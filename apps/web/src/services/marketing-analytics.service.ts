import { api } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api.type";

export type MetricGroup = "core" | "transaction-type" | "field";

export const METRIC_GROUP_LABELS: Record<MetricGroup, string> = {
  core: "Core Metric",
  "transaction-type": "Transaction Type",
  field: "Field",
};

export interface MarketingMetric {
  key: string;
  label: string;
  description: string;
  group: MetricGroup;
}

export interface MarketingDashboard {
  totalMetrics: number;
  byGroup: Array<{ group: MetricGroup; count: number }>;
  transactionTypePattern: string | null;
  note: string | null;
  lastSyncedAt: string;
}

export interface MetricsPage {
  data: MarketingMetric[];
  meta: {
    page: number;
    limit: number;
    total: number;
    lastSyncedAt: string;
  };
}

function qs(params: Record<string, string | number | undefined>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function getMarketingDashboard() {
  return api.get<ApiSuccessResponse<MarketingDashboard>>(
    "/marketing-analytics/dashboard",
  );
}

export function refreshMarketingAnalytics() {
  return api.post<ApiSuccessResponse<{ lastSyncedAt: string }>>(
    "/marketing-analytics/refresh",
  );
}

export function listMarketingMetrics(query: {
  page?: number;
  limit?: number;
  search?: string;
  group?: MetricGroup;
}): Promise<MetricsPage> {
  return api.get(`/marketing-analytics/metrics${qs(query)}`);
}

// ── Metric values / time-series (per telco) ──

export interface MarketingPartner {
  name: string;
  id: string;
  country: string | null;
  subscribers: string | null;
  hostDau: number | null;
  hostMau: number | null;
  hostSessionSec: number | null;
}

/** One day's metric point for one partner. Values may be null when untracked. */
export interface MetricSeriesPoint {
  date: string;
  metrics: Record<string, number | null>;
}

export interface PartnerSeries {
  partner_id: string;
  telco_name: string | null;
  series: MetricSeriesPoint[];
}

export interface MetricsQueryResult {
  date_from: string;
  date_to: string;
  results: PartnerSeries[];
}

export interface MetricsQueryBody {
  dateFrom: string;
  dateTo: string;
  metrics: string[];
  partnerIds?: string[];
}

/** Telco partners configured for scoped metric queries (name + BNII UUID). */
export function listMarketingPartners() {
  return api.get<ApiSuccessResponse<MarketingPartner[]>>(
    "/marketing-analytics/partners",
  );
}

// BNII renamed its GA4-sourced metric keys (Rahul, Jun–Jul 2026): the pages
// still request the legacy ids (unique_users / new_users / repeated_users) but
// the live BNII API now serves dau_ga / new_users_ga / repeated_users_ga
// (source of truth: the Atlas repo's atlas-prod/app/services/bnii_ingest.py
// METRIC_MAP). Request the current names and alias the response back to the
// legacy ids so every caller/page keeps working unchanged. Additive: a legacy
// value is only filled from its *_ga source when the legacy key is absent, so a
// genuinely-legacy response is never overwritten.
const BNII_METRIC_ALIASES: Record<string, string> = {
  unique_users: "dau_ga",
  new_users: "new_users_ga",
  repeated_users: "repeated_users_ga",
};

/** Query metric values / daily time-series per telco from the BNII API. */
export async function queryMarketingMetrics(
  body: MetricsQueryBody,
): Promise<ApiSuccessResponse<MetricsQueryResult>> {
  const metrics = Array.from(
    new Set(body.metrics.map((m) => BNII_METRIC_ALIASES[m] ?? m)),
  );
  const res = await api.post<ApiSuccessResponse<MetricsQueryResult>>(
    "/marketing-analytics/metrics/query",
    { ...body, metrics },
  );
  for (const series of res.data?.results ?? []) {
    for (const pt of series.series ?? []) {
      if (!pt.metrics) continue;
      for (const [legacy, current] of Object.entries(BNII_METRIC_ALIASES)) {
        if (pt.metrics[legacy] == null && pt.metrics[current] != null) {
          pt.metrics[legacy] = pt.metrics[current];
        }
      }
    }
  }
  return res;
}

// ── Raw Data: per-partner field breakdown ──

export type RawFieldSource =
  "time" | "ga4" | "binaryos" | "stw" | "bnry" | "bnrymart";

export type RawFieldAgg = "sum" | "avg" | "last";

/** How each window figure was derived — shown as a hint in the value column. */
export const RAW_AGGREGATION_LABELS: Record<RawFieldAgg, string> = {
  sum: "Window total",
  avg: "Daily average over reporting days",
  last: "Latest reported day",
};

export interface MarketingRawField {
  /** Atlas ingest field name — what the FIELD ID column shows. */
  fieldId: string;
  /** Canonical catalog id — what metric formulas reference. */
  canonicalId: string;
  label: string;
  source: RawFieldSource;
  sourceLabel: string;
  agg: RawFieldAgg;
  value: number | null;
  /** Days inside the window that reported a value for this field. */
  days: number;
  status: "live" | "no-data";
  note: string | null;
}

export interface MarketingRawFields {
  partner: MarketingPartner;
  fields: MarketingRawField[];
  liveCount: number;
  totalCount: number;
  dateFrom: string;
  dateTo: string;
  days: number;
}

export interface MarketingRawFieldsResponse {
  data: MarketingRawFields;
  meta: {
    partners: MarketingPartner[];
    /** Upstream failure message; fields still come back, all at no-data. */
    error: string | null;
    fetchedAt: string;
  };
}

/** Per-partner raw field breakdown (field id / label / source / value / status). */
export function getMarketingRawFields(query: {
  partnerId?: string;
  days?: number;
}) {
  return api.get<MarketingRawFieldsResponse>(
    `/marketing-analytics/raw-fields${qs(query)}`,
  );
}

// ── Metrics: the canonical catalog evaluated per partner ──

export interface MarketingMetricCategory {
  id: string;
  name: string;
  order: number;
  total: number;
  live: number;
}

export interface MarketingPartnerMetric {
  id: string;
  category: string;
  name: string;
  formula: string;
  meaning: string;
  unit: string;
  healthy: string;
  warning: string;
  critical: string;
  value: number | null;
  status: "live" | "no-data";
}

export interface MarketingPartnerMetrics {
  partner: MarketingPartner;
  categories: MarketingMetricCategory[];
  metrics: MarketingPartnerMetric[];
  liveCount: number;
  totalCount: number;
  catalogVersion: string;
  dateFrom: string;
  dateTo: string;
  days: number;
}

export interface MarketingPartnerMetricsResponse {
  data: MarketingPartnerMetrics;
  meta: {
    partners: MarketingPartner[];
    error: string | null;
    fetchedAt: string;
  };
}

/**
 * Canonical metrics catalog evaluated for one partner. A metric is "live" only
 * when its formula resolves against that partner's series, so the live count
 * differs per partner — it is not a property of the catalog.
 */
export function getPartnerMetrics(query: {
  partnerId?: string;
  days?: number;
}) {
  return api.get<MarketingPartnerMetricsResponse>(
    `/marketing-analytics/partner-metrics${qs(query)}`,
  );
}

/** Format a metric value for display, respecting its unit. */
// Value formatting lives with the other presentation helpers, in
// app/(dashboard)/marketing-analytics/partners/partner-ui.ts — this module is
// the transport layer and shouldn't own display concerns.

// ── Holistic Overview narrative content (admin-editable) ──

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

export function getOverviewContent() {
  return api.get<ApiSuccessResponse<OverviewContent>>(
    "/marketing-analytics/overview/content",
  );
}
export function updateOverviewContent(content: OverviewContent) {
  return api.put<ApiSuccessResponse<OverviewContent>>(
    "/marketing-analytics/overview/content",
    content,
  );
}

// ── DAU→MAU analytics (OneWave workbook exhibits, computed server-side) ──

export type MaDirection = "up" | "down" | "flat";

export interface MaAccountConfig {
  key: string;
  label: string;
  accessibleMau: number | null;
  includeInEstate: boolean;
  sortOrder: number;
}
export interface MaLifetimeRow {
  accountKey: string;
  label: string;
  totalSessions: number | null;
  averageSessions: number | null;
  peakSessions: number | null;
  peakDate: string | null;
  dauOnAsOf: number | null;
  shareOfTotal: number | null;
}
export interface MaRollingRow {
  accountKey: string;
  label: string;
  last3Avg: number | null;
  prior3Avg: number | null;
  change: number | null;
  pctChange: number | null;
  direction: MaDirection | null;
}
export interface MaMonthlyCell {
  accountKey: string;
  label: string;
  mau: number | null;
  daysEntered: number;
  capture: number | null;
  monthEndForecast: number | null;
  forecastCapture: number | null;
}
export interface MaMonthlyBlock {
  month: string;
  daysInMonth: number;
  accounts: MaMonthlyCell[];
  estate: MaMonthlyCell;
  sumOfAccounts: number | null;
  unattributed: number | null;
}
export interface MaForecastRow {
  accountKey: string;
  label: string;
  organicBaseline: number | null;
  tickedDays: number;
  campaignAvg: number | null;
  uplift: number;
  tickedOnForecastDate: boolean;
  forecastDau: number | null;
  basis: string;
}
export interface MaWeeklyCell {
  accountKey: string;
  weeklyDau: number | null;
  vsPrevWeek: number | null;
  campaignDays: number;
}
export interface MaWeeklyRow {
  weekIndex: number;
  weekStart: string;
  weekEnd: string;
  daysEntered: number;
  accounts: MaWeeklyCell[];
  estate: { weeklyDau: number | null; vsPrevWeek: number | null };
  campaignAccountDays: number;
  accountsRunning: number;
  whichAccounts: string[];
}
export interface MaExplorerRow {
  date: string;
  weekday: string;
  dau: number | null;
  dayOnDay: number | null;
  threeDayAvg: number | null;
  threeDayVsPrior: number | null;
  vsSameWeekday: number | null;
  isCampaignDay: boolean;
  organic: number | null;
  campaign: number | null;
  campaignsThatDay: string[];
  placementsThatDay: string[];
}
export interface MaTrendRow {
  date: string;
  weekday: string;
  threeDayAvg: number | null;
  vs28DaysBack: number | null;
  vsPrevMonthSameDate: number | null;
  /**
   * Which dates each figure came from, oldest first. The server sends these so
   * the Trend detail tooltips can name the window without the browser
   * re-deriving month-clamping maths. Mirrors `TrendRow` in
   * `apps/api/src/modules/marketing-analytics/dau-mau.metrics.ts`.
   */
  threeDayWindow: string[];
  vs28DaysBackDate: string;
  vsPrevMonthDate: string;
}
export interface MaCampaignIndexRow {
  accountKey: string;
  name: string;
  startDate: string;
  endDate: string;
  tickedDays: number;
  placements: string[];
}

export interface DauMauDashboard {
  policy: {
    rollingWindowDays: number;
    minTickedDaysForUplift: number;
    heldUplift: number;
    trendLookbackDays: number;
    weekdayLookbackWeeks: number;
    weekStartsOn: string;
    flatThresholdPct: number;
  };
  asOf: string;
  forecastDate: string;
  dateRange: { min: string | null; max: string | null };
  accounts: MaAccountConfig[];
  /**
   * Whether the total rows hold BNII's own estate series ("reported") or the sum
   * of the selected accounts ("sum"). Only "reported" is worth showing beside
   * the selected total — it counts traffic BNII does not break out per telco, so
   * it exceeds the sum and cannot be filtered by a selection.
   */
  estateSource: "reported" | "sum";
  lifetime: { rows: MaLifetimeRow[]; estate: MaLifetimeRow };
  rolling3Day: { rows: MaRollingRow[]; estate: MaRollingRow };
  monthly: MaMonthlyBlock[];
  forecast: { rows: MaForecastRow[]; estateForecast: number | null };
  weekly: MaWeeklyRow[];
  explorer: Record<string, MaExplorerRow[]>;
  trends: Record<string, MaTrendRow[]>;
  campaignIndex: MaCampaignIndexRow[];
  sessions: MaSessionsSummary;
  dauMetric: string;
  sessionsMetric: string;
  dateFrom: string;
  dateTo: string;
  /** Accounts the server actually counted, after dropping unknown keys. */
  selectedAccounts: string[];
}

export interface MaSessionsByTelco {
  accountKey: string;
  label: string;
  total: number | null;
  previousTotal: number | null;
  pctChange: number | null;
  /** Day-aligned pacing for this account alone, same shape as the estate one. */
  pacing: MaSessionsPacing[];
}
export interface MaSessionsPacing {
  date: string;
  current: number | null;
  previous: number | null;
}
export interface MaSessionsSummary {
  windowDays: number;
  asOf: string;
  total: number | null;
  previousTotal: number | null;
  pctChange: number | null;
  pacing: MaSessionsPacing[];
  byTelco: MaSessionsByTelco[];
}

export const MA_ESTATE_KEY = "estate";

export function getDauMauDashboard(params?: {
  dateFrom?: string;
  dateTo?: string;
  dauMetric?: string;
  asOf?: string;
  forecastDate?: string;
  /**
   * Accounts counted towards the totals, comma-separated. Omit for all of them
   * — the API rejects an explicitly empty list rather than reading it as "all".
   */
  accounts?: string;
}) {
  return api.get<ApiSuccessResponse<DauMauDashboard>>(
    `/marketing-analytics/dau-mau${qs(params ?? {})}`,
  );
}

export interface DriftSettings {
  recipients: string[];
}

/** Who is emailed when the daily DAU/MAU drift check finds something. */
export function getDriftSettings() {
  return api.get<ApiSuccessResponse<DriftSettings>>(
    "/marketing-analytics/drift-settings",
  );
}

/**
 * Replaces the list wholesale. An empty array is a valid save: it silences the
 * email while leaving the check running and reporting.
 */
export function updateDriftSettings(recipients: string[]) {
  return api.put<ApiSuccessResponse<DriftSettings>>(
    "/marketing-analytics/drift-settings",
    { recipients },
  );
}
