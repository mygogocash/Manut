import { z } from "zod";

export const createModuleSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  description: z.string().max(5000).optional(),
  category: z.string().min(1, "Category is required"),
  duration: z.coerce.number().int().positive().optional(),
  url: z.string().url().optional().or(z.literal("")),
  // Uploaded asset URL + display name. Frontend uploads via the
  // existing /uploads endpoint and forwards the resulting URL here.
  fileUrl: z.string().url().optional().or(z.literal("")),
  fileName: z.string().max(300).optional().or(z.literal("")),
  isMandatory: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export const updateModuleSchema = createModuleSchema.partial();

// Bulk import — create-new-only. Each row re-uses createModuleSchema
// so the same field-level coercion runs. Capped at 2000 to fit the
// real L&D Program List xlsx (~1000 rows in the 2026-05 snapshot)
// with headroom.
export const importModulesSchema = z.object({
  rows: z.array(createModuleSchema).min(1).max(2000),
});

export const moduleQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  category: z.string().optional(),
  isMandatory: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  search: z.string().optional(),
});

export const createCompletionSchema = z.object({
  moduleId: z.string().min(1, "Module ID is required"),
  score: z.coerce.number().int().min(0).max(100).optional(),
});

export const completionQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  employeeId: z.string().uuid().optional(),
  moduleId: z.string().optional(),
});

export type CreateModuleInput = z.infer<typeof createModuleSchema>;
export type UpdateModuleInput = z.infer<typeof updateModuleSchema>;
export type ImportModulesInput = z.infer<typeof importModulesSchema>;
export type ModuleQuery = z.infer<typeof moduleQuerySchema>;
export type CreateCompletionInput = z.infer<typeof createCompletionSchema>;
export type CompletionQuery = z.infer<typeof completionQuerySchema>;
