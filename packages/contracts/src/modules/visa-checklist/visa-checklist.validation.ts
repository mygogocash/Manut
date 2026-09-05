import { z } from "zod";

// One template line. `id` is a stable client-generated key carried onto the
// per-record item for traceability.
export const checklistTemplateItemSchema = z.object({
  id: z.string().min(1).max(60),
  label: z.string().min(1, "Label is required").max(200),
  category: z.enum(["document", "step"]).default("document"),
  optional: z.boolean().default(false),
  sortOrder: z.coerce.number().int().min(0).max(1000).default(0),
});

export const createChecklistTemplateSchema = z.object({
  visaType: z.string().min(1, "Visa type is required").max(100),
  // Empty = applies to any country for this visa type.
  country: z.string().max(100).optional().or(z.literal("")),
  name: z.string().min(1, "Name is required").max(150),
  items: z.array(checklistTemplateItemSchema).max(50).default([]),
  isActive: z.boolean().default(true),
  entityId: z.string().optional().or(z.literal("")),
});

export const updateChecklistTemplateSchema =
  createChecklistTemplateSchema.partial();

export const checklistTemplateQuerySchema = z.object({
  visaType: z.string().optional(),
  includeInactive: z.coerce.boolean().default(false),
});

export const toggleChecklistItemSchema = z.object({
  completed: z.boolean(),
});

export type ChecklistTemplateItemInput = z.infer<
  typeof checklistTemplateItemSchema
>;
export type CreateChecklistTemplateInput = z.infer<
  typeof createChecklistTemplateSchema
>;
export type UpdateChecklistTemplateInput = z.infer<
  typeof updateChecklistTemplateSchema
>;
export type ChecklistTemplateQuery = z.infer<
  typeof checklistTemplateQuerySchema
>;
export type ToggleChecklistItemInput = z.infer<
  typeof toggleChecklistItemSchema
>;
