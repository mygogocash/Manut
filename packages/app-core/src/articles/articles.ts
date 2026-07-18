import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

function toCalendarDate(value: string): string {
  return value.slice(0, 10);
}

const apiCalendarDateSchema = z.string().min(10).transform(toCalendarDate);

const paginationMetaSchema = z
  .object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .strict();

// List foundation strips cover image and author email.
const articleApiSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    link: z.string().min(1),
    date: apiCalendarDateSchema,
    author: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

export const articleSchema = articleApiSchema.transform((article) => ({
  id: article.id,
  title: article.title,
  link: article.link,
  date: article.date,
  author: article.author
    ? { id: article.author.id, name: article.author.name }
    : null,
}));

const articlesResponseSchema = z
  .object({
    data: z.array(articleSchema),
    meta: paginationMetaSchema,
  })
  .strict();

export const articleListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    search: z.string().trim().min(1).optional(),
  })
  .strict();

export type Article = z.infer<typeof articleSchema>;
export type ArticleListParams = z.input<typeof articleListParamsSchema>;
export type ArticleList = z.infer<typeof articlesResponseSchema>;

export const ARTICLES_QUERY_ROOT = ["articles", "list"] as const;

export function articlesQueryKey(params: ArticleListParams = {}) {
  return [
    ...ARTICLES_QUERY_ROOT,
    articleListParamsSchema.parse(params),
  ] as const;
}

function encodeArticleQuery(
  params: z.output<typeof articleListParamsSchema>,
): string {
  const entries: Array<[string, string | number | undefined]> = [
    ["page", params.page],
    ["limit", params.limit],
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

export async function listArticles(
  client: ApiClient,
  params: ArticleListParams = {},
  signal?: RequestAbortSignal,
): Promise<ArticleList> {
  const query = encodeArticleQuery(articleListParamsSchema.parse(params));
  const response = await client.get<unknown>(
    `/articles?${query}`,
    signal ? { signal } : undefined,
  );
  return articlesResponseSchema.parse(response);
}
