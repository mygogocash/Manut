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

const nullableDateText = z.union([z.string().min(1), z.null()]);

const projectDetailApiSchema = projectApiSchema.extend({
  startDate: nullableDateText.optional(),
  endDate: nullableDateText.optional(),
  goLiveDate: nullableDateText.optional(),
  workstream: nullableText.optional(),
});

export const projectDetailSchema = projectDetailApiSchema.transform(
  (project) => ({
    id: project.id,
    name: project.name,
    slug: project.slug,
    status: project.status,
    team: project.team ?? "general",
    department: project.department ?? null,
    taskCount: project._count?.tasks ?? 0,
    owner: { id: project.owner.id, name: project.owner.name },
    startDate: project.startDate ?? null,
    endDate: project.endDate ?? null,
    goLiveDate: project.goLiveDate ?? null,
    workstream: project.workstream ?? null,
  }),
);

const projectDetailResponseSchema = z
  .object({
    data: projectDetailSchema,
  })
  .strict();

export type ProjectDetail = z.infer<typeof projectDetailSchema>;

export const PROJECT_DETAIL_QUERY_ROOT = ["projects", "detail"] as const;

export function projectDetailQueryKey(projectId: string) {
  return [...PROJECT_DETAIL_QUERY_ROOT, projectId] as const;
}

export async function getProject(
  client: ApiClient,
  projectId: string,
  signal?: RequestAbortSignal,
): Promise<ProjectDetail> {
  const response = await client.get<unknown>(
    `/projects/${encodeURIComponent(projectId)}`,
    signal ? { signal } : undefined,
  );
  return projectDetailResponseSchema.parse(response).data;
}

const dashboardProjectSummarySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    slug: z.string().min(1),
    status: z.string().min(1),
    department: nullableText.optional(),
    goLiveDate: nullableDateText.optional(),
    revisedGoLiveDate: nullableDateText.optional(),
    updatedAt: z.string().min(1).optional(),
    owner: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
      })
      .passthrough(),
  })
  .passthrough()
  .transform((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
    status: row.status,
    department: row.department ?? null,
    goLiveDate: row.goLiveDate ?? null,
    revisedGoLiveDate: row.revisedGoLiveDate ?? null,
    updatedAt: row.updatedAt ?? null,
    owner: { id: row.owner.id, name: row.owner.name },
  }));

export const projectsDashboardSchema = z
  .object({
    total: z.number().int().nonnegative(),
    productionLive: z.number().int().nonnegative(),
    atRisk: z.number().int().nonnegative(),
    inProgress: z.number().int().nonnegative(),
    byStatus: z.array(
      z
        .object({
          status: z.string().min(1),
          count: z.number().int().nonnegative(),
        })
        .strict(),
    ),
    byDepartment: z.array(
      z
        .object({
          department: nullableText,
          count: z.number().int().nonnegative(),
        })
        .strict(),
    ),
    upcomingGoLives: z.array(dashboardProjectSummarySchema),
    recentUpdates: z.array(dashboardProjectSummarySchema),
  })
  .strict();

const projectsDashboardResponseSchema = z
  .object({
    data: projectsDashboardSchema,
  })
  .strict();

export const projectsDashboardParamsSchema = z
  .object({
    team: z.string().trim().min(1).default("general"),
  })
  .strict();

export type ProjectsDashboard = z.infer<typeof projectsDashboardSchema>;
export type ProjectsDashboardParams = z.input<
  typeof projectsDashboardParamsSchema
>;

export const PROJECTS_DASHBOARD_QUERY_ROOT = [
  "projects",
  "dashboard",
] as const;

export function projectsDashboardQueryKey(
  params: ProjectsDashboardParams = {},
) {
  return [
    ...PROJECTS_DASHBOARD_QUERY_ROOT,
    projectsDashboardParamsSchema.parse(params),
  ] as const;
}

export async function getProjectsDashboard(
  client: ApiClient,
  params: ProjectsDashboardParams = {},
  signal?: RequestAbortSignal,
): Promise<ProjectsDashboard> {
  const { team } = projectsDashboardParamsSchema.parse(params);
  const response = await client.get<unknown>(
    `/projects/dashboard?team=${encodeURIComponent(team)}`,
    signal ? { signal } : undefined,
  );
  return projectsDashboardResponseSchema.parse(response).data;
}
