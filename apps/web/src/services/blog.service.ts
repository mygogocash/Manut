import { api, apiBaseUrl } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

export interface BlogAuthor {
  id: string;
  name: string;
}

export interface Blog {
  id: string;
  title: string;
  content: string;
  coverImage: string;
  slug: string | null;
  active: boolean;
  authorId: string;
  author: BlogAuthor;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBlogInput {
  title: string;
  content: string;
  coverImage: string;
  slug?: string;
  active?: boolean;
}

export interface UpdateBlogInput {
  title?: string;
  content?: string;
  coverImage?: string;
  slug?: string | null;
  active?: boolean;
}

export async function listBlogs(params?: {
  search?: string;
  page?: number;
  limit?: number;
}): Promise<ApiPaginatedResponse<Blog>> {
  const searchParams = new URLSearchParams();
  if (params?.search) searchParams.set("search", params.search);
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  const qs = searchParams.toString();
  return api.get(`/blogs${qs ? `?${qs}` : ""}`);
}

export async function getBlog(id: string): Promise<ApiSuccessResponse<Blog>> {
  return api.get(`/blogs/${id}`);
}

export async function createBlog(
  input: CreateBlogInput,
): Promise<ApiSuccessResponse<Blog>> {
  return api.post("/blogs", input);
}

export async function updateBlog(
  id: string,
  input: UpdateBlogInput,
): Promise<ApiSuccessResponse<Blog>> {
  return api.put(`/blogs/${id}`, input);
}

export async function deleteBlog(id: string): Promise<void> {
  await api.delete(`/blogs/${id}`);
}

export async function downloadBlogsExport(): Promise<void> {
  const res = await fetch(`${apiBaseUrl}/blogs/export`, {
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
  a.download = `blogs-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
