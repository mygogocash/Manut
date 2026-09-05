import type { Prisma } from "@nexora/database";

import {
  BadRequestException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { logger } from "@/common/utils/logger";
import { prisma } from "@/infrastructure/database/prisma";
import {
  activePartnerMap,
  PARTNER_BY_SLUG,
  PARTNER_BY_UUID,
} from "@/modules/marketing/bnii-partners";
import {
  ATLAS_SOURCE_LABELS,
  FIELD_BY_ID,
  requiredUpstreamKeys,
  shownRawFields,
} from "@/modules/marketing-analytics/atlas/atlas-fields";
import {
  ATLAS_CATALOG_VERSION,
  ATLAS_METRIC_CATEGORIES,
  workspaceMetrics,
} from "@/modules/marketing-analytics/atlas/atlas-metrics";
import { evaluateFormula } from "@/modules/marketing-analytics/atlas/metric-formula";
import {
  buildPartnerSeries,
  type DailyPoint,
  headline,
  roundHeadline,
  type SeriesByField,
} from "@/modules/marketing-analytics/atlas/partner-series";
import {
  type AccountConfig,
  type CampaignRow,
  computeDashboard,
  computeSessions,
  type DauPoint,
  ESTATE_KEY,
  resolveSessionsWindow,
  type SessionsPoint,
} from "@/modules/marketing-analytics/dau-mau.metrics";
import {
  applyHostBaseline,
  clearHostBaseline,
  getHostBaselineOverrides,
  type HostBaseline,
  setHostBaseline,
} from "@/modules/marketing-analytics/partner-host-baselines";

/**
 * Upstream accepts at most 30 metrics per query and the registry needs 31, so
 * requests are chunked. 20 keeps each call comfortably inside the limit.
 */
const UPSTREAM_CHUNK = 20;

/**
 * Thin wrapper over the external BNII Analytics API. Phase 1 integrates the
 * metrics *catalog* + *dictionary* (the source of truth for which metrics
 * exist and what they mean). Metric values / time-series are a later phase.
 *
 * Metrics are NEVER hardcoded here — everything is derived from the live
 * catalog/dictionary responses and normalised into one list the dashboard
 * and Raw Data Explorer consume.
 */
const API_BASE = (
  process.env.MARKETING_ANALYTICS_API_URL ||
  "https://bnii-analytics-api-epgxydm2fa-as.a.run.app"
).replace(/\/+$/, "");

/** Cache TTL for catalog/dictionary (they change rarely). */
const CACHE_TTL_MS = 10 * 60 * 1000;
const FETCH_TIMEOUT_MS = 10_000;
/** Metric values change daily — cache the query results for a shorter window. */
const QUERY_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Partner identity now lives in ONE registry shared with the OneWave ingest
 * (modules/marketing/bnii-partners.ts). This module used to keep its own copy
 * — a different default list, and a different reading of
 * MARKETING_ANALYTICS_PARTNER_IDS — which meant setting that variable in
 * either shape silently half-broke the system.
 */
export interface PartnerRef {
  name: string;
  id: string;
  country: string | null;
  subscribers: string | null;
  hostDau: number | null;
  hostMau: number | null;
  hostSessionSec: number | null;
}

function loadPartners(): (PartnerRef & { slug: string })[] {
  const { byUuid } = activePartnerMap();
  return [...byUuid.entries()].map(([uuid, slug]) => {
    const p = PARTNER_BY_UUID.get(uuid) ?? PARTNER_BY_SLUG.get(slug);
    return {
      slug,
      // An override may name a partner the registry doesn't know; fall back to
      // the slug rather than rendering a blank card.
      name: p?.name ?? slug,
      id: uuid,
      country: p?.country ?? null,
      subscribers: p?.subscribers ?? null,
      hostDau: p?.hostDau ?? null,
      hostMau: p?.hostMau ?? null,
      hostSessionSec: p?.hostSessionSec ?? null,
    };
  });
}

// ── Upstream response shapes ──
interface CatalogResponse {
  core_metrics?: string[];
  transaction_type_pattern?: string;
  transaction_type_fields?: string[];
  known_transaction_types?: string[];
}
interface DictionaryResponse {
  metrics?: Record<string, string>;
  transaction_type_field_descriptions?: Record<string, string>;
  known_transaction_type_descriptions?: Record<string, string>;
  transaction_type_pattern?: string;
  note?: string;
}

export type MetricGroup = "core" | "transaction-type" | "field";

export interface NormalizedMetric {
  key: string;
  label: string;
  description: string;
  group: MetricGroup;
}

export interface MetricsSnapshot {
  metrics: NormalizedMetric[];
  transactionTypePattern: string | null;
  note: string | null;
  fetchedAt: string;
}

interface CacheEntry {
  snapshot: MetricsSnapshot;
  expiresAt: number;
}

let cache: CacheEntry | null = null;

/** Prettify a raw metric key into a human label (dau -> "Dau", total_x -> "Total X"). */
function prettify(key: string): string {
  return key
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

async function fetchJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`Analytics API ${path} responded ${res.status}`);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${API_BASE}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(
        `Analytics API ${path} responded ${res.status} ${detail}`,
      );
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

const queryCache = new Map<string, { at: number; data: unknown }>();

function buildSnapshot(
  catalog: CatalogResponse,
  dict: DictionaryResponse,
): MetricsSnapshot {
  const metrics: NormalizedMetric[] = [];
  const dictMetrics = dict.metrics ?? {};
  const fieldDescriptions = dict.transaction_type_field_descriptions ?? {};
  const typeDescriptions = dict.known_transaction_type_descriptions ?? {};

  for (const key of catalog.core_metrics ?? []) {
    metrics.push({
      key,
      label: prettify(key),
      description: dictMetrics[key] ?? "",
      group: "core",
    });
  }
  for (const key of catalog.known_transaction_types ?? []) {
    metrics.push({
      key,
      label: prettify(key),
      description: typeDescriptions[key] ?? "",
      group: "transaction-type",
    });
  }
  for (const key of catalog.transaction_type_fields ?? []) {
    metrics.push({
      key,
      label: prettify(key),
      description: fieldDescriptions[key] ?? "",
      group: "field",
    });
  }

  return {
    metrics,
    transactionTypePattern:
      catalog.transaction_type_pattern ?? dict.transaction_type_pattern ?? null,
    note: dict.note ?? null,
    fetchedAt: new Date().toISOString(),
  };
}

async function loadSnapshot(force = false): Promise<MetricsSnapshot> {
  if (!force && cache && cache.expiresAt > Date.now()) {
    return cache.snapshot;
  }
  const [catalog, dict] = await Promise.all([
    fetchJson<CatalogResponse>("/v1/metrics/catalog"),
    fetchJson<DictionaryResponse>("/v1/metrics/dictionary"),
  ]);
  const snapshot = buildSnapshot(catalog, dict);
  cache = { snapshot, expiresAt: Date.now() + CACHE_TTL_MS };
  return snapshot;
}

const GROUPS: MetricGroup[] = ["core", "transaction-type", "field"];

// ── Holistic Overview narrative content ──────────────────────────────────────
// The overview's data-driven sections (cumulative users, composition, org
// rollup) are computed live client-side from BNII + the campaign CRM. The two
// analysis sections — cross-telco "shared vs unique" learnings and org-level
// macro advice — have no data feed, so they're stored as ONE admin-editable
// SystemSetting row with a seeded default (mirrors the payslip company block).
const OVERVIEW_CONTENT_KEY = "marketing.overview_content";

export interface OverviewLearning {
  tag: string;
  text: string;
}
export interface OverviewPlay {
  step: string;
  title: string;
  text: string;
}
export interface OverviewContent {
  learningsShared: OverviewLearning[];
  learningsPerTelco: Record<string, string[]>;
  macroHeadline: string;
  macroBody: string;
  macroPlays: OverviewPlay[];
}

const DEFAULT_OVERVIEW_CONTENT: OverviewContent = {
  learningsShared: [
    {
      tag: "SMS",
      text: "SMS is the heaviest single conversion lever in every account that has tracked it.",
    },
    {
      tag: "Direct deep-link",
      text: "Levers that drop users straight into the campaign consistently out-perform multi-hop journeys.",
    },
    {
      tag: "Closing nudge",
      text: "A final-hour push or notification at campaign close lifts last-chance entries wherever tested.",
    },
  ],
  learningsPerTelco: {
    Dialog: [
      "Splash Banner converts 5-10% of DAU — strongest banner format measured.",
      "Push baseline benchmark: 0.30% of DAU (network reference rate).",
    ],
    U9: [
      "Largest organic acquisition footprint without active campaigning.",
      "Underleveraged: no SMS, social, or banner campaigns tested yet.",
    ],
  },
  macroHeadline:
    "Replicate the proven bonanza playbook on the highest-value untapped account next.",
  macroBody:
    "A multi-day window with SMS + push + social converts cold telco users into repeat OneWave users at scale. Prioritise the account with the largest MAU and existing engagement infrastructure that has not yet run the full format.",
  macroPlays: [
    {
      step: "PLAY 1",
      title: "Port the format",
      text: "Run the full bonanza structure: multi-day window, SMS + push at start, daily mini-rewards, social anticipation, closing push.",
    },
    {
      step: "PLAY 2",
      title: "Standardise tracking",
      text: "Make STW, Access Pass conversions, and BNRY earned/redeemed mandatory fields across all telcos.",
    },
    {
      step: "PLAY 3",
      title: "Test levers first",
      text: "Before a bonanza on a new market, test SMS and social independently to confirm conversion rates.",
    },
  ],
};

function normalizeLearnings(v: unknown): OverviewLearning[] | null {
  if (!Array.isArray(v)) return null;
  const out: OverviewLearning[] = [];
  for (const item of v) {
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      if (typeof o.tag === "string" && typeof o.text === "string") {
        out.push({ tag: o.tag, text: o.text });
      }
    }
  }
  return out;
}
function normalizePlays(v: unknown): OverviewPlay[] | null {
  if (!Array.isArray(v)) return null;
  const out: OverviewPlay[] = [];
  for (const item of v) {
    if (item && typeof item === "object") {
      const o = item as Record<string, unknown>;
      if (
        typeof o.step === "string" &&
        typeof o.title === "string" &&
        typeof o.text === "string"
      ) {
        out.push({ step: o.step, title: o.title, text: o.text });
      }
    }
  }
  return out;
}
function normalizePerTelco(v: unknown): Record<string, string[]> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const out: Record<string, string[]> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (Array.isArray(val)) {
      out[k] = val.filter((x): x is string => typeof x === "string");
    }
  }
  return out;
}

