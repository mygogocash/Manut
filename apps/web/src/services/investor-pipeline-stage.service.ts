import { api } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api.type";

export interface InvestorPipelineStage {
  key: string;
  label: string;
  color: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// Tailwind top-border palette offered in the Manage stages picker.
export const INVESTOR_STAGE_COLORS = [
  "border-t-zinc-500",
  "border-t-slate-500",
  "border-t-blue-500",
  "border-t-violet-500",
  "border-t-amber-500",
  "border-t-purple-500",
  "border-t-emerald-500",
  "border-t-teal-500",
  "border-t-orange-500",
  "border-t-rose-500",
] as const;

export async function listInvestorStages(): Promise<
  ApiSuccessResponse<InvestorPipelineStage[]>
> {
  return api.get("/investor/pipeline-stages");
}

export async function createInvestorStage(input: {
  label: string;
  color?: string;
}): Promise<ApiSuccessResponse<InvestorPipelineStage>> {
  return api.post("/investor/pipeline-stages", input);
}

export async function updateInvestorStage(
  key: string,
  input: { label?: string; color?: string },
): Promise<ApiSuccessResponse<InvestorPipelineStage>> {
  return api.put(`/investor/pipeline-stages/${key}`, input);
}

export async function deleteInvestorStage(
  key: string,
): Promise<ApiSuccessResponse<{ success: boolean; reassignedTo: string }>> {
  return api.delete(`/investor/pipeline-stages/${key}`);
}

export async function reorderInvestorStages(
  orderedKeys: string[],
): Promise<ApiSuccessResponse<InvestorPipelineStage[]>> {
  return api.put("/investor/pipeline-stages/reorder", { orderedKeys });
}
