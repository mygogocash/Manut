import { z } from "zod";

import { OPPORTUNITY_STAGES } from "@/modules/opportunities/opportunities.constants";

const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
  .or(z.literal(""))
  .optional()
  .nullable();

/** Pipeline fields edited from the Accounts form — synced to Opportunity. */
export const accountDealSchema = z
  .object({
    opportunityId: z.string().optional(),
    stage: z.enum(OPPORTUNITY_STAGES).optional(),
    probability: z.coerce.number().int().min(0).max(100).optional(),
    launchDate: dateField,
    revenueLaunchDate: dateField,
    value: z.coerce.number().nonnegative().optional(),
    currency: z.string().length(3).optional(),
  })
  .optional();

export const createAccountSchema = z.object({
  name: z.string().min(1, "Name is required").max(300),
  // When present, domain is the unique dedupe key.
  domain: z.string().max(255).optional(),
  industry: z.string().max(150).optional(),
  size: z.string().max(50).optional(),
  country: z.string().max(100).optional(),
  // Coarse geo rollup; admin-managed at the app layer so
  // we keep it as plain text here.
  region: z.string().max(100).optional(),
  website: z.string().max(500).optional(),
  notes: z.string().max(5000).optional(),
  // Account metrics. Coerce because xlsx imports / form inputs
  // arrive as strings.
  totalUsers: z.coerce.number().int().nonnegative().optional(),
  appUsers: z.coerce.number().int().nonnegative().optional(),
  // Engagement tracking. Every field is
  // nullable; reps populate them as the relationship matures. Dates
  // accept either YYYY-MM-DD or empty string (form sends "" for
  // unset pickers). The service converts "" → null on persist.
  picName: z.string().max(200).optional().nullable(),
  designation: z.string().max(150).optional().nullable(),
  department: z.string().max(150).optional().nullable(),
  lastFollowUpDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .or(z.literal(""))
    .optional()
    .nullable(),
  agreementSignedDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .or(z.literal(""))
    .optional()
    .nullable(),
  // Free-text "engagement" / "revenue" — client renders a dropdown
  // but the server stays open so admins can extend without a Zod
  // enum bump.
  engagementType: z.string().max(40).optional().nullable(),
  uatStartDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .or(z.literal(""))
    .optional()
    .nullable(),
  uatEndDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .or(z.literal(""))
    .optional()
    .nullable(),
  blocker: z.string().max(2000).optional().nullable(),
  remarks: z.string().max(2000).optional().nullable(),
  partnerId: z.string().optional(),
  // Name-dedupe fallback: when name matches an existing record (no domain), the
  // server returns 409 with the candidate. Client retries with this flag to
  // override and create a distinct account.
  confirmCreate: z.boolean().optional(),
  deal: accountDealSchema,
});

export const updateAccountSchema = createAccountSchema
  .partial()
  .omit({ confirmCreate: true });

export const listAccountsSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  // Cap raised from 100 → 1000 so the Accounts grid Export (#705)
  // can pull a full snapshot in one call. Same ceiling legal-crm
  // uses for the same reason.
  limit: z.coerce.number().int().positive().max(1000).default(20),
  search: z.string().optional(),
  industry: z.string().optional(),
  country: z.string().optional(),
  region: z.string().optional(),
  ownerId: z.string().optional(),
  partnerId: z.string().optional(),
  // Accounts list filter. Matches
  // accounts whose latest linked opportunity sits at this stage.
  // Server interprets it as "has at least one opportunity at <stage>"
  // so unattached or differently-staged accounts drop out.
  stage: z.enum(OPPORTUNITY_STAGES).optional(),
});

// Mirrors `reorderLegalProjectsSchema` (#697). `orderedIds` is the
// rep-visible list in the order they want persisted; the service
// writes 0..N-1 in that order so the next list call returns the same
// arrangement.
export const reorderAccountsSchema = z.object({
  orderedIds: z.array(z.string().min(1)).min(1).max(500),
});

// Bulk-create accounts from the xlsx / csv import dialog. Each row
// re-uses `createAccountSchema` so the same field-level coercion runs
// in the bulk path. Capped at 1000 to keep one transaction bounded —
// the service iterates row-by-row so a single bad row can be skipped
// rather than failing the whole batch.
export const importAccountsSchema = z.object({
  rows: z.array(createAccountSchema).min(1).max(1000),
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>;
export type ListAccountsQuery = z.infer<typeof listAccountsSchema>;
export type ReorderAccountsInput = z.infer<typeof reorderAccountsSchema>;
export type ImportAccountsInput = z.infer<typeof importAccountsSchema>;
