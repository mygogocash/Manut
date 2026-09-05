import { api } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api.type";

export interface ReportFilter {
  from?: string;
  to?: string;
  status?: string;
  channel?: string;
  country?: string;
  ownerId?: string;
}

export interface PvaRow {
  id: string;
  name: string;
  campaignDate: string;
  status: string;
  channel: string | null;
  predicted: number | null;
  actual: number | null;
  difference: number | null;
  performancePct: number | null;
}
export interface CampaignPerfRow {
  id: string;
  name: string;
  campaignDate: string;
  status: string;
  channel: string | null;
  country: string | null;
  product: string | null;
  owner: string | null;
  budget: number | null;
  currency: string;
  expectedReach: number | null;
  actualReach: number | null;
  performancePct: number | null;
}
export interface SummaryRow {
  period: string;
  campaigns: number;
  expectedReach: number;
  actualReach: number;
  budget: number;
  performancePct: number | null;
}
export interface AccuracyRow {
  id: string;
  name: string;
  campaignDate: string;
  predicted: number;
  actual: number;
  difference: number;
  performancePct: number | null;
  accuracyPct: number | null;
}
export interface LeverPerfRow {
  leverId: string;
  lever: string;
  campaigns: number;
  expectedReach: number;
  actualReach: number;
  budget: number;
  avgPerformancePct: number | null;
}

export interface ReportsDashboard {
  campaignPerformance: {
    totalCampaigns: number;
    totalExpectedReach: number;
    totalActualReach: number;
    totalBudget: number;
    avgPerformancePct: number | null;
  };
  predictionAccuracy: {
    evaluatedCampaigns: number;
    avgPerformancePct: number | null;
  };
  trafficTrends: Array<{ month: string; expected: number; actual: number }>;
  leverPerformance: LeverPerfRow[];
  campaignSummary: {
    byStatus: Array<{ status: string; count: number }>;
    byChannel: Array<{ channel: string; count: number }>;
  };
  upcomingCampaigns: Array<{
    id: string;
    name: string;
    campaignDate: string;
    status: string;
    channel: string | null;
  }>;
}

interface Paged<T> {
  data: T[];
  meta: { page: number; limit: number; total: number };
}

function qs<T extends object>(params: T): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function getReportsDashboard(filter: ReportFilter = {}) {
  return api.get<ApiSuccessResponse<ReportsDashboard>>(
    `/marketing-reports/dashboard${qs(filter)}`,
  );
}

export function getPredictionVsActual(
  query: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortDir?: "asc" | "desc";
  } & ReportFilter,
): Promise<Paged<PvaRow>> {
  return api.get(`/marketing-reports/prediction-vs-actual${qs(query)}`);
}

export function getCampaignPerformance(
  query: {
    page?: number;
    limit?: number;
    sortBy?: string;
    sortDir?: "asc" | "desc";
  } & ReportFilter,
): Promise<Paged<CampaignPerfRow>> {
  return api.get(`/marketing-reports/campaign-performance${qs(query)}`);
}

export function getCampaignSummary(
  query: { granularity: "daily" | "weekly" | "monthly" } & ReportFilter,
) {
  return api.get<ApiSuccessResponse<SummaryRow[]>>(
    `/marketing-reports/campaign-summary${qs(query)}`,
  );
}

export function getPredictionAccuracy(filter: ReportFilter = {}) {
  return api.get<ApiSuccessResponse<AccuracyRow[]>>(
    `/marketing-reports/prediction-accuracy${qs(filter)}`,
  );
}

export function getLeverPerformance(filter: ReportFilter = {}) {
  return api.get<ApiSuccessResponse<LeverPerfRow[]>>(
    `/marketing-reports/lever-performance${qs(filter)}`,
  );
}
