import { z } from "zod";

export const createInvestorContactSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(120),
  lastName: z.string().max(120).optional(),
  email: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  title: z.string().max(150).optional(),
  accountId: z.string().optional(),
  fundraisingEntity: z.string().min(1).max(60).optional(),
});

export const updateInvestorContactSchema = z.object({
  firstName: z.string().min(1).max(120).optional(),
  lastName: z.string().max(120).nullable().optional(),
  email: z.string().max(200).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  title: z.string().max(150).nullable().optional(),
  // null clears the account link; a string re-anchors it.
  accountId: z.string().nullable().optional(),
  // Moving a record between fundraising vehicles. Resolved against the
  // catalog in the service before it reaches Prisma.
  fundraisingEntity: z.string().min(1).max(60).optional(),
});

export const listInvestorContactsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  accountId: z.string().optional(),
  ownerId: z.string().optional(),
  fundraisingEntity: z.string().min(1).max(60).optional(),
  // Active (default) vs Archived view. Query arrives as a string; coerce to
  // a boolean so the repo can flip the archivedAt null/not-null filter.
  archived: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

export type CreateInvestorContactInput = z.infer<
  typeof createInvestorContactSchema
>;
export type UpdateInvestorContactInput = z.infer<
  typeof updateInvestorContactSchema
>;
export type ListInvestorContactsQuery = z.infer<
  typeof listInvestorContactsSchema
>;
