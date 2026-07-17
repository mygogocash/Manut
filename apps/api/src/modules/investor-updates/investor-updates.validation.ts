import { z } from "zod";

const UPDATE_STATUSES = ["draft", "sent"] as const;

export const createUpdateSchema = z.object({
  title: z.string().min(1, "Title is required").max(500),
  content: z.string().min(1, "Content is required"),
  period: z.string().min(1, "Period is required"),
  status: z.enum(UPDATE_STATUSES).default("draft"),
});

export const updateUpdateSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  content: z.string().min(1).optional(),
  period: z.string().min(1).optional(),
  status: z.enum(UPDATE_STATUSES).optional(),
});

export const listUpdatesSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.string().optional(),
});

export type CreateUpdateInput = z.infer<typeof createUpdateSchema>;
export type UpdateUpdateInput = z.infer<typeof updateUpdateSchema>;
export type ListUpdatesQuery = z.infer<typeof listUpdatesSchema>;

export { UPDATE_STATUSES };
