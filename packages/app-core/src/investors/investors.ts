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

// List foundation strips contact email/phone, website, notes, and
// investment amount strings.
const investorApiSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    type: z.string().min(1),
    status: z.string().min(1),
    contactName: nullableText.optional(),
    location: nullableText.optional(),
    region: nullableText.optional(),
    title: nullableText.optional(),
    revenueStream: nullableText.optional(),
    lastContactDate: z.union([z.string().min(1), z.null()]).optional(),
    nextAction: nullableText.optional(),
    adder: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
      })
      .passthrough()
      .nullable()
      .optional(),
    _count: z
      .object({
        investments: z.number().int().nonnegative(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const investorSchema = investorApiSchema.transform((investor) => ({
  id: investor.id,
  name: investor.name,
  type: investor.type,
  status: investor.status,
  contactName: investor.contactName ?? null,
  location: investor.location ?? null,
  region: investor.region ?? null,
  title: investor.title ?? null,
  revenueStream: investor.revenueStream ?? null,
  lastContactDate: investor.lastContactDate ?? null,
  nextAction: investor.nextAction ?? null,
  investmentCount: investor._count?.investments ?? 0,
  adder: investor.adder
    ? { id: investor.adder.id, name: investor.adder.name }
    : null,
}));

const investorsResponseSchema = z
  .object({
    data: z.array(investorSchema),
    meta: paginationMetaSchema,
  })
  .strict();

export const investorListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    status: z.string().trim().min(1).optional(),
    type: z.string().trim().min(1).optional(),
    search: z.string().trim().min(1).optional(),
  })
  .strict();

export type Investor = z.infer<typeof investorSchema>;
export type InvestorListParams = z.input<typeof investorListParamsSchema>;
export type InvestorList = z.infer<typeof investorsResponseSchema>;

export const INVESTORS_QUERY_ROOT = ["investors", "list"] as const;

export function investorsQueryKey(params: InvestorListParams = {}) {
  return [
    ...INVESTORS_QUERY_ROOT,
    investorListParamsSchema.parse(params),
  ] as const;
}

function encodeInvestorQuery(
  params: z.output<typeof investorListParamsSchema>,
): string {
  const entries: Array<[string, string | number | undefined]> = [
    ["page", params.page],
    ["limit", params.limit],
    ["status", params.status],
    ["type", params.type],
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

export async function listInvestors(
  client: ApiClient,
  params: InvestorListParams = {},
  signal?: RequestAbortSignal,
): Promise<InvestorList> {
  const query = encodeInvestorQuery(investorListParamsSchema.parse(params));
  const response = await client.get<unknown>(
    `/investors?${query}`,
    signal ? { signal } : undefined,
  );
  return investorsResponseSchema.parse(response);
}

// Dashboard foundation keeps KPI scalars + status counts; strips
// per-currency committed/received breakdowns.
const investorDashboardApiSchema = z
  .object({
    totalInvestors: z.number().int().nonnegative(),
    totalInvestments: z.number().int().nonnegative(),
    totalCommitted: z.number(),
    totalReceived: z.number(),
    totalEstInvestment: z.number(),
    totalActInvestment: z.number(),
    statusBreakdown: z.record(z.string(), z.number().int().nonnegative()),
  })
  .passthrough();

const investorDashboardResponseSchema = z
  .object({
    data: investorDashboardApiSchema,
  })
  .strict();

export const investorDashboardSchema = z
  .object({
    totalInvestors: z.number().int().nonnegative(),
    totalInvestments: z.number().int().nonnegative(),
    totalCommitted: z.number(),
    totalReceived: z.number(),
    totalEstInvestment: z.number(),
    totalActInvestment: z.number(),
    statusBreakdown: z.array(
      z
        .object({
          status: z.string().min(1),
          count: z.number().int().nonnegative(),
        })
        .strict(),
    ),
  })
  .strict();

export type InvestorDashboard = z.infer<typeof investorDashboardSchema>;

export const INVESTOR_DASHBOARD_QUERY_ROOT = [
  "investors",
  "dashboard",
] as const;

export function investorDashboardQueryKey() {
  return [...INVESTOR_DASHBOARD_QUERY_ROOT] as const;
}

export async function getInvestorDashboard(
  client: ApiClient,
  signal?: RequestAbortSignal,
): Promise<InvestorDashboard> {
  const response = await client.get<unknown>(
    "/investors/dashboard",
    signal ? { signal } : undefined,
  );
  const body = investorDashboardResponseSchema.parse(response);
  return investorDashboardSchema.parse({
    totalInvestors: body.data.totalInvestors,
    totalInvestments: body.data.totalInvestments,
    totalCommitted: body.data.totalCommitted,
    totalReceived: body.data.totalReceived,
    totalEstInvestment: body.data.totalEstInvestment,
    totalActInvestment: body.data.totalActInvestment,
    statusBreakdown: Object.entries(body.data.statusBreakdown).map(
      ([status, count]) => ({ status, count }),
    ),
  });
}
