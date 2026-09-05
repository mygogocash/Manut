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

// PRD §11.4 defaults. Service / UI snap probability to these per-stage when
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
  // BD-feedback (Vivek, May 2026) — surfaced so cards can show flag
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
  // Business-unit tags — see use-business-units.ts for label/colour
  // resolution. Empty array = untagged.
  businessUnits: string[];
  /**
   * Each tagged unit and the stage THAT UNIT is at — what the card chips
   * render as "Onewave - Live".
   *
   * Derived server-side (`dealUnitStages`) so a card and the dialog that
   * edits it cannot disagree. Resolves an unseeded unit to the deal's own
   * stage, so it is always populated for a tagged deal; `[]` means untagged,
   * which the card renders as a plain "Unassigned" chip. Optional because
   * older cached payloads predate it.
   */
  units?: { businessUnit: string; stage: string }[];
  /** Manual within-column order; lower sorts higher. */
  sortOrderWithinStage?: number;
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
  businessUnits?: string[];
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
  // When true, return ONLY archived opportunities; omit for active-only.
  // Serialized only when true (buildQuery skips undefined) so the default
  // active view sends no archived param.
  archived?: boolean;
  // A code narrows to records tagged with it; BUSINESS_UNIT_UNASSIGNED
  // ("__none__") narrows to untagged records.
  businessUnit?: string;
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

// PRD §11.5 follow-up — cross-currency aggregated forecast.
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
  return api.get(`/opportunities${buildQuery(params)}`);
}

/**
 * Per-stage rollup for the kanban headers. Takes the same board filters as
 * the per-column list calls — without them the counts and totals would
 * describe a different row set than the cards underneath.
 */
export interface PipelineParams {
  ownerId?: string;
  country?: string;
  region?: string;
  businessUnit?: string;
}

export async function getOpportunityPipeline(
  params: PipelineParams = {},
): Promise<ApiSuccessResponse<PipelineRow[]>> {
  return api.get(`/opportunities/pipeline${buildQuery(params)}`);
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
  businessUnits: string[];
}

export async function getSalesDashboard(): Promise<
  ApiSuccessResponse<SalesDashboardRow[]>
> {
  return api.get("/opportunities/dashboard");
}

export async function getOpportunityForecast(
  currency = "USD",
): Promise<ApiSuccessResponse<OpportunityForecast>> {
  return api.get(
    `/opportunities/forecast?currency=${encodeURIComponent(currency)}`,
  );
}

export async function getOpportunityFilterOptions(): Promise<
  ApiSuccessResponse<OpportunityFilterOptions>
> {
  return api.get("/opportunities/filter-options");
}

export async function getOpportunity(
  id: string,
): Promise<ApiSuccessResponse<Opportunity>> {
  return api.get(`/opportunities/${id}`);
}

export async function createOpportunity(
  input: CreateOpportunityInput,
): Promise<ApiSuccessResponse<Opportunity>> {
  return api.post("/opportunities", input);
}

export async function updateOpportunity(
  id: string,
  input: UpdateOpportunityInput,
): Promise<ApiSuccessResponse<Opportunity>> {
  return api.put(`/opportunities/${id}`, input);
}

export async function closeOpportunityAsLost(
  id: string,
  input: CloseLostInput = {},
): Promise<ApiSuccessResponse<Opportunity>> {
  return api.post(`/opportunities/${id}/close-lost`, input);
}

export async function reopenOpportunity(
  id: string,
  input: ReopenOpportunityInput = {},
): Promise<ApiSuccessResponse<Opportunity>> {
  return api.post(`/opportunities/${id}/reopen`, input);
}

export async function deleteOpportunity(id: string): Promise<void> {
  await api.delete(`/opportunities/${id}`);
}

// Reversible archive — hides the opportunity from the active pipeline while
// keeping its stage. Restore with unarchiveOpportunity. Gated crm:update.
export async function archiveOpportunity(
  id: string,
): Promise<ApiSuccessResponse<Opportunity>> {
  return api.post(`/opportunities/${id}/archive`, {});
}

export async function unarchiveOpportunity(
  id: string,
): Promise<ApiSuccessResponse<Opportunity>> {
  return api.post(`/opportunities/${id}/unarchive`, {});
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
  return api.get("/opportunities/stage-config");
}

