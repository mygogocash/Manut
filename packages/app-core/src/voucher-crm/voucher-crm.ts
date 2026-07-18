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

// List foundation keeps partner/country/counts; strips creator email.
const voucherEntryApiSchema = z
  .object({
    id: z.string().min(1),
    partner: z.string().min(1),
    country: nullableText.optional(),
    redeemed: z.number().int().nonnegative(),
    issued: z.number().int().nonnegative(),
    refund: z.number().int().nonnegative(),
    sortOrder: z.number().int().optional(),
    creator: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

export const voucherEntrySchema = voucherEntryApiSchema.transform((entry) => ({
  id: entry.id,
  partner: entry.partner,
  country: entry.country ?? null,
  redeemed: entry.redeemed,
  issued: entry.issued,
  refund: entry.refund,
  sortOrder: entry.sortOrder ?? 0,
  creator: entry.creator
    ? { id: entry.creator.id, name: entry.creator.name }
    : null,
}));

const voucherTotalsSchema = z
  .object({
    redeemed: z.number().int().nonnegative(),
    issued: z.number().int().nonnegative(),
    refund: z.number().int().nonnegative(),
  })
  .strict();

const vouchersResponseSchema = z
  .object({
    data: z.array(voucherEntrySchema),
    meta: paginationMetaSchema,
    totals: voucherTotalsSchema.optional(),
  })
  .strict();

export const voucherListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    search: z.string().trim().min(1).optional(),
    country: z.string().trim().min(1).optional(),
  })
  .strict();

export type VoucherEntry = z.infer<typeof voucherEntrySchema>;
export type VoucherListParams = z.input<typeof voucherListParamsSchema>;
export type VoucherList = z.infer<typeof vouchersResponseSchema>;

export const VOUCHER_CRM_QUERY_ROOT = ["voucher-crm", "list"] as const;

export function voucherCrmQueryKey(params: VoucherListParams = {}) {
  return [
    ...VOUCHER_CRM_QUERY_ROOT,
    voucherListParamsSchema.parse(params),
  ] as const;
}

function encodeVoucherQuery(
  params: z.output<typeof voucherListParamsSchema>,
): string {
  const entries: Array<[string, string | number | undefined]> = [
    ["page", params.page],
    ["limit", params.limit],
    ["search", params.search],
    ["country", params.country],
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

export async function listVoucherEntries(
  client: ApiClient,
  params: VoucherListParams = {},
  signal?: RequestAbortSignal,
): Promise<VoucherList> {
  const query = encodeVoucherQuery(voucherListParamsSchema.parse(params));
  const response = await client.get<unknown>(
    `/voucher-crm?${query}`,
    signal ? { signal } : undefined,
  );
  return vouchersResponseSchema.parse(response);
}
