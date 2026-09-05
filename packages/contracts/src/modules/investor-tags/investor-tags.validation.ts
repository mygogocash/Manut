import { z } from "zod";

/**
 * Admin-editable investor tags — searchable labels on investor rows.
 *
 * Shape deliberately mirrors `business-units.validation.ts`: codes are the
 * stable machine value stored inside each investor's `tags` text[], labels
 * are what the team reads, and both are workspace-editable.
 *
 * Driven by an investment-team ask (Yanni, 2026-08-26): an imported outreach
 * batch needs a tag "so we can search for them when this list grows to
 * thousands". That is why this is an indexed array column with a managed
 * catalog rather than a substring in a free-text note.
 */

// Normalized lowercase + dash-separated (same rule as business units and
// lost reasons) so a code is safe to put in a URL query param.
export const investorTagCodeSchema = z
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
 * the variant name keeps every chip inside the design system's literal class
 * map, which Tailwind's static scan requires (CLAUDE.md).
 */
export const INVESTOR_TAG_COLORS = [
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

export type InvestorTagColor = (typeof INVESTOR_TAG_COLORS)[number];

/**
 * Sentinel meaning "investors with NO tag" in a list filter.
 *
 * A reserved value rather than a real code — `investorTagCodeSchema` rejects
 * underscores, so it can never collide with a code an admin creates.
 */
export const INVESTOR_TAG_UNTAGGED = "__none__";

export const createInvestorTagSchema = z.object({
  code: investorTagCodeSchema,
  label: z.string().min(1, "Label is required").max(100),
  color: z.enum(INVESTOR_TAG_COLORS).optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
});

export const updateInvestorTagSchema = z
  .object({
    label: z.string().min(1).max(100).optional(),
    color: z.enum(INVESTOR_TAG_COLORS).optional(),
    sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
    isActive: z.boolean().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "At least one field is required",
  });

export const listInvestorTagsSchema = z.object({
  includeInactive: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "true"),
});

// Drag-to-reorder in the manager dialog. `orderedIds` is the list top to
// bottom; the service writes sortOrder = index. Capped so a runaway payload
// cannot write thousands of rows.
export const reorderInvestorTagsSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1).max(200),
});

export type CreateInvestorTagInput = z.infer<typeof createInvestorTagSchema>;
export type UpdateInvestorTagInput = z.infer<typeof updateInvestorTagSchema>;
export type ListInvestorTagsQuery = z.infer<typeof listInvestorTagsSchema>;
export type ReorderInvestorTagsInput = z.infer<
  typeof reorderInvestorTagsSchema
>;
