import { z } from "zod";

/**
 * The date becomes part of a SystemSetting primary key
 * (`marketing.recap.notes.<date>`), so it is pinned to an exact calendar-day
 * shape rather than accepted as free text — an unconstrained value could
 * address another module's row.
 */
export const recapDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD");

export const recapTargetsSchema = z.array(
  z.object({
    partnerId: z.string().min(1).max(64),
    targetDau: z.number().nonnegative().nullable().optional(),
    addressableMau: z.number().nonnegative().nullable().optional(),
    excluded: z.boolean().optional(),
  }),
);

export const recapNotesSchema = z.object({
  yesterday: z.array(z.string().max(2000)).max(50).optional(),
  today: z.array(z.string().max(2000)).max(50).optional(),
});
