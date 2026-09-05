import { z } from "zod";

/**
 * Admin-editable business units — the "who is taking care of this card" tag
 * shared by Sales CRM (`/sales`) and Sales Revenue CRM (`/sales-revenue`).
 *
 * Shape deliberately mirrors `lost-reasons.validation.ts`: codes are the
 * stable machine value stored inside each record's `businessUnits` text[],
 * labels are what reps read, and both are workspace-editable.
 */

// Codes are normalized lowercase + dash-separated (same rule as lost reasons
// and lead sources) so a code is safe to put in a URL query param.
export const businessUnitCodeSchema = z
  .string()
  .min(2, "Code must be at least 2 characters")
  .max(50, "Code must be 50 characters or fewer")
  .regex(
    /^[a-z][a-z0-9-]*$/,
    "Code must start with a letter and contain only lowercase letters, digits, and hyphens",
  );

/**
 * Chip colours are the shared `Badge` variant NAMES from
 * apps/web/src/components/shared/badge.tsx — not Tailwind classes. Storing
 * the variant name keeps every chip inside the design system's literal
 * class map, which Tailwind's static scan requires (CLAUDE.md).
 */
export const BUSINESS_UNIT_COLORS = [
  "green",
  "amber",
  "red",
  "gold",
  "blue",
  "grey",
  "purple",
  "teal",
  "violet",
] as const;

export type BusinessUnitColor = (typeof BUSINESS_UNIT_COLORS)[number];

/**
 * Sentinel used by every list filter to mean "records with NO business unit".
 * A reserved value rather than a real code — `businessUnitCodeSchema` rejects
 * underscores, so it can never collide with a code an admin creates.
 */
export const BUSINESS_UNIT_UNASSIGNED = "__none__";

export const createBusinessUnitSchema = z.object({
  code: businessUnitCodeSchema,
  label: z.string().min(1, "Label is required").max(100),
  color: z.enum(BUSINESS_UNIT_COLORS).optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
});

export const updateBusinessUnitSchema = z
  .object({
    label: z.string().min(1).max(100).optional(),
    color: z.enum(BUSINESS_UNIT_COLORS).optional(),
    sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "At least one field is required",
  });

export const listBusinessUnitsSchema = z.object({
  includeInactive: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "true"),
});

// Drag-to-reorder in the manager dialog. `orderedIds` is the list top to
// bottom; the service writes sortOrder = index. Capped so a runaway payload
// can't write thousands of rows.
export const reorderBusinessUnitsSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1).max(200),
});

export type CreateBusinessUnitInput = z.infer<typeof createBusinessUnitSchema>;
export type UpdateBusinessUnitInput = z.infer<typeof updateBusinessUnitSchema>;
export type ListBusinessUnitsQuery = z.infer<typeof listBusinessUnitsSchema>;
export type ReorderBusinessUnitsInput = z.infer<
  typeof reorderBusinessUnitsSchema
>;
