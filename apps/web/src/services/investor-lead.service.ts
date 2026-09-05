import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

export const INVESTOR_LEAD_STATUSES = [
  "new",
  "qualified",
  "converted",
  "disqualified",
] as const;
export type InvestorLeadStatus = (typeof INVESTOR_LEAD_STATUSES)[number];

export const INVESTOR_LEAD_STATUS_LABELS: Record<string, string> = {
  new: "New",
  qualified: "Qualified",
  converted: "Converted",
  disqualified: "Disqualified",
};

export interface InvestorLead {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  source: string | null;
  status: string;
  notes: string | null;
  ownerId: string;
  owner: { id: string; name: string; email: string };
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  fundraisingEntity: string;
}

export interface CreateInvestorLeadInput {
  name: string;
  company?: string;
  email?: string;
  phone?: string;
  source?: string;
  status?: InvestorLeadStatus;
  notes?: string;
  fundraisingEntity?: string;
}

export type UpdateInvestorLeadInput = Partial<CreateInvestorLeadInput>;

export interface ListInvestorLeadsParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  ownerId?: string;
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

export async function listInvestorLeads(
  params: ListInvestorLeadsParams = {},
): Promise<ApiPaginatedResponse<InvestorLead>> {
  return api.get(`/investor/leads${buildQuery(params)}`);
}

export async function createInvestorLead(
  input: CreateInvestorLeadInput,
): Promise<ApiSuccessResponse<InvestorLead>> {
  return api.post("/investor/leads", input);
}

export async function updateInvestorLead(
  id: string,
  input: UpdateInvestorLeadInput,
): Promise<ApiSuccessResponse<InvestorLead>> {
  return api.put(`/investor/leads/${id}`, input);
}

export async function deleteInvestorLead(
  id: string,
): Promise<ApiSuccessResponse<{ success: boolean }>> {
  return api.delete(`/investor/leads/${id}`);
}

export async function archiveInvestorLead(
  id: string,
): Promise<ApiSuccessResponse<InvestorLead>> {
  return api.post(`/investor/leads/${id}/archive`, {});
}

export async function unarchiveInvestorLead(
  id: string,
): Promise<ApiSuccessResponse<InvestorLead>> {
  return api.post(`/investor/leads/${id}/unarchive`, {});
}
