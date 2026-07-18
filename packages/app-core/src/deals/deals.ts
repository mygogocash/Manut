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

const moneySchema = z
  .union([z.number(), z.string()])
  .transform((value) => Number(value));

// List foundation strips notes, owner email, and partner join.
const dealApiSchema = z
  .object({
    id: z.string().min(1),
    company: z.string().min(1),
    contact: nullableText.optional(),
    value: moneySchema,
    stage: z.string().min(1),
    probability: z.number().int().nonnegative(),
    type: nullableText.optional(),
    country: nullableText.optional(),
    closeDate: z.union([z.string().min(1), z.null()]).optional(),
    notes: z.unknown().optional(),
    owner: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
      })
      .passthrough(),
  })
  .passthrough();

export const dealSchema = dealApiSchema.transform((deal) => ({
  id: deal.id,
  company: deal.company,
  contact: deal.contact ?? null,
  value: deal.value,
  stage: deal.stage,
  probability: deal.probability,
  type: deal.type ?? null,
  country: deal.country ?? null,
  closeDate: deal.closeDate ?? null,
  owner: { id: deal.owner.id, name: deal.owner.name },
}));

const dealsResponseSchema = z
  .object({
    data: z.array(dealSchema),
    meta: paginationMetaSchema,
  })
  .strict();

export const dealListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    stage: z.string().trim().min(1).optional(),
    type: z.string().trim().min(1).optional(),
    search: z.string().trim().min(1).optional(),
  })
  .strict();

export type Deal = z.infer<typeof dealSchema>;
export type DealListParams = z.input<typeof dealListParamsSchema>;
export type DealList = z.infer<typeof dealsResponseSchema>;

export const DEALS_QUERY_ROOT = ["deals", "list"] as const;

export function dealsQueryKey(params: DealListParams = {}) {
  return [...DEALS_QUERY_ROOT, dealListParamsSchema.parse(params)] as const;
}

function encodeDealQuery(params: z.output<typeof dealListParamsSchema>): string {
  const entries: Array<[string, string | number | undefined]> = [
    ["page", params.page],
    ["limit", params.limit],
    ["stage", params.stage],
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

export async function listDeals(
  client: ApiClient,
  params: DealListParams = {},
  signal?: RequestAbortSignal,
): Promise<DealList> {
  const query = encodeDealQuery(dealListParamsSchema.parse(params));
  const response = await client.get<unknown>(
    `/deals?${query}`,
    signal ? { signal } : undefined,
  );
  return dealsResponseSchema.parse(response);
}
