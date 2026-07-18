import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const travelApproverTypeSchema = z.enum(["manager", "manager_l2", "user"]);

// Read-only projection for travel approval-chain foundation.
export const travelApprovalStepSchema = z
  .object({
    id: z.string().min(1),
    order: z.number().int().nonnegative(),
    name: z.string().min(1),
    description: z.string().nullable().optional(),
    approverType: travelApproverTypeSchema,
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
  .passthrough()
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

const travelApprovalStepsResponseSchema = z
  .object({
    data: z.array(travelApprovalStepSchema),
  })
  .strict();

export type TravelApprovalStep = z.infer<typeof travelApprovalStepSchema>;
export type TravelApproverType = z.infer<typeof travelApproverTypeSchema>;

export const TRAVEL_APPROVAL_STEPS_QUERY_KEY = [
  "travel",
  "approval-steps",
] as const;

export async function listTravelApprovalSteps(
  client: ApiClient,
  signal?: RequestAbortSignal,
): Promise<TravelApprovalStep[]> {
  const response = await client.get<unknown>(
    "/travel/approval-steps",
    signal ? { signal } : undefined,
  );
  return travelApprovalStepsResponseSchema.parse(response).data;
}

export function travelApproverTypeLabel(type: TravelApproverType): string {
  switch (type) {
    case "manager":
      return "Direct manager";
    case "manager_l2":
      return "Second-level manager";
    case "user":
      return "Specific user";
    default: {
      const _exhaustive: never = type;
      return _exhaustive;
    }
  }
}
