import { api } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api.type";

export interface InvestorTypeOption {
  key: string;
  label: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// Last-resort label when a stored Investor.type key isn't in the
// configurable list (legacy / deleted type): "family_office" → "Family
// Office".
export function prettifyTypeKey(key: string): string {
  if (!key) return "—";
  return key
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export async function listInvestorTypes(): Promise<
  ApiSuccessResponse<InvestorTypeOption[]>
> {
  return api.get("/investor/types");
}

export async function createInvestorType(input: {
  label: string;
}): Promise<ApiSuccessResponse<InvestorTypeOption>> {
  return api.post("/investor/types", input);
}

export async function updateInvestorType(
  key: string,
  input: { label: string },
): Promise<ApiSuccessResponse<InvestorTypeOption>> {
  return api.put(`/investor/types/${key}`, input);
}

export async function deleteInvestorType(
  key: string,
): Promise<ApiSuccessResponse<{ success: boolean; reassignedTo: string }>> {
  return api.delete(`/investor/types/${key}`);
}

export async function reorderInvestorTypes(
  orderedKeys: string[],
): Promise<ApiSuccessResponse<InvestorTypeOption[]>> {
  return api.put("/investor/types/reorder", { orderedKeys });
}
