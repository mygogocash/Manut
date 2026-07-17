import { z } from "zod";

// Validation schemas for the Partner-native workspace (Phase 2 of
// the Partner ↔ Project decouple, 2026-05-26). Mirrors the equivalent
// Project task schemas so the eventual UI port stays mechanical.

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format");

const dateRangeRefine = <T extends { startDate?: string; endDate?: string }>(
  data: T,
) => {
  if (!data.startDate || !data.endDate) return true;
  return data.endDate >= data.startDate;
};

// ─── Tasks ──────────────────────────────────────────────────────

const taskBaseSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  description: z.string().max(10000).optional(),
  // Free-text column key — matches PartnerColumn.key for the row's
  // current column. Defaults to "todo" so callers can omit it on
  // first create.
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

export const createPartnerTaskSchema = taskBaseSchema.refine(dateRangeRefine, {
  message: "End date must not be before start date",
  path: ["endDate"],
});

export const updatePartnerTaskSchema = taskBaseSchema
  .partial()
  .omit({ parentTaskId: true })
  .refine(dateRangeRefine, {
    message: "End date must not be before start date",
    path: ["endDate"],
  });

// ─── Columns ────────────────────────────────────────────────────

export const createPartnerColumnSchema = z.object({
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

export const updatePartnerColumnSchema = createPartnerColumnSchema
  .partial()
  .omit({ key: true });

// ─── Members ────────────────────────────────────────────────────

export const managePartnerMembersSchema = z.object({
  userIds: z.array(z.string().uuid()).max(500),
});

// ─── Comments ───────────────────────────────────────────────────

export const createPartnerTaskCommentSchema = z.object({
  body: z.string().min(1).max(10000),
});

// ─── Assignees ──────────────────────────────────────────────────

export const managePartnerTaskAssigneesSchema = z.object({
  assignees: z
    .array(
      z.object({
        userId: z.string().uuid(),
        allocationPct: z.coerce.number().int().min(0).max(100).optional(),
      }),
    )
    .max(50),
});

// File / link attachment on a task card. `kind` distinguishes an uploaded
// file (Supabase storage url) from an external link.
export const createPartnerTaskResourceSchema = z.object({
  kind: z.enum(["file", "link"]).default("file"),
  label: z.string().min(1, "Label is required").max(300),
  // Restrict to http(s) so a stored `javascript:`/`data:` URL can never
  // become a live link when rendered as an anchor (stored XSS).
  url: z
    .string()
    .min(1, "URL is required")
    .max(2000)
    .refine((u) => {
      try {
        const p = new URL(u);
        return p.protocol === "http:" || p.protocol === "https:";
      } catch {
        return false;
      }
    }, "URL must be http(s)"),
});

export type CreatePartnerTaskResourceInput = z.infer<
  typeof createPartnerTaskResourceSchema
>;

// ─── Inferred types ─────────────────────────────────────────────

export type CreatePartnerTaskInput = z.infer<typeof createPartnerTaskSchema>;
export type UpdatePartnerTaskInput = z.infer<typeof updatePartnerTaskSchema>;
export type CreatePartnerColumnInput = z.infer<
  typeof createPartnerColumnSchema
>;
export type UpdatePartnerColumnInput = z.infer<
  typeof updatePartnerColumnSchema
>;
export type ManagePartnerMembersInput = z.infer<
  typeof managePartnerMembersSchema
>;
export type CreatePartnerTaskCommentInput = z.infer<
  typeof createPartnerTaskCommentSchema
>;
export type ManagePartnerTaskAssigneesInput = z.infer<
  typeof managePartnerTaskAssigneesSchema
>;
