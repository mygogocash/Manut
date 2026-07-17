import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

export interface CompanyDateAttachment {
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
}

export interface CompanyDate {
  id: string;
  title: string;
  date: string;
  type: string;
  location: string | null;
  authorId: string;
  attachments?: CompanyDateAttachment[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCompanyDateInput {
  title: string;
  date: string;
  type: string;
  location?: string;
  attachments?: CompanyDateAttachment[];
}

export interface UpdateCompanyDateInput {
  title?: string;
  date?: string;
  type?: string;
  location?: string;
}

export async function listDates(params?: {
  page?: number;
  limit?: number;
}): Promise<ApiPaginatedResponse<CompanyDate>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  const qs = searchParams.toString();
  return api.get(`/company-dates${qs ? `?${qs}` : ""}`);
}

export async function getDate(
  id: string,
): Promise<ApiSuccessResponse<CompanyDate>> {
  return api.get(`/company-dates/${id}`);
}

export async function createDate(
  input: CreateCompanyDateInput,
): Promise<ApiSuccessResponse<CompanyDate>> {
  return api.post("/company-dates", input);
}

export async function updateDate(
  id: string,
  input: UpdateCompanyDateInput,
): Promise<ApiSuccessResponse<CompanyDate>> {
  return api.put(`/company-dates/${id}`, input);
}

export async function deleteDate(
  id: string,
): Promise<ApiSuccessResponse<{ success: boolean }>> {
  return api.delete(`/company-dates/${id}`);
}
