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

// Detail may surface notes for the editor; list projection still strips them.
export const dealDetailSchema = dealApiSchema.transform((deal) => ({
  id: deal.id,
  company: deal.company,
  contact: deal.contact ?? null,
  value: deal.value,
  stage: deal.stage,
  probability: deal.probability,
  type: deal.type ?? null,
  country: deal.country ?? null,
  closeDate: deal.closeDate ?? null,
  notes:
    typeof deal.notes === "string"
      ? deal.notes
      : deal.notes == null
        ? null
        : String(deal.notes),
  owner: { id: deal.owner.id, name: deal.owner.name },
}));

const dealsResponseSchema = z
  .object({
    data: z.array(dealSchema),
    meta: paginationMetaSchema,
  })
  .strict();

const dealDetailResponseSchema = z
  .object({
    data: dealDetailSchema,
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
export type DealDetail = z.infer<typeof dealDetailSchema>;
export type DealListParams = z.input<typeof dealListParamsSchema>;
export type DealList = z.infer<typeof dealsResponseSchema>;

export const DEALS_QUERY_ROOT = ["deals", "list"] as const;
export const DEAL_DETAIL_QUERY_ROOT = ["deals", "detail"] as const;
export const DEALS_PIPELINE_QUERY_ROOT = ["deals", "pipeline"] as const;

export function dealsQueryKey(params: DealListParams = {}) {
  return [...DEALS_QUERY_ROOT, dealListParamsSchema.parse(params)] as const;
}

export function dealDetailQueryKey(dealId: string) {
  return [...DEAL_DETAIL_QUERY_ROOT, dealId] as const;
}

export function dealsPipelineQueryKey() {
  return [...DEALS_PIPELINE_QUERY_ROOT] as const;
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

export const DEAL_STAGES = [
  "lead",
  "qualified",
  "proposal",
  "negotiation",
  "closed_won",
  "closed_lost",
] as const;

export type DealStage = (typeof DEAL_STAGES)[number];

const dealPipelineRowSchema = z
  .object({
    stage: z.string().min(1),
    count: z.number().int().nonnegative(),
    totalValue: moneySchema,
  })
  .strict();

const dealPipelineResponseSchema = z
  .object({
    data: z.array(dealPipelineRowSchema),
  })
  .strict();

export type DealPipelineRow = z.infer<typeof dealPipelineRowSchema>;

export async function getDealPipeline(
  client: ApiClient,
  signal?: RequestAbortSignal,
): Promise<DealPipelineRow[]> {
  const response = await client.get<unknown>(
    "/deals/pipeline",
    signal ? { signal } : undefined,
  );
  return dealPipelineResponseSchema.parse(response).data;
}

export async function getDeal(
  client: ApiClient,
  dealId: string,
  signal?: RequestAbortSignal,
): Promise<DealDetail> {
  const id = z.string().min(1).parse(dealId);
  const response = await client.get<unknown>(
    `/deals/${encodeURIComponent(id)}`,
    signal ? { signal } : undefined,
  );
  return dealDetailResponseSchema.parse(response).data;
}

const trimmedOptional = z
  .string()
  .trim()
  .max(300)
  .optional()
  .transform((value) => {
    if (value === undefined || value.length === 0) return undefined;
    return value;
  });

export const createDealInputSchema = z
  .object({
    company: z.string().trim().min(1, "Company name is required").max(300),
    contact: trimmedOptional,
    value: z.number().nonnegative("Value must be non-negative"),
    stage: z.enum(DEAL_STAGES).default("lead"),
    probability: z.number().int().min(0).max(100).default(10),
    type: z.string().trim().max(100).optional(),
    country: z.string().trim().max(100).optional(),
    partnerId: z.string().min(1).optional(),
    closeDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format")
      .optional(),
    notes: z.string().max(5000).optional(),
  })
  .strict();

export type CreateDealInput = z.input<typeof createDealInputSchema>;

const createdDealResponseSchema = z
  .object({
    data: dealSchema,
  })
  .strict();

export async function createDeal(
  client: ApiClient,
  input: CreateDealInput,
): Promise<Deal> {
  const parsed = createDealInputSchema.parse(input);
  const response = await client.post<unknown>("/deals", parsed);
  return createdDealResponseSchema.parse(response).data;
}

const notesOptional = z
  .string()
  .max(5000)
  .optional()
  .transform((value) => {
    if (value === undefined) return undefined;
    const trimmed = value.trim();
    return trimmed.length === 0 ? "" : trimmed;
  });

export const updateDealInputSchema = z
  .object({
    company: z.string().trim().min(1).max(300).optional(),
    contact: trimmedOptional,
    value: z.number().nonnegative().optional(),
    stage: z.enum(DEAL_STAGES).optional(),
    probability: z.number().int().min(0).max(100).optional(),
    type: z.string().trim().max(100).optional(),
    country: z.string().trim().max(100).optional(),
    partnerId: z.string().min(1).optional(),
    closeDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format")
      .optional(),
    notes: notesOptional,
  })
  .strict()
  .refine((value) => Object.keys(value).length > 0, {
    message: "At least one field is required",
  });

export type UpdateDealInput = z.input<typeof updateDealInputSchema>;

const updatedDealResponseSchema = z
  .object({
    data: dealDetailSchema,
  })
  .strict();

export async function updateDeal(
  client: ApiClient,
  dealId: string,
  input: UpdateDealInput,
): Promise<DealDetail> {
  const id = z.string().min(1).parse(dealId);
  const parsed = updateDealInputSchema.parse(input);
  const response = await client.put<unknown>(
    `/deals/${encodeURIComponent(id)}`,
    parsed,
  );
  return updatedDealResponseSchema.parse(response).data;
}
