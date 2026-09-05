import { z } from "zod";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format");

/** JSON clients often send explicit `null`; `z.string()` rejects that before transforms. */
function preprocessOmitEmptyToNull(val: unknown): unknown {
  if (val === undefined) return undefined;
  if (val === null || val === "") return null;
  return val;
}

const updateNullableString = z.preprocess(
  preprocessOmitEmptyToNull,
  z.union([z.string(), z.null()]).optional(),
);

const updateNullableId = z.preprocess(
  preprocessOmitEmptyToNull,
  z.union([z.string().min(1), z.null()]).optional(),
);

const updateNullableDate = z.preprocess(
  preprocessOmitEmptyToNull,
  z.union([dateString, z.null()]).optional(),
);

// Free-text counterparty names (max 20 entries; each trimmed and non-empty).
const partiesField = z
  .array(z.string().trim().min(1, "Party name cannot be empty").max(300))
  .max(20, "At most 20 parties");

// Alert categories drive the configurable Legal notification settings
// (2026-06-12). A document is included in the alert digest only when its
// category's toggle is enabled.
export const LEGAL_ALERT_CATEGORIES = [
  "contract_expiry",
  "contract_review",
  "initial_drafting",
  "licence_renewal",
  "compliance_filing",
  "counterparty_review",
] as const;
const alertCategoryField = z.enum(LEGAL_ALERT_CATEGORIES).nullable().optional();

export const createLegalDocumentSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  // Stored as a string so admins can extend kinds without a code change.
  // Frontend should constrain to license / agreement / nda / policy / other.
  kind: z.string().min(1, "Kind is required").max(50),
  reference: z.string().max(200).optional(),
  parties: partiesField.optional().default([]),
  ownerId: updateNullableId,
  entityId: z.string().min(1).optional(),
  effectiveDate: dateString.optional(),
  expiryDate: dateString.optional(),
  renewalLeadDays: z.coerce.number().int().nonnegative().max(365).default(30),
  status: z.string().min(1).max(30).default("active"),
  fileUrl: z.string().max(2000).optional(),
  fileName: z.string().max(300).optional(),
  folder: z.string().trim().min(1).max(120).optional(),
  alertCategory: alertCategoryField,
  notes: z.string().max(5000).optional(),
});

export const updateLegalDocumentSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  kind: z.string().min(1).max(50).optional(),
  reference: updateNullableString,
  parties: partiesField.optional(),
  ownerId: updateNullableId,
  entityId: updateNullableId,
  effectiveDate: updateNullableDate,
  expiryDate: updateNullableDate,
  renewalLeadDays: z.coerce.number().int().nonnegative().max(365).optional(),
  status: z.string().min(1).max(30).optional(),
  fileUrl: updateNullableString,
  fileName: updateNullableString,
  folder: updateNullableString,
  alertCategory: alertCategoryField,
  notes: updateNullableString,
});

// Configurable Legal notification settings — recipient team list + a
// per-category toggle. Mirrors the IT Helpdesk settings schema.
export const updateLegalNotificationSettingsSchema = z.object({
  recipients: z
    .array(z.string().trim().toLowerCase().email("Invalid email"))
    .max(50, "At most 50 recipients")
    .default([]),
  notifyContractExpiry: z.boolean().default(true),
  notifyContractReview: z.boolean().default(true),
  notifyInitialDrafting: z.boolean().default(true),
  notifyLicenceRenewal: z.boolean().default(true),
  notifyComplianceFiling: z.boolean().default(true),
  notifyCounterpartyReview: z.boolean().default(true),
});

export type UpdateLegalNotificationSettingsInput = z.infer<
  typeof updateLegalNotificationSettingsSchema
>;

export const legalQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  kind: z.string().max(50).optional(),
  status: z.string().max(30).optional(),
  entityId: z.string().min(1).optional(),
  ownerId: z.string().uuid().optional(),
  folder: z.string().max(120).optional(),
  // Free-text search across title / reference / parties.
  search: z.string().max(200).optional(),
  // Surface only docs whose expiry falls within N days from today.
  expiringWithinDays: z.coerce.number().int().positive().max(3650).optional(),
});

export type CreateLegalDocumentInput = z.infer<
  typeof createLegalDocumentSchema
>;
export type UpdateLegalDocumentInput = z.infer<
  typeof updateLegalDocumentSchema
>;
export type LegalQuery = z.infer<typeof legalQuerySchema>;

// ── Attachments ─────────────────────────────────────────────────────────

// Supporting documents attached to a parent LegalDocument — addenda,
// amendments, renewal letters, signed PDFs, etc. Validation mirrors
// the parent document's date / file fields so the UI can reuse the
// same upload helper.
export const ATTACHMENT_KINDS = [
  "addendum",
  "amendment",
  "renewal",
  "signed-pdf",
  "supplement",
  "other",
] as const;

