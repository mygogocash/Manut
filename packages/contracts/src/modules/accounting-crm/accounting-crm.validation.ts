import { z } from "zod";

// Phase 2 of the Accounting CRM standalone workspace (Option A per-CRM
// schema isolation, 2026-05-26). Validation schemas for the native
// `accounting_*` tables introduced in Phase 1. Shape mirrors the IT CRM
// validation; Accounting-only fields (`workstream` + `details`) carry
// over from the shared Project schema.

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format");

const dateOrderRefine = <T extends { startDate?: string; endDate?: string }>(
  data: T,
) => {
  if (!data.startDate || !data.endDate) return true;
  return data.endDate >= data.startDate;
};

// ─── Project metadata ──────────────────────────────────────────

const projectBaseSchema = z.object({
  name: z.string().min(1, "Name is required").max(300),
  description: z.string().max(5000).optional(),
  status: z.string().max(50).default("not_yet_started"),
  ownerId: z.string().uuid().optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  productionLiveDate: dateString.nullable().optional(),
  goLiveDate: dateString.nullable().optional(),
  revisedGoLiveDate: dateString.nullable().optional(),
  dependency: z.string().max(200).nullable().optional(),
  comment: z.string().max(1000).nullable().optional(),
  department: z.string().max(100).nullable().optional(),
  workstream: z.string().max(200).nullable().optional(),
  details: z.string().max(10000).nullable().optional(),
  priority: z.string().max(50).default("medium"),
  sortOrder: z.coerce.number().int().nonnegative().default(0),
  // Auto-assign default for new tasks (Phase C pt2). `.partial()` on the update
  // schema wraps this as optional(default), so an omitted field stays undefined
  // (no reset) while create still defaults to "none".
  defaultAssigneeMode: z
    .enum(["none", "creator", "owner", "user"])
    .default("none"),
  defaultAssigneeId: z.string().uuid().nullable().optional(),
});

export const createAccountingProjectSchema = projectBaseSchema.refine(
  dateOrderRefine,
  {
    message: "End date must not be before start date",
    path: ["endDate"],
  },
);

export const updateAccountingProjectSchema = projectBaseSchema
  .partial()
  .refine(dateOrderRefine, {
    message: "End date must not be before start date",
    path: ["endDate"],
  });

export const accountingProjectQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(1000).default(20),
  status: z.string().optional(),
  search: z.string().optional(),
  department: z.string().optional(),
  // When "true", return ONLY archived projects; anything else (incl. absent)
  // shows active only. Explicit string compare — z.coerce.boolean() would turn
  // "false" into true.
  archived: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

export const reorderAccountingProjectsSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1).max(500),
});

// Bulk import — create-new-only. Cap raised from 500 → 2000 to fit
// the real Accounting-checklist xlsx the team imports from (≈1009 rows in
// the 2026-05 snapshot). Per-row work is a slug bump + column /
// member seeding, so the higher ceiling stays well within Cloud Run's
// 60s request budget.
export const importAccountingProjectsSchema = z.object({
  rows: z.array(createAccountingProjectSchema).min(1).max(2000),
});

// ─── Tasks ─────────────────────────────────────────────────────

const taskBaseSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  description: z.string().max(10000).optional(),
  columnKey: z.string().min(1).max(50).default("todo"),
  status: z.string().default("todo"),
  priority: z.string().default("medium"),
  ownerId: z.string().uuid().optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  assigneeIds: z.array(z.string().uuid()).max(50).optional(),
  sortOrder: z.coerce.number().int().nonnegative().default(0),
  parentTaskId: z.string().uuid().optional(),
});

export const createAccountingProjectTaskSchema = taskBaseSchema.refine(
  dateOrderRefine,
  {
    message: "End date must not be before start date",
    path: ["endDate"],
  },
);

export const updateAccountingProjectTaskSchema = taskBaseSchema
  .partial()
  .omit({ parentTaskId: true })
  .refine(dateOrderRefine, {
    message: "End date must not be before start date",
    path: ["endDate"],
  });

// ─── Columns ───────────────────────────────────────────────────

export const createAccountingProjectColumnSchema = z.object({
  key: z
    .string()
    .min(1)
    .max(50)
    .regex(
      /^[a-z0-9_]+$/,
      "Key must be lowercase alphanumeric with underscores",
    ),
  label: z.string().min(1).max(100),
  color: z.string().max(60).optional(),
  sortOrder: z.coerce.number().int().nonnegative().default(0),
});

export const updateAccountingProjectColumnSchema =
  createAccountingProjectColumnSchema.partial().omit({ key: true });

// ─── Members ───────────────────────────────────────────────────

export const manageAccountingProjectMembersSchema = z.object({
  userIds: z.array(z.string().uuid()).max(500),
});

// ─── Comments ──────────────────────────────────────────────────

export const createAccountingProjectTaskCommentSchema = z.object({
  body: z.string().min(1).max(10000),
});

// ─── Assignees ─────────────────────────────────────────────────

export const manageAccountingProjectTaskAssigneesSchema = z.object({
  assignees: z
    .array(
      z.object({
        userId: z.string().uuid(),
        allocationPct: z.coerce.number().int().min(0).max(100).optional(),
      }),
    )
    .max(50),
});

// ─── Inferred types ────────────────────────────────────────────

export type CreateAccountingProjectInput = z.infer<
  typeof createAccountingProjectSchema
>;
export type UpdateAccountingProjectInput = z.infer<
  typeof updateAccountingProjectSchema
>;
export type ImportAccountingProjectsInput = z.infer<
  typeof importAccountingProjectsSchema
>;
export type AccountingProjectQuery = z.infer<
  typeof accountingProjectQuerySchema
>;
export type ReorderAccountingProjectsInput = z.infer<
  typeof reorderAccountingProjectsSchema
>;
export type CreateAccountingProjectTaskInput = z.infer<
  typeof createAccountingProjectTaskSchema
>;
export type UpdateAccountingProjectTaskInput = z.infer<
  typeof updateAccountingProjectTaskSchema
>;
export type CreateAccountingProjectColumnInput = z.infer<
  typeof createAccountingProjectColumnSchema
>;
export type UpdateAccountingProjectColumnInput = z.infer<
  typeof updateAccountingProjectColumnSchema
>;
export type ManageAccountingProjectMembersInput = z.infer<
  typeof manageAccountingProjectMembersSchema
>;
export type CreateAccountingProjectTaskCommentInput = z.infer<
  typeof createAccountingProjectTaskCommentSchema
>;
export type ManageAccountingProjectTaskAssigneesInput = z.infer<
  typeof manageAccountingProjectTaskAssigneesSchema
>;
