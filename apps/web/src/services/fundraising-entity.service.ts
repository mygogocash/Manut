import { api } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api.type";

export const DEFAULT_FUNDRAISING_ENTITY = "tbh";

export interface FundraisingEntity {
  key: string;
  label: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export async function listFundraisingEntities(): Promise<
  ApiSuccessResponse<FundraisingEntity[]>
> {
  return api.get("/investor/entities");
}

export async function createFundraisingEntity(input: {
  label: string;
}): Promise<ApiSuccessResponse<FundraisingEntity>> {
  return api.post("/investor/entities", input);
}

export async function updateFundraisingEntity(
  key: string,
  input: { label: string },
): Promise<ApiSuccessResponse<FundraisingEntity>> {
  return api.put(`/investor/entities/${key}`, input);
}

export async function deleteFundraisingEntity(
  key: string,
): Promise<ApiSuccessResponse<{ success: boolean; reassignedTo: string }>> {
  return api.delete(`/investor/entities/${key}`);
}

export async function reorderFundraisingEntities(
  orderedKeys: string[],
): Promise<ApiSuccessResponse<FundraisingEntity[]>> {
  return api.put("/investor/entities/reorder", { orderedKeys });
}
