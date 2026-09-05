import { z } from "zod";

const DEAL_STAGES = [
  "lead",
  "qualified",
  "proposal",
  "negotiation",
  "closed_won",
  "closed_lost",
] as const;

const DEAL_PRIORITIES = ["low", "medium", "high"] as const;

export const createDealSchema = z.object({
  company: z.string().min(1, "Company name is required").max(300),
  contact: z.string().max(300).optional(),
  value: z.coerce.number().nonnegative("Value must be non-negative"),
  stage: z.enum(DEAL_STAGES).default("lead"),
  probability: z.coerce.number().int().min(0).max(100).default(10),
  type: z.string().max(100).optional(),
  country: z.string().max(100).optional(),
  partnerId: z.string().optional(),
  closeDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format")
    .optional(),
  notes: z.string().max(5000).optional(),
});

export const updateDealSchema = createDealSchema.partial();

export const listDealsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  stage: z.string().optional(),
  type: z.string().optional(),
  ownerId: z.string().optional(),
});

export type CreateDealInput = z.infer<typeof createDealSchema>;
export type UpdateDealInput = z.infer<typeof updateDealSchema>;
export type ListDealsQuery = z.infer<typeof listDealsSchema>;

export { DEAL_PRIORITIES, DEAL_STAGES };
