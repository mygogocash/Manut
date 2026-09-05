import { z } from "zod";

export const INVESTOR_LEAD_STATUSES = [
  "new",
  "qualified",
  "converted",
  "disqualified",
] as const;

// Email/phone kept as loose strings (no format enforcement) to match the
// Investor module's tolerance for "TBD" / partial pipeline data.
export const createInvestorLeadSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  company: z.string().max(200).optional(),
  email: z.string().max(200).optional(),
  phone: z.string().max(50).optional(),
  source: z.string().max(120).optional(),
  status: z.enum(INVESTOR_LEAD_STATUSES).default("new"),
  notes: z.string().max(5000).optional(),
  fundraisingEntity: z.string().min(1).max(60).optional(),
});

export const updateInvestorLeadSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  company: z.string().max(200).nullable().optional(),
  email: z.string().max(200).nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  source: z.string().max(120).nullable().optional(),
  status: z.enum(INVESTOR_LEAD_STATUSES).optional(),
  notes: z.string().max(5000).nullable().optional(),
  // Moving a record between fundraising vehicles. Resolved against the
  // catalog in the service before it reaches Prisma.
  fundraisingEntity: z.string().min(1).max(60).optional(),
});

export const listInvestorLeadsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(INVESTOR_LEAD_STATUSES).optional(),
  search: z.string().optional(),
  ownerId: z.string().optional(),
  fundraisingEntity: z.string().min(1).max(60).optional(),
  archived: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

export type CreateInvestorLeadInput = z.infer<typeof createInvestorLeadSchema>;
export type UpdateInvestorLeadInput = z.infer<typeof updateInvestorLeadSchema>;
export type ListInvestorLeadsQuery = z.infer<typeof listInvestorLeadsSchema>;
