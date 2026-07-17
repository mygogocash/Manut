import { api, apiBaseUrl } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

export interface ArticleAuthor {
  id: string;
  name: string;
}

export interface Article {
  id: string;
  title: string;
  date: string;
  link: string;
  img: string;
  authorId: string;
  author: ArticleAuthor;
  createdAt: string;
  updatedAt: string;
}

export interface CreateArticleInput {
  title: string;
  link: string;
  date: string;
  img: string;
}

export interface UpdateArticleInput {
  title?: string;
  link?: string;
  date?: string;
  img?: string;
}

export async function listArticles(params?: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<ApiPaginatedResponse<Article>> {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set("search", params.search);
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  const qs = searchParams.toString();
  return api.get(`/articles${qs ? `?${qs}` : ""}`);
}

export async function getArticle(
  id: string,
): Promise<ApiSuccessResponse<Article>> {
  return api.get(`/articles/${id}`);
}

export async function createArticle(
  input: CreateArticleInput,
): Promise<ApiSuccessResponse<Article>> {
  return api.post("/articles", input);
}

export async function updateArticle(
  id: string,
  input: UpdateArticleInput,
): Promise<ApiSuccessResponse<Article>> {
  return api.put(`/articles/${id}`, input);
}

export async function deleteArticle(id: string): Promise<void> {
  await api.delete(`/articles/${id}`);
}

export async function downloadArticlesExport(): Promise<void> {
  const res = await fetch(`${apiBaseUrl}/articles/export`, {
    credentials: "include",
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg =
      typeof body?.error === "string"
        ? body.error
        : (body?.error?.message ?? "Export failed");
    throw new Error(msg);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pr-articles-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