export class MarketingAnalyticsService {
  /** Raw upstream catalog (proxied, with lastSync). */
  async getCatalog() {
    const snapshot = await loadSnapshot();
    return { data: snapshot, meta: { lastSyncedAt: snapshot.fetchedAt } };
  }

  /** Force a re-fetch (Refresh button). */
  async refresh() {
    const snapshot = await loadSnapshot(true);
    return { data: { lastSyncedAt: snapshot.fetchedAt } };
  }

  /** Dashboard summary — counts by group + metadata (dynamic, from catalog). */
  async dashboard() {
    let snapshot: MetricsSnapshot;
    try {
      snapshot = await loadSnapshot();
    } catch (err) {
      logger.error("Marketing analytics: failed to load catalog", {
        error: err,
      });
      throw err;
    }
    const byGroup = GROUPS.map((group) => ({
      group,
      count: snapshot.metrics.filter((m) => m.group === group).length,
    }));
    return {
      data: {
        totalMetrics: snapshot.metrics.length,
        byGroup,
        transactionTypePattern: snapshot.transactionTypePattern,
        note: snapshot.note,
        lastSyncedAt: snapshot.fetchedAt,
      },
    };
  }

  /**
   * Paginated + searchable + group-filtered metric list for the Raw Data
   * Explorer. Filtering/paging happen server-side over the full catalog so
   * the client never reduces a partial page.
   */
  async listMetrics(query: {
    page?: number;
    limit?: number;
    search?: string;
    group?: string;
  }) {
    if (query.group && !GROUPS.includes(query.group as MetricGroup)) {
      throw new BadRequestException("Invalid metric group");
    }
    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const snapshot = await loadSnapshot();
    let rows = snapshot.metrics;
    if (query.group) rows = rows.filter((m) => m.group === query.group);
    if (query.search) {
      const q = query.search.toLowerCase();
      rows = rows.filter(
        (m) =>
          m.key.toLowerCase().includes(q) ||
          m.label.toLowerCase().includes(q) ||
          m.description.toLowerCase().includes(q),
      );
    }
    const total = rows.length;
    const start = (page - 1) * limit;
    return {
      data: rows.slice(start, start + limit),
      meta: { page, limit, total, lastSyncedAt: snapshot.fetchedAt },
    };
  }

