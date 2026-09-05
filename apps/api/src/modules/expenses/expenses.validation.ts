import { z } from "zod";

import { isValidOptionalYmdRange } from "@/common/optional-ymd-range";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format");

export const expenseQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    employeeId: z.string().uuid().optional(),
    entityId: z.string().optional(),
    categoryId: z.string().optional(),
    status: z
      .enum([
        "pending",
        "approved",
        "rejected",
        "payroll_processed",
        "reimbursed",
      ])
      .optional(),
    startDate: dateString.optional(),
    endDate: dateString.optional(),
  })
  .refine((q) => isValidOptionalYmdRange(q.startDate, q.endDate), {
    message: "End date must not be before start date",
    path: ["endDate"],
  });

export const createExpenseSchema = z.object({
  entityId: z.string().min(1, "Entity is required"),
  categoryId: z.string().optional(),
  travelRequestId: z.string().uuid().optional(),
  description: z.string().min(1, "Description is required").max(500),
  amount: z.coerce.number().positive("Amount must be positive"),
  currency: z.string().min(1).max(10),
  date: dateString,
  receiptUrl: z.string().url().optional(),
  notes: z.string().max(2000).optional(),
});

export const rejectExpenseSchema = z.object({
  reason: z.string().min(1, "Reason is required").max(1000),
});

export const updateExpenseSchema = createExpenseSchema
  .partial()
  .omit({ entityId: true });

export const createCategorySchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  description: z.string().max(1000).optional(),
  glAccountId: z.string().max(100).optional(),
  isActive: z.boolean().optional(),
  spendingLimit: z.coerce.number().positive().optional(),
  limitPeriod: z.enum(["monthly", "quarterly", "yearly"]).optional(),
  receiptRequired: z.boolean().optional(),
  isAllowance: z.boolean().optional(),
});

export const updateCategorySchema = createCategorySchema.partial();

/** Validated body for POST /exchange-rates (Zod's inferred output is overly optional here). */
export interface UpsertExchangeRateBody {
  baseCurrency: string;
  currency: string;
  rate: number;
  effectiveDate: string;
  source?: string;
}

export const upsertExchangeRateSchema = z.object({
  baseCurrency: z.string().min(1).max(10),
  currency: z.string().min(1).max(10),
  rate: z.coerce.number().positive(),
  effectiveDate: dateString,
  source: z.string().max(50).optional(),
});

export function parseUpsertExchangeRateBody(
  body: unknown,
): UpsertExchangeRateBody {
  const parsed = upsertExchangeRateSchema.parse(body);
  return {
    baseCurrency: parsed.baseCurrency,
    currency: parsed.currency,
    rate: parsed.rate,
    effectiveDate: parsed.effectiveDate,
    ...(parsed.source !== undefined ? { source: parsed.source } : {}),
  };
}

export const convertAmountSchema = z.object({
  amount: z.coerce.number().positive(),
  fromCurrency: z.string().min(1).max(10),
  toCurrency: z.string().min(1).max(10),
});

export type UpsertExchangeRateInput = UpsertExchangeRateBody;
export type ConvertAmountInput = z.infer<typeof convertAmountSchema>;

export type ExpenseQuery = z.infer<typeof expenseQuerySchema>;
export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;
export type RejectExpenseInput = z.infer<typeof rejectExpenseSchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;

// ─── Expense reports ───────────────────────────────────

const periodString = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Period must be YYYY-MM");

