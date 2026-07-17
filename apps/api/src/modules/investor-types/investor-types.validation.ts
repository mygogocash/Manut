import { z } from "zod";

export const createInvestorTypeSchema = z.object({
  label: z.string().min(1, "Label is required").max(80),
});

export const updateInvestorTypeSchema = z.object({
  label: z.string().min(1).max(80),
});

export const reorderInvestorTypesSchema = z.object({
  orderedKeys: z.array(z.string().min(1)).min(1).max(100),
});

export type CreateInvestorTypeInput = z.infer<typeof createInvestorTypeSchema>;
export type UpdateInvestorTypeInput = z.infer<typeof updateInvestorTypeSchema>;
export type ReorderInvestorTypesInput = z.infer<
  typeof reorderInvestorTypesSchema
>;
