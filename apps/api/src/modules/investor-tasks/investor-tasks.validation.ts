import { z } from "zod";

export const INVESTOR_TASK_STATUSES = ["open", "done", "cancelled"] as const;

// Every investor task is anchored to exactly one investor (the Investor
// CRM "Tasks" surface). investorId is required on create and immutable
// afterwards — re-anchoring a task to another investor is a recreate.
export const createInvestorTaskSchema = z.object({
  subject: z.string().min(1, "Subject is required").max(300),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format"),
  investorId: z.string().min(1, "investorId is required"),
});

export const updateInvestorTaskSchema = z.object({
  subject: z.string().min(1).max(300).optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format")
    .optional(),
  status: z.enum(INVESTOR_TASK_STATUSES).optional(),
});

export const listInvestorTasksSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(INVESTOR_TASK_STATUSES).optional(),
  investorId: z.string().optional(),
  ownerId: z.string().optional(),
  // "Today" surface grouping — overdue / today / soon (next 7 days).
  bucket: z.enum(["overdue", "today", "soon"]).optional(),
});

export type CreateInvestorTaskInput = z.infer<typeof createInvestorTaskSchema>;
export type UpdateInvestorTaskInput = z.infer<typeof updateInvestorTaskSchema>;
export type ListInvestorTasksQuery = z.infer<typeof listInvestorTasksSchema>;
