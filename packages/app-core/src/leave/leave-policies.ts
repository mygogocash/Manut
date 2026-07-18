import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";
import { leaveCategorySchema, leaveEntitySchema } from "./leave";

export type LeaveCategory = z.infer<typeof leaveCategorySchema>;

const nullableText = z.string().nullable();

// Admin `/types/all` may include timestamps; project the leave-type receipt.
export const leavePolicySchema = z
  .object({
    id: z.string().min(1),
    entityId: nullableText,
    entity: leaveEntitySchema.nullable(),
    name: z.string().min(1),
    code: z.string().min(1),
    description: nullableText,
    category: leaveCategorySchema,
    daysPerYear: z.number().int().nonnegative(),
    requiresApproval: z.boolean(),
    isPaid: z.boolean(),
    isActive: z.boolean(),
  })
  .transform((policy) => ({
    id: policy.id,
    entityId: policy.entityId,
    entity: policy.entity,
    name: policy.name,
    code: policy.code,
    description: policy.description,
    category: policy.category,
    daysPerYear: policy.daysPerYear,
    requiresApproval: policy.requiresApproval,
    isPaid: policy.isPaid,
    isActive: policy.isActive,
  }));

export type LeavePolicy = z.infer<typeof leavePolicySchema>;

const leavePoliciesResponseSchema = z
  .object({ data: z.array(leavePolicySchema) })
  .strict();

export const leavePolicyListParamsSchema = z
  .object({
    entityId: z.union([z.string().min(1), z.literal("global")]).optional(),
  })
  .strict();

export type LeavePolicyListParams = z.input<typeof leavePolicyListParamsSchema>;

export const LEAVE_POLICIES_QUERY_KEY = ["leave", "policies"] as const;

export function leavePoliciesQueryKey(params?: LeavePolicyListParams) {
  return [
    ...LEAVE_POLICIES_QUERY_KEY,
    leavePolicyListParamsSchema.parse(params ?? {}),
  ] as const;
}

export function leaveCategoryLabel(category: LeaveCategory): string {
  switch (category) {
    case "sick":
      return "Sick";
    case "casual":
      return "Casual";
    case "earned":
      return "Earned";
    case "paid":
      return "Paid";
    case "unpaid":
      return "Unpaid";
    case "other":
      return "Other";
    default: {
      const _exhaustive: never = category;
      return _exhaustive;
    }
  }
}

export async function listLeavePolicies(
  client: ApiClient,
  signal?: RequestAbortSignal,
  params?: LeavePolicyListParams,
): Promise<LeavePolicy[]> {
  const parsed = leavePolicyListParamsSchema.parse(params ?? {});
  const query =
    parsed.entityId !== undefined
      ? `?entityId=${encodeURIComponent(parsed.entityId)}`
      : "";
  const response = await client.get<unknown>(
    `/leave/types/all${query}`,
    signal ? { signal } : undefined,
  );
  return leavePoliciesResponseSchema.parse(response).data;
}

// Re-export entity schema for screen typing convenience.
export { leaveEntitySchema };
