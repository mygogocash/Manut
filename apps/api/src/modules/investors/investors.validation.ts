import { z } from "zod";

import { INVESTOR_STATUS_VALUES } from "@/modules/investors/investor-pipeline";

export { INVESTOR_STATUS_VALUES };

const jsonValueSchema: z.ZodType<
  string | number | boolean | null | { [key: string]: unknown } | unknown[]
> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.record(z.string(), jsonValueSchema),
    z.array(jsonValueSchema),
  ]),
);

// Free-text helpers — empty strings round-trip through the form
// pickers; the service normalises "" → null on persist. URL / email
// validators stay strict but accept an explicit empty string so a
// rep can clear the field without typing a placeholder.
const optionalText = z.string().optional().or(z.literal(""));
const optionalEmail = z
  .string()
  .email()
  .or(z.literal(""))
  .optional()
  .nullable();
const optionalUrl = z.string().url().or(z.literal("")).optional().nullable();
const optionalDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .or(z.literal(""))
  .optional()
  .nullable();

export const createInvestorSchema = z.object({
  name: z.string().min(1, "Name is required").max(300),
  type: z.string().min(1, "Type is required"),
  contactName: optionalText,
  contactEmail: optionalEmail,
  contactPhone: optionalText,
  website: optionalUrl,
  location: optionalText,
  notes: z.record(z.string(), jsonValueSchema).optional(),
  visibility: z.enum(["team", "private", "public"]).default("team"),
  // Pipeline stages are admin-configurable (InvestorPipelineStage), so
  // status is an open stage key rather than a fixed enum. Default is the
  // leftmost intake stage.
  status: z.string().min(1).max(120).default("investors"),
  // Pipeline import columns.
  title: optionalText,
  linkedinUrl: optionalUrl,
  revenueStream: optionalText,
  lastContactDate: optionalDate,
  nextAction: optionalText,
  // Separate actual investment to date from estimated future
  // ticket replaced the single `estCommission` field.
  actInvestment: optionalText,
  estInvestment: optionalText,
  crossSell: optionalText,
  region: optionalText,
  notesText: optionalText,
});

export const updateInvestorSchema = createInvestorSchema.partial();

// Bulk import payload from the xlsx / csv dialog. Re-uses
// `createInvestorSchema` per row so the existing email / url / enum
// validators run unchanged. Capped at 1000 to keep one bulk call
// bounded — the service iterates row-by-row so a single failure
// skips that row rather than rolling back the batch.
export const importInvestorsSchema = z.object({
  rows: z.array(createInvestorSchema).min(1).max(1000),
});

// Drag-to-reorder payload — `orderedIds` is the rep-visible list in
// the desired sequence; the service writes 0..N-1 to `sortOrder` in
// that order. Mirrors the sales-crm + legal-crm reorder schemas.
export const reorderInvestorsSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1).max(1000),
});

// Bulk select-and-act payloads. The selection is EITHER an explicit id
// list (rows ticked on the page) OR `allMatching: true` + a `filter`
// (Gmail-style "select all N matching the current search / filters").
// Exactly one mode must be supplied.
const bulkFilterSchema = z
  .object({
    search: z.string().optional(),
    type: z.string().optional(),
    status: z.string().optional(),
  })
  .optional();

const bulkSelection = {
  ids: z.array(z.string().min(1)).max(5000).optional(),
  allMatching: z.boolean().optional(),
  filter: bulkFilterSchema,
};

const hasSelection = (d: { ids?: string[]; allMatching?: boolean }) =>
  (d.ids?.length ?? 0) > 0 || d.allMatching === true;

export const bulkUpdateInvestorsSchema = z
  .object({
    ...bulkSelection,
    set: z
      .object({
        status: z.string().min(1).max(120).optional(),
        type: z.string().min(1).max(60).optional(),
        // Reassign owner — service requires investors:read-all.
        addedBy: z.string().uuid().optional(),
      })
      .refine((s) => Object.keys(s).length > 0, {
        message: "Provide at least one field to update.",
      }),
  })
  .refine(hasSelection, {
    message: "Select rows (ids) or set allMatching with a filter.",
  });

export const bulkDeleteInvestorsSchema = z
  .object(bulkSelection)
  .refine(hasSelection, {
    message: "Select rows (ids) or set allMatching with a filter.",
  });

export type CreateInvestorInput = z.infer<typeof createInvestorSchema>;
export type UpdateInvestorInput = z.infer<typeof updateInvestorSchema>;
export type ImportInvestorsInput = z.infer<typeof importInvestorsSchema>;
export type ReorderInvestorsInput = z.infer<typeof reorderInvestorsSchema>;
export type BulkUpdateInvestorsInput = z.infer<
  typeof bulkUpdateInvestorsSchema
>;
export type BulkDeleteInvestorsInput = z.infer<
  typeof bulkDeleteInvestorsSchema
>;
