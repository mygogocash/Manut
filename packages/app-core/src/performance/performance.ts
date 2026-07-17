import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const nullableText = z.string().nullable();

export const appraisalStatusSchema = z.enum([
  "pending",
  "self_review",
  "manager_review",
  "completed",
]);

export const goalStatusSchema = z.enum([
  "not_started",
  "in_progress",
  "completed",
]);

export const appraisalGoalSchema = z
  .object({
    id: z.string().uuid(),
    appraisalId: z.string().uuid(),
    title: z.string().min(1),
    description: nullableText,
    weight: z.number().int().nonnegative(),
    selfScore: z.number().int().min(1).max(5).nullable(),
    managerScore: z.number().int().min(1).max(5).nullable(),
    status: goalStatusSchema,
    createdAt: z.string().min(1),
    updatedAt: z.string().min(1),
  })
  .strict();

const appraisalPersonSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1),
    email: z.email(),
    department: nullableText.optional(),
  })
  .strict();

const appraisalCycleRefSchema = z
  .object({
    id: z.string().uuid(),
    name: z.string().min(1),
    status: z.string().min(1),
  })
  .strict();

// Strip unexpected extras from API receipts (e.g. internal notes).
export const appraisalSchema = z.object({
  id: z.string().uuid(),
  cycleId: z.string().uuid(),
  employeeId: z.string().uuid(),
  managerId: z.string().uuid().nullable(),
  status: appraisalStatusSchema,
  selfRating: z.number().int().min(1).max(5).nullable(),
  selfComment: nullableText,
  managerRating: z.number().int().min(1).max(5).nullable(),
  managerComment: nullableText,
  finalRating: z.number().int().min(1).max(5).nullable(),
  completedAt: nullableText,
  cycle: appraisalCycleRefSchema,
  employee: appraisalPersonSchema,
  manager: appraisalPersonSchema.nullable(),
  goals: z.array(appraisalGoalSchema),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});

const paginationMetaSchema = z
  .object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  })
  .strict();

const appraisalListResponseSchema = z
  .object({
    data: z.array(appraisalSchema),
    meta: paginationMetaSchema,
  })
  .strict();

const appraisalDetailResponseSchema = z
  .object({
    data: appraisalSchema,
  })
  .strict();

export const appraisalListParamsSchema = z
  .object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().max(100).default(20),
    cycleId: z.string().uuid().optional(),
    status: appraisalStatusSchema.optional(),
  })
  .strict();

export type AppraisalStatus = z.infer<typeof appraisalStatusSchema>;
export type AppraisalGoal = z.infer<typeof appraisalGoalSchema>;
export type Appraisal = z.infer<typeof appraisalSchema>;
export type AppraisalListParams = z.input<typeof appraisalListParamsSchema>;
export type AppraisalList = z.infer<typeof appraisalListResponseSchema>;

export const PERFORMANCE_APPRAISALS_QUERY_ROOT = [
  "performance",
  "appraisals",
] as const;
export const PERFORMANCE_DETAIL_QUERY_ROOT = [
  "performance",
  "detail",
] as const;

export function performanceAppraisalsQueryKey(params: AppraisalListParams) {
  return [
    ...PERFORMANCE_APPRAISALS_QUERY_ROOT,
    appraisalListParamsSchema.parse(params),
  ] as const;
}

export function performanceDetailQueryKey(appraisalId: string) {
  return [
    ...PERFORMANCE_DETAIL_QUERY_ROOT,
    z.string().uuid().parse(appraisalId),
  ] as const;
}

function encodeQuery(
  params: z.output<typeof appraisalListParamsSchema>,
): string {
  const entries: Array<[string, string | number | undefined]> = [
    ["page", params.page],
    ["limit", params.limit],
    ["cycleId", params.cycleId],
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

export async function listAppraisals(
  client: ApiClient,
  params: AppraisalListParams = {},
  signal?: RequestAbortSignal,
): Promise<AppraisalList> {
  const query = encodeQuery(appraisalListParamsSchema.parse(params));
  const response = await client.get<unknown>(
    `/performance/appraisals?${query}`,
    signal ? { signal } : undefined,
  );
  return appraisalListResponseSchema.parse(response);
}

export async function getAppraisal(
  client: ApiClient,
  appraisalId: string,
  signal?: RequestAbortSignal,
): Promise<Appraisal> {
  const id = z.string().uuid().parse(appraisalId);
  const response = await client.get<unknown>(
    `/performance/appraisals/${encodeURIComponent(id)}`,
    signal ? { signal } : undefined,
  );
  return appraisalDetailResponseSchema.parse(response).data;
}
