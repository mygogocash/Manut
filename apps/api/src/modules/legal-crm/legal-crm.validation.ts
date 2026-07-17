import { z } from "zod";

// Validation schemas for the Legal CRM standalone workspace. Shape mirrors the IT CRM
// validation; Legal-only fields (`workstream` + `details`) carry
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

export const createLegalProjectSchema = projectBaseSchema.refine(
  dateOrderRefine,
  {
    message: "End date must not be before start date",
    path: ["endDate"],
  },
);

export const updateLegalProjectSchema = projectBaseSchema
  .partial()
  .refine(dateOrderRefine, {
    message: "End date must not be before start date",
    path: ["endDate"],
  });

export const legalProjectQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(1000).default(20),
  status: z.string().optional(),
  search: z.string().optional(),
  department: z.string().optional(),
});

export const reorderLegalProjectsSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1).max(500),
});

// Bulk import is create-new-only. Bound the request so a malformed workbook
// cannot turn one synchronous compatibility-API call into unbounded work.
export const importLegalProjectsSchema = z.object({
  rows: z.array(createLegalProjectSchema).min(1).max(2000),
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

export const createLegalProjectTaskSchema = taskBaseSchema.refine(
  dateOrderRefine,
  {
    message: "End date must not be before start date",
    path: ["endDate"],
  },
);

export const updateLegalProjectTaskSchema = taskBaseSchema
  .partial()
  .omit({ parentTaskId: true })
  .refine(dateOrderRefine, {
    message: "End date must not be before start date",
    path: ["endDate"],
  });

// ─── Columns ───────────────────────────────────────────────────

export const createLegalProjectColumnSchema = z.object({
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

export const updateLegalProjectColumnSchema = createLegalProjectColumnSchema
  .partial()
  .omit({ key: true });

// ─── Members ───────────────────────────────────────────────────

export const manageLegalProjectMembersSchema = z.object({
  userIds: z.array(z.string().uuid()).max(500),
});

// ─── Comments ──────────────────────────────────────────────────

export const createLegalProjectTaskCommentSchema = z.object({
  body: z.string().min(1).max(10000),
});

// ─── Assignees ─────────────────────────────────────────────────

export const manageLegalProjectTaskAssigneesSchema = z.object({
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

export type CreateLegalProjectInput = z.infer<typeof createLegalProjectSchema>;
export type UpdateLegalProjectInput = z.infer<typeof updateLegalProjectSchema>;
export type ImportLegalProjectsInput = z.infer<
  typeof importLegalProjectsSchema
>;
export type LegalProjectQuery = z.infer<typeof legalProjectQuerySchema>;
export type ReorderLegalProjectsInput = z.infer<
  typeof reorderLegalProjectsSchema
>;
export type CreateLegalProjectTaskInput = z.infer<
  typeof createLegalProjectTaskSchema
>;
export type UpdateLegalProjectTaskInput = z.infer<
  typeof updateLegalProjectTaskSchema
>;
export type CreateLegalProjectColumnInput = z.infer<
  typeof createLegalProjectColumnSchema
>;
export type UpdateLegalProjectColumnInput = z.infer<
  typeof updateLegalProjectColumnSchema
>;
export type ManageLegalProjectMembersInput = z.infer<
  typeof manageLegalProjectMembersSchema
>;
export type CreateLegalProjectTaskCommentInput = z.infer<
  typeof createLegalProjectTaskCommentSchema
>;
export type ManageLegalProjectTaskAssigneesInput = z.infer<
  typeof manageLegalProjectTaskAssigneesSchema
>;
