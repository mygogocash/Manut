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

// Sales-revenue leads foundation strips email/phone/notes and conversion
// internals (same surface as /sales leads, different API + permissions).
const salesRevenueLeadApiSchema = z
  .object({
    id: z.string().min(1),
    company: z.string().min(1),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    source: nullableText.optional(),
    status: z.string().min(1),
    createdAt: z.string().min(1),
    owner: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

export const salesRevenueLeadSchema = salesRevenueLeadApiSchema.transform(
  (lead) => ({
    id: lead.id,
    company: lead.company,
    firstName: lead.firstName,
    lastName: lead.lastName,
    source: lead.source ?? null,
    status: lead.status,
    createdAt: lead.createdAt,
    owner: lead.owner
      ? { id: lead.owner.id, name: lead.owner.name }
      : null,
  }),
);

const salesRevenueLeadsResponseSchema = z
  .object({
    data: z.array(salesRevenueLeadSchema),
    meta: paginationMetaSchema,
  })
  .strict();

export const salesRevenueLeadListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    status: z.string().trim().min(1).optional(),
    source: z.string().trim().min(1).optional(),
    search: z.string().trim().min(1).optional(),
  })
  .strict();

export type SalesRevenueLead = z.infer<typeof salesRevenueLeadSchema>;
export type SalesRevenueLeadListParams = z.input<
  typeof salesRevenueLeadListParamsSchema
>;
export type SalesRevenueLeadList = z.infer<
  typeof salesRevenueLeadsResponseSchema
>;

export const SALES_REVENUE_LEADS_QUERY_ROOT = [
  "sales-revenue",
  "leads",
] as const;

export function salesRevenueLeadsQueryKey(
  params: SalesRevenueLeadListParams = {},
) {
  return [
    ...SALES_REVENUE_LEADS_QUERY_ROOT,
    salesRevenueLeadListParamsSchema.parse(params),
  ] as const;
}

function encodeSalesRevenueLeadQuery(
  params: z.output<typeof salesRevenueLeadListParamsSchema>,
): string {
  const entries: Array<[string, string | number | undefined]> = [
    ["page", params.page],
    ["limit", params.limit],
    ["status", params.status],
    ["source", params.source],
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

export async function listSalesRevenueLeads(
  client: ApiClient,
  params: SalesRevenueLeadListParams = {},
  signal?: RequestAbortSignal,
): Promise<SalesRevenueLeadList> {
  const query = encodeSalesRevenueLeadQuery(
    salesRevenueLeadListParamsSchema.parse(params),
  );
  const response = await client.get<unknown>(
    `/sales-revenue/leads?${query}`,
    signal ? { signal } : undefined,
  );
  return salesRevenueLeadsResponseSchema.parse(response);
}