export async function bulkUpdateOpportunityStageConfigs(
  input: BulkUpdateStageConfigsInput,
): Promise<ApiSuccessResponse<OpportunityStageConfig[]>> {
  return api.put("/opportunities/stage-config", input);
}

// ─── Per-unit progress + card order ──────────────────────────────────────
//
// The board is one card per partner (deal), so a card is addressed by deal id
// alone. What still addresses a single unit is the Edit dialog's per-unit
// stage table: `stage` in `MoveBusinessUnitInput` is the UNIT's stage, never
// the deal's rolled-up one — the whole point is that they can differ.

export interface MoveBusinessUnitInput {
  stage?: OpportunityStage;
  probability?: number;
  value?: number;
  closeDate?: string | null;
  launchDate?: string | null;
  revenueLaunchDate?: string | null;
  lostReason?: string | null;
}

/**
 * Move or edit ONE unit on a deal — what the Edit dialog's per-unit stage
 * table submits, one call per changed unit.
 *
 * NOT what a card drag calls. A card is a whole deal now, so a drag is
 * `updateOpportunity(id, { stage })`: that writes the deal, and the push-down
 * lands the stage on the least-advanced unit, which is the one the deal's
 * rolled-up stage reports. Using this per-unit route for a drag would need
 * the caller to decide which unit "the card" means, and the card means all
 * of them.
 */
export async function moveBusinessUnitCard(
  opportunityId: string,
  businessUnit: string,
  input: MoveBusinessUnitInput,
): Promise<ApiSuccessResponse<Opportunity>> {
  return api.put(
    `/opportunities/${opportunityId}/business-units/${encodeURIComponent(businessUnit)}`,
    input,
  );
}

/**
 * Write a column's manual card order.
 *
 * Deal ids, because a card IS a deal. The index of each id in the array is
 * the order it will be given, so the array must be the column exactly as the
 * user just dropped it.
 */
export async function reorderOpportunityCards(input: {
  stageKey: OpportunityStage;
  opportunityIds: string[];
}): Promise<ApiSuccessResponse<{ success: boolean; reordered: number }>> {
  return api.post(`/opportunities/reorder`, input);
}

/** One deal's per-unit rows — what the edit form's stage-per-unit table binds to. */
export interface DealBusinessUnitRow {
  businessUnit: string;
  stage: OpportunityStage;
  probability: number;
  probabilityCustom: boolean;
  value: number;
  closeDate: string | null;
  launchDate: string | null;
  revenueLaunchDate: string | null;
  lostReason: string | null;
  sortOrderWithinStage: number;
}

/**
 * The rows come back already seeded: the API routes this through getById,
 * which lazily creates a row per tag, so a deal that has never been written
 * still returns one row per unit rather than an empty table.
 */
export async function listDealBusinessUnits(
  opportunityId: string,
): Promise<ApiSuccessResponse<DealBusinessUnitRow[]>> {
  return api.get(`/opportunities/${opportunityId}/business-units`);
}

// ── Bulk business-unit assignment ─────────────────────────────────

/**
 * Selection is EITHER ticked ids OR `allMatching` + the filter in force, which
 * the server resolves through the same where-builder the list uses. Never send
 * both: the API ignores `ids` when `allMatching` is set.
 */
export interface BulkBusinessUnitsPayload {
  ids?: string[];
  allMatching?: boolean;
  filter?: Record<string, string | boolean | undefined>;
  businessUnits: { mode: "add" | "replace"; codes: string[] };
}

export interface BulkBusinessUnitsResult {
  /** Rows the selection resolved to. */
  selected: number;
  /** Rows actually written. */
  updated: number;
  /** Rows that already carried the requested set. */
  skipped: number;
  /** Rows whose write failed — surfaced rather than swallowed. */
  failed: Array<{ id: string; reason: string }>;
}

export async function bulkAssignOpportunitiesBusinessUnits(
  payload: BulkBusinessUnitsPayload,
): Promise<ApiSuccessResponse<BulkBusinessUnitsResult>> {
  return api.post("/opportunities/bulk-business-units", payload);
}

export async function bulkUpdateOpportunitiesFields(payload: {
  ids?: string[];
  allMatching?: boolean;
  filter?: Record<string, string | boolean | undefined>;
  set: { ownerId?: string; archived?: boolean };
}): Promise<ApiSuccessResponse<BulkBusinessUnitsResult>> {
  return api.post("/opportunities/bulk-update", payload);
}
