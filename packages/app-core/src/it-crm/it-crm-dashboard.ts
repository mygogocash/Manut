import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const nullableText = z.string().nullable();
const nullableDateText = z.union([z.string().min(1), z.null()]);

const dashboardProjectSummarySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    slug: z.string().min(1),
    status: z.string().min(1),
    department: nullableText.optional(),
    goLiveDate: nullableDateText.optional(),
    revisedGoLiveDate: nullableDateText.optional(),
    updatedAt: z.union([z.string().min(1), z.date()]).optional(),
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
    updatedAt:
      row.updatedAt instanceof Date
        ? row.updatedAt.toISOString()
        : (row.updatedAt ?? null),
    owner: { id: row.owner.id, name: row.owner.name },
  }));

// Full IT dashboard payload is accepted then collapsed to the projects-
// dashboard KPI surface. Helpdesk SLA, flow analytics, comments on
// blocked/recent rows, and task deep-dives stay off the Expo foundation.
const itCrmDashboardApiSchema = z
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
        .passthrough(),
    ),
    byDepartment: z.array(
      z
        .object({
          department: nullableText,
          count: z.number().int().nonnegative(),
        })
        .passthrough(),
    ),
    upcomingGoLives: z.array(z.unknown()).default([]),
    recentUpdates: z.array(z.unknown()).default([]),
  })
  .passthrough();

const itCrmDashboardResponseSchema = z
  .object({
    data: itCrmDashboardApiSchema,
  })
  .strict();

export const itCrmDashboardSchema = z
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

export type ItCrmDashboard = z.infer<typeof itCrmDashboardSchema>;

export const IT_CRM_DASHBOARD_QUERY_ROOT = ["it-crm", "dashboard"] as const;

export function itCrmDashboardQueryKey() {
  return [...IT_CRM_DASHBOARD_QUERY_ROOT] as const;
}

export async function getItCrmDashboard(
  client: ApiClient,
  signal?: RequestAbortSignal,
): Promise<ItCrmDashboard> {
  const response = await client.get<unknown>(
    "/it-crm/dashboard",
    signal ? { signal } : undefined,
  );
  const body = itCrmDashboardResponseSchema.parse(response);
  return itCrmDashboardSchema.parse({
    total: body.data.total,
    productionLive: body.data.productionLive,
    atRisk: body.data.atRisk,
    inProgress: body.data.inProgress,
    byStatus: body.data.byStatus.map((bucket) => ({
      status: bucket.status,
      count: bucket.count,
    })),
    byDepartment: body.data.byDepartment.map((bucket) => ({
      department: bucket.department,
      count: bucket.count,
    })),
    upcomingGoLives: body.data.upcomingGoLives,
    recentUpdates: body.data.recentUpdates,
  });
}
