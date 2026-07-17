import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

export const dashboardKpisSchema = z
  .object({
    totalEmployees: z.number().int().nonnegative(),
    activeProjects: z.number().int().nonnegative(),
    pendingLeaves: z.number().int().nonnegative(),
    pendingTravels: z.number().int().nonnegative(),
    pendingExpenses: z.number().int().nonnegative(),
    expensesThisMonth: z.number().nonnegative(),
  })
  .strict();

export const dashboardPendingActionSchema = z
  .object({
    kind: z.enum(["leave", "travel", "expense"]),
    id: z.string().min(1),
    title: z.string().min(1),
    subtitle: z.string().min(1),
    href: z.string().min(1),
    createdAt: z.string().min(1),
  })
  .strict();

// Project only the hub widgets for Phase 1; strip the rest of /dashboard/stats.
export const dashboardStatsSchema = z.object({
  kpis: dashboardKpisSchema,
  pendingActions: z.array(dashboardPendingActionSchema),
});

const dashboardStatsResponseSchema = z.object({
  data: dashboardStatsSchema,
});

export type DashboardKpis = z.infer<typeof dashboardKpisSchema>;
export type DashboardPendingAction = z.infer<
  typeof dashboardPendingActionSchema
>;
export type DashboardStats = z.infer<typeof dashboardStatsSchema>;

export const DASHBOARD_STATS_QUERY_KEY = ["dashboard", "stats"] as const;

export async function getDashboardStats(
  client: ApiClient,
  signal?: RequestAbortSignal,
): Promise<DashboardStats> {
  const response = await client.get<unknown>(
    "/dashboard/stats",
    signal ? { signal } : undefined,
  );
  return dashboardStatsResponseSchema.parse(response).data;
}
