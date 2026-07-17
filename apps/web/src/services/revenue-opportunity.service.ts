import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// Constants mirror apps/api/src/modules/opportunities/opportunities.constants.ts.

// "live" sits after closed_won — a won deal now live / generating revenue.
// Array order drives the kanban column order + the Account form dropdown.
export const OPPORTUNITY_STAGES = [
  "qualified",
  "proposal",
  "negotiation",
  "closed_won",
  "live",
  "closed_lost",
] as const;

export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number];

export const OPPORTUNITY_STAGE_LABELS: Record<OpportunityStage, string> = {
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  closed_won: "Closed Won",
  live: "Live",
  closed_lost: "Closed Lost",
};

// Stage defaults. Service / UI snap probability to these when
// `probabilityCustom` is false. Mirrors STAGE_PROBABILITY_DEFAULTS in the API.
export const STAGE_PROBABILITY_DEFAULTS: Record<OpportunityStage, number> = {
  qualified: 20,
  proposal: 40,
  negotiation: 60,
  closed_won: 100,
  // Live = already won, so 100% like closed_won.
  live: 100,
  closed_lost: 0,
};

// Stages a rep can pick at conversion time. closed_* and live are terminal /
// settled — converting straight to one would skip the active pipeline.
export const CONVERT_STAGES = OPPORTUNITY_STAGES.filter(
  (s): s is "qualified" | "proposal" | "negotiation" =>
    s !== "closed_won" && s !== "closed_lost" && s !== "live",
);

// Reopen targets — same set as convert. Closed_* are not selectable since
// re-flipping back to a terminal stage defeats the purpose of reopening.
export const REOPEN_STAGES = CONVERT_STAGES;

// ─── Types ──────────────────────────────────────────────────────────────

export interface OpportunityAccountRef {
  id: string;
  name: string;
  ownerId: string;
  // Surfaced so cards can show the flag
  // chips and the pipeline filter can group rows by geo.
  country?: string | null;
  region?: string | null;
}

export interface OpportunityContactRef {
  id: string;
  firstName: string;
  lastName: string;
}

export interface OpportunityOwner {
  id: string;
  name: string;
  email: string;
}

export interface Opportunity {
  id: string;
  name: string;
  legacyDealId: string | null;
  accountId: string;
  contactId: string | null;
  stage: string;
  value: number | string;
  currency: string;
  probability: number;
  probabilityCustom: boolean;
  closeDate: string | null;
  launchDate: string | null;
  revenueLaunchDate: string | null;
  type: string | null;
  notes: string | null;
  ownerId: string;
  lostReason: string | null;
  createdAt: string;
  updatedAt: string;
  account: OpportunityAccountRef;
  contact: OpportunityContactRef | null;
  owner: OpportunityOwner;
}

export interface CreateOpportunityInput {
  name: string;
  accountId: string;
  contactId?: string;
  stage?: OpportunityStage;
  value: number;
  currency?: string;
  probability?: number;
  closeDate?: string;
  launchDate?: string;
  revenueLaunchDate?: string;
  type?: string;
  notes?: string;
}

export type UpdateOpportunityInput = Partial<
  Omit<CreateOpportunityInput, "accountId">
>;

export interface CloseLostInput {
  lostReason?: string;
}

export interface ReopenOpportunityInput {
  stage?: "qualified" | "proposal" | "negotiation";
}

export interface ListOpportunitiesParams {
  page?: number;
  limit?: number;
  search?: string;
  stage?: OpportunityStage;
  accountId?: string;
  ownerId?: string;
  country?: string;
  region?: string;
}

export interface OpportunityFilterOptions {
  countries: string[];
  regions: string[];
}

export interface PipelineRow {
  stage: string;
  currency: string;
  count: number;
  totalValue: number;
}

// Cross-currency aggregated forecast.
export interface ForecastByStage {
  stage: string;
  count: number;
  weighted: number;
  unweighted: number;
}

export interface ForecastMissingRate {
  currency: string;
  count: number;
}

export interface OpportunityForecast {
  reportCurrency: string;
  totalOpportunities: number;
  convertedCount: number;
  weighted: number;
  unweighted: number;
  byStage: ForecastByStage[];
  missingRates: ForecastMissingRate[];
}

// ─── Helpers ────────────────────────────────────────────────────────────

