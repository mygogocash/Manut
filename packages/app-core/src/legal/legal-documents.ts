import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const nullableText = z.string().nullable();

export const legalKindSchema = z.enum([
  "license",
  "agreement",
  "nda",
  "policy",
  "other",
]);

export const legalStatusSchema = z.enum([
  "active",
  "expired",
  "archived",
  "draft",
  "signed",
]);

const paginationMetaSchema = z
  .object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative().optional(),
  })
  .passthrough();

// List foundation strips notes, file URLs, shares, attachments, owner email.
const legalDocumentApiSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    kind: legalKindSchema,
    status: legalStatusSchema,
    effectiveStatus: legalStatusSchema.optional(),
    reference: nullableText.optional(),
    effectiveDate: nullableText.optional(),
    expiryDate: nullableText.optional(),
    effectiveExpiry: nullableText.optional(),
    folder: nullableText.optional(),
    entity: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
      })
      .nullable()
      .optional(),
  })
  .passthrough();

export const legalDocumentSchema = legalDocumentApiSchema.transform((row) => ({
  id: row.id,
  title: row.title,
  kind: row.kind,
  status: row.effectiveStatus ?? row.status,
  reference: row.reference ?? null,
  effectiveDate: row.effectiveDate ?? null,
  expiryDate: row.effectiveExpiry ?? row.expiryDate ?? null,
  folder: row.folder ?? null,
  entityName: row.entity?.name ?? null,
}));

const legalListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
  })
  .strict();

const legalListResponseSchema = z
  .object({
    data: z.array(legalDocumentSchema),
    meta: paginationMetaSchema,
  })
  .strict();

export type LegalDocument = z.infer<typeof legalDocumentSchema>;
export type LegalDocumentList = z.infer<typeof legalListResponseSchema>;
export type LegalDocumentListParams = z.input<typeof legalListParamsSchema>;
export type LegalKind = z.infer<typeof legalKindSchema>;
export type LegalStatus = z.infer<typeof legalStatusSchema>;

export const LEGAL_DOCUMENTS_QUERY_ROOT = ["legal", "documents"] as const;
export const LEGAL_SHARED_QUERY_ROOT = ["legal", "shared"] as const;

export function legalDocumentsQueryKey(params: LegalDocumentListParams = {}) {
  return [
    ...LEGAL_DOCUMENTS_QUERY_ROOT,
    legalListParamsSchema.parse(params),
  ] as const;
}

export function legalSharedQueryKey(params: LegalDocumentListParams = {}) {
  return [
    ...LEGAL_SHARED_QUERY_ROOT,
    legalListParamsSchema.parse(params),
  ] as const;
}

function encodeListQuery(
  params: z.output<typeof legalListParamsSchema>,
): string {
  return `page=${params.page}&limit=${params.limit}`;
}

export async function listLegalDocuments(
  client: ApiClient,
  params: LegalDocumentListParams = {},
  signal?: RequestAbortSignal,
): Promise<LegalDocumentList> {
  const query = encodeListQuery(legalListParamsSchema.parse(params));
  const response = await client.get<unknown>(
    `/legal?${query}`,
    signal ? { signal } : undefined,
  );
  return legalListResponseSchema.parse(response);
}

export async function listSharedLegalDocuments(
  client: ApiClient,
  params: LegalDocumentListParams = {},
  signal?: RequestAbortSignal,
): Promise<LegalDocumentList> {
  const query = encodeListQuery(legalListParamsSchema.parse(params));
  const response = await client.get<unknown>(
    `/legal/shared-with-me?${query}`,
    signal ? { signal } : undefined,
  );
  return legalListResponseSchema.parse(response);
}
