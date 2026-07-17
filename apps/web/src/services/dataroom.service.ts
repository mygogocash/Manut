import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// ─── Types ──────────────────────────────────────────────

export interface DocumentUploader {
  id: string;
  name: string;
  email: string;
}

export interface DataRoomDocument {
  id: string;
  name: string;
  description: string | null;
  category: string;
  fileUrl: string;
  fileSize: number | null;
  mimeType: string | null;
  version: number;
  uploadedBy: string;
  uploader: DocumentUploader;
  uploadedAt: string;
}

export interface CreateDocumentInput {
  name: string;
  description?: string;
  category: string;
  fileUrl: string;
  fileSize?: number;
  mimeType?: string;
}

export interface UpdateDocumentInput {
  name?: string;
  description?: string | null;
  category?: string;
}

export interface DataRoomParams {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
}

export interface CategorySummary {
  category: string;
  count: number;
  totalSize: number;
}

export const DOCUMENT_CATEGORIES = [
  "legal",
  "financial",
  "technical",
  "pitch",
  "other",
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  legal: "Legal",
  financial: "Financial",
  technical: "Technical",
  pitch: "Pitch",
  other: "Other",
};

// ─── Helpers ────────────────────────────────────────────

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

export function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

// ─── Service ────────────────────────────────────────────

export async function listDocuments(
  params: DataRoomParams = {},
): Promise<ApiPaginatedResponse<DataRoomDocument>> {
  return api.get(`/dataroom${buildQuery(params)}`);
}

export async function getDocument(
  id: string,
): Promise<ApiSuccessResponse<DataRoomDocument>> {
  return api.get(`/dataroom/${id}`);
}

export async function uploadDocument(
  input: CreateDocumentInput,
): Promise<ApiSuccessResponse<DataRoomDocument>> {
  return api.post("/dataroom", input);
}

export async function updateDocument(
  id: string,
  input: UpdateDocumentInput,
): Promise<ApiSuccessResponse<DataRoomDocument>> {
  return api.put(`/dataroom/${id}`, input);
}

export async function deleteDocument(id: string): Promise<void> {
  await api.delete(`/dataroom/${id}`);
}

export async function getCategorySummary(): Promise<
  ApiSuccessResponse<CategorySummary[]>
> {
  return api.get("/dataroom/summary");
}