function buildQuery<T extends object>(params: T): string {
  const qs = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== "") {
      qs.set(key, String(val));
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}

// ─── Service ────────────────────────────────────────────────────────────

export async function listOpportunities(
  params: ListOpportunitiesParams = {},
): Promise<ApiPaginatedResponse<Opportunity>> {
  return api.get(`/sales-revenue/opportunities${buildQuery(params)}`);
}

export async function getOpportunityPipeline(): Promise<
  ApiSuccessResponse<PipelineRow[]>
> {
  return api.get("/sales-revenue/opportunities/pipeline");
}

// Flat opportunity rows joined with account geo + reach metrics — the
// single fetch that powers every exhibit on the Sales CRM dashboard tab.
export interface SalesDashboardRow {
  id: string;
  name: string;
  stage: string;
  value: number;
  currency: string;
  probability: number;
  launchDate: string | null;
  revenueLaunchDate: string | null;
  accountId: string | null;
  accountName: string | null;
  country: string | null;
  region: string | null;
  industry: string | null;
  totalUsers: number | null;
  appUsers: number | null;
  engagementType: string | null;
  ownerName: string | null;
}

export async function getSalesDashboard(): Promise<
  ApiSuccessResponse<SalesDashboardRow[]>
> {
  return api.get("/sales-revenue/opportunities/dashboard");
}

export async function getOpportunityForecast(
  currency = "USD",
): Promise<ApiSuccessResponse<OpportunityForecast>> {
  return api.get(
    `/sales-revenue/opportunities/forecast?currency=${encodeURIComponent(currency)}`,
  );
}

export async function getOpportunityFilterOptions(): Promise<
  ApiSuccessResponse<OpportunityFilterOptions>
> {
  return api.get("/sales-revenue/opportunities/filter-options");
}

export async function getOpportunity(
  id: string,
): Promise<ApiSuccessResponse<Opportunity>> {
  return api.get(`/sales-revenue/opportunities/${id}`);
}

export async function createOpportunity(
  input: CreateOpportunityInput,
): Promise<ApiSuccessResponse<Opportunity>> {
  return api.post("/sales-revenue/opportunities", input);
}

export async function updateOpportunity(
  id: string,
  input: UpdateOpportunityInput,
): Promise<ApiSuccessResponse<Opportunity>> {
  return api.put(`/sales-revenue/opportunities/${id}`, input);
}

export async function closeOpportunityAsLost(
  id: string,
  input: CloseLostInput = {},
): Promise<ApiSuccessResponse<Opportunity>> {
  return api.post(`/sales-revenue/opportunities/${id}/close-lost`, input);
}

export async function reopenOpportunity(
  id: string,
  input: ReopenOpportunityInput = {},
): Promise<ApiSuccessResponse<Opportunity>> {
  return api.post(`/sales-revenue/opportunities/${id}/reopen`, input);
}

export async function deleteOpportunity(id: string): Promise<void> {
  await api.delete(`/sales-revenue/opportunities/${id}`);
}

// Persist the manual within-column order for one pipeline stage. `orderedIds`
// is the column top-to-bottom; the API writes sortOrderWithinStage = index.
export async function reorderOpportunitiesWithinStage(input: {
  stageKey: OpportunityStage;
  orderedIds: string[];
}): Promise<ApiSuccessResponse<{ success: boolean; reordered: number }>> {
  return api.post("/sales-revenue/opportunities/reorder-within-stage", input);
}

// ─── Stage config (admin) ────────────────────────────────────────────────

export interface OpportunityStageConfig {
  key: OpportunityStage;
  label: string;
  probability: number;
  sortOrder: number;
  color: string;
  updatedAt: string;
}

export interface BulkUpdateStageConfigsInput {
  configs: Array<{
    key: OpportunityStage;
    label: string;
    probability: number;
    sortOrder: number;
    color?: string;
  }>;
}

export async function listOpportunityStageConfigs(): Promise<
  ApiSuccessResponse<OpportunityStageConfig[]>
> {
  return api.get("/sales-revenue/opportunities/stage-config");
}

export async function bulkUpdateOpportunityStageConfigs(
  input: BulkUpdateStageConfigsInput,
): Promise<ApiSuccessResponse<OpportunityStageConfig[]>> {
  return api.put("/sales-revenue/opportunities/stage-config", input);
}
