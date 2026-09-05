import { z } from "zod";

// Phase 2 of the QA CRM standalone workspace (Option A per-CRM
// schema isolation, 2026-05-26). Validation schemas for the
// native `qa_*` tables introduced in Phase 1 (#612). Shape mirrors
// the IT CRM validation; the Task layer extends with the QA team's
// Excel template fields (issueDate / product / issueType /
// observation / expectation / eta / qaComment) and re-binds
// priority to `P0|P1|P2` (no `low|medium|high` legacy values).

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format");

const dateOrderRefine = <T extends { startDate?: string; endDate?: string }>(
  data: T,
) => {
  if (!data.startDate || !data.endDate) return true;
  return data.endDate >= data.startDate;
};

const QA_PRIORITY = z.enum(["P0", "P1", "P2"]);
const QA_TASK_STATUS = z.enum(["open", "clarified", "exception", "closed"]);

// ─── Project metadata ──────────────────────────────────────────

const projectBaseSchema = z.object({
  name: z.string().min(1, "Name is required").max(300),
  description: z.string().max(5000).optional(),
  status: z.string().max(50).default("active"),
  ownerId: z.string().uuid().optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  comment: z.string().max(1000).nullable().optional(),
  department: z.string().max(100).nullable().optional(),
  sortOrder: z.coerce.number().int().nonnegative().default(0),
  // Auto-assign default for new tasks (Phase C pt3). `.partial()` on the update
  // schema wraps this as optional(default), so an omitted field stays undefined
  // (no reset) while create still defaults to "none".
  defaultAssigneeMode: z
    .enum(["none", "creator", "owner", "user"])
    .default("none"),
  defaultAssigneeId: z.string().uuid().nullable().optional(),
});

export const createQaProjectSchema = projectBaseSchema.refine(dateOrderRefine, {
  message: "End date must not be before start date",
  path: ["endDate"],
});

export const updateQaProjectSchema = projectBaseSchema
  .partial()
  .refine(dateOrderRefine, {
    message: "End date must not be before start date",
    path: ["endDate"],
  });

export const qaProjectQuerySchema = z.object({
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

export const reorderQaProjectsSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1).max(500),
});

// Reorder QA issues (tasks) within a project — drag-to-reorder rows.
export const reorderQaTasksSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1).max(1000),
});

// ─── Tasks (QA issues) ─────────────────────────────────────────

const taskBaseSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  description: z.string().max(10000).optional(),
  columnKey: z.string().min(1).max(50).default("open"),
  status: QA_TASK_STATUS.default("open"),
  priority: QA_PRIORITY.default("P1"),
  ownerId: z.string().uuid().optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  assigneeIds: z.array(z.string().uuid()).max(50).optional(),
  sortOrder: z.coerce.number().int().nonnegative().default(0),
  parentTaskId: z.string().uuid().optional(),
  // QA template fields — direct port of the team's Excel columns.
  issueDate: dateString.nullable().optional(),
  partner: z.string().max(200).nullable().optional(),
  product: z.string().max(200).nullable().optional(),
  issueType: z.string().max(200).nullable().optional(),
  observation: z.string().max(10000).nullable().optional(),
  expectation: z.string().max(10000).nullable().optional(),
  eta: z.string().max(120).nullable().optional(),
  qaComment: z.string().max(10000).nullable().optional(),
});

export const createQaProjectTaskSchema = taskBaseSchema.refine(
  dateOrderRefine,
  {
    message: "End date must not be before start date",
    path: ["endDate"],
  },
);

export const updateQaProjectTaskSchema = taskBaseSchema
  .partial()
  .omit({ parentTaskId: true })
  .refine(dateOrderRefine, {
    message: "End date must not be before start date",
    path: ["endDate"],
  });

// Bulk import of QA issues (tasks) — create-new-only, capped at 1000.
export const importQaProjectTasksSchema = z.object({
  rows: z.array(createQaProjectTaskSchema).min(1).max(1000),
});

// ─── Columns ───────────────────────────────────────────────────

export const createQaProjectColumnSchema = z.object({
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

export const updateQaProjectColumnSchema = createQaProjectColumnSchema
  .partial()
  .omit({ key: true });

// ─── Members ───────────────────────────────────────────────────

export const manageQaProjectMembersSchema = z.object({
  userIds: z.array(z.string().uuid()).max(500),
});

// ─── Comments ──────────────────────────────────────────────────

export const createQaProjectTaskCommentSchema = z.object({
  body: z.string().min(1).max(10000),
});

// ─── Assignees ─────────────────────────────────────────────────

export const manageQaProjectTaskAssigneesSchema = z.object({
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

export type CreateQaProjectInput = z.infer<typeof createQaProjectSchema>;
export type UpdateQaProjectInput = z.infer<typeof updateQaProjectSchema>;
export type QaProjectQuery = z.infer<typeof qaProjectQuerySchema>;
export type ReorderQaProjectsInput = z.infer<typeof reorderQaProjectsSchema>;
export type ReorderQaTasksInput = z.infer<typeof reorderQaTasksSchema>;
export type CreateQaProjectTaskInput = z.infer<
  typeof createQaProjectTaskSchema
>;
export type UpdateQaProjectTaskInput = z.infer<
  typeof updateQaProjectTaskSchema
>;
export type ImportQaProjectTasksInput = z.infer<
  typeof importQaProjectTasksSchema
>;
export type CreateQaProjectColumnInput = z.infer<
  typeof createQaProjectColumnSchema
>;
export type UpdateQaProjectColumnInput = z.infer<
  typeof updateQaProjectColumnSchema
>;
export type ManageQaProjectMembersInput = z.infer<
  typeof manageQaProjectMembersSchema
>;
export type CreateQaProjectTaskCommentInput = z.infer<
  typeof createQaProjectTaskCommentSchema
>;
export type ManageQaProjectTaskAssigneesInput = z.infer<
  typeof manageQaProjectTaskAssigneesSchema
>;
