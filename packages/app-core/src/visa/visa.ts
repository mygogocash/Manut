import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const nullableText = z.string().nullable();

function toCalendarDate(value: string): string {
  return value.slice(0, 10);
}

const apiCalendarDateSchema = z.string().min(10).transform(toCalendarDate);

const nullableCalendarDateSchema = z.union([
  z.string().min(10).transform(toCalendarDate),
  z.null(),
]);

const paginationMetaSchema = z
  .object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .strict();

export const visaHolderTypeSchema = z.enum(["employee", "dependent"]);

export const visaStatusSchema = z.enum([
  "active",
  "expired",
  "pending",
  "processing",
]);

export const visaDocumentCategorySchema = z.enum([
  "passport_front",
  "visa_page",
  "work_permit",
  "other",
]);

const visaEmployeeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().min(1),
});

const visaDocumentApiSchema = z.object({
  name: z.string().min(1),
  url: z.string().optional(),
  category: visaDocumentCategorySchema,
});

// List/detail receipts strip notes and raw storage URLs; downloads go
// through the signed-url endpoint.
const visaRecordApiSchema = z
  .object({
    id: z.string().min(1),
    holderType: visaHolderTypeSchema.default("employee"),
    holderName: nullableText,
    holderRelationship: nullableText,
    visaType: z.string().min(1),
    country: z.string().min(1),
    nationality: nullableText,
    issueDate: nullableCalendarDateSchema,
    expiryDate: apiCalendarDateSchema,
    workPermitExpiryDate: nullableCalendarDateSchema,
    status: visaStatusSchema,
    documentUrl: nullableText.optional(),
    documents: z.array(visaDocumentApiSchema).default([]),
    notes: z.unknown().optional(),
    employee: visaEmployeeSchema,
    entity: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
      })
      .nullable()
      .optional(),
  })
  .passthrough();

export const visaRecordSchema = visaRecordApiSchema.transform((record) => ({
  id: record.id,
  holderType: record.holderType,
  holderName: record.holderName,
  holderRelationship: record.holderRelationship,
  visaType: record.visaType,
  country: record.country,
  nationality: record.nationality,
  issueDate: record.issueDate,
  expiryDate: record.expiryDate,
  workPermitExpiryDate: record.workPermitExpiryDate,
  status: record.status,
  documentCount: record.documents.length > 0
    ? record.documents.length
    : record.documentUrl
      ? 1
      : 0,
  employee: record.employee,
  entityName: record.entity?.name ?? null,
}));

export const visaRecordDetailSchema = visaRecordApiSchema.transform(
  (record) => ({
    id: record.id,
    holderType: record.holderType,
    holderName: record.holderName,
    holderRelationship: record.holderRelationship,
    visaType: record.visaType,
    country: record.country,
    nationality: record.nationality,
    issueDate: record.issueDate,
    expiryDate: record.expiryDate,
    workPermitExpiryDate: record.workPermitExpiryDate,
    status: record.status,
    documents: record.documents.map((doc) => ({
      name: doc.name,
      category: doc.category,
    })),
    hasLegacyDocument: Boolean(record.documentUrl),
    employee: record.employee,
    entityName: record.entity?.name ?? null,
  }),
);

const visaListResponseSchema = z
  .object({
    data: z.array(visaRecordSchema),
    meta: paginationMetaSchema,
  })
  .strict();

const visaDetailResponseSchema = z
  .object({
    data: visaRecordDetailSchema,
  })
  .strict();

const visaDownloadResponseSchema = z
  .object({
    data: z.object({
      url: z.string().url(),
      name: z.string().min(1),
    }),
  })
  .strict();

export const visaListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    status: visaStatusSchema.optional(),
    search: z.string().trim().min(1).optional(),
  })
  .strict();

export type VisaHolderType = z.infer<typeof visaHolderTypeSchema>;
export type VisaStatus = z.infer<typeof visaStatusSchema>;
export type VisaDocumentCategory = z.infer<typeof visaDocumentCategorySchema>;
export type VisaRecord = z.infer<typeof visaRecordSchema>;
export type VisaRecordDetail = z.infer<typeof visaRecordDetailSchema>;
export type VisaListParams = z.input<typeof visaListParamsSchema>;
export type VisaList = z.infer<typeof visaListResponseSchema>;
export type VisaDownload = z.infer<typeof visaDownloadResponseSchema>["data"];

export const VISAS_QUERY_ROOT = ["visa", "list"] as const;
export const VISA_DETAIL_QUERY_ROOT = ["visa", "detail"] as const;

export function visasQueryKey(params: VisaListParams = {}) {
  return [...VISAS_QUERY_ROOT, visaListParamsSchema.parse(params)] as const;
}

export function visaDetailQueryKey(visaId: string) {
  return [...VISA_DETAIL_QUERY_ROOT, visaId] as const;
}

function encodeVisaQuery(params: z.output<typeof visaListParamsSchema>): string {
  const entries: Array<[string, string | number | undefined]> = [
    ["page", params.page],
    ["limit", params.limit],
    ["status", params.status],
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

export async function listVisas(
  client: ApiClient,
  params: VisaListParams = {},
  signal?: RequestAbortSignal,
): Promise<VisaList> {
  const query = encodeVisaQuery(visaListParamsSchema.parse(params));
  const response = await client.get<unknown>(
    `/visa?${query}`,
    signal ? { signal } : undefined,
  );
  return visaListResponseSchema.parse(response);
}

export async function getVisa(
  client: ApiClient,
  visaId: string,
  signal?: RequestAbortSignal,
): Promise<VisaRecordDetail> {
  const id = z.string().min(1).parse(visaId);
  const response = await client.get<unknown>(
    `/visa/${encodeURIComponent(id)}`,
    signal ? { signal } : undefined,
  );
  return visaDetailResponseSchema.parse(response).data;
}

export const visaDownloadParamsSchema = z
  .object({
    docIndex: z.number().int().nonnegative().optional(),
  })
  .strict();

export type VisaDownloadParams = z.input<typeof visaDownloadParamsSchema>;

export async function getVisaDownloadUrl(
  client: ApiClient,
  visaId: string,
  params: VisaDownloadParams = {},
  signal?: RequestAbortSignal,
): Promise<VisaDownload> {
  const id = z.string().min(1).parse(visaId);
  const parsed = visaDownloadParamsSchema.parse(params);
  const query =
    parsed.docIndex === undefined
      ? ""
      : `?docIndex=${encodeURIComponent(String(parsed.docIndex))}`;
  const response = await client.get<unknown>(
    `/visa/${encodeURIComponent(id)}/download${query}`,
    signal ? { signal } : undefined,
  );
  return visaDownloadResponseSchema.parse(response).data;
}
