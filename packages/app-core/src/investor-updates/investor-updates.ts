import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const paginationMetaSchema = z
  .object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .strict();

// List foundation strips update body content and sender email.
const investorUpdateApiSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    period: z.string().min(1),
    status: z.string().min(1),
    sentAt: z.union([z.string().min(1), z.null()]).optional(),
    createdAt: z.string().min(1),
    sender: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

export const investorUpdateSchema = investorUpdateApiSchema.transform(
  (update) => ({
    id: update.id,
    title: update.title,
    period: update.period,
    status: update.status,
    sentAt: update.sentAt ?? null,
    createdAt: update.createdAt,
    sender: update.sender
      ? { id: update.sender.id, name: update.sender.name }
      : null,
  }),
);

const investorUpdatesResponseSchema = z
  .object({
    data: z.array(investorUpdateSchema),
    meta: paginationMetaSchema,
  })
  .strict();

export const investorUpdateListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    status: z.string().trim().min(1).optional(),
  })
  .strict();

export type InvestorUpdate = z.infer<typeof investorUpdateSchema>;
export type InvestorUpdateListParams = z.input<
  typeof investorUpdateListParamsSchema
>;
export type InvestorUpdateList = z.infer<typeof investorUpdatesResponseSchema>;

export const INVESTOR_UPDATES_QUERY_ROOT = ["investor-updates", "list"] as const;

export function investorUpdatesQueryKey(params: InvestorUpdateListParams = {}) {
  return [
    ...INVESTOR_UPDATES_QUERY_ROOT,
    investorUpdateListParamsSchema.parse(params),
  ] as const;
}

function encodeInvestorUpdateQuery(
  params: z.output<typeof investorUpdateListParamsSchema>,
): string {
  const entries: Array<[string, string | number | undefined]> = [
    ["page", params.page],
    ["limit", params.limit],
    ["status", params.status],
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

export async function listInvestorUpdates(
  client: ApiClient,
  params: InvestorUpdateListParams = {},
  signal?: RequestAbortSignal,
): Promise<InvestorUpdateList> {
  const query = encodeInvestorUpdateQuery(
    investorUpdateListParamsSchema.parse(params),
  );
  const response = await client.get<unknown>(
    `/investor-updates?${query}`,
    signal ? { signal } : undefined,
  );
  return investorUpdatesResponseSchema.parse(response);
}
