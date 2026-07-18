import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const paginationMetaSchema = z
  .object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .strict();

// List foundation strips storage path and ownership internals.
const uploadApiSchema = z
  .object({
    id: z.string().min(1),
    originalName: z.string().min(1),
    mimeType: z.string().min(1),
    size: z.number().int().nonnegative(),
    purpose: z.string().nullable().optional(),
    createdAt: z.string().min(1),
    bucket: z.string().min(1).optional(),
  })
  .passthrough();

export const uploadSchema = uploadApiSchema.transform((upload) => ({
  id: upload.id,
  originalName: upload.originalName,
  mimeType: upload.mimeType,
  size: upload.size,
  purpose: upload.purpose ?? null,
  createdAt: upload.createdAt,
  bucket: upload.bucket ?? null,
}));

const uploadsResponseSchema = z
  .object({
    data: z.array(uploadSchema),
    meta: paginationMetaSchema,
  })
  .strict();

export const uploadListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
  })
  .strict();

export type Upload = z.infer<typeof uploadSchema>;
export type UploadListParams = z.input<typeof uploadListParamsSchema>;
export type UploadList = z.infer<typeof uploadsResponseSchema>;

export const UPLOADS_QUERY_ROOT = ["uploads", "list"] as const;

export function uploadsQueryKey(params: UploadListParams = {}) {
  return [
    ...UPLOADS_QUERY_ROOT,
    uploadListParamsSchema.parse(params),
  ] as const;
}

export async function listUploads(
  client: ApiClient,
  params: UploadListParams = {},
  signal?: RequestAbortSignal,
): Promise<UploadList> {
  const { page, limit } = uploadListParamsSchema.parse(params);
  const response = await client.get<unknown>(
    `/uploads?page=${page}&limit=${limit}`,
    signal ? { signal } : undefined,
  );
  return uploadsResponseSchema.parse(response);
}

const signedUrlResponseSchema = z
  .object({
    data: z
      .object({
        url: z.string().url(),
      })
      .strict(),
  })
  .strict();

export type UploadSignedUrl = z.infer<
  typeof signedUrlResponseSchema
>["data"];

export async function getUploadSignedUrl(
  client: ApiClient,
  uploadId: string,
  signal?: RequestAbortSignal,
): Promise<UploadSignedUrl> {
  const response = await client.get<unknown>(
    `/uploads/${encodeURIComponent(uploadId)}/signed-url`,
    signal ? { signal } : undefined,
  );
  return signedUrlResponseSchema.parse(response).data;
}

export const createUploadInputSchema = z
  .object({
    base64: z.string().min(1),
    originalName: z.string().min(1).max(255),
    mimeType: z.string().min(1).max(255),
    bucket: z
      .enum([
        "article",
        "avatars",
        "blog",
        "receipts",
        "documents",
        "uploads",
      ])
      .optional(),
    purpose: z.string().min(1).max(100).optional(),
  })
  .strict();

export type CreateUploadInput = z.input<typeof createUploadInputSchema>;

const createdUploadResponseSchema = z
  .object({
    data: uploadSchema,
  })
  .strict();

export async function createUpload(
  client: ApiClient,
  input: CreateUploadInput,
): Promise<Upload> {
  const parsed = createUploadInputSchema.parse(input);
  const response = await client.post<unknown>("/uploads", parsed);
  return createdUploadResponseSchema.parse(response).data;
}

const deleteUploadResponseSchema = z
  .object({
    message: z.string().min(1),
  })
  .strict();

export type DeleteUploadResult = z.infer<typeof deleteUploadResponseSchema>;

export async function deleteUpload(
  client: ApiClient,
  uploadId: string,
): Promise<DeleteUploadResult> {
  const response = await client.delete<unknown>(
    `/uploads/${encodeURIComponent(uploadId)}`,
  );
  return deleteUploadResponseSchema.parse(response);
}
