import { z } from "zod";

import { businessUnitCodeSchema } from "../business-units/business-units.validation";
import {
  bulkBusinessUnitsSchema,
  bulkFieldSetSchema,
  bulkSelectionFields,
  bulkStageSchema,
  bulkViewFacets,
  hasSelection,
  NO_SELECTION_MESSAGE,
} from "../crm-shared/bulk-validation";
import { OPPORTUNITY_STAGES } from "./opportunities.constants";

export const createOpportunitySchema = z.object({
  name: z.string().min(1, "Name is required").max(300),
  accountId: z.string().min(1, "Account is required"),
  contactId: z.string().optional(),
  stage: z.enum(OPPORTUNITY_STAGES).default("qualified"),
  value: z.coerce.number().nonnegative("Value must be non-negative"),
  // Per-Opportunity currency per PRD §11.5 (no FX in v2).
  currency: z.string().length(3).default("USD"),
  // When the rep sets probability on create we mark probabilityCustom = true
  // so subsequent stage moves do not overwrite it.
  probability: z.coerce.number().int().min(0).max(100).optional(),
  closeDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format")
    .optional(),
  // BD-feedback — separate "deal closed" from "launched in production".
  launchDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format")
    .optional(),
  // BD-feedback (2026-05-28) — when revenue actually starts, often
  // weeks after the soft launch tracked by `launchDate`.
  revenueLaunchDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format")
    .optional(),
  type: z.string().max(100).optional(),
  notes: z.string().max(5000).optional(),
  // Create-on-behalf-of. Honoured ONLY when the actor holds crm:team-read
  // (service-level check); anyone else silently gets themselves as owner, so
  // a rep cannot park deals on a teammate. Added for the ARIA Revenue
  // migration, whose 13 deals belong to their original owner, not to the
  // admin running the move.
  ownerId: z.string().uuid().optional(),
  // Provenance + idempotency for imports/migrations. DB-unique, so a re-run
  // fails loudly on the second insert instead of duplicating the deal.
  legacyDealId: z.string().min(1).max(100).optional(),
  // Business-unit tags (Onewave / Onewave Revenue / ARIA …). Shape-validated
  // only: a code that has since been deactivated stays on records already
  // carrying it, exactly like Lead.source / Opportunity.lostReason.
  //
  // Deduped BEFORE the max-count check: 11 copies of one code collapse to
  // one unit, and rejecting that submission would be wrong even though the
  // raw array is over the limit. The transform runs only when the array is
  // present, so an absent businessUnits stays absent rather than becoming
  // [].
  businessUnits: z
    .array(businessUnitCodeSchema)
    .transform((codes) => [...new Set(codes)])
    .refine((codes) => codes.length <= 10, {
      message: "Cannot tag more than 10 business units",
    })
    .optional(),
});

export const updateOpportunitySchema = createOpportunitySchema
  .partial()
  // accountId is set on create; switching the parent account is a separate
  // workflow (we'd need to re-validate contact + tasks). Out of scope for v2.
  .omit({ accountId: true });

export const closeLostSchema = z.object({
  lostReason: z.string().max(1000).optional(),
});

// PRD §11.4 — reopen flips a closed_* row back into the live pipeline. Only
// non-terminal stages are valid targets; the rep picks where the deal lands.
export const reopenSchema = z.object({
  stage: z.enum(["qualified", "proposal", "negotiation"]).default("qualified"),
});

// PRD §11.5 follow-up — cross-currency forecast. Caller picks which
// ISO 4217 code to roll everything up into.
export const forecastQuerySchema = z.object({
  currency: z
    .string()
    .length(3, "Use a 3-letter ISO currency code")
    .default("USD")
    .transform((v) => v.toUpperCase()),
});

export type ForecastQuery = z.infer<typeof forecastQuerySchema>;

export const listOpportunitiesSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  stage: z.enum(OPPORTUNITY_STAGES).optional(),
  accountId: z.string().optional(),
  ownerId: z.string().optional(),
  // BD-feedback (Vivek, May 2026) — geo filters resolve through the
  // related Account row. Plain text match so admin-added country /
  // region values flow through without a fixed enum.
  country: z.string().optional(),
  region: z.string().optional(),
  // Reversible archive filter. "true" → ONLY archived opportunities;
  // anything else (incl. absent) → active only. Explicit string compare —
  // z.coerce.boolean() would turn "false" into true. Orthogonal to `stage`.
  archived: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  // Business-unit filter. A code narrows to records tagged with it;
  // BUSINESS_UNIT_UNASSIGNED ("__none__") narrows to untagged records.
  businessUnit: z.string().optional(),
});

export type CreateOpportunityInput = z.infer<typeof createOpportunitySchema>;
export type UpdateOpportunityInput = z.infer<typeof updateOpportunitySchema>;
export type CloseLostInput = z.infer<typeof closeLostSchema>;
export type ReopenOpportunityInput = z.infer<typeof reopenSchema>;
export type ListOpportunitiesQuery = z.infer<typeof listOpportunitiesSchema>;

