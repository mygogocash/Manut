import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

export interface CompanyNewsAuthor {
  id: string;
  name: string;
}

export interface CompanyNewsAttachment {
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
}

export interface CompanyNews {
  id: string;
  title: string;
  content: string;
  category: string | null;
  isPinned: boolean;
  authorId: string;
  author: CompanyNewsAuthor;
  attachments?: CompanyNewsAttachment[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateNewsInput {
  title: string;
  content: string;
  category?: string;
  isPinned?: boolean;
  attachments?: CompanyNewsAttachment[];
}

export interface UpdateNewsInput {
  title?: string;
  content?: string;
  category?: string;
  isPinned?: boolean;
}

export async function listNews(params?: {
  page?: number;
  limit?: number;
}): Promise<ApiPaginatedResponse<CompanyNews>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  const qs = searchParams.toString();
  return api.get(`/news${qs ? `?${qs}` : ""}`);
}

export async function getNews(
  id: string,
): Promise<ApiSuccessResponse<CompanyNews>> {
  return api.get(`/news/${id}`);
}

export async function createNews(
  input: CreateNewsInput,
): Promise<ApiSuccessResponse<CompanyNews>> {
  return api.post("/news", input);
}

export async function updateNews(
  id: string,
  input: UpdateNewsInput,
): Promise<ApiSuccessResponse<CompanyNews>> {
  return api.put(`/news/${id}`, input);
}

export async function deleteNews(
  id: string,
): Promise<ApiSuccessResponse<{ success: boolean }>> {
  return api.delete(`/news/${id}`);
}
