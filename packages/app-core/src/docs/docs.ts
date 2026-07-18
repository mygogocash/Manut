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

// List foundation strips wiki body and creator email.
const wikiPageApiSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    slug: z.string().min(1),
    folder: nullableText.optional(),
    parentId: nullableText.optional(),
    isPublished: z.boolean(),
    isRestricted: z.boolean(),
    createdBy: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

export const wikiPageSchema = wikiPageApiSchema.transform((page) => ({
  id: page.id,
  title: page.title,
  slug: page.slug,
  folder: page.folder ?? null,
  parentId: page.parentId ?? null,
  isPublished: page.isPublished,
  isRestricted: page.isRestricted,
  createdBy: page.createdBy
    ? { id: page.createdBy.id, name: page.createdBy.name }
    : null,
}));

const wikiPagesResponseSchema = z
  .object({
    data: z.array(wikiPageSchema),
    meta: paginationMetaSchema,
  })
  .strict();

export const wikiPageListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    search: z.string().trim().min(1).optional(),
    folder: z.string().trim().min(1).optional(),
  })
  .strict();

export type WikiPage = z.infer<typeof wikiPageSchema>;
export type WikiPageListParams = z.input<typeof wikiPageListParamsSchema>;
export type WikiPageList = z.infer<typeof wikiPagesResponseSchema>;

export const DOCS_QUERY_ROOT = ["docs", "list"] as const;

export function wikiPagesQueryKey(params: WikiPageListParams = {}) {
  return [
    ...DOCS_QUERY_ROOT,
    wikiPageListParamsSchema.parse(params),
  ] as const;
}

function encodeWikiQuery(
  params: z.output<typeof wikiPageListParamsSchema>,
): string {
  const entries: Array<[string, string | number | undefined]> = [
    ["page", params.page],
    ["limit", params.limit],
    ["search", params.search],
    ["folder", params.folder],
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

export async function listWikiPages(
  client: ApiClient,
  params: WikiPageListParams = {},
  signal?: RequestAbortSignal,
): Promise<WikiPageList> {
  const query = encodeWikiQuery(wikiPageListParamsSchema.parse(params));
  const response = await client.get<unknown>(
    `/docs?${query}`,
    signal ? { signal } : undefined,
  );
  return wikiPagesResponseSchema.parse(response);
}
