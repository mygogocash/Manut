import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// Wiki / Sticky repository.

export interface WikiPageUser {
  id: string;
  name: string;
  email: string;
}

export interface WikiPageAttachment {
  url: string;
  name: string;
  mimeType: string;
  size: number;
}

export interface WikiPageListItem {
  id: string;
  title: string;
  parentId: string | null;
  position: number;
  folder: string | null;
  slug: string | null;
  isPublished: boolean;
  isRestricted: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy: WikiPageUser;
  updatedBy: WikiPageUser;
}

export interface WikiPage extends WikiPageListItem {
  body: string;
  attachments: WikiPageAttachment[];
}

export interface WikiExtractionResult {
  title: string;
  body: string;
}

export interface CreateWikiPageInput {
  title: string;
  body: string;
  parentId?: string | null;
  position?: number;
  folder?: string;
  slug?: string;
  isPublished?: boolean;
  isRestricted?: boolean;
  attachments?: WikiPageAttachment[];
}

export type UpdateWikiPageInput = Partial<CreateWikiPageInput>;

export interface ListWikiPagesParams {
  page?: number;
  limit?: number;
  folder?: string;
  search?: string;
  includeUnpublished?: boolean;
}

export interface MoveWikiPageInput {
  parentId: string | null;
  position: number;
}

export type WikiPagePermissionLevel = "read" | "edit";

export interface WikiPagePermission {
  id: string;
  pageId: string;
  userId: string;
  level: WikiPagePermissionLevel;
  createdAt: string;
  user: WikiPageUser;
}

export interface WikiPageVersionListItem {
  id: string;
  version: number;
  title: string;
  createdAt: string;
  createdBy: WikiPageUser;
}

export interface WikiPageVersion extends WikiPageVersionListItem {
  body: string;
}

function buildQuery<T extends object>(params: T): string {
  const qs = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== "") {
      qs.set(key, String(val));
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}

export async function listWikiPages(
  params: ListWikiPagesParams = {},
): Promise<ApiPaginatedResponse<WikiPageListItem>> {
  return api.get(`/docs${buildQuery(params)}`);
}

export async function getWikiTree(
  includeUnpublished = false,
): Promise<ApiSuccessResponse<WikiPageListItem[]>> {
  return api.get(
    `/docs/tree${includeUnpublished ? "?includeUnpublished=true" : ""}`,
  );
}

export async function getWikiPage(
  idOrSlug: string,
): Promise<ApiSuccessResponse<WikiPage>> {
  return api.get(`/docs/${encodeURIComponent(idOrSlug)}`);
}

export async function createWikiPage(
  input: CreateWikiPageInput,
): Promise<ApiSuccessResponse<WikiPage>> {
  return api.post("/docs", input);
}

export async function updateWikiPage(
  id: string,
  input: UpdateWikiPageInput,
): Promise<ApiSuccessResponse<WikiPage>> {
  return api.put(`/docs/${id}`, input);
}

export async function deleteWikiPage(id: string): Promise<void> {
  await api.delete(`/docs/${id}`);
}

export async function extractWikiFromAttachment(
  url: string,
  mimeType: string,
): Promise<ApiSuccessResponse<WikiExtractionResult>> {
  return api.post("/docs/extract", { url, mimeType });
}

export async function moveWikiPage(
  id: string,
  input: MoveWikiPageInput,
): Promise<ApiSuccessResponse<WikiPage>> {
  return api.post(`/docs/${id}/move`, input);
}

// ── Versions ─────────────────────────────────────────────────

export async function listWikiPageVersions(
  pageId: string,
): Promise<ApiSuccessResponse<WikiPageVersionListItem[]>> {
  return api.get(`/docs/${pageId}/versions`);
}

export async function getWikiPageVersion(
  pageId: string,
  versionId: string,
): Promise<ApiSuccessResponse<WikiPageVersion>> {
  return api.get(`/docs/${pageId}/versions/${versionId}`);
}

export async function restoreWikiPageVersion(
  pageId: string,
  versionId: string,
): Promise<ApiSuccessResponse<WikiPage>> {
  return api.post(`/docs/${pageId}/versions/${versionId}/restore`, {});
}

// ── Permissions ──────────────────────────────────────────────

export async function listWikiPagePermissions(
  pageId: string,
): Promise<ApiSuccessResponse<WikiPagePermission[]>> {
  return api.get(`/docs/${pageId}/permissions`);
}

export async function grantWikiPagePermission(
  pageId: string,
  userId: string,
  level: WikiPagePermissionLevel,
): Promise<ApiSuccessResponse<WikiPagePermission>> {
  return api.post(`/docs/${pageId}/permissions`, { userId, level });
}

export async function revokeWikiPagePermission(
  pageId: string,
  permissionId: string,
): Promise<void> {
  await api.delete(`/docs/${pageId}/permissions/${permissionId}`);
}