export const expenseReportQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  employeeId: z.string().uuid().optional(),
  status: z
    .enum([
      "draft",
      "submitted",
      "approved",
      "rejected",
      "payroll_processed",
      "reimbursed",
    ])
    .optional(),
  period: periodString.optional(),
  // `pendingForMe = true` returns the reports the current user needs
  // to action as a line manager. Cheaper than asking the FE to scope
  // employeeId to all direct reports.
  pendingForMe: z.coerce.boolean().optional(),
  // `includeAll = true` opts an HR caller into the unscoped "every
  // report in the workspace" view. Without it, the service falls back
  // to the safe default of scoping to the caller's own reports — so
  // a stale FE bundle that forgets `employeeId` on the `My reports`
  // tab can never leak other employees' reports.
  includeAll: z.coerce.boolean().optional(),
  /**
   * Free-text match over report title, period and employee name.
   *
   * Server-side deliberately. It used to be a browser-side filter over whichever
   * page of reports had already been fetched, so a name matched only when its row
   * happened to be on screen — and picking a month appeared to "fix" it purely
   * because `period` IS a server filter and cut the set down enough to pull the
   * row onto page one.
   *
   * A blank or whitespace-only value becomes `undefined` rather than an error:
   * the UI sends whatever is in the box, and an empty box means "no filter", not
   * "match the empty string".
   */
  search: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => (v && v.length > 0 ? v : undefined)),
});

// Workspace-wide monthly roll-up (Admin/HR). Optional filters mirror the
// list query so the overview can track the active status filter and a
// chosen year. No pagination — the endpoint rolls up the whole set.
export const monthlyExpenseSummaryQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  status: z
    .enum([
      "draft",
      "submitted",
      "approved",
      "rejected",
      "payroll_processed",
      "reimbursed",
    ])
    .optional(),
  year: z
    .string()
    .regex(/^\d{4}$/, "Year must be YYYY")
    .optional(),
});

export type MonthlyExpenseSummaryQuery = z.infer<
  typeof monthlyExpenseSummaryQuerySchema
>;

export const createExpenseReportSchema = z.object({
  entityId: z.string().min(1, "Entity is required"),
  period: periodString,
  title: z.string().min(1, "Title is required").max(200),
  // `office` is a finance-admin-only bucket — list views relabel the
  // submitter as "Office Admin" so HR can file shared office spend
  // (utilities, supplies) without exposing the individual operator.
  // The service layer enforces the perm gate.
  category: z
    .enum(["general", "business_or_bd", "allowance", "office"])
    .default("general"),
  notes: z.string().max(2000).optional(),
});

export const updateExpenseReportSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  period: periodString.optional(),
  category: z
    .enum(["general", "business_or_bd", "allowance", "office"])
    .optional(),
  notes: z.string().max(2000).optional(),
});

export const addExpenseToReportSchema = z.object({
  categoryId: z.string().optional(),
  travelRequestId: z.string().uuid().optional(),
  description: z.string().min(1, "Description is required").max(500),
  amount: z.coerce.number().positive("Amount must be positive"),
  currency: z.string().min(1).max(10),
  date: dateString,
  receiptUrl: z.string().url().optional(),
  notes: z.string().max(2000).optional(),
});

export const updateExpenseInReportSchema = addExpenseToReportSchema.partial();

export const rejectExpenseReportSchema = z.object({
  reason: z.string().min(1, "Reason is required").max(1000),
});

// Optional approver override — empty body / undefined keeps the full
// running total. When supplied, must be positive and not greater than
// the submitted total (the service enforces the upper bound against
// the report's current total since the request payload doesn't
// include it).
export const approveExpenseReportSchema = z.object({
  approvedAmount: z.coerce.number().positive().optional(),
  notes: z.string().max(1000).optional(),
});

export type ExpenseReportQuery = z.infer<typeof expenseReportQuerySchema>;
export type CreateExpenseReportInput = z.infer<
  typeof createExpenseReportSchema
>;
export type UpdateExpenseReportInput = z.infer<
  typeof updateExpenseReportSchema
>;
export type AddExpenseToReportInput = z.infer<typeof addExpenseToReportSchema>;
export type UpdateExpenseInReportInput = z.infer<
  typeof updateExpenseInReportSchema
>;
export type RejectExpenseReportInput = z.infer<
  typeof rejectExpenseReportSchema
>;
export type ApproveExpenseReportInput = z.infer<
  typeof approveExpenseReportSchema
>;

// ─── Expense approval chain (admin) ───────────────────

