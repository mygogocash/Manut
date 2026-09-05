import { z } from "zod";

export const CASH_ADVANCE_STATUSES = [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "disbursed",
  "cleared",
] as const;

export const CASH_ADVANCE_PAYOUT_MODES = ["cash", "bank-transfer"] as const;

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format");

const lineItemBase = z.object({
  description: z.string().min(1, "Description is required").max(500),
  requestedAmount: z.coerce.number().nonnegative(),
  approvedAmount: z.coerce.number().nonnegative().default(0),
  // Optional GL category (shared expense category id) + supporting
  // receipt. Both nullable so a pre-spend advance can omit them.
  categoryId: z.string().nullable().optional(),
  receiptUrl: z.string().url().nullable().optional(),
});

export const createCashAdvanceSchema = z
  .object({
    entityId: z.string().optional(),
    requestDate: dateString.optional(),
    position: z.string().trim().max(120).optional(),
    department: z.string().trim().max(120).optional(),
    directManager: z.string().trim().max(200).optional(),
    payoutMode: z.enum(CASH_ADVANCE_PAYOUT_MODES).default("bank-transfer"),
    bankName: z.string().trim().max(120).optional(),
    bankCountry: z.string().trim().max(120).optional(),
    bankAccountNo: z.string().trim().max(120).optional(),
    swiftCode: z.string().trim().max(40).optional(),
    currency: z.string().trim().min(1).max(10).default("THB"),
    notes: z.string().trim().max(2000).optional(),
    items: z.array(lineItemBase).min(1, "At least one line item is required"),
  })
  .superRefine((val, ctx) => {
    if (val.payoutMode === "bank-transfer") {
      if (!val.bankName?.trim() || !val.bankAccountNo?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["bankName"],
          message: "Bank name + account number are required for bank transfers",
        });
      }
    }
  });

export const updateCashAdvanceSchema = z
  .object({
    entityId: z.string().nullable().optional(),
    requestDate: dateString.optional(),
    position: z.string().trim().max(120).nullable().optional(),
    department: z.string().trim().max(120).nullable().optional(),
    directManager: z.string().trim().max(200).nullable().optional(),
    payoutMode: z.enum(CASH_ADVANCE_PAYOUT_MODES).optional(),
    bankName: z.string().trim().max(120).nullable().optional(),
    bankCountry: z.string().trim().max(120).nullable().optional(),
    bankAccountNo: z.string().trim().max(120).nullable().optional(),
    swiftCode: z.string().trim().max(40).nullable().optional(),
    currency: z.string().trim().min(1).max(10).optional(),
    notes: z.string().trim().max(2000).nullable().optional(),
    items: z.array(lineItemBase).min(1).optional(),
  })
  .strict();

export const approveCashAdvanceSchema = z.object({
  // Optional now that approval is a multi-step chain — only the approver
  // who adjusts/finalises sends per-line approved amounts. Intermediate
  // approvers can approve their step without touching amounts.
  items: z
    .array(
      z.object({
        id: z.string().uuid(),
        approvedAmount: z.coerce.number().nonnegative(),
      }),
    )
    .optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const rejectCashAdvanceSchema = z.object({
  reason: z.string().trim().min(1, "Reason is required").max(1000),
});

export const disburseCashAdvanceSchema = z.object({
  proofUrl: z.string().url("Disbursement proof file is required"),
});

// ── Approval-chain config (mirrors travel) ──
const approverTypeEnum = z.enum(["manager", "user"]);

const approvalStepBase = z.object({
  name: z.string().trim().min(1).max(100),
  description: z.string().trim().max(500).nullable().optional(),
  approverType: approverTypeEnum.default("manager"),
  approverUserId: z.string().uuid().nullable().optional(),
  skipWhenSubmitterIds: z.array(z.string().uuid()).default([]),
  onlyWhenSubmitterIds: z.array(z.string().uuid()).default([]),
  payoutModeFilter: z.array(z.enum(CASH_ADVANCE_PAYOUT_MODES)).default([]),
  amountMin: z.coerce.number().nonnegative().nullable().optional(),
  amountMax: z.coerce.number().nonnegative().nullable().optional(),
  isActive: z.boolean().default(true),
});

const requireUserApprover = (
  data: { approverType?: string; approverUserId?: string | null },
  ctx: z.RefinementCtx,
) => {
  if (data.approverType === "user" && !data.approverUserId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["approverUserId"],
      message: "approverUserId is required when approverType is 'user'",
    });
  }
};

export const createCashAdvanceStepSchema =
  approvalStepBase.superRefine(requireUserApprover);
export const updateCashAdvanceStepSchema = approvalStepBase
  .partial()
  .superRefine(requireUserApprover);
export const reorderCashAdvanceStepsSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1).max(50),
});
export const cashAdvanceRecipientsSchema = z.object({
  emails: z.array(z.string().email()).max(50),
});

export type CreateCashAdvanceStepInput = z.output<
  typeof createCashAdvanceStepSchema
>;
export type UpdateCashAdvanceStepInput = z.output<
  typeof updateCashAdvanceStepSchema
>;
export type ReorderCashAdvanceStepsInput = z.output<
  typeof reorderCashAdvanceStepsSchema
>;

export const cashAdvanceQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(CASH_ADVANCE_STATUSES).optional(),
  employeeId: z.string().uuid().optional(),
  scope: z.enum(["mine", "all"]).default("mine"),
});

export type CreateCashAdvanceInput = z.output<typeof createCashAdvanceSchema>;
export type UpdateCashAdvanceInput = z.output<typeof updateCashAdvanceSchema>;
export type ApproveCashAdvanceInput = z.output<typeof approveCashAdvanceSchema>;
export type RejectCashAdvanceInput = z.output<typeof rejectCashAdvanceSchema>;
export type DisburseCashAdvanceInput = z.output<
  typeof disburseCashAdvanceSchema
>;
export type CashAdvanceQuery = z.output<typeof cashAdvanceQuerySchema>;
