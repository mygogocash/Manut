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

// List foundation keeps name/status/owner; strips budget, comments,
// member emails, partner company, and board internals.
const projectApiSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    slug: z.string().min(1),
    status: z.string().min(1),
    team: z.string().min(1).optional(),
    department: nullableText.optional(),
    owner: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
      })
      .passthrough(),
    _count: z
      .object({
        tasks: z.number().int().nonnegative(),
      })
      .optional(),
  })
  .passthrough();

export const projectSchema = projectApiSchema.transform((project) => ({
  id: project.id,
  name: project.name,
  slug: project.slug,
  status: project.status,
  team: project.team ?? "general",
  department: project.department ?? null,
  taskCount: project._count?.tasks ?? 0,
  owner: { id: project.owner.id, name: project.owner.name },
}));

const projectsResponseSchema = z
  .object({
    data: z.array(projectSchema),
    meta: paginationMetaSchema,
  })
  .strict();

export const projectListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    team: z.string().trim().min(1).optional(),
    status: z.string().trim().min(1).optional(),
    search: z.string().trim().min(1).optional(),
  })
  .strict();

export type Project = z.infer<typeof projectSchema>;
export type ProjectListParams = z.input<typeof projectListParamsSchema>;
export type ProjectList = z.infer<typeof projectsResponseSchema>;

export const PROJECTS_QUERY_ROOT = ["projects", "list"] as const;

export function projectsQueryKey(params: ProjectListParams = {}) {
  return [
    ...PROJECTS_QUERY_ROOT,
    projectListParamsSchema.parse(params),
  ] as const;
}

function encodeProjectQuery(
  params: z.output<typeof projectListParamsSchema>,
): string {
  const entries: Array<[string, string | number | undefined]> = [
    ["page", params.page],
    ["limit", params.limit],
    ["team", params.team],
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

export async function listProjects(
  client: ApiClient,
  params: ProjectListParams = {},
  signal?: RequestAbortSignal,
): Promise<ProjectList> {
  const query = encodeProjectQuery(projectListParamsSchema.parse(params));
  const response = await client.get<unknown>(
    `/projects?${query}`,
    signal ? { signal } : undefined,
  );
  return projectsResponseSchema.parse(response);
}
