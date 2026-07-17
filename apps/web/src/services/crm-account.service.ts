import { api } from "@/lib/api-client";
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
  // Engagement tracking. All optional; populated
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
  createdAt: string;
  updatedAt: string;
  owner: AccountOwner;
  partner: AccountPartner | null;
  _count: AccountCounts;
  opportunities: AccountOpportunitySummary[];
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
  // Engagement fields. Empty string clears on update; the
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
  // Name-dedupe fallback override forwarded to the server when the rep accepts a
  // case-insensitive name match.
  confirmCreate?: boolean;
  /** Synced to Pipeline (creates or updates linked opportunity). */
  deal?: AccountDealInput;
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
  // Filter by linked opportunity stage. Server matches
  // accounts that have at least one opportunity at the given stage.
  stage?: string;
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
