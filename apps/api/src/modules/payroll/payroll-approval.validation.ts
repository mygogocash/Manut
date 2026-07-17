import { z } from "zod";

export const createPayrollApprovalStepSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  description: z.string().trim().max(2000).optional(),
  approverUserId: z.string().uuid("Invalid approver user id"),
  isActive: z.boolean().optional(),
});

export const updatePayrollApprovalStepSchema = z
  .object({
    name: z.string().trim().min(1).max(100).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    approverUserId: z.string().uuid().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (v) =>
      v.name !== undefined ||
      v.description !== undefined ||
      v.approverUserId !== undefined ||
      v.isActive !== undefined,
    { message: "Provide at least one field to update" },
  );

export const reorderPayrollApprovalStepsSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
});

export type CreatePayrollApprovalStepInput = z.infer<
  typeof createPayrollApprovalStepSchema
>;
export type UpdatePayrollApprovalStepInput = z.infer<
  typeof updatePayrollApprovalStepSchema
>;
export type ReorderPayrollApprovalStepsInput = z.infer<
  typeof reorderPayrollApprovalStepsSchema
>;
