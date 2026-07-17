import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// ─── Types ──────────────────────────────────────────────

export interface UpdateSender {
  id: string;
  name: string;
  email: string;
}

export interface InvestorUpdate {
  id: string;
  title: string;
  content: string;
  period: string;
  sentBy: string | null;
  sender: UpdateSender | null;
  sentAt: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateUpdateInput {
  title: string;
  content: string;
  period: string;
  status?: string;
}

export interface UpdateUpdateInput {
  title?: string;
  content?: string;
  period?: string;
  status?: string;
}

export interface InvestorUpdateParams {
  page?: number;
  limit?: number;
  status?: string;
}

export const UPDATE_STATUSES = ["draft", "sent"] as const;

export const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
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

export async function listUpdates(
  params: InvestorUpdateParams = {},
): Promise<ApiPaginatedResponse<InvestorUpdate>> {
  return api.get(`/investor-updates${buildQuery(params)}`);
}

export async function getUpdate(
  id: string,
): Promise<ApiSuccessResponse<InvestorUpdate>> {
  return api.get(`/investor-updates/${id}`);
}

export async function createUpdate(
  input: CreateUpdateInput,
): Promise<ApiSuccessResponse<InvestorUpdate>> {
  return api.post("/investor-updates", input);
}

export async function updateUpdate(
  id: string,
  input: UpdateUpdateInput,
): Promise<ApiSuccessResponse<InvestorUpdate>> {
  return api.put(`/investor-updates/${id}`, input);
}

export async function deleteUpdate(id: string): Promise<void> {
  await api.delete(`/investor-updates/${id}`);
}

export async function sendUpdate(
  id: string,
): Promise<ApiSuccessResponse<InvestorUpdate>> {
  return api.post(`/investor-updates/${id}/send`);
}
