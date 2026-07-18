import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const leaveApproverTypeSchema = z.enum(["manager", "user"]);

// Read-only projection for approval-chain foundation.
export const leaveApprovalStepSchema = z
  .object({
    id: z.string().min(1),
    order: z.number().int().nonnegative(),
    name: z.string().min(1),
    description: z.string().nullable(),
    approverType: leaveApproverTypeSchema,
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

const leaveApprovalStepsResponseSchema = z
  .object({
    data: z.array(leaveApprovalStepSchema),
  })
  .strict();

export type LeaveApprovalStep = z.infer<typeof leaveApprovalStepSchema>;
export type LeaveApproverType = z.infer<typeof leaveApproverTypeSchema>;

export const LEAVE_APPROVAL_STEPS_QUERY_KEY = [
  "leave",
  "approval-steps",
] as const;

export async function listLeaveApprovalSteps(
  client: ApiClient,
  signal?: RequestAbortSignal,
): Promise<LeaveApprovalStep[]> {
  const response = await client.get<unknown>(
    "/leave/approval-steps",
    signal ? { signal } : undefined,
  );
  return leaveApprovalStepsResponseSchema.parse(response).data;
}

export function leaveApproverTypeLabel(type: LeaveApproverType): string {
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
