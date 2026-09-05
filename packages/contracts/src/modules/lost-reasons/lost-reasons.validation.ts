import { z } from "zod";

// PRD §11.7 follow-up — workspace-admin lookup mirroring LeadSource.
// Codes are normalized lowercase + dash-separated.
export const lostReasonCodeSchema = z
  .string()
  .min(2, "Code must be at least 2 characters")
  .max(50, "Code must be 50 characters or fewer")
  .regex(
    /^[a-z][a-z0-9-]*$/,
    "Code must start with a letter and contain only lowercase letters, digits, and hyphens",
  );

export const createLostReasonSchema = z.object({
  code: lostReasonCodeSchema,
  label: z.string().min(1, "Label is required").max(100),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
});

export const updateLostReasonSchema = z
  .object({
    label: z.string().min(1).max(100).optional(),
    sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "At least one field is required",
  });

export const listLostReasonsSchema = z.object({
  includeInactive: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "true"),
});

export type CreateLostReasonInput = z.infer<typeof createLostReasonSchema>;
export type UpdateLostReasonInput = z.infer<typeof updateLostReasonSchema>;
export type ListLostReasonsQuery = z.infer<typeof listLostReasonsSchema>;
