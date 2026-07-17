import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

export interface PublicHoliday {
  id: string;
  entityId: string;
  date: string;
  name: string;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  entity: { id: string; name: string; code: string };
}

export interface CreateHolidayInput {
  entityId: string;
  date: string;
  name: string;
  notes?: string | null;
  isActive?: boolean;
}

export type UpdateHolidayInput = Partial<Omit<CreateHolidayInput, "entityId">>;

export interface ListHolidaysParams {
  page?: number;
  limit?: number;
  entityId?: string;
  year?: number;
}

function buildQuery(params: Record<string, unknown>): string {
  const qs = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== "") {
      qs.set(key, String(val));
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}

export async function listHolidays(
  params: ListHolidaysParams = {},
): Promise<ApiPaginatedResponse<PublicHoliday>> {
  return api.get(`/holidays${buildQuery(params as Record<string, unknown>)}`);
}

export async function createHoliday(
  input: CreateHolidayInput,
): Promise<ApiSuccessResponse<PublicHoliday>> {
  return api.post("/holidays", input);
}

export async function updateHoliday(
  id: string,
  input: UpdateHolidayInput,
): Promise<ApiSuccessResponse<PublicHoliday>> {
  return api.put(`/holidays/${id}`, input);
}

export async function deleteHoliday(
  id: string,
): Promise<ApiSuccessResponse<{ id: string }>> {
  return api.delete(`/holidays/${id}`);
}
