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

// Manage-oriented list projection: keep identity + taxonomy, strip body.
export const visaKbArticleSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    slug: z.string().min(1),
    country: nullableText.optional(),
    visaType: nullableText.optional(),
    tags: z.array(z.string()).default([]),
    isActive: z.boolean(),
    updatedAt: z.string().min(1),
    body: z.unknown().optional(),
    createdBy: z.unknown().optional(),
  })
  .passthrough()
  .transform((article) => ({
    id: article.id,
    title: article.title,
    slug: article.slug,
    country: article.country ?? null,
    visaType: article.visaType ?? null,
    tags: article.tags,
    isActive: article.isActive,
    updatedAt: article.updatedAt,
  }));

const visaKbArticlesResponseSchema = z
  .object({
    data: z.array(visaKbArticleSchema),
    meta: paginationMetaSchema,
  })
  .strict();

export const visaKbArticleListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
  })
  .strict();

export type VisaKbArticle = z.infer<typeof visaKbArticleSchema>;
export type VisaKbArticleListParams = z.input<
  typeof visaKbArticleListParamsSchema
>;
export type VisaKbArticleList = z.infer<typeof visaKbArticlesResponseSchema>;

export const VISA_KB_QUERY_ROOT = ["visa", "knowledge-base"] as const;

export function visaKbArticlesQueryKey(params: VisaKbArticleListParams = {}) {
  return [
    ...VISA_KB_QUERY_ROOT,
    visaKbArticleListParamsSchema.parse(params),
  ] as const;
}

export async function listVisaKbArticles(
  client: ApiClient,
  params: VisaKbArticleListParams = {},
  signal?: RequestAbortSignal,
): Promise<VisaKbArticleList> {
  const parsed = visaKbArticleListParamsSchema.parse(params);
  const query = `page=${encodeURIComponent(String(parsed.page))}&limit=${encodeURIComponent(String(parsed.limit))}`;
  const response = await client.get<unknown>(
    `/visa-kb?${query}`,
    signal ? { signal } : undefined,
  );
  return visaKbArticlesResponseSchema.parse(response);
}
