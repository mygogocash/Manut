import { z } from "zod";

export const INVESTOR_ACTIVITY_TYPES = [
  "call",
  "email",
  "meeting",
  "note",
] as const;

const dateString = z
  .string()
  .min(1)
  .refine((s) => !Number.isNaN(new Date(s).getTime()), "Invalid date/time");

// Every activity is logged against exactly one investor; investorId is
// required on create and immutable afterwards (re-anchoring is a recreate).
export const createInvestorActivitySchema = z.object({
  type: z.enum(INVESTOR_ACTIVITY_TYPES),
  subject: z.string().min(1, "Subject is required").max(300),
  body: z.string().max(5000).optional(),
  occurredAt: dateString,
  durationMins: z.coerce.number().int().positive().max(100_000).optional(),
  investorId: z.string().min(1, "investorId is required"),
});

export const updateInvestorActivitySchema = z.object({
  type: z.enum(INVESTOR_ACTIVITY_TYPES).optional(),
  subject: z.string().min(1).max(300).optional(),
  body: z.string().max(5000).nullable().optional(),
  occurredAt: dateString.optional(),
  durationMins: z.coerce
    .number()
    .int()
    .positive()
    .max(100_000)
    .nullable()
    .optional(),
});

export const listInvestorActivitiesSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  type: z.enum(INVESTOR_ACTIVITY_TYPES).optional(),
  investorId: z.string().optional(),
  ownerId: z.string().optional(),
  fundraisingEntity: z.string().min(1).max(60).optional(),
});

export type CreateInvestorActivityInput = z.infer<
  typeof createInvestorActivitySchema
>;
export type UpdateInvestorActivityInput = z.infer<
  typeof updateInvestorActivitySchema
>;
export type ListInvestorActivitiesQuery = z.infer<
  typeof listInvestorActivitiesSchema
>;
