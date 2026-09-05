import { z } from "zod";

import { isValidOptionalYmdRange } from "@/common/optional-ymd-range";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format");

export const leaveSourceEnum = z.enum(["entitled", "carried"]);

export const leaveDurationTypeEnum = z.enum(["full_day", "half_day"]);
export const halfDayPeriodEnum = z.enum(["am", "pm"]);

export const createLeaveRequestSchema = z
  .object({
    leaveTypeId: z.string().min(1, "Leave type is required"),
    startDate: dateString,
    endDate: dateString,
    /** Full-day (date range) or half-day (single date, 0.5 days). */
    durationType: leaveDurationTypeEnum.default("full_day"),
    /** Required when `durationType` is `half_day` — morning or afternoon. */
    halfDayPeriod: halfDayPeriodEnum.optional(),
    reason: z.string().max(1000).optional(),
    /**
     * Which bucket to draw from on approval. Defaults to "entitled"
     * (current-year allowance). "carried" requires a positive carried
     * remainder and an unexpired `carriedExpiry`; the service rejects
     * the request otherwise so the rule sits closer to the data.
     */
    source: leaveSourceEnum.default("entitled"),
    /** When set to another user, requires `leave:hr-on-behalf`. Omitted or same as actor = self-service. */
    employeeId: z.string().uuid().optional(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must not be before start date",
    path: ["endDate"],
  })
  .refine(
    (data) =>
      data.durationType !== "half_day" || data.startDate === data.endDate,
    {
      message: "Half-day leave must use the same start and end date",
      path: ["endDate"],
    },
  )
  .refine(
    (data) =>
      data.durationType !== "half_day" ||
      data.halfDayPeriod === "am" ||
      data.halfDayPeriod === "pm",
    {
      message: "Select A.M. or P.M. for half-day leave",
      path: ["halfDayPeriod"],
    },
  );

export const rejectLeaveRequestSchema = z.object({
  reason: z.string().min(1, "Reason is required").max(1000),
});

export const leaveRequestQuerySchema = z
  .object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    employeeId: z.string().uuid().optional(),
    entityId: z.string().optional(),
    status: z
      .enum([
        "pending",
        "approved",
        "rejected",
        "cancelled",
        "pending_cancellation",
      ])
      .optional(),
    leaveTypeId: z.string().optional(),
    startDate: dateString.optional(),
    endDate: dateString.optional(),
    search: z.string().optional(),
  })
  .refine((q) => isValidOptionalYmdRange(q.startDate, q.endDate), {
    message: "End date must not be before start date",
    path: ["endDate"],
  });

export const balanceQuerySchema = z.object({
  employeeId: z.string().uuid().optional(),
  year: z.coerce.number().int().positive().optional(),
});

export const teamBalanceQuerySchema = z.object({
  year: z.coerce.number().int().positive().optional(),
});

export const balanceDriftQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export type BalanceDriftQuery = z.infer<typeof balanceDriftQuerySchema>;

export const leaveCalendarQuerySchema = z
  .object({
    from: dateString,
    to: dateString,
    department: z.string().max(100).optional(),
  })
  .refine((q) => q.to >= q.from, {
    message: "End date must not be before start date",
    path: ["to"],
  });

export const leaveAnalyticsQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).optional(),
});

export const balanceTransactionsQuerySchema = z.object({
  employeeId: z.string().uuid(),
  year: z.coerce.number().int().min(2000).max(2100),
  leaveTypeId: z.string().optional(),
});

export type BalanceTransactionsQuery = z.infer<
  typeof balanceTransactionsQuerySchema
>;

export const previewApproversQuerySchema = z.object({
  employeeId: z.string().uuid(),
});

export const forwardLeaveRequestSchema = z.object({
  delegateUserId: z.string().uuid(),
});

