import { z } from "zod";

import { LEGAL_KINDS, LEGAL_STATUSES } from "@/services/legal.service";

export const legalFormSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(200, "Title is too long"),
    kind: z.enum(LEGAL_KINDS),
    reference: z.string().max(100).optional().or(z.literal("")),
    // Free-text counterparties — one per line. Server splits + trims.
    parties: z.string().max(2000).optional().or(z.literal("")),
    ownerId: z.string().optional().or(z.literal("")),
    entityId: z.string().optional().or(z.literal("")),
    effectiveDate: z.string().optional().or(z.literal("")),
    expiryDate: z.string().optional().or(z.literal("")),
    renewalLeadDays: z.coerce
      .number<number | string>()
      .int("Must be a whole number")
      .min(0, "Must be 0 or greater"),
    status: z.enum(LEGAL_STATUSES),
    fileUrl: z.string().optional().or(z.literal("")),
    fileName: z.string().optional().or(z.literal("")),
    folder: z.string().max(120).optional().or(z.literal("")),
    // Empty string = no category (excluded from alert digests).
    alertCategory: z.string().optional().or(z.literal("")),
    notes: z.string().max(5000).optional().or(z.literal("")),
  })
  .refine(
    (data) => {
      const a = data.effectiveDate?.trim();
      const b = data.expiryDate?.trim();
      if (!a || !b) return true;
      return b >= a;
    },
    {
      message: "Expiry date must not be before effective date",
      path: ["expiryDate"],
    },
  );

export type LegalFormInput = z.input<typeof legalFormSchema>;
export type LegalFormValues = z.output<typeof legalFormSchema>;

export const LEGAL_FORM_DEFAULTS: LegalFormValues = {
  title: "",
  kind: "agreement",
  reference: "",
  parties: "",
  ownerId: "",
  entityId: "",
  effectiveDate: "",
  expiryDate: "",
  renewalLeadDays: 30,
  status: "active",
  fileUrl: "",
  fileName: "",
  folder: "",
  alertCategory: "",
  notes: "",
};
