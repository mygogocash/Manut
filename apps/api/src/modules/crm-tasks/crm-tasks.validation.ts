import { z } from "zod";

export const TASK_STATUSES = ["open", "done", "cancelled"] as const;

// Tasks can be tied to a Lead OR an Opportunity. At least one anchor must be
// supplied so a stray "call back" never floats untethered. Both can sit on
// the row (e.g. follow-up for the lead's converted Opportunity), but one is
// the minimum.
const anchorRefinement = (
  d: { leadId?: string; opportunityId?: string },
  ctx: z.RefinementCtx,
) => {
  if (!d.leadId && !d.opportunityId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "At least one of leadId, opportunityId is required.",
    });
  }
};

export const createCrmTaskSchema = z
  .object({
    subject: z.string().min(1, "Subject is required").max(300),
    dueDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format"),
    leadId: z.string().optional(),
    opportunityId: z.string().optional(),
  })
  .superRefine(anchorRefinement);

export const updateCrmTaskSchema = z.object({
  subject: z.string().min(1).max(300).optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format")
    .optional(),
  status: z.enum(TASK_STATUSES).optional(),
});

export const listCrmTasksSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(TASK_STATUSES).optional(),
  ownerId: z.string().optional(),
  leadId: z.string().optional(),
  opportunityId: z.string().optional(),
  // Convenience filter for the "Today" surface — overdue / today / soon
  // groupings the UI renders. "soon" = next 7 days excluding today.
  bucket: z.enum(["overdue", "today", "soon"]).optional(),
});

export type CreateCrmTaskInput = z.infer<typeof createCrmTaskSchema>;
export type UpdateCrmTaskInput = z.infer<typeof updateCrmTaskSchema>;
export type ListCrmTasksQuery = z.infer<typeof listCrmTasksSchema>;
