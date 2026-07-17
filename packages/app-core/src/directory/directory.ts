import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const nullableText = z.string().nullable();

export const directoryEntitySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    code: z.string().min(1),
  })
  .strict();

export const directoryManagerSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1),
    email: z.email(),
    jobTitle: nullableText,
    avatarUrl: nullableText,
  })
  .strict();

export const directoryEmployeeSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1),
    email: z.email(),
    avatarUrl: nullableText,
    phone: nullableText.optional(),
    department: nullableText,
    jobTitle: nullableText,
    employeeId: nullableText,
    employmentType: z.string().min(1),
    location: nullableText,
    country: nullableText,
    isActive: z.boolean(),
    startDate: nullableText,
    salary: z.union([z.string(), z.number()]).nullable().optional(),
    currency: nullableText.optional(),
    entity: directoryEntitySchema.nullable(),
    manager: directoryManagerSchema.nullable(),
  })
  .strict();

export const departmentSchema = z
  .object({
    name: z.string().min(1),
    count: z.number().int().nonnegative(),
  })
  .strict();

const paginationMetaSchema = z
  .object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .strict();

const directoryListResponseSchema = z
  .object({
    data: z.array(directoryEmployeeSchema),
    meta: paginationMetaSchema,
  })
  .strict();

const departmentsResponseSchema = z
  .object({ data: z.array(departmentSchema) })
  .strict();

const trimmedOptional = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional();

export const directoryParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(500).default(24),
    search: trimmedOptional,
    entityId: trimmedOptional,
    department: trimmedOptional,
  })
  .strict();

const directoryDirectReportSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  jobTitle: nullableText,
  avatarUrl: nullableText,
  department: nullableText,
});

const directoryUserRoleSchema = z.object({
  role: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
  }),
});

// Detail endpoints may attach internal metadata; strip extras.
export const directoryEmployeeDetailSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.email(),
  avatarUrl: nullableText,
  phone: nullableText.optional(),
  department: nullableText,
  jobTitle: nullableText,
  employeeId: nullableText,
  employmentType: z.string().min(1),
  location: nullableText,
  country: nullableText,
  isActive: z.boolean(),
  startDate: nullableText,
  salary: z.union([z.string(), z.number()]).nullable().optional(),
  currency: nullableText.optional(),
  entity: directoryEntitySchema.nullable(),
  manager: directoryManagerSchema.nullable(),
  timezone: nullableText,
  createdAt: z.string().min(1),
  directReports: z.array(directoryDirectReportSchema),
  userRoles: z.array(directoryUserRoleSchema),
});

const directoryEmployeeDetailResponseSchema = z
  .object({ data: directoryEmployeeDetailSchema })
  .strict();

export type DirectoryEntity = z.infer<typeof directoryEntitySchema>;
export type DirectoryManager = z.infer<typeof directoryManagerSchema>;
export type DirectoryEmployee = z.infer<typeof directoryEmployeeSchema>;
export type DirectoryEmployeeDetail = z.infer<
  typeof directoryEmployeeDetailSchema
>;
export type DirectoryDirectReport = z.infer<typeof directoryDirectReportSchema>;
export type Department = z.infer<typeof departmentSchema>;
export type DirectoryParams = z.input<typeof directoryParamsSchema>;
export type DirectoryList = z.infer<typeof directoryListResponseSchema>;

export const DIRECTORY_DEPARTMENTS_QUERY_KEY = [
  "directory",
  "departments",
] as const;
export const DIRECTORY_LIST_QUERY_ROOT = ["directory", "list"] as const;
export const DIRECTORY_DETAIL_QUERY_ROOT = ["directory", "detail"] as const;

export type DirectoryAccessTier = "standard" | "sensitive";

export function directoryListAccessQueryKey(
  accessTier: DirectoryAccessTier = "standard",
) {
  return [...DIRECTORY_LIST_QUERY_ROOT, accessTier] as const;
}

export function directoryListQueryKey(
  params: DirectoryParams,
  accessTier: DirectoryAccessTier = "standard",
) {
  return [
    ...directoryListAccessQueryKey(accessTier),
    directoryParamsSchema.parse(params),
  ] as const;
}

function encodeQuery(params: z.output<typeof directoryParamsSchema>): string {
  const entries: Array<[string, string | number | undefined]> = [
    ["page", params.page],
    ["limit", params.limit],
    ["search", params.search],
    ["entityId", params.entityId],
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

export async function listDirectory(
  client: ApiClient,
  params: DirectoryParams = {},
  signal?: RequestAbortSignal,
): Promise<DirectoryList> {
  const query = encodeQuery(directoryParamsSchema.parse(params));
  const response = await client.get<unknown>(
    `/directory?${query}`,
    signal ? { signal } : undefined,
  );
  return directoryListResponseSchema.parse(response);
}

export async function getDirectoryDepartments(
  client: ApiClient,
  signal?: RequestAbortSignal,
): Promise<Department[]> {
  const response = await client.get<unknown>(
    "/directory/departments",
    signal ? { signal } : undefined,
  );
  return departmentsResponseSchema.parse(response).data;
}

export function directoryDetailQueryKey(
  employeeId: string,
  accessTier: DirectoryAccessTier = "standard",
) {
  return [
    ...DIRECTORY_DETAIL_QUERY_ROOT,
    accessTier,
    z.string().uuid().parse(employeeId),
  ] as const;
}

export async function getDirectoryEmployee(
  client: ApiClient,
  employeeId: string,
  signal?: RequestAbortSignal,
): Promise<DirectoryEmployeeDetail> {
  const id = z.string().uuid().parse(employeeId);
  const response = await client.get<unknown>(
    `/directory/${encodeURIComponent(id)}`,
    signal ? { signal } : undefined,
  );
  return directoryEmployeeDetailResponseSchema.parse(response).data;
}

// Strip unexpected extras (e.g. compensation) from org-chart receipts.
export const orgChartNodeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  jobTitle: nullableText,
  department: nullableText,
  avatarUrl: nullableText,
  reportingTo: z.string().uuid().nullable(),
  entity: directoryEntitySchema.nullable(),
});

const orgChartResponseSchema = z
  .object({ data: z.array(orgChartNodeSchema) })
  .strict();

export type OrgChartNode = z.infer<typeof orgChartNodeSchema>;

export const DIRECTORY_ORG_CHART_QUERY_KEY = [
  "directory",
  "org-chart",
] as const;

export async function getDirectoryOrgChart(
  client: ApiClient,
  signal?: RequestAbortSignal,
): Promise<OrgChartNode[]> {
  const response = await client.get<unknown>(
    "/directory/org-chart",
    signal ? { signal } : undefined,
  );
  return orgChartResponseSchema.parse(response).data;
}
