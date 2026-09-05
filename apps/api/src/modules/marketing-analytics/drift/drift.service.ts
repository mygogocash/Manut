// DAU/MAU drift check — the daily audit that the two BNII readers still agree.
//
// Read-only against every source it touches, so a re-run is always safe. It
// writes exactly one thing: the fingerprint of the last finding set it alerted
// on, so a permanent upstream restatement doesn't re-email every morning.
import { logger } from "@/common/utils/logger";
import { prisma } from "@/infrastructure/database/prisma";
import { sendEmail } from "@/infrastructure/email/email.service";
import { crmTaskUpdateEmail } from "@/infrastructure/email/templates";
import { PORTAL_URL } from "@/lib/portal-url";
import { activePartnerMap } from "@/modules/marketing/bnii-partners";
import {
  compareStoredToUpstream,
  crossFootDashboard,
  DRIFT_METRICS,
  DRIFT_UNSETTLED_DAYS,
  DRIFT_WINDOW_DAYS,
  driftFingerprint,
  settledWindow,
  type StoredMetricRow,
  type UpstreamSeriesPoint,
} from "@/modules/marketing-analytics/drift/drift.check";
import type {
  DriftReport,
  StoreDriftFinding,
} from "@/modules/marketing-analytics/drift/drift.types";
import {
  getDriftRecipients,
  getDriftState,
  setDriftState,
} from "@/modules/marketing-analytics/drift/drift-recipients";
import { marketingAnalyticsService } from "@/modules/marketing-analytics/marketing-analytics.service";

const DASHBOARD_URL = `${PORTAL_URL}/marketing-analytics/dau-mau`;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

interface UpstreamQueryResult {
  partner_id?: string;
  series?: Array<{ date?: string; metrics?: Record<string, number | null> }>;
}

/**
 * Pull the settled window from BNII, keyed by telco slug.
 *
 * Returns `null` on a failed query rather than an empty array — the difference
 * decides whether the run reports drift or declares itself inconclusive.
 */
