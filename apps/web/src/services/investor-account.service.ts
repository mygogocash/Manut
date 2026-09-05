import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

export interface InvestorAccount {
  id: string;
  name: string;
  type: string | null;
  website: string | null;
  location: string | null;
  region: string | null;
  notes: string | null;
  ownerId: string;
  owner: { id: string; name: string; email: string };
  _count: { contacts: number };
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  fundraisingEntity: string;
}

export interface CreateInvestorAccountInput {
  name: string;
  type?: string;
  website?: string;
  location?: string;
  region?: string;
  notes?: string;
  fundraisingEntity?: string;
}

export type UpdateInvestorAccountInput = Partial<CreateInvestorAccountInput>;

export interface ListInvestorAccountsParams {
  page?: number;
  limit?: number;
  search?: string;
  region?: string;
  ownerId?: string;
  // When true, return ONLY archived accounts; omit/false shows active only.
  archived?: boolean;
  fundraisingEntity?: string;
}

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

export async function listInvestorAccounts(
  params: ListInvestorAccountsParams = {},
): Promise<ApiPaginatedResponse<InvestorAccount>> {
  return api.get(`/investor/accounts${buildQuery(params)}`);
}

export async function createInvestorAccount(
  input: CreateInvestorAccountInput,
): Promise<ApiSuccessResponse<InvestorAccount>> {
  return api.post("/investor/accounts", input);
}

export async function updateInvestorAccount(
  id: string,
  input: UpdateInvestorAccountInput,
): Promise<ApiSuccessResponse<InvestorAccount>> {
  return api.put(`/investor/accounts/${id}`, input);
}

export async function deleteInvestorAccount(
  id: string,
): Promise<ApiSuccessResponse<{ success: boolean }>> {
  return api.delete(`/investor/accounts/${id}`);
}

export async function archiveInvestorAccount(
  id: string,
): Promise<ApiSuccessResponse<InvestorAccount>> {
  return api.post(`/investor/accounts/${id}/archive`, {});
}

export async function unarchiveInvestorAccount(
  id: string,
): Promise<ApiSuccessResponse<InvestorAccount>> {
  return api.post(`/investor/accounts/${id}/unarchive`, {});
}
