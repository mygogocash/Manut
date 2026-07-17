import { z } from "zod";

const benefitCategory = z.enum([
  "health",
  "dental",
  "vision",
  "life",
  "retirement",
  "wellness",
  "other",
]);

export const createBenefitSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  category: benefitCategory,
  description: z.string().max(2000).optional(),
  provider: z.string().max(200).optional(),
  cost: z.coerce.number().nonnegative("Cost must be non-negative"),
  currency: z.string().length(3).default("THB"),
  entityId: z.string().cuid().nullable().optional(),
  isActive: z.boolean().default(true),
});

// `partial()` only loosens required-ness — to let an admin *clear* the
// entity on edit, allow null explicitly. createBenefitSchema's entityId
// still rejects null so creates require either a real cuid or omit.
export const updateBenefitSchema = createBenefitSchema.partial().extend({
  entityId: z.string().cuid().nullable().optional(),
});

export const enrollSchema = z.object({
  benefitId: z.string().cuid("Invalid benefit ID"),
  employeeId: z.string().optional(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format"),
});

export const listBenefitsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  category: benefitCategory.optional(),
  entityId: z.string().optional(),
});

// ─── Bulk import ────────────────────────────────────────
//
// Frontend parses the template xlsx locally and POSTs canonical rows.
// Entity is resolved server-side by `entityCode` / `entityName` /
// `entityId` (first match wins) so HR can fill in whichever column is
// most convenient.

export const benefitImportRowSchema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  category: benefitCategory,
  description: z.string().max(2000).optional().nullable(),
  provider: z.string().max(200).optional().nullable(),
  cost: z.coerce.number().nonnegative().default(0),
  currency: z
    .string()
    .max(8)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v.toUpperCase() : null)),
  entityCode: z.string().max(20).optional().nullable(),
  entityName: z.string().max(200).optional().nullable(),
  entityId: z.string().max(50).optional().nullable(),
  isActive: z.coerce.boolean().optional(),
});

export const benefitImportSchema = z.object({
  rows: z.array(benefitImportRowSchema).min(1).max(2000),
});

export type CreateBenefitInput = z.infer<typeof createBenefitSchema>;
export type UpdateBenefitInput = z.infer<typeof updateBenefitSchema>;
export type EnrollInput = z.infer<typeof enrollSchema>;
export type ListBenefitsQuery = z.infer<typeof listBenefitsSchema>;
export type BenefitImportRow = z.infer<typeof benefitImportRowSchema>;
export type BenefitImportInput = z.infer<typeof benefitImportSchema>;
