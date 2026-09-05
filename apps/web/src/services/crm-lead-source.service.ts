import { api } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api.type";

// Mirrors the LeadSource Prisma model. PRD §11.7 — workspace-admin
// managed lookup table.

export interface LeadSource {
  id: string;
  code: string;
  label: string;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeadSourceInput {
  code: string;
  label: string;
  sortOrder?: number;
}

export interface UpdateLeadSourceInput {
  label?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface ListLeadSourcesParams {
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

export async function listLeadSources(
  params: ListLeadSourcesParams = {},
): Promise<ApiSuccessResponse<LeadSource[]>> {
  return api.get(`/lead-sources${buildQuery(params)}`);
}

export async function createLeadSource(
  input: CreateLeadSourceInput,
): Promise<ApiSuccessResponse<LeadSource>> {
  return api.post("/lead-sources", input);
}

export async function updateLeadSource(
  id: string,
  input: UpdateLeadSourceInput,
): Promise<ApiSuccessResponse<LeadSource>> {
  return api.put(`/lead-sources/${id}`, input);
}

export async function deleteLeadSource(id: string): Promise<void> {
  await api.delete(`/lead-sources/${id}`);
}