export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;
export type RejectLeaveRequestInput = z.infer<typeof rejectLeaveRequestSchema>;
export type LeaveRequestQuery = z.infer<typeof leaveRequestQuerySchema>;
export type BalanceQuery = z.infer<typeof balanceQuerySchema>;
export type TeamBalanceQuery = z.infer<typeof teamBalanceQuerySchema>;
export type LeaveCalendarQuery = z.infer<typeof leaveCalendarQuerySchema>;
export type LeaveAnalyticsQuery = z.infer<typeof leaveAnalyticsQuerySchema>;
export const bulkImportBalanceRowSchema = z.object({
  employeeEmail: z.string().email(),
  leaveTypeCode: z.string().min(1),
  year: z.coerce.number().int().min(2000).max(2100),
  /**
   * Optional. When undefined the existing balance's `entitled` is
   * preserved (or 0 for new rows). Rosters that only carry "used" data
   * MUST omit this rather than send 0 — sending 0 wipes the prod policy.
   */
  entitled: z.coerce.number().multipleOf(0.5).min(0).optional(),
  carried: z.coerce.number().multipleOf(0.5).min(0).default(0),
  adjustment: z.coerce.number().multipleOf(0.5).default(0),
  /**
   * Optional pre-existing usage. Lets a roster import seed "already
   * taken" days alongside the entitlement so `remaining` lines up
   * without having to backfill historical leave requests. Half-days
   * (0.5 increments) are accepted to match LeaveRequest.days.
   */
  used: z.coerce.number().multipleOf(0.5).min(0).optional(),
});

export const bulkImportBalanceSchema = z.object({
  rows: z.array(bulkImportBalanceRowSchema).min(1).max(5000),
});

/**
 * HR-driven manual edit of a LeaveBalance row. At least one numeric
 * field must be present; `reason` is captured into the audit
 * description on the resulting BalanceTransaction.
 */
export const updateLeaveBalanceSchema = z
  .object({
    entitled: z.coerce.number().multipleOf(0.5).min(0).optional(),
    used: z.coerce.number().multipleOf(0.5).min(0).optional(),
    carried: z.coerce.number().multipleOf(0.5).min(0).optional(),
    /** Days already consumed from the carried bucket. */
    carriedUsed: z.coerce.number().multipleOf(0.5).min(0).optional(),
    /**
     * Deadline for using the carried bucket. Pass `null` to clear an
     * existing expiry, omit to leave it untouched. Date-only (YYYY-MM-DD)
     * to match the underlying DATE column.
     */
    carriedExpiry: dateString.nullable().optional(),
    adjustment: z.coerce.number().multipleOf(0.5).optional(),
    reason: z.string().min(1).max(500).optional(),
  })
  .refine(
    (data) =>
      data.entitled !== undefined ||
      data.used !== undefined ||
      data.carried !== undefined ||
      data.carriedUsed !== undefined ||
      data.carriedExpiry !== undefined ||
      data.adjustment !== undefined,
    { message: "At least one field must be provided" },
  );

export type UpdateLeaveBalanceInput = z.infer<typeof updateLeaveBalanceSchema>;

/**
 * HR-driven create-or-update for a LeaveBalance row keyed on
 * `(employeeId, leaveTypeId, year)`. Used by the team-balances UI when
 * the row hasn't materialised yet (synthesized from policy default).
 */
export const upsertLeaveBalanceSchema = z.object({
  employeeId: z.string().uuid(),
  leaveTypeId: z.string().min(1),
  year: z.coerce.number().int().min(2000).max(2100),
  entitled: z.coerce.number().multipleOf(0.5).min(0),
  used: z.coerce.number().multipleOf(0.5).min(0).default(0),
  carried: z.coerce.number().multipleOf(0.5).min(0).default(0),
  carriedUsed: z.coerce.number().multipleOf(0.5).min(0).default(0),
  carriedExpiry: dateString.nullable().optional(),
  adjustment: z.coerce.number().multipleOf(0.5).default(0),
  reason: z.string().min(1).max(500).optional(),
});

export type UpsertLeaveBalanceInput = z.infer<typeof upsertLeaveBalanceSchema>;

export type ForwardLeaveRequestInput = z.infer<
  typeof forwardLeaveRequestSchema