  /** Configured telco partners (name + BNII UUID) for scoped metric queries. */
  /**
   * Partner cards. Host MAU/DAU come from the hardcoded registry, with any
   * admin override layered on top — see partner-host-baselines.ts for why a
   * stored null is meaningful and differs from an absent slug.
   */
  async listPartners() {
    const overrides = await getHostBaselineOverrides();
    return {
      data: loadPartners().map((p) => applyHostBaseline(p, p.slug, overrides)),
    };
  }

  /** Admin write: set one partner's host baseline. */
  async setPartnerHostBaseline(slug: string, baseline: HostBaseline) {
    if (![...PARTNER_BY_SLUG.keys()].some((k) => String(k) === slug)) {
      throw new NotFoundException(`Unknown partner "${slug}"`);
    }
    await setHostBaseline(slug, baseline);
    return this.listPartners();
  }

  /** Admin write: drop the override, restoring the hardcoded constant. */
  async clearPartnerHostBaseline(slug: string) {
    if (![...PARTNER_BY_SLUG.keys()].some((k) => String(k) === slug)) {
      throw new NotFoundException(`Unknown partner "${slug}"`);
    }
    await clearHostBaseline(slug);
    return this.listPartners();
  }

  /** Resolve a partner id (or default to the first configured telco). */
  private resolvePartner(partnerId?: string): PartnerRef {
    const partners = loadPartners();
    const partner = partnerId
      ? partners.find((p) => p.id === partnerId)
      : partners[0];
    if (!partner) {
      throw new BadRequestException(
        partnerId
          ? "Unknown telco partner"
          : "No telco partner IDs configured. Set MARKETING_ANALYTICS_PARTNER_IDS.",
      );
    }
    return partner;
  }