async function fetchUpstream(
  from: string,
  to: string,
  byUuid: Map<string, string>,
): Promise<UpstreamSeriesPoint[] | null> {
  try {
    const res = await marketingAnalyticsService.queryMetrics({
      dateFrom: from,
      dateTo: to,
      metrics: DRIFT_METRICS.map((m) => m.upstream),
    });
    const raw = res.data as { results?: UpstreamQueryResult[] };
    const results = Array.isArray(raw?.results) ? raw.results : [];
    const points: UpstreamSeriesPoint[] = [];
    for (const r of results) {
      const slug = r.partner_id ? byUuid.get(r.partner_id) : undefined;
      if (!slug) continue;
      for (const pt of r.series ?? []) {
        const date =
          typeof pt.date === "string" ? pt.date.slice(0, 10) : undefined;
        if (!date) continue;
        points.push({ telco: slug, date, metrics: pt.metrics ?? {} });
      }
    }
    return points;
  } catch (err) {
    logger.error(
      `Marketing drift: BNII query failed: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
    return null;
  }
}

async function fetchStored(
  from: string,
  to: string,
  telcos: string[],
): Promise<StoredMetricRow[]> {
  const rows = await prisma.owDailyMetric.findMany({
    where: {
      telco: { in: telcos },
      date: {
        gte: new Date(`${from}T00:00:00.000Z`),
        lte: new Date(`${to}T00:00:00.000Z`),
      },
    },
  });
  return rows.map((r) => {
    const bag = r as unknown as Record<string, unknown>;
    const values: Record<string, number | null> = {};
    for (const m of DRIFT_METRICS) {
      const v = bag[m.column];
      values[m.column] = typeof v === "number" ? v : null;
    }
    return {
      telco: r.telco,
      date: ymd(r.date),
      isIntraday: r.isIntraday,
      values,
    };
  });
}

function countBy(findings: StoreDriftFinding[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const f of findings) out[f.kind] = (out[f.kind] ?? 0) + 1;
  return out;
}

/** One-line, human-first description of what drifted. Escaped by the template. */
function summarize(report: DriftReport): string {
  const bits: string[] = [];
  const counts = countBy(report.store.findings);
  const label: Record<string, string> = {
    missing_row: "day(s) never ingested",
    unsettled_row: "day(s) still flagged intraday",
    missing_value: "value(s) missing from the store",
    orphan_value: "value(s) upstream no longer has",
    value_mismatch: "value(s) disagreeing with upstream",
  };
  for (const [kind, n] of Object.entries(counts)) {
    bits.push(`${n} ${label[kind] ?? kind}`);
  }
  if (report.crossFoot.findings.length > 0) {
    bits.push(
      `${report.crossFoot.findings.length} dashboard total(s) not equal to their parts`,
    );
  }
  const telcos = [...new Set(report.store.findings.map((f) => f.telco))];
  const scope = telcos.length > 0 ? ` across ${telcos.join(", ")}` : "";
  const worst = report.store.findings
    .filter((f) => f.kind === "value_mismatch")
    .sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0))[0];
  const example = worst
    ? ` Largest gap: ${worst.telco} ${worst.date} ${worst.metric} stored ${worst.stored?.toLocaleString("en-US")} vs upstream ${worst.upstream?.toLocaleString("en-US")}.`
    : "";
  return `${bits.join(", ")}${scope}, over ${report.window.from} to ${report.window.to}.${example}`;
}

export interface RunDriftCheckInput {
  /** Overrides "today" — test seam and manual backfill checks. */
  today?: string;
  days?: number;
  /** Send the email even when the fingerprint is unchanged. */
  force?: boolean;
  /** Compute and report, but never email. */
  dryRun?: boolean;
}

export async function runMarketingDriftCheck(
  input: RunDriftCheckInput = {},
): Promise<DriftReport> {
  const ranAt = new Date().toISOString();
  const win = settledWindow(
    input.today ?? todayUtc(),
    input.days ?? DRIFT_WINDOW_DAYS,
    DRIFT_UNSETTLED_DAYS,
  );
  const { byUuid } = activePartnerMap();
  const telcos = [...new Set(byUuid.values())];

  const base: DriftReport = {
    ranAt,
    window: {
      from: win.from,
      to: win.to,
      days: win.days,
      unsettledDays: win.unsettledDays,
    },
    inconclusive: false,
    reason: null,
    silentTelcos: [],
    store: { comparisons: 0, findings: [] },
    crossFoot: { checks: 0, findings: [] },
    fingerprint: "clean",
    emailed: false,
    emailSkippedReason: null,
    recipients: 0,
  };

  if (telcos.length === 0) {
    return {
      ...base,
      inconclusive: true,
      reason: "no partners configured",
      emailSkippedReason: "inconclusive",
    };
  }

  const upstream = await fetchUpstream(win.from, win.to, byUuid);
  if (upstream === null) {
    // An unreachable upstream is not evidence that our store is wrong.
    return {
      ...base,
      inconclusive: true,
      reason: "BNII query failed",
      emailSkippedReason: "inconclusive",
    };
  }
  if (upstream.length === 0) {
    return {
      ...base,
      inconclusive: true,
      reason: "BNII returned no data for the window",
      emailSkippedReason: "inconclusive",
    };
  }

  const stored = await fetchStored(win.from, win.to, telcos);
  const store = compareStoredToUpstream({
    dates: win.dates,
    telcos,
    stored,
    upstream,
  });

  // Cross-foot runs off one live dashboard build. A failure here must not sink
  // the store comparison, which is the half that catches ingest breakage.
  let crossFoot = {
    findings: [] as DriftReport["crossFoot"]["findings"],
    checks: 0,
  };
  try {
    const dash = await marketingAnalyticsService.dauMauDashboard({});
    crossFoot = crossFootDashboard(dash.data);
  } catch (err) {
    logger.error(
      `Marketing drift: dashboard cross-foot skipped: ${
        err instanceof Error ? err.message : String(err)
      }`,
    );
  }

  const fingerprint = driftFingerprint({
    store: store.findings,
    crossFoot: crossFoot.findings,
  });
  const report: DriftReport = {
    ...base,
    silentTelcos: store.silentTelcos,
    store: { comparisons: store.comparisons, findings: store.findings },
    crossFoot,
    fingerprint,
  };

  const total = store.findings.length + crossFoot.findings.length;
  if (total === 0) {
    // Clear the debounce so the NEXT occurrence alerts even if it is identical
    // to one already resolved.
    const prev = await getDriftState();
    if (prev.fingerprint && prev.fingerprint !== "clean") {
      await setDriftState({ fingerprint: "clean", notifiedAt: ranAt });
    }
    return { ...report, emailSkippedReason: "no drift" };
  }

  const prev = await getDriftState();
  if (!input.force && prev.fingerprint === fingerprint) {
    return { ...report, emailSkippedReason: "unchanged since last alert" };
  }
  if (input.dryRun) {
    return { ...report, emailSkippedReason: "dry run" };
  }

  const recipients = await getDriftRecipients();
  if (recipients.length === 0) {
    logger.warn(
      `Marketing drift: ${total} finding(s) but no recipients configured (SystemSetting marketing-analytics.drift_recipients)`,
    );
    return { ...report, emailSkippedReason: "no recipients configured" };
  }

  // Reuses the shipping CRM update template — a fresh templateId would fail
  // silently upstream with TEMPLATE_NOT_FOUND.
  const mail = crmTaskUpdateEmail({
    crmLabel: "Marketing Analytics",
    taskTitle: "DAU/MAU drift detected",
    projectName: `${win.from} → ${win.to} (${win.days} settled days)`,
    eventLabel: `${total} finding${total === 1 ? "" : "s"}`,
    summary: summarize(report),
    portalUrl: DASHBOARD_URL,
  });
  await sendEmail({ to: recipients, ...mail });
  await setDriftState({ fingerprint, notifiedAt: ranAt });
  logger.info("Marketing drift alert sent", {
    findings: total,
    recipients: recipients.length,
    fingerprint,
  });

  return { ...report, emailed: true, recipients: recipients.length };
}
