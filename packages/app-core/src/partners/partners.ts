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

// List foundation strips contracts, website, notes, and owner email.
const partnerApiSchema = z
  .object({
    id: z.string().min(1),
    slug: z.string().min(1),
    company: z.string().min(1),
    type: z.string().min(1),
    status: z.string().min(1),
    department: nullableText.optional(),
    region: nullableText.optional(),
    country: nullableText.optional(),
    sortOrder: z.number().int().optional(),
    owner: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
      })
      .passthrough()
      .nullable()
      .optional(),
    _count: z
      .object({
        projects: z.number().int().nonnegative(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export const partnerSchema = partnerApiSchema.transform((partner) => ({
  id: partner.id,
  slug: partner.slug,
  company: partner.company,
  type: partner.type,
  status: partner.status,
  department: partner.department ?? null,
  region: partner.region ?? null,
  country: partner.country ?? null,
  sortOrder: partner.sortOrder ?? 0,
  projectCount: partner._count?.projects ?? 0,
  owner: partner.owner
    ? { id: partner.owner.id, name: partner.owner.name }
    : null,
}));

const partnersResponseSchema = z
  .object({
    data: z.array(partnerSchema),
    meta: paginationMetaSchema,
  })
  .strict();

export const partnerListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    status: z.string().trim().min(1).optional(),
    type: z.string().trim().min(1).optional(),
    search: z.string().trim().min(1).optional(),
  })
  .strict();

export type Partner = z.infer<typeof partnerSchema>;
export type PartnerListParams = z.input<typeof partnerListParamsSchema>;
export type PartnerList = z.infer<typeof partnersResponseSchema>;

export const PARTNERS_QUERY_ROOT = ["partners", "list"] as const;

export function partnersQueryKey(params: PartnerListParams = {}) {
  return [
    ...PARTNERS_QUERY_ROOT,
    partnerListParamsSchema.parse(params),
  ] as const;
}

function encodePartnerQuery(
  params: z.output<typeof partnerListParamsSchema>,
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

export async function listPartners(
  client: ApiClient,
  params: PartnerListParams = {},
  signal?: RequestAbortSignal,
): Promise<PartnerList> {
  const query = encodePartnerQuery(partnerListParamsSchema.parse(params));
  const response = await client.get<unknown>(
    `/partners?${query}`,
    signal ? { signal } : undefined,
  );
  return partnersResponseSchema.parse(response);
}
