import { z } from "zod";

export const ACTIVITY_TYPES = ["call", "email", "meeting", "note"] as const;

// Exactly one parent reference is required. SQL-level CHECK across nullable
// FKs is brittle, so we enforce it here at the API boundary.
const parentRefRefinement = (
  d: {
    leadId?: string;
    opportunityId?: string;
    contactId?: string;
    accountId?: string;
  },
  ctx: z.RefinementCtx,
) => {
  const refs = [d.leadId, d.opportunityId, d.contactId, d.accountId].filter(
    Boolean,
  );
  if (refs.length !== 1) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message:
        "Exactly one of leadId, opportunityId, contactId, accountId is required.",
    });
  }
};

export const createCrmActivitySchema = z
  .object({
    type: z.enum(ACTIVITY_TYPES),
    subject: z.string().min(1, "Subject is required").max(300),
    body: z.string().max(10000).optional(),
    occurredAt: z
      .string()
      .datetime({ offset: true })
      .or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)),
    durationMins: z.coerce.number().int().nonnegative().optional(),
    leadId: z.string().optional(),
    opportunityId: z.string().optional(),
    contactId: z.string().optional(),
    accountId: z.string().optional(),
  })
  .superRefine(parentRefRefinement);

// Updates leave the parent reference alone — re-targeting an activity is a
// rare operation; for now we treat it as immutable. type/subject/body/timing
// are editable.
export const updateCrmActivitySchema = z.object({
  type: z.enum(ACTIVITY_TYPES).optional(),
  subject: z.string().min(1).max(300).optional(),
  body: z.string().max(10000).optional(),
  occurredAt: z
    .string()
    .datetime({ offset: true })
    .or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/))
    .optional(),
  durationMins: z.coerce.number().int().nonnegative().optional(),
});

export const listCrmActivitiesSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  type: z.enum(ACTIVITY_TYPES).optional(),
  leadId: z.string().optional(),
  opportunityId: z.string().optional(),
  contactId: z.string().optional(),
  accountId: z.string().optional(),
  ownerId: z.string().optional(),
});

export type CreateCrmActivityInput = z.infer<typeof createCrmActivitySchema>;
export type UpdateCrmActivityInput = z.infer<typeof updateCrmActivitySchema>;
export type ListCrmActivitiesQuery = z.infer<typeof listCrmActivitiesSchema>;
