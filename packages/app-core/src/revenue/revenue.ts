import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

export const revenuePeriodSchema = z.enum(["3m", "6m", "12m", "ytd", "all"]);

export const revenueDashboardParamsSchema = z
  .object({
    period: revenuePeriodSchema.default("12m"),
    entityId: z.string().min(1).optional(),
  })
  .strict();

const investmentSummarySchema = z
  .object({
    totalInvestments: z.number(),
    investorCount: z.number().int().nonnegative(),
    avgInvestment: z.number().optional(),
  })
  .passthrough();

const expenseMonthSchema = z
  .object({
    month: z.string().min(1),
    total: z.number(),
  })
  .passthrough();

const invoiceStatusDetailSchema = z
  .object({
    count: z.number().int().nonnegative(),
    total: z.number(),
  })
  .passthrough();

const invoiceSummarySchema = z
  .object({
    byStatus: z.record(z.string(), invoiceStatusDetailSchema).default({}),
    grandTotal: z.number(),
  })
  .passthrough();

const pipelineStageSchema = z
  .object({
    stage: z.string().min(1),
    count: z.number().int().nonnegative(),
    totalValue: z.number(),
  })
  .passthrough();

const monthlyComparisonSchema = z
  .object({
    month: z.string().min(1),
    revenue: z.number(),
    previousRevenue: z.number(),
    growth: z.number(),
  })
  .passthrough();

// Full dashboard payload is accepted then collapsed to KPI scalars.
// Chart series, entity net-income rows, and invoice status breakdowns
// stay off the Expo foundation surface.
const revenueDashboardApiSchema = z
  .object({
    investments: investmentSummarySchema,
    expenses: z.array(expenseMonthSchema),
    invoices: invoiceSummarySchema,
    revenueByEntity: z.array(z.unknown()).optional(),
    pipeline: z.array(pipelineStageSchema),
    monthly: z.array(monthlyComparisonSchema),
  })
  .passthrough();

const revenueDashboardResponseSchema = z
  .object({
    data: revenueDashboardApiSchema,
  })
  .strict();

export const revenueDashboardSchema = z.object({
  period: revenuePeriodSchema,
  totalInvestments: z.number(),
  investorCount: z.number().int().nonnegative(),
  totalInvoiced: z.number(),
  invoiceCount: z.number().int().nonnegative(),
  totalExpenses: z.number(),
  pipelineValue: z.number(),
  latestGrowth: z.number().nullable(),
});

export type RevenuePeriod = z.infer<typeof revenuePeriodSchema>;
export type RevenueDashboardParams = z.input<
  typeof revenueDashboardParamsSchema
>;
export type RevenueDashboard = z.infer<typeof revenueDashboardSchema>;

export const REVENUE_DASHBOARD_QUERY_ROOT = [
  "revenue",
  "dashboard",
] as const;

export function revenueDashboardQueryKey(
  params: RevenueDashboardParams = {},
) {
  return [
    ...REVENUE_DASHBOARD_QUERY_ROOT,
    revenueDashboardParamsSchema.parse(params),
  ] as const;
}

function encodeRevenueQuery(
  params: z.output<typeof revenueDashboardParamsSchema>,
): string {
  const entries: Array<[string, string | undefined]> = [
    ["period", params.period],
    ["entityId", params.entityId],
  ];
  return entries
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join("&");
}

function projectDashboard(
  data: z.infer<typeof revenueDashboardApiSchema>,
  period: RevenuePeriod,
): RevenueDashboard {
  const invoiceCount = Object.values(data.invoices.byStatus).reduce(
    (sum, detail) => sum + detail.count,
    0,
  );
  const totalExpenses = data.expenses.reduce(
    (sum, month) => sum + month.total,
    0,
  );
  const pipelineValue = data.pipeline.reduce(
    (sum, stage) => sum + stage.totalValue,
    0,
  );
  const latest =
    data.monthly.length > 0 ? data.monthly[data.monthly.length - 1] : undefined;

  return revenueDashboardSchema.parse({
    period,
    totalInvestments: data.investments.totalInvestments,
    investorCount: data.investments.investorCount,
    totalInvoiced: data.invoices.grandTotal,
    invoiceCount,
    totalExpenses,
    pipelineValue,
    latestGrowth: latest ? latest.growth : null,
  });
}

export async function getRevenueDashboard(
  client: ApiClient,
  params: RevenueDashboardParams = {},
  signal?: RequestAbortSignal,
): Promise<RevenueDashboard> {
  const parsed = revenueDashboardParamsSchema.parse(params);
  const query = encodeRevenueQuery(parsed);
  const response = await client.get<unknown>(
    `/revenue/dashboard?${query}`,
    signal ? { signal } : undefined,
  );
  const body = revenueDashboardResponseSchema.parse(response);
  return projectDashboard(body.data, parsed.period);
}
