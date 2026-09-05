import { api } from "@/lib/api-client";
import type {
  BulkBusinessUnitsPayload,
  BulkBusinessUnitsResult,
} from "@/services/crm-opportunity.service";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// ─── Types ──────────────────────────────────────────────────────────────

export interface AccountOwner {
  id: string;
  name: string;
  email: string;
}

export interface AccountPartner {
  id: string;
  company: string;
}

export interface AccountCounts {
  contacts: number;
  opportunities: number;
}

// Slim opportunity shape returned alongside an Account row. Server
// returns `take: 1` ordered by `updatedAt` desc so the UI can show
// the most-recently-touched opp's stage / TCV / launch date inline.
export interface AccountOpportunitySummary {
  id: string;
  stage: string;
  probability: number;
  // Prisma Decimal serialises as string over JSON.
  value: string;
  currency: string;
  launchDate: string | null;
  revenueLaunchDate: string | null;
}

export interface Account {
  id: string;
  name: string;
  domain: string | null;
  industry: string | null;
  size: string | null;
  country: string | null;
  region: string | null;
  website: string | null;
  notes: string | null;
  totalUsers: number | null;
  appUsers: number | null;
  // BD-feedback round 3 — engagement tracking. All optional; populated
  // by the rep over time.
  picName: string | null;
  designation: string | null;
  department: string | null;
  lastFollowUpDate: string | null;
  agreementSignedDate: string | null;
  engagementType: string | null;
  uatStartDate: string | null;
  uatEndDate: string | null;
  blocker: string | null;
  remarks: string | null;
  ownerId: string;
  partnerId: string | null;
  // Reversible archive. Null → active; ISO timestamp → archived.
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  owner: AccountOwner;
  partner: AccountPartner | null;
  _count: AccountCounts;
  opportunities: AccountOpportunitySummary[];
  // Business-unit tags (Onewave / Onewave Revenue / ARIA …). Labels and
  // chip colours resolve through use-business-units.ts.
  businessUnits: string[];
}

export interface AccountDealInput {
  opportunityId?: string;
  stage?: string;
  probability?: number;
  launchDate?: string | null;
  revenueLaunchDate?: string | null;
  value?: number;
  currency?: string;
}

export interface CreateAccountInput {
  name: string;
  domain?: string;
  industry?: string;
  size?: string;
  country?: string;
  region?: string;
  website?: string;
  notes?: string;
  totalUsers?: number;
  appUsers?: number;
  // BD-feedback round 3 fields. Empty string clears on update; the
  // server converts "" → null before persist.
  picName?: string | null;
  designation?: string | null;
  department?: string | null;
  lastFollowUpDate?: string | null;
  agreementSignedDate?: string | null;
  engagementType?: string | null;
  uatStartDate?: string | null;
  uatEndDate?: string | null;
  blocker?: string | null;
  remarks?: string | null;
  partnerId?: string;
  // §11.2 fallback override forwarded to the server when the rep accepts a
  // case-insensitive name match.
  confirmCreate?: boolean;
  /** Synced to Pipeline (creates or updates linked opportunity). */
  deal?: AccountDealInput;
  businessUnits?: string[];
}

export type UpdateAccountInput = Omit<
  Partial<CreateAccountInput>,
  "confirmCreate"
>;

export interface ListAccountsParams {
  page?: number;
  limit?: number;
  search?: string;
  industry?: string;
  country?: string;
  region?: string;
  ownerId?: string;
  partnerId?: string;
  // BD-feedback — filter by linked opportunity stage. Server matches
  // accounts that have at least one opportunity at the given stage.
  stage?: string;
  // When true, return ONLY archived accounts; omit/false shows active only.
  archived?: boolean;
  // A code narrows to records tagged with it; BUSINESS_UNIT_UNASSIGNED
  // ("__none__") narrows to untagged records.
  businessUnit?: string;
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

export async function listAccounts(
  params: ListAccountsParams = {},
): Promise<ApiPaginatedResponse<Account>> {
  return api.get(`/accounts${buildQuery(params)}`);
}

export async function getAccount(
  id: string,
): Promise<ApiSuccessResponse<Account>> {
  return api.get(`/accounts/${id}`);
}

export async function createAccount(
  input: CreateAccountInput,
): Promise<ApiSuccessResponse<Account>> {
  return api.post("/accounts", input);
}

export async function updateAccount(
  id: string,
  input: UpdateAccountInput,
): Promise<ApiSuccessResponse<Account>> {
  return api.put(`/accounts/${id}`, input);
}

export async function deleteAccount(id: string): Promise<void> {
  await api.delete(`/accounts/${id}`);
}

export async function archiveAccount(
  id: string,
): Promise<ApiSuccessResponse<Account>> {
  return api.post(`/accounts/${id}/archive`, {});
}

export async function unarchiveAccount(
  id: string,
): Promise<ApiSuccessResponse<Account>> {
  return api.post(`/accounts/${id}/unarchive`, {});
}

export async function reorderAccounts(
  orderedIds: string[],
): Promise<ApiSuccessResponse<{ success: boolean }>> {
  return api.post("/accounts/reorder", { orderedIds });
}

export async function importAccounts(
  rows: CreateAccountInput[],
): Promise<ApiSuccessResponse<{ created: number; skipped: number }>> {
  return api.post("/accounts/import", { rows });
}

// ── Bulk business-unit assignment ─────────────────────────────────
// Payload + result shapes are declared once in crm-opportunity.service.ts.

export async function bulkAssignAccountsBusinessUnits(
  payload: BulkBusinessUnitsPayload,
): Promise<ApiSuccessResponse<BulkBusinessUnitsResult>> {
  return api.post("/accounts/bulk-business-units", payload);
}

export async function bulkUpdateAccountsFields(payload: {
  ids?: string[];
  allMatching?: boolean;
  filter?: Record<string, string | boolean | undefined>;
  set: { ownerId?: string; archived?: boolean };
}): Promise<ApiSuccessResponse<BulkBusinessUnitsResult>> {
  return api.post("/accounts/bulk-update", payload);
}
