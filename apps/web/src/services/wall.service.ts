import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

export interface WallPostAuthor {
  id: string;
  name: string;
}

export interface WallComment {
  id: string;
  postId: string;
  authorId: string;
  author: WallPostAuthor;
  content: string;
  createdAt: string;
}

export type ReactionType = "like" | "love" | "celebrate";

export interface WallAttachment {
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
}

export interface WallPost {
  id: string;
  content: string;
  type: string;
  authorId: string;
  author: WallPostAuthor;
  reactions: Record<ReactionType, string[]>;
  comments: WallComment[];
  attachments?: WallAttachment[] | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePostInput {
  content: string;
  type?: string;
  attachments?: WallAttachment[];
}

export interface UpdatePostInput {
  content: string;
}

export interface ReactToPostInput {
  reaction: ReactionType;
}

export interface AddCommentInput {
  content: string;
}

export async function listPosts(params?: {
  page?: number;
  limit?: number;
}): Promise<ApiPaginatedResponse<WallPost>> {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  const qs = searchParams.toString();
  return api.get(`/wall${qs ? `?${qs}` : ""}`);
}

export async function getPost(
  id: string,
): Promise<ApiSuccessResponse<WallPost>> {
  return api.get(`/wall/${id}`);
}

export async function createPost(
  input: CreatePostInput,
): Promise<ApiSuccessResponse<WallPost>> {
  return api.post("/wall", input);
}

export async function updatePost(
  id: string,
  input: UpdatePostInput,
): Promise<ApiSuccessResponse<WallPost>> {
  return api.put(`/wall/${id}`, input);
}

export async function deletePost(
  id: string,
): Promise<ApiSuccessResponse<{ success: boolean }>> {
  return api.delete(`/wall/${id}`);
}

export async function reactToPost(
  id: string,
  input: ReactToPostInput,
): Promise<ApiSuccessResponse<WallPost>> {
  return api.put(`/wall/${id}/react`, input);
}

export async function addComment(
  postId: string,
  input: AddCommentInput,
): Promise<ApiSuccessResponse<WallComment>> {
  return api.post(`/wall/${postId}/comment`, input);
}
