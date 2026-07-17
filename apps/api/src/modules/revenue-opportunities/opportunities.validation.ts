import { z } from "zod";

import { OPPORTUNITY_STAGES } from "@/modules/revenue-opportunities/opportunities.constants";

export const createOpportunitySchema = z.object({
  name: z.string().min(1, "Name is required").max(300),
  accountId: z.string().min(1, "Account is required"),
  contactId: z.string().optional(),
  stage: z.enum(OPPORTUNITY_STAGES).default("qualified"),
  value: z.coerce.number().nonnegative("Value must be non-negative"),
  // Per-opportunity currency; no implicit FX conversion.
  currency: z.string().length(3).default("USD"),
  // When the rep sets probability on create we mark probabilityCustom = true
  // so subsequent stage moves do not overwrite it.
  probability: z.coerce.number().int().min(0).max(100).optional(),
  closeDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format")
    .optional(),
  // Keep "deal closed" separate from "launched in production".
  launchDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format")
    .optional(),
  // Record when revenue actually starts, often
  // weeks after the soft launch tracked by `launchDate`.
  revenueLaunchDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format")
    .optional(),
  type: z.string().max(100).optional(),
  notes: z.string().max(5000).optional(),
});

export const updateOpportunitySchema = createOpportunitySchema
  .partial()
  // accountId is set on create; switching the parent account is a separate
  // workflow (we'd need to re-validate contact + tasks). Out of scope for v2.
  .omit({ accountId: true });

export const closeLostSchema = z.object({
  lostReason: z.string().max(1000).optional(),
});

// Reopen flips a closed_* row back into the live pipeline. Only
// non-terminal stages are valid targets; the rep picks where the deal lands.
export const reopenSchema = z.object({
  stage: z.enum(["qualified", "proposal", "negotiation"]).default("qualified"),
});

// Cross-currency forecast. Caller picks which
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
  // Geographic filters resolve through the
  // related Account row. Plain text match so admin-added country /
  // region values flow through without a fixed enum.
  country: z.string().optional(),
  region: z.string().optional(),
});

// Within-stage manual reorder. `orderedIds` is the full visible card list
// for one stage column, top to bottom; the service writes sortOrderWithinStage
// = index for each. Capped so a runaway payload can't write thousands of rows.
export const reorderWithinStageSchema = z.object({
  stageKey: z.enum(OPPORTUNITY_STAGES),
  orderedIds: z.array(z.string().min(1)).min(1).max(500),
});

export type CreateOpportunityInput = z.infer<typeof createOpportunitySchema>;
export type UpdateOpportunityInput = z.infer<typeof updateOpportunitySchema>;
export type ReorderWithinStageInput = z.infer<typeof reorderWithinStageSchema>;
export type CloseLostInput = z.infer<typeof closeLostSchema>;
export type ReopenOpportunityInput = z.infer<typeof reopenSchema>;
export type ListOpportunitiesQuery = z.infer<typeof listOpportunitiesSchema>;

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
