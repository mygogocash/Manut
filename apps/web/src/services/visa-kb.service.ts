import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

export interface VisaKbArticle {
  id: string;
  title: string;
  slug: string;
  body: string;
  country: string | null;
  visaType: string | null;
  tags: string[];
  isActive: boolean;
  createdBy: { id: string; name: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface VisaKbArticleInput {
  title: string;
  body: string;
  country?: string;
  visaType?: string;
  tags?: string[];
  isActive?: boolean;
}

export interface ListVisaArticlesParams {
  page?: number;
  limit?: number;
  country?: string;
  visaType?: string;
  includeInactive?: boolean;
}

function buildQuery<T extends object>(params: T): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export async function listVisaArticles(
  params: ListVisaArticlesParams = {},
): Promise<ApiPaginatedResponse<VisaKbArticle>> {
  return api.get(`/visa-kb${buildQuery(params)}`);
}

export async function getVisaArticlesForRecord(
  country?: string,
  visaType?: string,
): Promise<ApiSuccessResponse<VisaKbArticle[]>> {
  return api.get(`/visa-kb/for-record${buildQuery({ country, visaType })}`);
}

export async function getVisaArticle(
  id: string,
): Promise<ApiSuccessResponse<VisaKbArticle>> {
  return api.get(`/visa-kb/${id}`);
}

export async function createVisaArticle(
  input: VisaKbArticleInput,
): Promise<ApiSuccessResponse<VisaKbArticle>> {
  return api.post("/visa-kb", input);
}

export async function updateVisaArticle(
  id: string,
  input: Partial<VisaKbArticleInput>,
): Promise<ApiSuccessResponse<VisaKbArticle>> {
  return api.put(`/visa-kb/${id}`, input);
}

export async function deactivateVisaArticle(
  id: string,
): Promise<ApiSuccessResponse<VisaKbArticle>> {
  return api.delete(`/visa-kb/${id}`);
}