export const createLegalAttachmentSchema = z.object({
  kind: z.enum(ATTACHMENT_KINDS).default("other"),
  label: z.string().trim().max(300).optional(),
  fileUrl: z.string().min(1, "fileUrl is required").max(2000),
  fileName: z.string().min(1, "fileName is required").max(300),
  effectiveDate: dateString.optional(),
  expiryDate: dateString.optional(),
  notes: z.string().max(5000).optional(),
});

export const updateLegalAttachmentSchema = z.object({
  kind: z.enum(ATTACHMENT_KINDS).optional(),
  label: updateNullableString,
  fileUrl: z.string().min(1).max(2000).optional(),
  fileName: z.string().min(1).max(300).optional(),
  effectiveDate: updateNullableDate,
  expiryDate: updateNullableDate,
  notes: updateNullableString,
});

export type CreateLegalAttachmentInput = z.infer<
  typeof createLegalAttachmentSchema
>;
export type UpdateLegalAttachmentInput = z.infer<
  typeof updateLegalAttachmentSchema
>;

// ── Shares ──────────────────────────────────────────────────────────────

export const VISIBILITY_VALUES = ["private", "public", "restricted"] as const;

export const SHARE_TYPES = ["user", "department", "group"] as const;

export const createShareSchema = z
  .object({
    type: z.enum(SHARE_TYPES),
    userId: z.string().uuid().optional(),
    department: z.string().trim().min(1).max(120).optional(),
    groupId: z.string().uuid().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.type === "user" && !val.userId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "userId is required for type=user",
      });
    }
    if (val.type === "department" && !val.department) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "department is required for type=department",
      });
    }
    if (val.type === "group" && !val.groupId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "groupId is required for type=group",
      });
    }
  });

export const updateVisibilitySchema = z.object({
  visibility: z.enum(VISIBILITY_VALUES),
});

export type CreateShareInput = z.infer<typeof createShareSchema>;
export type UpdateVisibilityInput = z.infer<typeof updateVisibilitySchema>;

export const sharedQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().max(200).optional(),
  kind: z.string().max(50).optional(),
  status: z.string().max(30).optional(),
});
export type SharedLegalQuery = z.infer<typeof sharedQuerySchema>;

// ── Phase 2 e-signature flow ────────────────────────────────────────────

// Accept a full ISO 8601 timestamp here (not just YYYY-MM-DD) — the
// signing-invite expiry is precise to the second on the server side, even
// if the UI surfaces a date picker.
// Single-signer body kept for backwards compatibility. The dialog
// converts a one-row form into this shape; multi-signer requests use
// `signers[]` instead.
const baseSignerSchema = z.object({
  signerEmail: z.string().email("Invalid email").max(320),
  signerName: z.string().trim().min(1, "Signer name is required").max(200),
  // 1-based; DocuSign treats equal orders as parallel signers.
  signingOrder: z.coerce.number().int().min(1).max(50).default(1),
});

export const sendForSignatureSchema = z
  .object({
    signerEmail: z.string().email().max(320).optional(),
    signerName: z.string().trim().min(1).max(200).optional(),
    signingOrder: z.coerce.number().int().min(1).max(50).optional(),
    signers: z.array(baseSignerSchema).max(20).optional(),
    inviteMessage: z.string().max(5000).optional(),
    expiresAt: z.string().datetime({ offset: true }).optional(),
    // 'inhouse' = Intranet's typed-name page; 'docusign' = create a DocuSign
    // envelope and let DocuSign drive the signing UX. Defaults to inhouse
    // so existing callers don't need to change.
    provider: z.enum(["inhouse", "docusign"]).default("inhouse"),
  })
  .superRefine((val, ctx) => {
    const hasSingle = !!val.signerEmail && !!val.signerName;
    const hasMulti = !!val.signers && val.signers.length > 0;
    if (!hasSingle && !hasMulti) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide either signerEmail+signerName or signers[]",
      });
    }
  });

export const submitSignatureSchema = z.object({
  // The typed full name acts as the signature glyph for v1; we record the
  // raw text alongside the audit trail so a downstream PDF render can
  // reproduce it verbatim.
  signatureText: z.string().trim().min(1, "Signature is required").max(200),
  // Explicit consent flag — the form must affirmatively check this before
  // we accept the signature.
  agreed: z.literal(true, {
    errorMap: () => ({ message: "You must agree to sign this document" }),
  }),
});

export const declineSignatureSchema = z.object({
  reason: z.string().trim().min(1, "Decline reason is required").max(2000),
});

export type SendForSignatureInput = z.infer<typeof sendForSignatureSchema>;
export type SubmitSignatureInput = z.infer<typeof submitSignatureSchema>;
export type DeclineSignatureInput = z.infer<typeof declineSignatureSchema>;