>;
export type BulkImportBalanceRow = z.infer<typeof bulkImportBalanceRowSchema>;
export type BulkImportBalanceInput = z.infer<typeof bulkImportBalanceSchema>;

const leaveCategoryEnum = z.enum([
  "sick",
  "casual",
  "earned",
  "paid",
  "unpaid",
  "other",
]);

export const createLeaveTypeSchema = z.object({
  /** Empty string / null = global policy applied to every entity. */
  entityId: z.string().min(1).optional().nullable(),
  name: z.string().min(1, "Name is required").max(100),
  code: z
    .string()
    .min(1, "Code is required")
    .max(20)
    .regex(/^[A-Z0-9_-]+$/, "Code must be uppercase letters, digits, _ or -"),
  description: z.string().max(2000).optional(),
  category: leaveCategoryEnum.default("other"),
  daysPerYear: z.coerce.number().int().min(0).max(365).default(0),
  requiresApproval: z.boolean().default(true),
  isPaid: z.boolean().default(true),
  isActive: z.boolean().default(true),
});

export const updateLeaveTypeSchema = createLeaveTypeSchema.partial();

export type CreateLeaveTypeInput = z.infer<typeof createLeaveTypeSchema>;
export type UpdateLeaveTypeInput = z.infer<typeof updateLeaveTypeSchema>;

const policyApproverSchema = z
  .object({
    approverType: z.enum(["manager", "user"]),
    approverUserId: z.string().uuid().optional().nullable(),
    // Per-step conditions (parity with the org-wide chain) + a whole-day
    // band on the request's day count.
    skipWhenSubmitterIds: z.array(z.string().uuid()).default([]),
    onlyWhenSubmitterIds: z.array(z.string().uuid()).default([]),
    minDays: z.coerce.number().int().min(0).nullable().optional(),
    maxDays: z.coerce.number().int().min(0).nullable().optional(),
  })
  .refine(
    (v) =>
      v.approverType !== "user" ||
      (v.approverUserId && v.approverUserId.length > 0),
    {
      message: "approverUserId is required when approverType is 'user'",
      path: ["approverUserId"],
    },
  )
  .refine(
    (v) => v.minDays == null || v.maxDays == null || v.maxDays >= v.minDays,
    {
      message: "maxDays must be greater than or equal to minDays",
      path: ["maxDays"],
    },
  );

export const setLeavePolicyApproversSchema = z.object({
  approvers: z.array(policyApproverSchema).max(20),
});

export type SetLeavePolicyApproversInput = z.infer<
  typeof setLeavePolicyApproversSchema
>;

// ─── Leave approval chain (admin) ─────────────────────

const leaveApproverTypeEnum = z.enum(["manager", "user"]);

const leaveApprovalStepBase = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(2000).optional(),
  approverType: leaveApproverTypeEnum.default("manager"),
  approverUserId: z.string().uuid().optional().nullable(),
  skipWhenSubmitterIds: z.array(z.string().uuid()).default([]),
  onlyWhenSubmitterIds: z.array(z.string().uuid()).default([]),
  isActive: z.boolean().default(true),
});

export const createLeaveApprovalStepSchema = leaveApprovalStepBase.refine(
  (data) =>
    data.approverType !== "user" ||
    (data.approverUserId && data.approverUserId.length > 0),
  {
    message: "approverUserId is required when approverType is 'user'",
    path: ["approverUserId"],
  },
);

export const updateLeaveApprovalStepSchema = leaveApprovalStepBase
  .partial()
  .refine(
    (data) =>
      data.approverType !== "user" ||
      (data.approverUserId && data.approverUserId.length > 0),
    {
      message: "approverUserId is required when approverType is 'user'",
      path: ["approverUserId"],
    },
  );

export const reorderLeaveApprovalStepsSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1),
});

export type CreateLeaveApprovalStepInput = z.infer<
  typeof createLeaveApprovalStepSchema
>;
export type UpdateLeaveApprovalStepInput = z.infer<
  typeof updateLeaveApprovalStepSchema
>;
export type ReorderLeaveApprovalStepsInput = z.infer<
  typeof reorderLeaveApprovalStepsSchema
>;
