import { z } from "zod";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format");

// HR-driven workflow per Tanny May-2026: TM.47 report is approved
// by Immigration on submission, or marked "no required" when an
// applicant left the country before the 90-day mark.
// `to_be_notifying` was added in May-2026 as a manual HR marker for
// rows queued for outreach (does not trigger the cron reminder; HR
// flips it back to `pending` when the normal cycle should resume).
export const NINETY_DAY_STATUSES = [
  "pending",
  "to_be_notifying",
  "approved",
  "no_required",
] as const;

export const NINETY_DAY_HOLDER_TYPES = ["employee", "dependent"] as const;

/** Uploaded TM.47 / submission receipt (Supabase `documents` bucket). */
export const ninetyDayReceiptSchema = z
  .object({
    name: z.string().min(1).max(255),
    url: z.string().url(),
    mimeType: z.string().max(100).optional(),
  })
  .nullable();

export const createNinetyDaySchema = z
  .object({
    employeeId: z.string().uuid("Invalid employee ID"),
    entityId: z.string().optional(),
    holderType: z.enum(NINETY_DAY_HOLDER_TYPES).default("employee"),
    holderName: z.string().trim().max(200).optional(),
    holderRelationship: z.string().trim().max(200).optional(),
    lastArrivalDate: dateString,
    status: z.enum(NINETY_DAY_STATUSES).default("pending"),
    notes: z.string().max(2000).optional(),
    receipt: ninetyDayReceiptSchema.optional(),
  })
  .superRefine((val, ctx) => {
    if (val.holderType === "dependent" && !val.holderName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["holderName"],
        message: "Holder name is required for non-employee applicants",
      });
    }
  });

export const updateNinetyDaySchema = z
  .object({
    entityId: z.string().nullable().optional(),
    holderType: z.enum(NINETY_DAY_HOLDER_TYPES).optional(),
    holderName: z.string().trim().max(200).nullable().optional(),
    holderRelationship: z.string().trim().max(200).nullable().optional(),
    lastArrivalDate: dateString.optional(),
    status: z.enum(NINETY_DAY_STATUSES).optional(),
    notes: z.string().max(2000).optional(),
    receipt: ninetyDayReceiptSchema.optional(),
  })
  .strict();

export const ninetyDayQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  employeeId: z.string().uuid().optional(),
  status: z.enum(NINETY_DAY_STATUSES).optional(),
  search: z.string().optional(),
  entityId: z.string().optional(),
});

export type CreateNinetyDayInput = z.infer<typeof createNinetyDaySchema>;
export type UpdateNinetyDayInput = z.infer<typeof updateNinetyDaySchema>;
export type NinetyDayQuery = z.infer<typeof ninetyDayQuerySchema>;
