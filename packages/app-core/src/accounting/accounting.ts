import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const apiMoneySchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value));

export const accountTypeSchema = z.enum([
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
]);

export const accountSortFieldSchema = z.enum([
  "code",
  "name",
  "type",
  "balance",
]);

const namedEntitySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});

const parentAccountSchema = z.object({
  id: z.string().min(1),
  code: z.string().min(1),
  name: z.string().min(1),
});

// Chart-of-accounts list receipts keep code/name/type/balance for the
// read-only summary. Lifecycle timestamps, raw entityId, and entity
// currency stay off the client projection. Bank statement fields never
// appear on this endpoint.
const chartOfAccountApiSchema = z
  .object({
    id: z.string().min(1),
    code: z.string().min(1),
    name: z.string().min(1),
    nameTh: z.string().nullable().optional(),
    type: accountTypeSchema,
    isActive: z.boolean(),
    balance: apiMoneySchema,
    entity: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
        currency: z.string().optional(),
      })
      .passthrough(),
    parent: z
      .object({
        id: z.string().min(1),
        code: z.string().min(1),
        name: z.string().min(1),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

export const chartOfAccountSchema = chartOfAccountApiSchema.transform(
  (account) => ({
    id: account.id,
    code: account.code,
    name: account.name,
    nameTh: account.nameTh ?? null,
    type: account.type,
    isActive: account.isActive,
    balance: account.balance,
    entity: namedEntitySchema.parse(account.entity),
    parent: account.parent ? parentAccountSchema.parse(account.parent) : null,
  }),
);

const chartOfAccountsResponseSchema = z
  .object({
    data: z.array(chartOfAccountSchema),
  })
  .strict();

export const chartOfAccountListParamsSchema = z
  .object({
    entityId: z.string().min(1).optional(),
    type: accountTypeSchema.optional(),
    sortBy: accountSortFieldSchema.optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  })
  .strict();

export type AccountType = z.infer<typeof accountTypeSchema>;
export type ChartOfAccount = z.infer<typeof chartOfAccountSchema>;
export type ChartOfAccountListParams = z.input<
  typeof chartOfAccountListParamsSchema
>;
export type ChartOfAccountList = z.infer<typeof chartOfAccountsResponseSchema>;

export const CHART_OF_ACCOUNTS_QUERY_ROOT = [
  "accounting",
  "accounts",
] as const;

export function chartOfAccountsQueryKey(
  params: ChartOfAccountListParams = {},
) {
  return [
    ...CHART_OF_ACCOUNTS_QUERY_ROOT,
    chartOfAccountListParamsSchema.parse(params),
  ] as const;
}

function encodeAccountQuery(
  params: z.output<typeof chartOfAccountListParamsSchema>,
): string {
  const entries: Array<[string, string | undefined]> = [
    ["entityId", params.entityId],
    ["type", params.type],
    ["sortBy", params.sortBy],
    ["sortOrder", params.sortOrder],
  ];
  return entries
    .filter((entry): entry is [string, string] => entry[1] !== undefined)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
    )
    .join("&");
}

export async function listChartOfAccounts(
  client: ApiClient,
  params: ChartOfAccountListParams = {},
  signal?: RequestAbortSignal,
): Promise<ChartOfAccountList> {
  const query = encodeAccountQuery(chartOfAccountListParamsSchema.parse(params));
  const path = query
    ? `/accounting/accounts?${query}`
    : "/accounting/accounts";
  const response = await client.get<unknown>(
    path,
    signal ? { signal } : undefined,
  );
  return chartOfAccountsResponseSchema.parse(response);
}
