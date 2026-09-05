import { z } from "zod";

/**
 * A table id becomes part of a `SystemSetting` primary key
 * (`table-layout.<tableId>`), so it is constrained rather than free text: a
 * dotted or traversing id could address another module's row —
 * `payslip.company` being the obvious one — turning "save my column widths"
 * into "overwrite the payslip footer".
 *
 * 64 chars keeps the composed key inside the column's VarChar(100).
 */
export const tableIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9-]+$/, "tableId must be kebab-case");

export const tableLayoutSchema = z.object({
  order: z.array(z.string().max(64)).max(100).optional(),
  hidden: z.array(z.string().max(64)).max(100).optional(),
  widths: z.record(z.string().max(64), z.number()).optional(),
  // Row keys can be dates, account keys or composite campaign keys, so the
  // cap is generous; the count is what actually needs bounding.
  rowOrder: z.array(z.string().max(120)).max(2000).optional(),
});

export type TableLayoutInput = z.infer<typeof tableLayoutSchema>;
