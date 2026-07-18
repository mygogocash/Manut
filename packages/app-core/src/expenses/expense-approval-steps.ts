import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const expenseApproverTypeSchema = z.enum(["manager", "user"]);

// Read-only projection for expense approval-chain foundation.
export const expenseApprovalStepSchema = z
  .object({
    id: z.string().min(1),
    order: z.number().int().nonnegative(),
    name: z.string().min(1),
    description: z.string().nullable(),
    approverType: expenseApproverTypeSchema,
    approverUserId: z.string().nullable(),
    approverUser: z
      .object({
        id: z.string().min(1),
        name: z.string().min(1),
        email: z.string().min(1),
      })
      .nullable(),
    isActive: z.boolean(),
  })
  .transform((step) => ({
    id: step.id,
    order: step.order,
    name: step.name,
    description: step.description,
    approverType: step.approverType,
    approverUserId: step.approverUserId,
    approverUser: step.approverUser,
    isActive: step.isActive,
  }));

const expenseApprovalStepsResponseSchema = z
  .object({
    data: z.array(expenseApprovalStepSchema),
  })
  .strict();

export type ExpenseApprovalStep = z.infer<typeof expenseApprovalStepSchema>;
export type ExpenseApproverType = z.infer<typeof expenseApproverTypeSchema>;

export const EXPENSE_APPROVAL_STEPS_QUERY_KEY = [
  "expenses",
  "approval-steps",
] as const;

export async function listExpenseApprovalSteps(
  client: ApiClient,
  signal?: RequestAbortSignal,
): Promise<ExpenseApprovalStep[]> {
  const response = await client.get<unknown>(
    "/expenses/approval-steps",
    signal ? { signal } : undefined,
  );
  return expenseApprovalStepsResponseSchema.parse(response).data;
}

export function expenseApproverTypeLabel(type: ExpenseApproverType): string {
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
