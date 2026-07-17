import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// ─── Types ──────────────────────────────────────────────

export interface DealOwner {
  id: string;
  name: string;
  email: string;
}

export interface DealPartner {
  id: string;
  company: string;
}

export interface Deal {
  id: string;
  company: string;
  contact: string | null;
  value: number;
  stage: string;
  probability: number;
  type: string | null;
  country: string | null;
  closeDate: string | null;
  notes: string | null;
  partnerId: string | null;
  ownerId: string;
  owner: DealOwner;
  partner: DealPartner | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDealInput {
  company: string;
  contact?: string;
  value: number;
  stage?: string;
  probability?: number;
  type?: string;
  country?: string;
  partnerId?: string;
  closeDate?: string;
  notes?: string;
}

export type UpdateDealInput = Partial<CreateDealInput>;

export interface DealParams {
  page?: number;
  limit?: number;
  search?: string;
  stage?: string;
  type?: string;
  ownerId?: string;
}

export interface PipelineStage {
  stage: string;
  count: number;
  totalValue: number;
}

export const DEAL_STAGES = [
  "lead",
  "qualified",
  "proposal",
  "negotiation",
  "closed_won",
  "closed_lost",
] as const;

export const DEAL_STAGE_LABELS: Record<string, string> = {
  lead: "Lead",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
};

export const DEAL_STAGE_COLORS: Record<string, string> = {
  lead: "grey",
  qualified: "blue",
  proposal: "blue",
  negotiation: "amber",
  closed_won: "green",
  closed_lost: "red",
};

// ─── Helpers ────────────────────────────────────────────

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

// ─── Service ────────────────────────────────────────────

export async function listDeals(
  params: DealParams = {},
): Promise<ApiPaginatedResponse<Deal>> {
  return api.get(`/deals${buildQuery(params)}`);
}

export async function getDeal(id: string): Promise<ApiSuccessResponse<Deal>> {
  return api.get(`/deals/${id}`);
}

export async function createDeal(
  input: CreateDealInput,
): Promise<ApiSuccessResponse<Deal>> {
  return api.post("/deals", input);
}

export async function updateDeal(
  id: string,
  input: UpdateDealInput,
): Promise<ApiSuccessResponse<Deal>> {
  return api.put(`/deals/${id}`, input);
}

export async function deleteDeal(id: string): Promise<void> {
  await api.delete(`/deals/${id}`);
}

export async function getDealPipeline(): Promise<
  ApiSuccessResponse<PipelineStage[]>
> {
  return api.get("/deals/pipeline");
}
