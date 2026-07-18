import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const cashAdvanceApproverTypeSchema = z.enum(["manager", "user"]);

// Read-only projection for cash-advance approval-chain foundation.
export const cashAdvanceApprovalStepSchema = z
  .object({
    id: z.string().min(1),
    order: z.number().int().nonnegative(),
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    approverType: cashAdvanceApproverTypeSchema,
    approverUserId: z.string().nullable(),
    approverUser: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
        email: z.string().min(1),
      })
      .nullable()
      .optional(),
    isActive: z.boolean(),
  })
  .transform((step) => ({
    id: step.id,
    order: step.order,
    name: step.name,
    description: step.description ?? null,
    approverType: step.approverType,
    approverUserId: step.approverUserId,
    approverUser: step.approverUser ?? null,
    isActive: step.isActive,
  }));

const cashAdvanceApprovalStepsResponseSchema = z
  .object({
    data: z.array(cashAdvanceApprovalStepSchema),
  })
  .strict();

export type CashAdvanceApprovalStep = z.infer<
  typeof cashAdvanceApprovalStepSchema
>;
export type CashAdvanceApproverType = z.infer<
  typeof cashAdvanceApproverTypeSchema
>;

export const CASH_ADVANCE_APPROVAL_STEPS_QUERY_KEY = [
  "cash-advance",
  "approval-steps",
] as const;

export async function listCashAdvanceApprovalSteps(
  client: ApiClient,
  signal?: RequestAbortSignal,
): Promise<CashAdvanceApprovalStep[]> {
  const response = await client.get<unknown>(
    "/cash-advance/approval-steps",
    signal ? { signal } : undefined,
  );
  return cashAdvanceApprovalStepsResponseSchema.parse(response).data;
}

export function cashAdvanceApproverTypeLabel(
  type: CashAdvanceApproverType,
): string {
  switch (type) {
    case "manager":
      return "Direct manager";
    case "user":
      return "Specific user";
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}
