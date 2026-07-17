import { z } from "zod";

// Validation schemas for the IT CRM standalone workspace. Shape mirrors
// the existing project + partner-workspace validation so a future
// generic-workspace refactor (Option A2) stays mechanical.

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
  // RAG health rating driving the dashboard heat-map. `statusChangedAt`
  // is server-managed (stamped on status change in the service), so it's
  // intentionally not accepted here.
  healthStatus: z.enum(["green", "yellow", "red"]).nullable().optional(),
  effortPoints: z.coerce.number().int().min(0).max(1000).nullable().optional(),
  // Auto-assign default for new tasks. `user` mode requires defaultAssigneeId;
  // the service validates it points at an active user before applying.
  defaultAssigneeMode: z
    .enum(["none", "creator", "owner", "user"])
    .default("none"),
  defaultAssigneeId: z.string().uuid().nullable().optional(),
  sortOrder: z.coerce.number().int().nonnegative().default(0),
});

export const createItProjectSchema = projectBaseSchema.refine(dateOrderRefine, {
  message: "End date must not be before start date",
  path: ["endDate"],
});

export const updateItProjectSchema = projectBaseSchema
  .partial()
  .refine(dateOrderRefine, {
    message: "End date must not be before start date",
    path: ["endDate"],
  });

export const itProjectQuerySchema = z.object({
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

export const reorderItProjectsSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1).max(500),
});

// Admin-editable extra recipients for deadline-reminder emails.
export const reminderSettingsSchema = z.object({
  recipients: z.array(z.string().trim().email()).max(50),
});

// Bulk import — create-new-only. Each row reuses the single-create
// schema. Capped at 500: each row triggers a slug lookup + column /
// member seeding, so a bigger batch risks the request timeout.
export const importItProjectsSchema = z.object({
  rows: z.array(createItProjectSchema).min(1).max(500),
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
  effortPoints: z.coerce.number().int().min(0).max(1000).nullable().optional(),
  sortOrder: z.coerce.number().int().nonnegative().default(0),
  parentTaskId: z.string().uuid().optional(),
});

export const createItProjectTaskSchema = taskBaseSchema.refine(
  dateOrderRefine,
  {
    message: "End date must not be before start date",
    path: ["endDate"],
  },
);

export const updateItProjectTaskSchema = taskBaseSchema
  .partial()
  .omit({ parentTaskId: true })
  .refine(dateOrderRefine, {
    message: "End date must not be before start date",
    path: ["endDate"],
  });

// ─── Columns ───────────────────────────────────────────────────

export const createItProjectColumnSchema = z.object({
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

export const updateItProjectColumnSchema = createItProjectColumnSchema
  .partial()
  .omit({ key: true });

// ─── Members ───────────────────────────────────────────────────

export const manageItProjectMembersSchema = z.object({
  userIds: z.array(z.string().uuid()).max(500),
});

// ─── Comments ──────────────────────────────────────────────────

export const createItProjectTaskCommentSchema = z.object({
  body: z.string().min(1).max(10000),
});

// ─── Assignees ─────────────────────────────────────────────────

export const manageItProjectTaskAssigneesSchema = z.object({
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

export type CreateItProjectInput = z.infer<typeof createItProjectSchema>;
export type UpdateItProjectInput = z.infer<typeof updateItProjectSchema>;
export type ItProjectQuery = z.infer<typeof itProjectQuerySchema>;
export type ReorderItProjectsInput = z.infer<typeof reorderItProjectsSchema>;
export type ReminderSettingsInput = z.infer<typeof reminderSettingsSchema>;
export type ImportItProjectsInput = z.infer<typeof importItProjectsSchema>;
export type CreateItProjectTaskInput = z.infer<
  typeof createItProjectTaskSchema
>;
export type UpdateItProjectTaskInput = z.infer<
  typeof updateItProjectTaskSchema
>;
export type CreateItProjectColumnInput = z.infer<
  typeof createItProjectColumnSchema
>;
export type UpdateItProjectColumnInput = z.infer<
  typeof updateItProjectColumnSchema
>;
export type ManageItProjectMembersInput = z.infer<
  typeof manageItProjectMembersSchema
>;
export type CreateItProjectTaskCommentInput = z.infer<
  typeof createItProjectTaskCommentSchema
>;
export type ManageItProjectTaskAssigneesInput = z.infer<
  typeof manageItProjectTaskAssigneesSchema
>;
