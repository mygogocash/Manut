import { z } from "zod";

export const createInvestorAccountSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  type: z.string().max(120).optional(),
  website: z.string().max(300).optional(),
  location: z.string().max(200).optional(),
  region: z.string().max(120).optional(),
  notes: z.string().max(5000).optional(),
  fundraisingEntity: z.string().min(1).max(60).optional(),
});

export const updateInvestorAccountSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  type: z.string().max(120).nullable().optional(),
  website: z.string().max(300).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  region: z.string().max(120).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  // Moving a record between fundraising vehicles. Resolved against the
  // catalog in the service before it reaches Prisma.
  fundraisingEntity: z.string().min(1).max(60).optional(),
});

export const listInvestorAccountsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  region: z.string().optional(),
  ownerId: z.string().optional(),
  fundraisingEntity: z.string().min(1).max(60).optional(),
  // Active (default) vs Archived view. Query arrives as a string; coerce to
  // a boolean so the repo can flip the archivedAt null/not-null filter.
  archived: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

export type CreateInvestorAccountInput = z.infer<
  typeof createInvestorAccountSchema
>;
export type UpdateInvestorAccountInput = z.infer<
  typeof updateInvestorAccountSchema
>;
export type ListInvestorAccountsQuery = z.infer<
  typeof listInvestorAccountsSchema
>;
