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

// List foundation strips email/phone/notes and conversion internals.
const leadApiSchema = z
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

export const leadSchema = leadApiSchema.transform((lead) => ({
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
}));

const leadsResponseSchema = z
  .object({
    data: z.array(leadSchema),
    meta: paginationMetaSchema,
  })
  .strict();

export const leadListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    status: z.string().trim().min(1).optional(),
    source: z.string().trim().min(1).optional(),
    search: z.string().trim().min(1).optional(),
  })
  .strict();

export type Lead = z.infer<typeof leadSchema>;
export type LeadListParams = z.input<typeof leadListParamsSchema>;
export type LeadList = z.infer<typeof leadsResponseSchema>;

export const LEADS_QUERY_ROOT = ["leads", "list"] as const;

export function leadsQueryKey(params: LeadListParams = {}) {
  return [...LEADS_QUERY_ROOT, leadListParamsSchema.parse(params)] as const;
}

function encodeLeadQuery(params: z.output<typeof leadListParamsSchema>): string {
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

export async function listLeads(
  client: ApiClient,
  params: LeadListParams = {},
  signal?: RequestAbortSignal,
): Promise<LeadList> {
  const query = encodeLeadQuery(leadListParamsSchema.parse(params));
  const response = await client.get<unknown>(
    `/leads?${query}`,
    signal ? { signal } : undefined,
  );
  return leadsResponseSchema.parse(response);
}
