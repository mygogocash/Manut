import { z } from "zod";

export const ACCESS_REQUEST_TYPES = [
  "new",
  "modify",
  "revoke",
  "temporary",
  "emergency",
] as const;

export const ACCESS_REQUEST_STATUSES = [
  "draft",
  "pending-manager",
  "pending-it",
  "approved",
  "rejected",
  "granted",
  "revoked",
] as const;

const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
  .nullable()
  .optional();

// ── Systems (admin-editable dynamic list) ──
export const createSystemSchema = z.object({
  name: z.string().trim().min(1).max(150),
  description: z.string().trim().max(1000).nullable().optional(),
  category: z.string().trim().max(50).nullable().optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});
export const updateSystemSchema = createSystemSchema.partial();

// ── Access requests ──
export const createRequestSchema = z
  .object({
    systemId: z.string().min(1),
    requestType: z.enum(ACCESS_REQUEST_TYPES).default("new"),
    requestedAccessLevel: z.string().trim().min(1).max(200),
    businessJustification: z.string().trim().min(1).max(2000),
    startDate: optionalDate,
    endDate: optionalDate,
    // HR/IT submitting on behalf - optional, defaults to the caller.
    employeeId: z.string().uuid().optional(),
  })
  .superRefine((val, ctx) => {
    if (
      (val.requestType === "temporary" || val.requestType === "emergency") &&
      !val.endDate
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endDate"],
        message: "End date is required for temporary / emergency access",
      });
    }
  });

export const updateRequestSchema = z.object({
  systemId: z.string().min(1).optional(),
  requestType: z.enum(ACCESS_REQUEST_TYPES).optional(),
  requestedAccessLevel: z.string().trim().min(1).max(200).optional(),
  businessJustification: z.string().trim().min(1).max(2000).optional(),
  startDate: optionalDate,
  endDate: optionalDate,
});

export const requestQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  scope: z.enum(["mine", "all"]).default("mine"),
  status: z.enum(ACCESS_REQUEST_STATUSES).optional(),
  systemId: z.string().optional(),
  employeeId: z.string().uuid().optional(),
});

export const decisionSchema = z.object({
  notes: z.string().trim().max(2000).optional(),
});

export const rejectSchema = z.object({
  reason: z.string().trim().min(1).max(2000),
});

export const grantSchema = z.object({
  // Optional override of the access level actually provisioned.
  accessLevel: z.string().trim().min(1).max(200).optional(),
  notes: z.string().trim().max(2000).optional(),
});

export const revokeAssignmentSchema = z.object({
  reason: z.string().trim().min(1).max(2000),
});

export type CreateSystemInput = z.output<typeof createSystemSchema>;
export type UpdateSystemInput = z.output<typeof updateSystemSchema>;
export type CreateRequestInput = z.output<typeof createRequestSchema>;
export type UpdateRequestInput = z.output<typeof updateRequestSchema>;
export type RequestQuery = z.output<typeof requestQuerySchema>;
export type DecisionInput = z.output<typeof decisionSchema>;
export type RejectInput = z.output<typeof rejectSchema>;
export type GrantInput = z.output<typeof grantSchema>;
export type RevokeAssignmentInput = z.output<typeof revokeAssignmentSchema>;
