import { api } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api.type";

// Workspace-admin lookup mirroring LeadSource.

export interface LostReason {
  id: string;
  code: string;
  label: string;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLostReasonInput {
  code: string;
  label: string;
  sortOrder?: number;
}

export interface UpdateLostReasonInput {
  label?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface ListLostReasonsParams {
  includeInactive?: boolean;
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

export async function listLostReasons(
  params: ListLostReasonsParams = {},
): Promise<ApiSuccessResponse<LostReason[]>> {
  return api.get(`/sales-revenue/lost-reasons${buildQuery(params)}`);
}

export async function createLostReason(
  input: CreateLostReasonInput,
): Promise<ApiSuccessResponse<LostReason>> {
  return api.post("/sales-revenue/lost-reasons", input);
}

export async function updateLostReason(
  id: string,
  input: UpdateLostReasonInput,
): Promise<ApiSuccessResponse<LostReason>> {
  return api.put(`/sales-revenue/lost-reasons/${id}`, input);
}

export async function deleteLostReason(id: string): Promise<void> {
  await api.delete(`/sales-revenue/lost-reasons/${id}`);
}