  /**
   * One partner's daily series for every Atlas raw field.
   *
   * The registry needs 31 distinct upstream keys, one more than a single
   * `/v1/metrics/query` accepts, so the request is chunked and the per-day
   * metric objects merged back together before mapping.
   *
   * Best-effort: on upstream failure it returns whatever chunks succeeded plus
   * the error, so a partial feed still renders instead of blanking the page.
   */
  private async loadPartnerDaily(
    partner: PartnerRef,
    days: number,
  ): Promise<{
    series: SeriesByField;
    dateFrom: string;
    dateTo: string;
    error: string | null;
  }> {
    const toYmd = (d: Date) => d.toISOString().slice(0, 10);
    const now = new Date();
    const dateTo = toYmd(now);
    const dateFrom = toYmd(new Date(now.getTime() - (days - 1) * 86400000));

    const keys = requiredUpstreamKeys();
    const chunks: string[][] = [];
    for (let i = 0; i < keys.length; i += UPSTREAM_CHUNK) {
      chunks.push(keys.slice(i, i + UPSTREAM_CHUNK));
    }

    interface ChunkResult {
      series: Array<{ date?: string; metrics?: Record<string, number | null> }>;
      error: string | null;
    }

    // The chunks are independent upstream reads — issue them together rather
    // than paying each one's timeout in series.
    const settled = await Promise.all(
      chunks.map(async (metrics): Promise<ChunkResult> => {
        try {
          const res = await this.queryMetrics({
            dateFrom,
            dateTo,
            metrics,
            partnerIds: [partner.id],
          });
          const raw = res.data as {
            results?: Array<{
              partner_id?: string;
              series?: Array<{
                date?: string;
                metrics?: Record<string, number | null>;
              }>;
            }>;
          };
          const match = (raw?.results ?? []).find(
            (r) => r.partner_id === partner.id,
          );
          return { series: match?.series ?? [], error: null };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          logger.error(
            `Marketing partner series: BNII query failed: ${message}`,
          );
          return { series: [], error: message };
        }
      }),
    );

    // Merge day by day. A failed chunk contributes only its message, so the
    // fields that did land still render.
    const byDate = new Map<string, Record<string, number | null>>();
    let error: string | null = null;
    for (const chunk of settled) {
      if (chunk.error && !error) error = chunk.error;
      for (const pt of chunk.series) {
        if (typeof pt.date !== "string") continue;
        const date = pt.date.slice(0, 10);
        byDate.set(date, {
          ...(byDate.get(date) ?? {}),
          ...(pt.metrics ?? {}),
        });
      }
    }

    const points: DailyPoint[] = [...byDate.entries()].map(
      ([date, metrics]) => ({ date, metrics }),
    );
    return { series: buildPartnerSeries(points), dateFrom, dateTo, error };
  }

