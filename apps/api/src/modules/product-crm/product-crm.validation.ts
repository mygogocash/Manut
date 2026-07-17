import { z } from "zod";

// Validation schemas for the Product CRM standalone workspace. Shape mirrors
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
  sortOrder: z.coerce.number().int().nonnegative().default(0),
});

export const createProductProjectSchema = projectBaseSchema.refine(
  dateOrderRefine,
  {
    message: "End date must not be before start date",
    path: ["endDate"],
  },
);

export const updateProductProjectSchema = projectBaseSchema
  .partial()
  .refine(dateOrderRefine, {
    message: "End date must not be before start date",
    path: ["endDate"],
  });

export const productProjectQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(1000).default(20),
  status: z.string().optional(),
  search: z.string().optional(),
  department: z.string().optional(),
});

export const reorderProductProjectsSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1).max(500),
});

// Bulk import — create-new-only, capped at 500 (per-row slug +
// column / member seeding).
export const importProductProjectsSchema = z.object({
  rows: z.array(createProductProjectSchema).min(1).max(500),
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

export const createProductProjectTaskSchema = taskBaseSchema.refine(
  dateOrderRefine,
  {
    message: "End date must not be before start date",
    path: ["endDate"],
  },
);

export const updateProductProjectTaskSchema = taskBaseSchema
  .partial()
  .omit({ parentTaskId: true })
  .refine(dateOrderRefine, {
    message: "End date must not be before start date",
    path: ["endDate"],
  });

// ─── Columns ───────────────────────────────────────────────────

export const createProductProjectColumnSchema = z.object({
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

export const updateProductProjectColumnSchema = createProductProjectColumnSchema
  .partial()
  .omit({ key: true });

// ─── Members ───────────────────────────────────────────────────

export const manageProductProjectMembersSchema = z.object({
  userIds: z.array(z.string().uuid()).max(500),
});

// ─── Comments ──────────────────────────────────────────────────

export const createProductProjectTaskCommentSchema = z.object({
  body: z.string().min(1).max(10000),
});

// ─── Assignees ─────────────────────────────────────────────────

export const manageProductProjectTaskAssigneesSchema = z.object({
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

export type CreateProductProjectInput = z.infer<
  typeof createProductProjectSchema
>;
export type UpdateProductProjectInput = z.infer<
  typeof updateProductProjectSchema
>;
export type ImportProductProjectsInput = z.infer<
  typeof importProductProjectsSchema
>;
export type ProductProjectQuery = z.infer<typeof productProjectQuerySchema>;
export type ReorderProductProjectsInput = z.infer<
  typeof reorderProductProjectsSchema
>;
export type CreateProductProjectTaskInput = z.infer<
  typeof createProductProjectTaskSchema
>;
export type UpdateProductProjectTaskInput = z.infer<
  typeof updateProductProjectTaskSchema
>;
export type CreateProductProjectColumnInput = z.infer<
  typeof createProductProjectColumnSchema
>;
export type UpdateProductProjectColumnInput = z.infer<
  typeof updateProductProjectColumnSchema
>;
export type ManageProductProjectMembersInput = z.infer<
  typeof manageProductProjectMembersSchema
>;
export type CreateProductProjectTaskCommentInput = z.infer<
  typeof createProductProjectTaskCommentSchema
>;
export type ManageProductProjectTaskAssigneesInput = z.infer<
  typeof manageProductProjectTaskAssigneesSchema
>;
