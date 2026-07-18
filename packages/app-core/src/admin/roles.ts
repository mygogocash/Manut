import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const nullableText = z.string().nullable();

// List receipt keeps counts only — permission codes belong in a later
// role-edit slice.
export const roleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: nullableText,
  isSystem: z.boolean(),
  permissionCount: z.number().int().nonnegative(),
  userCount: z.number().int().nonnegative(),
  createdAt: z.string().min(1),
});

const rolesResponseSchema = z
  .object({ data: z.array(roleSchema) })
  .strict();

export type Role = z.infer<typeof roleSchema>;

export const ROLES_QUERY_KEY = ["roles", "list"] as const;

export async function listRoles(
  client: ApiClient,
  signal?: RequestAbortSignal,
): Promise<Role[]> {
  const response = await client.get<unknown>(
    "/roles",
    signal ? { signal } : undefined,
  );
  return rolesResponseSchema.parse(response).data;
}
