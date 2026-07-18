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

export const dashboardExpenseSummarySchema = z
  .object({
    month: z.string().min(1),
    expenses: z.number().nonnegative(),
  })
  .strict();

export const dashboardProjectStatusSchema = z
  .object({
    status: z.string().min(1),
    count: z.number().int().nonnegative(),
  })
  .strict();

export const dashboardDepartmentSchema = z
  .object({
    department: z.string().min(1),
    count: z.number().int().nonnegative(),
  })
  .strict();

// Project hub widgets + chart series; strip wall/news/compose payloads.
export const dashboardStatsSchema = z.object({
  kpis: dashboardKpisSchema,
  pendingActions: z.array(dashboardPendingActionSchema),
  expenseSummary: z.array(dashboardExpenseSummarySchema).default([]),
  projectStatusBreakdown: z.array(dashboardProjectStatusSchema).default([]),
  employeesByDepartment: z.array(dashboardDepartmentSchema).default([]),
});

const dashboardStatsResponseSchema = z.object({
  data: dashboardStatsSchema,
});

export type DashboardKpis = z.infer<typeof dashboardKpisSchema>;
export type DashboardPendingAction = z.infer<
  typeof dashboardPendingActionSchema
>;
export type DashboardExpenseSummary = z.infer<
  typeof dashboardExpenseSummarySchema
>;
export type DashboardProjectStatus = z.infer<
  typeof dashboardProjectStatusSchema
>;
export type DashboardDepartment = z.infer<typeof dashboardDepartmentSchema>;
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
