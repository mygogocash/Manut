import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

// Read-only projection for payroll approval-chain foundation.
export const payrollApprovalStepSchema = z
  .object({
    id: z.string().min(1),
    order: z.number().int().nonnegative(),
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    approverUserId: z.string().min(1),
    approverUser: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
        email: z.string().min(1),
        jobTitle: z.unknown().optional(),
      })
      .nullable()
      .optional(),
    isActive: z.boolean(),
  })
  .passthrough()
  .transform((step) => ({
    id: step.id,
    order: step.order,
    name: step.name,
    description: step.description ?? null,
    approverUserId: step.approverUserId,
    approverUser: step.approverUser
      ? {
          id: step.approverUser.id,
          name: step.approverUser.name,
          email: step.approverUser.email,
        }
      : null,
    isActive: step.isActive,
  }));

const payrollApprovalStepsResponseSchema = z
  .object({
    data: z.array(payrollApprovalStepSchema),
  })
  .strict();

export type PayrollApprovalStep = z.infer<typeof payrollApprovalStepSchema>;

export const PAYROLL_APPROVAL_STEPS_QUERY_KEY = [
  "payroll",
  "approval-steps",
] as const;

export async function listPayrollApprovalSteps(
  client: ApiClient,
  signal?: RequestAbortSignal,
): Promise<PayrollApprovalStep[]> {
  const response = await client.get<unknown>(
    "/payroll/approval-chain/steps",
    signal ? { signal } : undefined,
  );
  return payrollApprovalStepsResponseSchema.parse(response).data;
}
