import { api, apiBaseUrl } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api.type";

type StorageBucket =
  | "article"
  | "avatars"
  | "blog"
  | "receipts"
  | "documents"
  | "uploads";

interface UploadedFile {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  bucket: string;
  url: string;
  purpose?: string;
  linkedTo?: string;
  linkedId?: string;
  createdAt: string;
}

interface SignedUrlResponse {
  url: string;
}

/**
 * Upload a file using multipart/form-data (preferred for large files).
 */
export async function uploadFile(
  file: File,
  options?: {
    bucket?: StorageBucket;
    purpose?: string;
    linkedTo?: string;
    linkedId?: string;
  },
): Promise<UploadedFile> {
  const formData = new FormData();
  formData.append("file", file);
  if (options?.bucket) formData.append("bucket", options.bucket);
  if (options?.purpose) formData.append("purpose", options.purpose);
  if (options?.linkedTo) formData.append("linkedTo", options.linkedTo);
  if (options?.linkedId) formData.append("linkedId", options.linkedId);

  const res = await fetch(`${apiBaseUrl}/uploads/multipart`, {
    method: "POST",
    headers: { "X-Requested-With": "XMLHttpRequest" },
    credentials: "include",
    body: formData,
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || "Upload failed");
  }

  const body: ApiSuccessResponse<UploadedFile> = await res.json();
  return body.data;
}

/**
 * Upload a file using base64 encoding (for smaller files / inline use).
 */
export async function uploadBase64(
  file: File,
  options?: {
    bucket?: StorageBucket;
    purpose?: string;
    linkedTo?: string;
    linkedId?: string;
  },
): Promise<UploadedFile> {
  const base64 = await fileToBase64(file);

  const res = await api.post<ApiSuccessResponse<UploadedFile>>("/uploads", {
    base64,
    originalName: file.name,
    mimeType: file.type,
    bucket: options?.bucket || "uploads",
    purpose: options?.purpose,
    linkedTo: options?.linkedTo,
    linkedId: options?.linkedId,
  });

  return res.data;
}

export async function listUploads(page = 1, limit = 20) {
  return api.get<{
    data: UploadedFile[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }>(`/uploads?page=${page}&limit=${limit}`);
}

export async function getSignedUrl(uploadId: string): Promise<string> {
  const res = await api.get<ApiSuccessResponse<SignedUrlResponse>>(
    `/uploads/${uploadId}/signed-url`,
  );
  return res.data.url;
}

export async function deleteUpload(uploadId: string): Promise<void> {
  await api.delete(`/uploads/${uploadId}`);
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
