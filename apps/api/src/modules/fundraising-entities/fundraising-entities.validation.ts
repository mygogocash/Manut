import { z } from "zod";

export const DEFAULT_FUNDRAISING_ENTITY = "tbh";

export const createFundraisingEntitySchema = z.object({
  label: z.string().min(1, "Label is required").max(80),
});

export const updateFundraisingEntitySchema = z.object({
  label: z.string().min(1).max(80),
});

export const reorderFundraisingEntitiesSchema = z.object({
  orderedKeys: z.array(z.string().min(1)).min(1).max(100),
});

export type CreateFundraisingEntityInput = z.infer<
  typeof createFundraisingEntitySchema
>;
export type UpdateFundraisingEntityInput = z.infer<
  typeof updateFundraisingEntitySchema
>;
export type ReorderFundraisingEntitiesInput = z.infer<
  typeof reorderFundraisingEntitiesSchema
>;
