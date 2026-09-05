import { z } from "zod";

import { businessUnitCodeSchema } from "@/modules/business-units/business-units.validation";
import {
  bulkBusinessUnitsSchema,
  bulkLeadFieldSetSchema,
  bulkSelectionFields,
  bulkViewFacets,
  hasSelection,
  NO_SELECTION_MESSAGE,
} from "@/modules/crm-shared/bulk-validation";
import { OPPORTUNITY_STAGES } from "@/modules/opportunities/opportunities.constants";

// PRD §11.7 — `source` was a fixed zod enum in Phase 1. Now backed by
// the workspace-admin-managed `crm_lead_sources` table; zod validates
// the *shape* (lowercase code), and LeadService checks the value
// resolves to an active row before persisting.
export const SOURCE_CODE_RE = /^[a-z][a-z0-9-]*$/;

// Kept as a typed list for the seed file + legacy migrations. Other
// callers should query the lead_sources table at runtime.
export const SYSTEM_LEAD_SOURCE_CODES = [
  "web",
  "referral",
  "conference",
  "partner",
  "cold",
  "other",
] as const;

// Lifecycle: new → contacted → qualified → converted | disqualified.
// "converted" / "disqualified" are set by their dedicated endpoints, not via PUT.
export const LEAD_STATUSES = [
  "new",
  "contacted",
  "qualified",
  "converted",
  "disqualified",
] as const;

// Statuses a rep is allowed to set directly via create/update.
export const REP_SETTABLE_STATUSES = ["new", "contacted", "qualified"] as const;

// PRD §11.3 — stale-lead threshold is hard-coded to 14 days in v2. Promoted
// to a workspace-configurable setting in a future release (§15 follow-up).
export const STALE_LEAD_DAYS = 14;

// Stale view restricts to leads still in active prospecting (`new` /
// `contacted`). `qualified` rows are about to be converted; `converted` /
// `disqualified` are terminal — none are useful in a "needs follow-up" list.
export const STALE_LEAD_STATUSES = ["new", "contacted"] as const;

export const createLeadSchema = z.object({
  company: z.string().min(1, "Company is required").max(300),
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().min(1, "Last name is required").max(100),
  email: z.string().email().max(200).optional(),
  phone: z.string().max(50).optional(),
  title: z.string().max(150).optional(),
  source: z
    .string()
    .min(2, "Source is required")
    .max(50)
    .regex(SOURCE_CODE_RE, "Source must be a lowercase code"),
  status: z.enum(REP_SETTABLE_STATUSES).default("new"),
  notes: z.string().max(5000).optional(),
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

export const updateLeadSchema = createLeadSchema.partial();

export const listLeadsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  status: z.enum(LEAD_STATUSES).optional(),
  source: z.string().regex(SOURCE_CODE_RE).optional(),
  ownerId: z.string().optional(),
  // Active (default) vs Archived view. Query arrives as a string; coerce to
  // a boolean so the repo can flip the archivedAt null/not-null filter.
  archived: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  // Business-unit filter. A code narrows to records tagged with it;
  // BUSINESS_UNIT_UNASSIGNED ("__none__") narrows to untagged records.
  businessUnit: z.string().optional(),
});

// Stale list takes the same pagination + search shape as the regular list
// but does not accept status / source overrides — the stale rule fully
// determines the row set.
export const listStaleLeadsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  ownerId: z.string().optional(),
});

export const disqualifyLeadSchema = z.object({
  reason: z.string().min(1, "Reason is required").max(1000),
});

// PRD §6 conversion body. Account / contact pieces are optional — when both
// are absent the service synthesises them from Lead fields.
export const convertLeadSchema = z
  .object({
    accountId: z.string().optional(),
    newAccount: z
      .object({
        name: z.string().min(1).max(300),
        domain: z.string().max(255).optional(),
        industry: z.string().max(150).optional(),
        size: z.string().max(50).optional(),
        country: z.string().max(100).optional(),
        website: z.string().max(500).optional(),
      })
      .optional(),
    contactId: z.string().optional(),
    newContact: z
      .object({
        firstName: z.string().min(1).max(100),
        lastName: z.string().min(1).max(100),
        email: z.string().email().max(200).optional(),
        phone: z.string().max(50).optional(),
        title: z.string().max(150).optional(),
      })
      .optional(),
    opportunity: z.object({
      name: z.string().min(1, "Opportunity name is required").max(300),
      stage: z.enum(OPPORTUNITY_STAGES).default("qualified"),
      value: z.coerce.number().nonnegative(),
      currency: z.string().length(3).default("USD"),
      probability: z.coerce.number().int().min(0).max(100).optional(),
      closeDate: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format")
        .optional(),
      type: z.string().max(100).optional(),
    }),
    // PRD §11.1 — gated by `crm:reassign` at the service layer.
    ownerId: z.string().optional(),
    // §11.2 fallback override forwarded to account dedupe.
    confirmCreate: z.boolean().optional(),
  })
  .refine((d) => !(d.accountId && d.newAccount), {
    message: "Pass accountId OR newAccount, not both",
    path: ["newAccount"],
  })
  .refine((d) => !(d.contactId && d.newContact), {
    message: "Pass contactId OR newContact, not both",
    path: ["newContact"],
  });

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type ListLeadsQuery = z.infer<typeof listLeadsSchema>;
export type ListStaleLeadsQuery = z.infer<typeof listStaleLeadsSchema>;
export type DisqualifyLeadInput = z.infer<typeof disqualifyLeadSchema>;
export type ConvertLeadInput = z.infer<typeof convertLeadSchema>;

// ── Bulk select-and-act ───────────────────────────────────────────
// Selection shape and the reasoning behind it live in
// `modules/crm-shared/bulk-validation.ts`. Only the filter facets are
// module-specific — they must mirror ListLeadsFilters, minus
// `ownerScope`, which is server-computed and never client-supplied.

const bulkLeadsFilterSchema = z
  .object({
    search: z.string().optional(),
    status: z.string().min(1).max(40).optional(),
    source: z.string().min(1).max(60).optional(),
    ownerId: z.string().uuid().optional(),
    ...bulkViewFacets,
  })
  .optional();

export const bulkUpdateLeadsSchema = z
  .object({
    ...bulkSelectionFields,
    filter: bulkLeadsFilterSchema,
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

export type BulkUpdateLeadsInput = z.infer<typeof bulkUpdateLeadsSchema>;

export const bulkFieldUpdateLeadsSchema = z
  .object({
    ...bulkSelectionFields,
    filter: bulkLeadsFilterSchema,
    set: z
      .object({
        archived: z.boolean().optional(),
        // Only the rep-settable statuses. `converted` and `disqualified` are
        // terminal and have dedicated endpoints — convert creates an
        // opportunity, disqualify captures a reason — so neither can be a flat
        // bulk set without losing that work.
        status: z.enum(REP_SETTABLE_STATUSES).optional(),
      })
      .refine((v) => v.archived !== undefined || v.status !== undefined, {
        message: "Provide at least one field to change.",
      }),
  })
  .refine(hasSelection, { message: NO_SELECTION_MESSAGE });

export type BulkFieldUpdateLeadsInput = z.infer<
  typeof bulkFieldUpdateLeadsSchema
>;