// `manager_l2` resolves to the submitter's skip-level manager
// (submitter.reportingTo.reportingTo) at submit time. The per-report
// decision snapshot stores the resolved user as `approverType="user"`
// so every downstream inbox / approve / reject path continues treating
// it as a fixed-user step. Steps that resolve to no L2 user
// (org-chart top) are auto-skipped on submit.
const expenseApproverTypeEnum = z.enum(["manager", "manager_l2", "user"]);

// A `review` step validates and passes the report forward (accept/reject)
// but never finalises it and cannot reduce the approved amount; `approve`
// is the final-sign-off gate (today's default behaviour).
const expenseStageRoleEnum = z.enum(["review", "approve"]);

// Categories drive amount-band routing — mirror TRAVEL_CATEGORIES so
// HR can use the same buckets for both flows. Stored as plain strings.
//
// `allowance` is reserved for the 3-stage allowance approval chain
// (IT-15). Reports never carry it from user input — the service
// layer overrides `category` to `"allowance"` at submit time when
// every line item belongs to an `isAllowance` category. We still
// list it here so the admin approval-step UI can filter steps by
// the allowance bucket.
export const EXPENSE_CATEGORIES = [
  "general",
  "business_or_bd",
  "allowance",
  "office",
] as const;
const expenseCategorySchema = z.enum(EXPENSE_CATEGORIES);

const expenseApprovalStepBase = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(2000).optional(),
  approverType: expenseApproverTypeEnum.default("manager"),
  stageRole: expenseStageRoleEnum.default("approve"),
  approverUserId: z.string().uuid().optional().nullable(),
  skipWhenSubmitterIds: z.array(z.string().uuid()).default([]),
  onlyWhenSubmitterIds: z.array(z.string().uuid()).default([]),
  // Category whitelist — empty list matches all categories.
  categoryFilter: z.array(expenseCategorySchema).default([]),
  // THB amount band — applied against the report's THB-equivalent total.
  amountMinBaht: z.coerce.number().nonnegative().nullable().optional(),
  amountMaxBaht: z.coerce.number().positive().nullable().optional(),
  isActive: z.boolean().default(true),
});

export const createExpenseApprovalStepSchema = expenseApprovalStepBase.refine(
  (data) =>
    data.approverType !== "user" ||
    (data.approverUserId && data.approverUserId.length > 0),
  {
    message: "approverUserId is required when approverType is 'user'",
    path: ["approverUserId"],
  },
);

export const updateExpenseApprovalStepSchema = expenseApprovalStepBase
  .partial()
  .extend({
    // Direct edit of the `order` integer. Reports re-sort by this on
    // every list. We keep the existing `reorderExpenseApprovalSteps`
    // endpoint for sequential drag-style moves; this field is for
    // inline edits when the operator wants to assign a specific slot
    // (e.g. set a new "Allowance" step at order 90 between order 1
    // and the 100-block).
    order: z.coerce.number().int().nonnegative().optional(),
  })
  .refine(
    (data) =>
      data.approverType !== "user" ||
      (data.approverUserId && data.approverUserId.length > 0),
    {
      message: "approverUserId is required when approverType is 'user'",
      path: ["approverUserId"],
    },
  );

export const reorderExpenseApprovalStepsSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
});

export type CreateExpenseApprovalStepInput = z.infer<
  typeof createExpenseApprovalStepSchema
>;
export type UpdateExpenseApprovalStepInput = z.infer<
  typeof updateExpenseApprovalStepSchema
>;
export type ReorderExpenseApprovalStepsInput = z.infer<
  typeof reorderExpenseApprovalStepsSchema
>;

export const upsertExpenseReminderSettingsSchema = z.object({
  reminderDay: z.number().int().min(1).max(31).default(22),
  reminderTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "Must be HH:MM (24-hour)")
    .default("09:00"),
  reminderTimezone: z
    .string()
    .min(1)
    .max(60)
    .refine((tz) => {
      try {
        Intl.DateTimeFormat(undefined, { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, "Invalid IANA timezone")
    .default("Asia/Bangkok"),
  enableThailand: z.boolean().default(true),
  enableInternational: z.boolean().default(true),
});

export type UpsertExpenseReminderSettingsInput = z.infer<
  typeof upsertExpenseReminderSettingsSchema
>;
