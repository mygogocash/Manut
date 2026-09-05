import { z } from "zod";

// Tailwind top-border palette the board renders for column headers.
const colorSchema = z.string().min(1).max(60);

export const createInvestorStageSchema = z.object({
  label: z.string().min(1, "Label is required").max(80),
  color: colorSchema.optional(),
});

export const updateInvestorStageSchema = z.object({
  label: z.string().min(1).max(80).optional(),
  color: colorSchema.optional(),
});

export const reorderInvestorStagesSchema = z.object({
  orderedKeys: z.array(z.string().min(1)).min(1).max(50),
});

export type CreateInvestorStageInput = z.infer<
  typeof createInvestorStageSchema
>;
export type UpdateInvestorStageInput = z.infer<
  typeof updateInvestorStageSchema
>;
export type ReorderInvestorStagesInput = z.infer<
  typeof reorderInvestorStagesSchema
>;
