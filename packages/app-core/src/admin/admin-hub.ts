import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

// Thin admin hub: user headcount KPIs only (no per-user PII / audit).
const userStatsApiSchema = z
  .object({
    total: z.number().int().nonnegative(),
    active: z.number().int().nonnegative(),
    inactive: z.number().int().nonnegative(),
    newThisMonth: z.number().int().nonnegative().optional(),
  })
  .passthrough();

export const adminUserStatsSchema = userStatsApiSchema.transform((row) => ({
  total: row.total,
  active: row.active,
  inactive: row.inactive,
  newThisMonth: row.newThisMonth ?? 0,
}));

const userStatsResponseSchema = z
  .object({
    data: adminUserStatsSchema,
  })
  .strict();

export type AdminUserStats = z.infer<typeof adminUserStatsSchema>;

export const ADMIN_USER_STATS_QUERY_KEY = ["admin", "user-stats"] as const;

export function adminUserStatsQueryKey() {
  return ADMIN_USER_STATS_QUERY_KEY;
}

export async function getAdminUserStats(
  client: ApiClient,
  signal?: RequestAbortSignal,
): Promise<AdminUserStats> {
  const response = await client.get<unknown>(
    "/admin/users/stats",
    signal ? { signal } : undefined,
  );
  return userStatsResponseSchema.parse(response).data;
}