/**
 * Kanban board filters. Same keys as the list query minus pagination and
 * `stage`, so the column-header rollup can be narrowed by exactly what the
 * cards are narrowed by.
 */
export const pipelineQuerySchema = listOpportunitiesSchema.pick({
  ownerId: true,
  country: true,
  region: true,
  businessUnit: true,
});

export type PipelineQuery = z.infer<typeof pipelineQuerySchema>;

// Admin bulk-update for the per-stage label / probability / sortOrder
// table. Each row's `key` must be one of the canonical stages — admins
// can edit the metadata, not invent new stage codes.
export const bulkUpdateStageConfigsSchema = z.object({
  configs: z
    .array(
      z.object({
        key: z.enum(OPPORTUNITY_STAGES),
        label: z.string().min(1).max(50),
        probability: z.coerce.number().int().min(0).max(100),
        sortOrder: z.coerce.number().int().min(0).max(1000),
        color: z.string().max(50).optional(),
      }),
    )
    .min(1),
});

export type BulkUpdateStageConfigsInput = z.infer<
  typeof bulkUpdateStageConfigsSchema
>;

// ── Per-unit progress + card order ────────────────────────────────────────
//
// The BOARD is one card per partner (deal). These schemas are the two things
// that still address something finer:
//
//  - `moveBusinessUnitSchema` edits ONE unit's progress, which is what the
//    Edit-opportunity dialog's per-unit stage table submits. `stage` here is
//    the UNIT's stage, never the deal's rolled-up one.
//  - `reorderOpportunityCardsSchema` writes a column's manual card order.
//    Deal ids, because a card IS a deal now — ordering by (deal x unit) pair
//    would have no card to apply to.

export const moveBusinessUnitSchema = z.object({
  stage: z.enum(OPPORTUNITY_STAGES).optional(),
  probability: z.coerce.number().int().min(0).max(100).optional(),
  value: z.coerce.number().min(0).optional(),
  closeDate: z.string().date().nullable().optional(),
  launchDate: z.string().date().nullable().optional(),
  revenueLaunchDate: z.string().date().nullable().optional(),
  lostReason: z.string().max(200).nullable().optional(),
});

export type MoveBusinessUnitInput = z.infer<typeof moveBusinessUnitSchema>;

export const reorderOpportunityCardsSchema = z.object({
  stageKey: z.enum(OPPORTUNITY_STAGES),
  // Capped because a column renumber is one write per card, and an unbounded
  // list would be an easy way to hold a transaction open.
  opportunityIds: z.array(z.string().min(1)).min(1).max(500),
});

export type ReorderOpportunityCardsInput = z.infer<
  typeof reorderOpportunityCardsSchema
>;

// ── Bulk select-and-act ───────────────────────────────────────────
// Selection shape and the reasoning behind it live in
// `modules/crm-shared/bulk-validation.ts`. Only the filter facets are
// module-specific — they must mirror ListOpportunitiesFilters, minus
// `ownerScope`, which is server-computed and never client-supplied.

const bulkOpportunitiesFilterSchema = z
  .object({
    search: z.string().optional(),
    stage: z.string().min(1).max(40).optional(),
    accountId: z.string().min(1).optional(),
    ownerId: z.string().uuid().optional(),
    country: z.string().min(1).max(80).optional(),
    region: z.string().min(1).max(40).optional(),
    ...bulkViewFacets,
  })
  .optional();

export const bulkUpdateOpportunitiesSchema = z
  .object({
    ...bulkSelectionFields,
    filter: bulkOpportunitiesFilterSchema,
    businessUnits: bulkBusinessUnitsSchema,
  })
  .refine(hasSelection, { message: NO_SELECTION_MESSAGE })
  .refine(
    (d) =>
      d.businessUnits.mode === "replace" || d.businessUnits.codes.length > 0,
    {
      message: "Provide at least one business unit to add.",
      path: ["businessUnits", "codes"],
    },
  );

export type BulkUpdateOpportunitiesInput = z.infer<
  typeof bulkUpdateOpportunitiesSchema
>;

export const bulkFieldUpdateOpportunitiesSchema = z
  .object({
    ...bulkSelectionFields,
    filter: bulkOpportunitiesFilterSchema,
    set: bulkFieldSetSchema
      .and(z.object({ stage: bulkStageSchema.optional() }))
      // The base schema requires owner or archived; a stage-only payload is
      // legitimate, so the combined refinement replaces it.
      .refine(
        (v) =>
          v.ownerId !== undefined ||
          v.archived !== undefined ||
          v.stage !== undefined,
        { message: "Provide at least one field to change." },
      ),
  })
  .refine(hasSelection, { message: NO_SELECTION_MESSAGE });

export type BulkFieldUpdateOpportunitiesInput = z.infer<
  typeof bulkFieldUpdateOpportunitiesSchema
>;
