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

// List foundation keeps name/status/owner; strips description, comment,
// dates, board columns/tasks, member emails, and effort/budget fields.
const crmWorkspaceProjectApiSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    slug: z.string().min(1),
    status: z.string().min(1),
    department: nullableText.optional(),
    sortOrder: z.number().int().optional(),
    owner: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
      })
      .passthrough(),
  })
  .passthrough();

export const crmWorkspaceProjectSchema = crmWorkspaceProjectApiSchema.transform(
  (project) => ({
    id: project.id,
    name: project.name,
    slug: project.slug,
    status: project.status,
    department: project.department ?? null,
    sortOrder: project.sortOrder ?? 0,
    owner: { id: project.owner.id, name: project.owner.name },
  }),
);

const crmWorkspaceListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    status: z.string().trim().min(1).optional(),
    search: z.string().trim().min(1).optional(),
    department: z.string().trim().min(1).optional(),
  })
  .strict();

export type CrmWorkspaceProject = z.infer<typeof crmWorkspaceProjectSchema>;
export type CrmWorkspaceListParams = z.input<typeof crmWorkspaceListParamsSchema>;

function encodeCrmWorkspaceQuery(
  params: z.output<typeof crmWorkspaceListParamsSchema>,
): string {
  const entries: Array<[string, string | number | undefined]> = [
    ["page", params.page],
    ["limit", params.limit],
    ["status", params.status],
    ["search", params.search],
    ["department", params.department],
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

export function createCrmWorkspaceList(options: {
  apiBasePath: `/${string}`;
  queryRoot: readonly [string, ...string[]];
}) {
  const responseSchema = z
    .object({
      data: z.array(crmWorkspaceProjectSchema),
      meta: paginationMetaSchema,
    })
    .strict();

  type List = z.infer<typeof responseSchema>;

  function queryKey(params: CrmWorkspaceListParams = {}) {
    return [
      ...options.queryRoot,
      crmWorkspaceListParamsSchema.parse(params),
    ] as const;
  }

  async function list(
    client: ApiClient,
    params: CrmWorkspaceListParams = {},
    signal?: RequestAbortSignal,
  ): Promise<List> {
    const query = encodeCrmWorkspaceQuery(
      crmWorkspaceListParamsSchema.parse(params),
    );
    const response = await client.get<unknown>(
      `${options.apiBasePath}?${query}`,
      signal ? { signal } : undefined,
    );
    return responseSchema.parse(response);
  }

  return {
    QUERY_ROOT: options.queryRoot,
    projectSchema: crmWorkspaceProjectSchema,
    listParamsSchema: crmWorkspaceListParamsSchema,
    queryKey,
    list,
  };
}
