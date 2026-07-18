import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const nullableText = z.string().nullable();

const departmentApiSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    code: nullableText.optional(),
    description: nullableText.optional(),
    isActive: z.boolean(),
  })
  .passthrough();

export const adminDepartmentSchema = departmentApiSchema.transform((row) => ({
  id: row.id,
  name: row.name,
  code: row.code ?? null,
  description: row.description ?? null,
  isActive: row.isActive,
}));

const departmentsResponseSchema = z
  .object({
    data: z.array(adminDepartmentSchema),
  })
  .strict();

export type AdminDepartment = z.infer<typeof adminDepartmentSchema>;
export type AdminDepartmentList = z.infer<typeof departmentsResponseSchema>;

export const ADMIN_DEPARTMENTS_QUERY_KEY = [
  "admin",
  "departments",
] as const;

export function adminDepartmentsQueryKey() {
  return ADMIN_DEPARTMENTS_QUERY_KEY;
}

export async function listAdminDepartments(
  client: ApiClient,
  signal?: RequestAbortSignal,
): Promise<AdminDepartmentList> {
  const response = await client.get<unknown>(
    "/admin/departments",
    signal ? { signal } : undefined,
  );
  return departmentsResponseSchema.parse(response);
}
