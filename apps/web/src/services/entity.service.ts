import { api } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api.type";

export interface Entity {
  id: string;
  name: string;
  code: string;
  country: string;
  currency: string;
}

export async function listEntities(): Promise<ApiSuccessResponse<Entity[]>> {
  return api.get("/admin/entities");
}

/** Entities for expense forms (requires expense:read, expense:create, or expense:hr-read). */
export async function listExpenseFormEntities(): Promise<
  ApiSuccessResponse<Entity[]>
> {
  return api.get("/expenses/meta/entities");
}
