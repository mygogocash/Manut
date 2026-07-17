import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

export const INVESTOR_ACTIVITY_TYPES = [
  "call",
  "email",
  "meeting",
  "note",
] as const;
export type InvestorActivityType = (typeof INVESTOR_ACTIVITY_TYPES)[number];

export const INVESTOR_ACTIVITY_TYPE_LABELS: Record<string, string> = {
  call: "Call",
  email: "Email",
  meeting: "Meeting",
  note: "Note",
};

export interface InvestorActivity {
  id: string;
  type: string;
  subject: string;
  body: string | null;
  occurredAt: string;
  durationMins: number | null;
  investorId: string;
  ownerId: string;
  createdAt: string;
  owner: { id: string; name: string; email: string };
  investor: { id: string; name: string };
}

export interface CreateInvestorActivityInput {
  type: InvestorActivityType;
  subject: string;
  body?: string;
  occurredAt: string;
  durationMins?: number;
  investorId: string;
}

export interface UpdateInvestorActivityInput {
  type?: InvestorActivityType;
  subject?: string;
  body?: string | null;
  occurredAt?: string;
  durationMins?: number | null;
}

export interface ListInvestorActivitiesParams {
  page?: number;
  limit?: number;
  type?: string;
  investorId?: string;
  ownerId?: string;
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

export async function listInvestorActivities(
  params: ListInvestorActivitiesParams = {},
): Promise<ApiPaginatedResponse<InvestorActivity>> {
  return api.get(`/investor/activities${buildQuery(params)}`);
}

export async function createInvestorActivity(
  input: CreateInvestorActivityInput,
): Promise<ApiSuccessResponse<InvestorActivity>> {
  return api.post("/investor/activities", input);
}

export async function updateInvestorActivity(
  id: string,
  input: UpdateInvestorActivityInput,
): Promise<ApiSuccessResponse<InvestorActivity>> {
  return api.put(`/investor/activities/${id}`, input);
}

export async function deleteInvestorActivity(
  id: string,
): Promise<ApiSuccessResponse<{ success: boolean }>> {
  return api.delete(`/investor/activities/${id}`);
}
