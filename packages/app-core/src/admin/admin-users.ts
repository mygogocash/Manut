import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const nullableText = z.string().nullable();

const adminUserEntitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

const adminUserManagerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().min(1),
});

const adminUserRoleRefSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

// Admin directory receipt: identity + org placement only. Strip salary,
// government IDs, avatars, and other detail-only fields.
export const adminUserSchema = z.object({
  id: z.string().min(1),
  email: z.string().min(1),
  name: z.string().min(1),
  phone: nullableText,
  department: nullableText,
  jobTitle: nullableText,
  employeeId: nullableText,
  employmentType: z.string().min(1),
  location: nullableText,
  country: nullableText,
  isActive: z.boolean(),
  entity: adminUserEntitySchema.nullable(),
  manager: adminUserManagerSchema.nullable(),
  roles: z.array(adminUserRoleRefSchema),
  createdAt: z.string().min(1),
});

const paginationMetaSchema = z
  .object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .strict();

const adminUsersResponseSchema = z
  .object({
    data: z.array(adminUserSchema),
    meta: paginationMetaSchema,
  })
  .strict();

const trimmedOptional = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional();

export const adminUserListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    search: trimmedOptional,
    entityId: z.string().min(1).optional(),
    roleId: z.string().uuid().optional(),
    isActive: z.boolean().optional(),
    department: trimmedOptional,
    employmentType: trimmedOptional,
    sortBy: z
      .enum(["name", "email", "createdAt", "employeeId"])
      .default("name"),
    sortOrder: z.enum(["asc", "desc"]).default("asc"),
  })
  .strict();

export type AdminUser = z.infer<typeof adminUserSchema>;
export type AdminUserListParams = z.input<typeof adminUserListParamsSchema>;
export type AdminUserList = z.infer<typeof adminUsersResponseSchema>;

export const ADMIN_USERS_QUERY_ROOT = ["admin", "users"] as const;

export function adminUsersQueryKey(params: AdminUserListParams) {
  return [
    ...ADMIN_USERS_QUERY_ROOT,
    adminUserListParamsSchema.parse(params),
  ] as const;
}

function encodeAdminUserQuery(
  params: z.output<typeof adminUserListParamsSchema>,
): string {
  const entries: Array<[string, string | number | boolean | undefined]> = [
    ["page", params.page],
    ["limit", params.limit],
    ["search", params.search],
    ["entityId", params.entityId],
    ["roleId", params.roleId],
    ["isActive", params.isActive],
    ["department", params.department],
    ["employmentType", params.employmentType],
    ["sortBy", params.sortBy],
    ["sortOrder", params.sortOrder],
  ];
  return entries
    .filter(
      (entry): entry is [string, string | number | boolean] =>
        entry[1] !== undefined,
    )
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
    .join("&");
}

export async function listAdminUsers(
  client: ApiClient,
  params: AdminUserListParams = {},
  signal?: RequestAbortSignal,
): Promise<AdminUserList> {
  const query = encodeAdminUserQuery(adminUserListParamsSchema.parse(params));
  const response = await client.get<unknown>(
    `/admin/users?${query}`,
    signal ? { signal } : undefined,
  );
  return adminUsersResponseSchema.parse(response);
}
