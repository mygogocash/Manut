import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const nullableText = z.string().nullable();

export const certificateTypeSchema = z.enum([
  "achievement",
  "appreciation",
  "recognition",
]);

export const certificateStatusSchema = z.enum(["draft", "issued"]);

const paginationMetaSchema = z
  .object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative().optional(),
  })
  .passthrough();

// List foundation strips message, fileUrl, signatories, and emails.
const certificateApiSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    type: certificateTypeSchema,
    status: certificateStatusSchema,
    recipientName: z.string().min(1),
    recipientEmail: z.string().optional(),
    issuedAt: nullableText.optional(),
  })
  .passthrough();

export const certificateSchema = certificateApiSchema.transform((row) => ({
  id: row.id,
  title: row.title,
  type: row.type,
  status: row.status,
  recipientName: row.recipientName,
  issuedAt: row.issuedAt ?? null,
}));

const certificateListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
  })
  .strict();

const certificatesResponseSchema = z
  .object({
    data: z.array(certificateSchema),
    meta: paginationMetaSchema,
  })
  .strict();

export type Certificate = z.infer<typeof certificateSchema>;
export type CertificateList = z.infer<typeof certificatesResponseSchema>;
export type CertificateListParams = z.input<typeof certificateListParamsSchema>;
export type CertificateType = z.infer<typeof certificateTypeSchema>;
export type CertificateStatus = z.infer<typeof certificateStatusSchema>;

export const CERTIFICATES_QUERY_ROOT = ["certificates", "list"] as const;

export function certificatesQueryKey(params: CertificateListParams = {}) {
  return [
    ...CERTIFICATES_QUERY_ROOT,
    certificateListParamsSchema.parse(params),
  ] as const;
}

export async function listCertificates(
  client: ApiClient,
  params: CertificateListParams = {},
  signal?: RequestAbortSignal,
): Promise<CertificateList> {
  const parsed = certificateListParamsSchema.parse(params);
  const query = `page=${parsed.page}&limit=${parsed.limit}`;
  const response = await client.get<unknown>(
    `/certificates?${query}`,
    signal ? { signal } : undefined,
  );
  return certificatesResponseSchema.parse(response);
}
