import { z } from "zod";

/**
 * Selection fields shared by every Sales CRM bulk payload.
 *
 * The selection is EITHER an explicit id list (rows ticked on the page) OR
 * `allMatching: true` + a `filter` (Gmail-style "select all N matching the
 * current filters"). Each module supplies its own `filter` schema because the
 * facets differ, but the selection half is identical everywhere.
 *
 * `ownerScope` is deliberately NOT accepted from the client in any module's
 * filter schema. It is computed server-side from `crm:team-read` and ANDed in
 * by `resolveBulkWhere`; letting a caller supply it would hand them a way to
 * act on another rep's rows.
 */
export const bulkSelectionFields = {
  ids: z.array(z.string().min(1)).max(5000).optional(),
  allMatching: z.boolean().optional(),
};

/**
 * Exactly one selection mode must be present. Without this refinement an empty
 * body would parse, and `{}` as a Prisma `where` means every row in the table.
 */
export const hasSelection = (d: { ids?: string[]; allMatching?: boolean }) =>
  (d.ids?.length ?? 0) > 0 || d.allMatching === true;

export const NO_SELECTION_MESSAGE =
  "Select rows (ids) or set allMatching with a filter.";

/**
 * The business-unit assignment half of a bulk payload.
 *
 * Codes are not validated against the catalog here: an unknown code simply
 * tags nothing useful, whereas rejecting the whole batch for one stale code is
 * the worse failure. The service resolves them, exactly as the single-record
 * path does.
 */
export const bulkBusinessUnitsSchema = z.object({
  mode: z.enum(["add", "replace"]),
  // `replace` with an empty array is meaningful — it clears every tag — so
  // only `add` requires at least one code.
  codes: z.array(z.string().min(1).max(60)).max(50),
});

/** Shared archive-view + tag facets every Sales CRM list exposes. */
export const bulkViewFacets = {
  // Scope "select all matching" to the Active/Archived view the rep is looking
  // at, so a bulk action in one view cannot spill onto the other.
  archived: z.boolean().optional(),
  // The business-unit facet is part of what the rep is looking at — including
  // the `__none__` Unassigned sentinel — so it MUST travel with the selection
  // or the action hits rows the list never showed.
  businessUnit: z.string().min(1).max(60).optional(),
};

/**
 * The plain-field half of a bulk payload: owner and archive.
 *
 * `ownerId` is NOT gated here — `requirePermission` on the route cannot express
 * "only when this optional field is present", so the `crm:reassign` check lives
 * in the service. That is the same reasoning the approval-chain routes use for
 * `assertCanActOnStep`.
 */
export const bulkFieldSetSchema = z
  .object({
    ownerId: z.string().uuid().optional(),
    archived: z.boolean().optional(),
  })
  .refine((s) => s.ownerId !== undefined || s.archived !== undefined, {
    message: "Provide at least one field to change.",
  });

/**
 * Leads variant: archive only, no `ownerId`.
 *
 * A lead's owner is NOT settable through its single-record update —
 * `updateLeadSchema` is `createLeadSchema.partial()` and the create schema has
 * no owner field, so ownership is fixed at creation and can only move during
 * convert (itself gated on `crm:reassign`, PRD §11.1). Bulk must not invent a
 * capability the single-record path does not have, so the field is absent here
 * rather than accepted and silently dropped.
 */
export const bulkLeadFieldSetSchema = z.object({
  archived: z.boolean(),
});

/**
 * Stages a bulk action may set on an opportunity: the NON-TERMINAL ones only.
 *
 * Deliberately the same set `reopenSchema` allows, and for the same reason —
 * the three terminal stages each carry semantics a flat bulk set cannot supply:
 *
 *   * `closed_lost` needs a lost reason, captured by the `closeLost` endpoint;
 *   * `closed_won` and `live` are milestones whose dates (closeDate,
 *     launchDate, revenueLaunchDate) a bulk set would leave empty.
 *
 * And `update()` carries no terminal-transition guard — only `closeLost` does —
 * so permitting them here would let one click move fifty won deals to lost with
 * no reason recorded anywhere.
 */
export const BULK_SETTABLE_STAGES = [
  "qualified",
  "proposal",
  "negotiation",
] as const;

export const bulkStageSchema = z.enum(BULK_SETTABLE_STAGES);
