import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const nullableText = z.string().nullable();

const paginationMetaSchema = z
  .object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .strict();

// List foundation strips storage fileUrl and uploader email.
const dataRoomDocumentApiSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: nullableText.optional(),
    category: z.string().min(1),
    fileSize: z.number().int().nonnegative().nullable().optional(),
    mimeType: nullableText.optional(),
    version: z.number().int().positive().optional(),
    uploadedAt: z.string().min(1),
    uploader: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

export const dataRoomDocumentSchema = dataRoomDocumentApiSchema.transform(
  (document) => ({
    id: document.id,
    name: document.name,
    description: document.description ?? null,
    category: document.category,
    fileSize: document.fileSize ?? null,
    mimeType: document.mimeType ?? null,
    version: document.version ?? 1,
    uploadedAt: document.uploadedAt,
    uploader: document.uploader
      ? { id: document.uploader.id, name: document.uploader.name }
      : null,
  }),
);

const dataRoomDocumentsResponseSchema = z
  .object({
    data: z.array(dataRoomDocumentSchema),
    meta: paginationMetaSchema,
  })
  .strict();

export const dataRoomListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    category: z.string().trim().min(1).optional(),
    search: z.string().trim().min(1).optional(),
  })
  .strict();

export type DataRoomDocument = z.infer<typeof dataRoomDocumentSchema>;
export type DataRoomListParams = z.input<typeof dataRoomListParamsSchema>;
export type DataRoomList = z.infer<typeof dataRoomDocumentsResponseSchema>;

export const DATAROOM_QUERY_ROOT = ["dataroom", "list"] as const;

export function dataRoomDocumentsQueryKey(params: DataRoomListParams = {}) {
  return [
    ...DATAROOM_QUERY_ROOT,
    dataRoomListParamsSchema.parse(params),
  ] as const;
}

function encodeDataRoomQuery(
  params: z.output<typeof dataRoomListParamsSchema>,
): string {
  const entries: Array<[string, string | number | undefined]> = [
    ["page", params.page],
    ["limit", params.limit],
    ["category", params.category],
    ["search", params.search],
  ];
  return entries
    .filter(
      (entry): entry is [string, string | number] => entry[1] !== undefined,
    )
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
    .join("&");
}

export async function listDataRoomDocuments(
  client: ApiClient,
  params: DataRoomListParams = {},
  signal?: RequestAbortSignal,
): Promise<DataRoomList> {
  const query = encodeDataRoomQuery(dataRoomListParamsSchema.parse(params));
  const response = await client.get<unknown>(
    `/dataroom?${query}`,
    signal ? { signal } : undefined,
  );
  return dataRoomDocumentsResponseSchema.parse(response);
}
