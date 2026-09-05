import { api } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api.type";

/**
 * Investor tags — searchable labels on investor rows.
 *
 * Same shape as crm-business-unit.service.ts. Codes are the stable machine
 * value stored inside `investors.tags`; labels are what the team reads.
 */

export interface InvestorTag {
  id: string;
  code: string;
  label: string;
  color: string;
  isSystem: boolean;
  isActive: boolean;
  sortOrder: number;
}

export interface CreateInvestorTagInput {
  code: string;
  label: string;
  color?: string;
  sortOrder?: number;
}

export interface UpdateInvestorTagInput {
  label?: string;
  color?: string;
  sortOrder?: number;
  isActive?: boolean;
}

/**
 * Filter sentinel for "investors with no tag". Reserved rather than a real
 * code — the API rejects underscores in codes, so it cannot collide.
 */
export const INVESTOR_TAG_UNTAGGED = "__none__";

export const INVESTOR_TAG_COLORS = [
  "green",
  "amber",
  "red",
  "gold",
  "blue",
  "grey",
  "purple",
  "teal",
  "violet",
] as const;

export async function listInvestorTags(params?: {
  includeInactive?: boolean;
}): Promise<ApiSuccessResponse<InvestorTag[]>> {
  const qs = params?.includeInactive ? "?includeInactive=true" : "";
  return api.get(`/investor/tags${qs}`);
}

export async function createInvestorTag(
  input: CreateInvestorTagInput,
): Promise<ApiSuccessResponse<InvestorTag>> {
  return api.post("/investor/tags", input);
}

export async function updateInvestorTag(
  id: string,
  input: UpdateInvestorTagInput,
): Promise<ApiSuccessResponse<InvestorTag>> {
  return api.put(`/investor/tags/${id}`, input);
}

/**
 * Deleting strips the code from every investor carrying it. The response
 * reports how many were untagged so the caller can say what actually
 * happened rather than a bare "deleted".
 */
export async function deleteInvestorTag(
  id: string,
): Promise<
  ApiSuccessResponse<{ success: boolean; investorsUntagged: number }>
> {
  return api.delete(`/investor/tags/${id}`);
}

/** How many investors currently carry a code — shown before a delete. */
export async function investorTagUsage(
  code: string,
): Promise<ApiSuccessResponse<{ count: number }>> {
  return api.get(`/investor/tags/${encodeURIComponent(code)}/usage`);
}

export async function reorderInvestorTags(
  orderedIds: string[],
): Promise<ApiSuccessResponse<{ success: boolean; reordered: number }>> {
  return api.put("/investor/tags/reorder", { orderedIds });
}
