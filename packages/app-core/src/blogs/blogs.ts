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

// List foundation strips HTML content, cover image, and author email.
const blogApiSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    slug: z.string().nullable().optional(),
    active: z.boolean(),
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

export const blogSchema = blogApiSchema.transform((blog) => ({
  id: blog.id,
  title: blog.title,
  slug: blog.slug ?? null,
  active: blog.active,
  author: blog.author
    ? { id: blog.author.id, name: blog.author.name }
    : null,
}));

const blogsResponseSchema = z
  .object({
    data: z.array(blogSchema),
    meta: paginationMetaSchema,
  })
  .strict();

export const blogListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    search: z.string().trim().min(1).optional(),
  })
  .strict();

export type Blog = z.infer<typeof blogSchema>;
export type BlogListParams = z.input<typeof blogListParamsSchema>;
export type BlogList = z.infer<typeof blogsResponseSchema>;

export const BLOGS_QUERY_ROOT = ["blogs", "list"] as const;

export function blogsQueryKey(params: BlogListParams = {}) {
  return [...BLOGS_QUERY_ROOT, blogListParamsSchema.parse(params)] as const;
}

function encodeBlogQuery(
  params: z.output<typeof blogListParamsSchema>,
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

export async function listBlogs(
  client: ApiClient,
  params: BlogListParams = {},
  signal?: RequestAbortSignal,
): Promise<BlogList> {
  const query = encodeBlogQuery(blogListParamsSchema.parse(params));
  const response = await client.get<unknown>(
    `/blogs?${query}`,
    signal ? { signal } : undefined,
  );
  return blogsResponseSchema.parse(response);
}