  /**
   * Raw Data explorer, scoped to ONE telco partner: the 31 Atlas fields with
   * their window headline, upstream source and live/no-data status.
   */
  async rawFields(input: { partnerId?: string; days?: number }) {
    const partner = this.resolvePartner(input.partnerId);
    const days = input.days ?? 30;
    const { series, dateFrom, dateTo, error } = await this.loadPartnerDaily(
      partner,
      days,
    );

    const fields = shownRawFields().map((f) => {
      const values = f.bnii ? series[f.bnii] : undefined;
      const value = roundHeadline(headline(values, f.agg), f.agg);
      return {
        // Atlas shows its ingest field name as the FIELD ID, not the
        // canonical catalog id — mirror that so the consoles agree.
        fieldId: f.bnii ?? f.id,
        canonicalId: f.id,
        label: f.label,
        source: f.source,
        sourceLabel: ATLAS_SOURCE_LABELS[f.source],
        agg: f.agg,
        value,
        days: values?.length ?? 0,
        status: value === null ? ("no-data" as const) : ("live" as const),
        note: f.note ?? null,
      };
    });

    return {
      data: {
        partner,
        fields,
        liveCount: fields.filter((f) => f.status === "live").length,
        totalCount: fields.length,
        dateFrom,
        dateTo,
        days,
      },
      meta: {
        partners: loadPartners(),
        error,
        fetchedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Canonical metrics catalog evaluated against ONE partner's daily series.
   *
   * "Live" is not a stored flag — a metric is live only when its formula
   * evaluates without throwing, so the count differs per partner and per day.
   * Metrics that can never compute (band()/count() composites, the cohort
   * category BNII does not feed) are still returned, at no-data, exactly as
   * Atlas renders them.
   *
   * `days` defaults to 120 so the 30-day windows and `[t-30]` lookbacks the
   * catalog uses have enough history to resolve.
   */
  async partnerMetrics(input: { partnerId?: string; days?: number }) {
    const partner = this.resolvePartner(input.partnerId);
    const days = input.days ?? 120;
    const { series, dateFrom, dateTo, error } = await this.loadPartnerDaily(
      partner,
      days,
    );

    // Formulas reference the CANONICAL id; the series are keyed by Atlas field
    // name. A field with no BNII source resolves to null and yields no-data.
    const lookup = (canonicalId: string): number[] | null => {
      const field = FIELD_BY_ID.get(canonicalId);
      if (!field?.bnii) return null;
      return series[field.bnii] ?? null;
    };

    const metrics = workspaceMetrics().map((m) => {
      const value = evaluateFormula(m.formula, lookup);
      return {
        id: m.id,
        category: m.category,
        name: m.name,
        formula: m.formula,
        meaning: m.meaning,
        unit: m.unit,
        healthy: m.healthy,
        warning: m.warning,
        critical: m.critical,
        value,
        status: value === null ? ("no-data" as const) : ("live" as const),
      };
    });

    const categories = ATLAS_METRIC_CATEGORIES.map((c) => {
      const rows = metrics.filter((m) => m.category === c.id);
      return {
        id: c.id,
        name: c.name,
        order: c.order,
        total: rows.length,
        live: rows.filter((m) => m.status === "live").length,
      };
    }).filter((c) => c.total > 0);

    return {
      data: {
        partner,
        categories,
        metrics,
        liveCount: metrics.filter((m) => m.status === "live").length,
        totalCount: metrics.length,
        catalogVersion: ATLAS_CATALOG_VERSION,
        dateFrom,
        dateTo,
        days,
      },
      meta: {
        partners: loadPartners(),
        error,
        fetchedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * Query metric VALUES / time-series from the BNII API
   * (`POST /v1/metrics/query`). `partner_ids` is required upstream; when the
   * caller omits it we default to every configured partner. Cached briefly.
   */
  async queryMetrics(input: {
    dateFrom?: string;
    dateTo?: string;
    metrics?: string[];
    partnerIds?: string[];
  }) {
    if (!input.dateFrom || !input.dateTo || !input.metrics?.length) {
      throw new BadRequestException(
        "dateFrom, dateTo, and metrics are required",
      );
    }
    const partners = loadPartners();
    const partnerIds =
      input.partnerIds && input.partnerIds.length > 0
        ? input.partnerIds
        : partners.map((p) => p.id);
    if (partnerIds.length === 0) {
      throw new BadRequestException(
        "No telco partner IDs configured. Set MARKETING_ANALYTICS_PARTNER_IDS.",
      );
    }
    const body = {
      date_from: input.dateFrom,
      date_to: input.dateTo,
      metrics: input.metrics,
      partner_ids: partnerIds.slice(0, 9),
    };
    const cacheKey = JSON.stringify(body);
    const hit = queryCache.get(cacheKey);
    if (hit && Date.now() - hit.at < QUERY_CACHE_TTL_MS) {
      return { data: hit.data, meta: { partners } };
    }
    const data = await postJson<unknown>("/v1/metrics/query", body);
    queryCache.set(cacheKey, { at: Date.now(), data });
    return { data, meta: { partners } };
  }

  /** Read the admin-editable overview narrative (falls back to the default). */
  async getOverviewContent(): Promise<OverviewContent> {
    const row = await prisma.systemSetting.findUnique({
      where: { key: OVERVIEW_CONTENT_KEY },
    });
    const value = row?.value;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const v = value as Record<string, unknown>;
      return {
        learningsShared:
          normalizeLearnings(v.learningsShared) ??
          DEFAULT_OVERVIEW_CONTENT.learningsShared,
        learningsPerTelco:
          normalizePerTelco(v.learningsPerTelco) ??
          DEFAULT_OVERVIEW_CONTENT.learningsPerTelco,
        macroHeadline:
          typeof v.macroHeadline === "string"
            ? v.macroHeadline
            : DEFAULT_OVERVIEW_CONTENT.macroHeadline,
        macroBody:
          typeof v.macroBody === "string"
            ? v.macroBody
            : DEFAULT_OVERVIEW_CONTENT.macroBody,
        macroPlays:
          normalizePlays(v.macroPlays) ?? DEFAULT_OVERVIEW_CONTENT.macroPlays,
      };
    }
    return DEFAULT_OVERVIEW_CONTENT;
  }

  /** Admin upsert of the overview narrative content. */
  async setOverviewContent(input: {
    learningsShared?: Array<{ tag?: string; text?: string }>;
    learningsPerTelco?: Record<string, string[]>;
    macroHeadline?: string;
    macroBody?: string;
    macroPlays?: Array<{ step?: string; title?: string; text?: string }>;
  }): Promise<OverviewContent> {
    const content: OverviewContent = {
      learningsShared: (input.learningsShared ?? []).map((l) => ({
        tag: l.tag ?? "",
        text: l.text ?? "",
      })),
      learningsPerTelco: input.learningsPerTelco ?? {},
      macroHeadline: input.macroHeadline ?? "",
      macroBody: input.macroBody ?? "",
      macroPlays: (input.macroPlays ?? []).map((p) => ({
        step: p.step ?? "",
        title: p.title ?? "",
        text: p.text ?? "",
      })),
    };
    const value = content as unknown as Prisma.InputJsonValue;
    await prisma.systemSetting.upsert({
      where: { key: OVERVIEW_CONTENT_KEY },
      create: { key: OVERVIEW_CONTENT_KEY, value },
      update: { value },
    });
    return content;
  }

  /**
   * OneWave DAU→MAU analytics (the workbook exhibits) computed server-side over
   * the live BNII daily series + each telco's host MAU (accessible base) +
   * campaign dates. Read-only, no persistence; the pure engine lives in
   * dau-mau.metrics.ts (unit-tested against the workbook's numbers).
   *
   * Campaign days are inferred at the COUNTRY level — MktCampaign only carries a
   * country, so telcos sharing a country share campaign-day flags (best-effort;
   * surfaced as a caveat in the UI). Estate totals exclude Okara (workbook rule).
   */
  async dauMauDashboard(input: {
    dateFrom?: string;
    dateTo?: string;
    dauMetric?: string;
    asOf?: string;
    forecastDate?: string;
    /** Accounts counted towards the totals; absent = every account. */
    accounts?: string[];
  }) {
    const partners = loadPartners();
    // GA4 DAU on the live BNII API is `dau_ga` (Atlas stores it as unique_users);
    // `unique_users` is an Atlas field, not a BNII query key. Default to dau_ga
    // and coalesce with unique_users so either API state yields a value.
    // Source of truth: Atlas repo atlas-prod/app/services/bnii_ingest.py.
    const dauMetric = input.dauMetric?.trim() || "dau_ga";
    // Sessions = the metric that replaced GA "sessions" (BNII renamed
    // total_user_sessions → total_views_homepage, 2026-06-10).
    const SESSIONS_METRIC = "total_views_homepage";
    const toYmd = (d: Date) => d.toISOString().slice(0, 10);
    const now = new Date();
    const dateTo = input.dateTo || toYmd(now);
    const dateFrom =
      input.dateFrom || toYmd(new Date(now.getTime() - 120 * 86400000));

    // The Sessions exhibit follows the picked range instead of a fixed 28 days,
    // and the fetch reaches one window further back so it has a baseline to
    // compare against. `fetchFrom` is a pre-roll for that comparison ONLY — it
    // must not reach the DAU index, or Lifetime / Explorer / Trends would
    // silently start reporting on days outside the range the page says it is
    // showing.
    const sessionsWindow = resolveSessionsWindow({
      requestedFrom: input.dateFrom,
      dateFrom,
      dateTo,
    });

    // Live per-telco daily series from BNII (reuses the cached query path).
    let results: Array<{
      partner_id?: string;
      telco_name?: string | null;
      series?: Array<{
        date?: string;
        metrics?: Record<string, number | null>;
      }>;
    }> = [];
    try {
      const res = await this.queryMetrics({
        dateFrom: sessionsWindow.fetchFrom,
        dateTo,
        metrics: Array.from(
          new Set([dauMetric, "unique_users", SESSIONS_METRIC]),
        ),
      });
      const raw = res.data as { results?: unknown };
      if (raw && Array.isArray(raw.results)) {
        results = raw.results as typeof results;
      }
    } catch (err) {
      // A flaky upstream never blanks the page — return an empty dataset.
      logger.error(
        `DAU/MAU dashboard: BNII query failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    const byId = new Map(partners.map((p) => [p.id, p]));
    /**
     * Which accounts count towards the totals.
     *
     * This used to be `!/okara/i.test(p.name)` — Okara's exclusion was a name
     * test compiled into the service, so the only way to total a different set
     * of telcos was to edit and redeploy. The page now asks for a set, and
     * unknown keys are dropped rather than 400ing: a saved link naming a
     * partner that has since left the registry should still render.
     *
     * ESTATE_KEY is never a member. It is the reserved key for the estate
     * series BNII may enter separately, not a telco, and the exhibits already
     * treat it as the total rather than a row.
     */
    const requested = input.accounts?.length
      ? new Set(input.accounts)
      : new Set(partners.map((p) => p.id));
    const isMember = (id: string) => id !== ESTATE_KEY && requested.has(id);
    const accounts: AccountConfig[] = partners.map((p, i) => ({
      key: p.id,
      label: p.name,
      accessibleMau: p.hostMau,
      includeInEstate: isMember(p.id),
      sortOrder: i,
    }));
    const selectedAccounts = accounts
      .filter((a) => a.includeInEstate)
      .map((a) => a.key);

    // Campaign dates (by country) → per-telco campaign-day flags.
    const campaignRows = await prisma.mktCampaign.findMany({
      where: {
        archivedAt: null,
        campaignDate: {
          gte: new Date(`${dateFrom}T00:00:00.000Z`),
          lte: new Date(`${dateTo}T00:00:00.000Z`),
        },
      },
      select: {
        name: true,
        campaignDate: true,
        country: true,
        // Explicit BNII partner link (preferred over country attribution).
        partnerId: true,
        // Structured levers (multi-select) → the Campaign Index "Levers" column.
        levers: { select: { lever: { select: { name: true } } } },
      },
    });
    // A campaign with an explicit partnerId is attributed to exactly that
    // partner; one without falls back to a country match (legacy rows).
    const datesByPartner = new Map<string, Set<string>>();
    const datesByCountry = new Map<string, Set<string>>();
    for (const c of campaignRows) {
      const ymd = toYmd(c.campaignDate);
      if (c.partnerId) {
        const set = datesByPartner.get(c.partnerId) ?? new Set<string>();
        set.add(ymd);
        datesByPartner.set(c.partnerId, set);
        continue;
      }
      if (!c.country) continue;
      const key = c.country.trim().toLowerCase();
      const set = datesByCountry.get(key) ?? new Set<string>();
      set.add(ymd);
      datesByCountry.set(key, set);
    }
    const campaignDayFor = (partnerId: string, ymd: string): boolean => {
      if (datesByPartner.get(partnerId)?.has(ymd)) return true;
      const country = byId.get(partnerId)?.country?.trim().toLowerCase();
      return country ? (datesByCountry.get(country)?.has(ymd) ?? false) : false;
    };

    const num = (v: number | null | undefined): number | null =>
      typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;
    const points: DauPoint[] = [];
    const sessionPoints: SessionsPoint[] = [];
    for (const r of results) {
      const pid = r.partner_id;
      if (!pid || !byId.has(pid)) continue;
      for (const pt of r.series ?? []) {
        const date = typeof pt.date === "string" ? pt.date.slice(0, 10) : null;
        if (!date) continue;
        sessionPoints.push({
          accountKey: pid,
          date,
          sessions: num(pt.metrics?.[SESSIONS_METRIC]),
        });
        // Pre-roll days exist only to give the sessions comparison a baseline.
        if (date < dateFrom) continue;
        // Coalesce the chosen DAU metric with unique_users (either API state).
        const dau = num(pt.metrics?.[dauMetric] ?? pt.metrics?.unique_users);
        points.push({
          accountKey: pid,
          date,
          dau,
          isCampaignDay: campaignDayFor(pid, date),
        });
      }
    }

    // Attach each campaign to its telco (Campaign Index). An explicit partnerId
    // wins; otherwise attribute to every telco sharing the campaign's country.
    const campaigns: CampaignRow[] = campaignRows.flatMap((c) => {
      const country = c.country?.trim().toLowerCase();
      const ymd = toYmd(c.campaignDate);
      const levers = c.levers
        .map((cl) => cl.lever?.name)
        .filter((n): n is string => !!n);
      const matched = c.partnerId
        ? partners.filter((p) => p.id === c.partnerId)
        : partners.filter(
            (p) => !!country && p.country?.trim().toLowerCase() === country,
          );
      return matched.map((p) => ({
        accountKey: p.id,
        name: c.name,
        startDate: ymd,
        endDate: ymd,
        placements: levers,
      }));
    });

    const dashboard = computeDashboard({
      points,
      accounts,
      campaigns,
      asOf: input.asOf ?? null,
      forecastDate: input.forecastDate ?? null,
    });
    const sessions = computeSessions(
      sessionPoints,
      accounts,
      dashboard.asOf,
      sessionsWindow.windowDays,
    );
    return {
      data: {
        ...dashboard,
        sessions,
        dauMetric,
        sessionsMetric: SESSIONS_METRIC,
        dateFrom,
        dateTo,
        // Echoed like the resolved date window: the page renders what it got
        // back rather than what it asked for, so a dropped unknown key shows up
        // as an unchecked box instead of a silent disagreement.
        selectedAccounts,
      },
      meta: { partners },
    };
  }
}

export const marketingAnalyticsService = new MarketingAnalyticsService();
