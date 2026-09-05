import { z } from "zod";

// Per PRD §11.7 follow-up — workspace-admin-managed lookup table.
// Codes are normalized to lowercase + dash-separated so the value column
// stays predictable across the API surface.
export const leadSourceCodeSchema = z
  .string()
  .min(2, "Code must be at least 2 characters")
  .max(50, "Code must be 50 characters or fewer")
  .regex(
    /^[a-z][a-z0-9-]*$/,
    "Code must start with a letter and contain only lowercase letters, digits, and hyphens",
  );

export const createLeadSourceSchema = z.object({
  code: leadSourceCodeSchema,
  label: z.string().min(1, "Label is required").max(100),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
});

export const updateLeadSourceSchema = z
  .object({
    label: z.string().min(1).max(100).optional(),
    sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "At least one field is required",
  });

// Reps creating leads only see active sources, but workspace-admins
// reviewing the management screen need to see deactivated rows too.
export const listLeadSourcesSchema = z.object({
  includeInactive: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "true"),
});

export type CreateLeadSourceInput = z.infer<typeof createLeadSourceSchema>;
export type UpdateLeadSourceInput = z.infer<typeof updateLeadSourceSchema>;
export type ListLeadSourcesQuery = z.infer<typeof listLeadSourcesSchema>;
