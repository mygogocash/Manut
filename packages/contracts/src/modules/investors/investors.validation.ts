import { z } from "zod";

import { investorTagCodeSchema } from "../investor-tags/investor-tags.validation";
import { INVESTOR_STATUS_VALUES } from "./investor-pipeline";

export { INVESTOR_STATUS_VALUES };

const jsonValueSchema: z.ZodType<
  string | number | boolean | null | { [key: string]: unknown } | unknown[]
> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.record(jsonValueSchema),
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
  notes: z.record(jsonValueSchema).optional(),
  visibility: z.enum(["team", "private", "public"]).default("team"),
  // Pipeline stages are admin-configurable (InvestorPipelineStage), so
  // status is an open stage key rather than a fixed enum. Default is the
  // leftmost intake stage.
  status: z.string().min(1).max(120).default("investors"),
  // Pipeline-master columns (2026-05-28).
  title: optionalText,
  linkedinUrl: optionalUrl,
  revenueStream: optionalText,
  lastContactDate: optionalDate,
  nextAction: optionalText,
  // 2026-05-28 split — actual investment to date + estimated future
  // ticket replaced the single `estCommission` field.
  actInvestment: optionalText,
  estInvestment: optionalText,
  crossSell: optionalText,
  region: optionalText,
  notesText: optionalText,
  fundraisingEntity: z.string().min(1).max(60).optional(),
  // Searchable labels. Open strings with no FK to InvestorTag, so a tag can
  // be renamed or retired without touching investor rows — the same contract
  // as `businessUnits` on opportunities. Validated to the shared code shape
  // so a filter value is always URL-safe, and capped so one payload cannot
  // write an unbounded array.
  tags: z.array(investorTagCodeSchema).max(50).optional(),
});

export const updateInvestorSchema = createInvestorSchema.partial();

// Bulk import payload from the xlsx / csv dialog. Re-uses
// `createInvestorSchema` per row so the existing email / url / enum
// validators run unchanged. Capped at 1000 to keep one bulk call
// bounded — the service iterates row-by-row so a single failure
// skips that row rather than rolling back the batch.
export const importInvestorsSchema = z.object({
  rows: z.array(createInvestorSchema).min(1).max(1000),
  // Tag codes on a row are open strings with no FK, so a code that exists on
  // no catalog row still saves — it just renders as a raw slug and never
  // appears in the tag filter. The importer therefore creates the missing
  // catalog entries by default. Opt out to import rows without touching the
  // shared catalog.
  createMissingTags: z.boolean().optional(),
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
    fundraisingEntity: z.string().min(1).max(60).optional(),
    // Scope the "select all matching" set to the active/archived view the
    // rep is looking at, so a bulk action in the Archived view can't spill
    // onto active rows.
    archived: z.boolean().optional(),
    // Same reason as `archived`: the tag facet is part of what the rep is
    // looking at, so "select all matching" MUST carry it or the action hits
    // rows the list never showed. Not code-validated here — an unknown code
    // simply matches nothing, which is the safe direction.
    tag: z.string().optional(),
    // Sent by the pipeline board, which only renders rows whose status maps
    // to a configured stage. Legacy statuses (`new`, `prospect`, `active`, …)
    // exist on real rows and appear in no column, so an "all matching"
    // selection from the board without this facet would resolve to a WIDER
    // set than the board counted — offering 214 and updating 220.
    statusIn: z.array(z.string().min(1).max(120)).max(100).optional(),
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
        // Move the selection to another fundraising vehicle. The service
        // resolves the key against the catalog before writing, so an
        // unknown key 400s rather than stranding rows on a dead tab.
        fundraisingEntity: z.string().min(1).max(60).optional(),
        // Reassign owner — service requires investors:read-all.
        addedBy: z.string().uuid().optional(),
        // Archive / restore the selection. true archives, false restores.
        // The service narrows the where so an already-archived row keeps its
        // original archivedAt — see the note on bulkUpdate.
        archived: z.boolean().optional(),
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

/**
 * Bulk tag assignment.
 *
 * Separate from `bulkUpdateInvestorsSchema` rather than another key on `set`,
 * because tagging has a MODE. Every other bulk field is "write this value";
 * `add` is a per-row union of what each investor already carries with what was
 * requested, which is a different operation with a different result per row.
 *
 * `replace` with an empty array is meaningful — it clears every tag — so only
 * the union direction is constrained by the schema's shape.
 *
 * Codes are NOT validated against the catalog here, matching the Sales CRM
 * business-unit decision: an unknown code tags nothing useful, whereas
 * rejecting a 200-row batch over one stale code is the worse failure. Chips
 * fall back to rendering the raw code, which is the documented behaviour of
 * `labelForInvestorTag`.
 */
export const bulkTagsInvestorsSchema = z
  .object({
    ...bulkSelection,
    mode: z.enum(["add", "replace"]),
    codes: z.array(investorTagCodeSchema).max(50),
  })
  .refine(hasSelection, {
    message: "Select rows (ids) or set allMatching with a filter.",
  })
  .refine((d) => d.mode === "replace" || d.codes.length > 0, {
    message: "Choose at least one tag to add.",
    path: ["codes"],
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
export type BulkTagsInvestorsInput = z.infer<typeof bulkTagsInvestorsSchema>;
