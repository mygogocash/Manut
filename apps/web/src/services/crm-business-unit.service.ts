import { api } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api.type";

/**
 * Business units — the "who is taking care of this card" tag on Sales CRM
 * records. ONE list serves both CRMs (`/sales` and `/sales-revenue`), so
 * there is deliberately no `revenue-business-unit.service.ts` mirror.
 *
 * Same shape as crm-lost-reason.service.ts.
 */

export interface BusinessUnit {
  id: string;
  code: string;
  label: string;
  /** A shared Badge variant name, e.g. "blue" — not a Tailwind class. */
  color: string;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBusinessUnitInput {
  code: string;
  label: string;
  color?: string;
  sortOrder?: number;
}

export interface UpdateBusinessUnitInput {
  label?: string;
  color?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface ListBusinessUnitsParams {
  includeInactive?: boolean;
}

/**
 * Filter sentinel for "records with no business unit". Mirrors
 * BUSINESS_UNIT_UNASSIGNED in the API — codes can't contain underscores, so
 * it can never collide with a real one.
 */
export const BUSINESS_UNIT_UNASSIGNED = "__none__";

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

export async function listBusinessUnits(
  params: ListBusinessUnitsParams = {},
): Promise<ApiSuccessResponse<BusinessUnit[]>> {
  return api.get(`/business-units${buildQuery(params)}`);
}

export async function createBusinessUnit(
  input: CreateBusinessUnitInput,
): Promise<ApiSuccessResponse<BusinessUnit>> {
  return api.post("/business-units", input);
}

export async function updateBusinessUnit(
  id: string,
  input: UpdateBusinessUnitInput,
): Promise<ApiSuccessResponse<BusinessUnit>> {
  return api.put(`/business-units/${id}`, input);
}

export async function reorderBusinessUnits(input: {
  orderedIds: string[];
}): Promise<ApiSuccessResponse<{ success: boolean; reordered: number }>> {
  return api.put("/business-units/reorder", input);
}

export async function deleteBusinessUnit(id: string): Promise<void> {
  await api.delete(`/business-units/${id}`);
}
