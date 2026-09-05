import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

export interface InvestorContact {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  title: string | null;
  accountId: string | null;
  ownerId: string;
  owner: { id: string; name: string; email: string };
  account: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
  fundraisingEntity: string;
}

export interface CreateInvestorContactInput {
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  title?: string;
  accountId?: string;
  fundraisingEntity?: string;
}

export interface UpdateInvestorContactInput {
  firstName?: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  title?: string | null;
  accountId?: string | null;
  fundraisingEntity?: string;
}

export interface ListInvestorContactsParams {
  page?: number;
  limit?: number;
  search?: string;
  accountId?: string;
  ownerId?: string;
  // When true, return ONLY archived contacts; omit/false shows active only.
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

export async function listInvestorContacts(
  params: ListInvestorContactsParams = {},
): Promise<ApiPaginatedResponse<InvestorContact>> {
  return api.get(`/investor/contacts${buildQuery(params)}`);
}

export async function createInvestorContact(
  input: CreateInvestorContactInput,
): Promise<ApiSuccessResponse<InvestorContact>> {
  return api.post("/investor/contacts", input);
}

export async function updateInvestorContact(
  id: string,
  input: UpdateInvestorContactInput,
): Promise<ApiSuccessResponse<InvestorContact>> {
  return api.put(`/investor/contacts/${id}`, input);
}

export async function deleteInvestorContact(
  id: string,
): Promise<ApiSuccessResponse<{ success: boolean }>> {
  return api.delete(`/investor/contacts/${id}`);
}

export async function archiveInvestorContact(
  id: string,
): Promise<ApiSuccessResponse<InvestorContact>> {
  return api.post(`/investor/contacts/${id}/archive`, {});
}

export async function unarchiveInvestorContact(
  id: string,
): Promise<ApiSuccessResponse<InvestorContact>> {
  return api.post(`/investor/contacts/${id}/unarchive`, {});
}
