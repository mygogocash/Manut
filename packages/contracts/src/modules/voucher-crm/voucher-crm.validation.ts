import { z } from "zod";

export const voucherEntrySchema = z.object({
  partner: z.string().min(1, "Partner is required").max(200),
  country: z.string().max(120).nullable().optional(),
  redeemed: z.coerce.number().int().min(0).default(0),
  issued: z.coerce.number().int().min(0).default(0),
  refund: z.coerce.number().int().min(0).default(0),
});

export const createVoucherEntrySchema = voucherEntrySchema;
export const updateVoucherEntrySchema = voucherEntrySchema.partial();

export const voucherQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(1000).default(20),
  search: z.string().optional(),
  country: z.string().optional(),
  // When "true", return ONLY archived rows; anything else (incl. absent) shows
  // active only. Explicit string compare — z.coerce.boolean() would turn
  // "false" into true.
  archived: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

export const reorderVoucherEntriesSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1).max(500),
});

// Bulk import — create-new-only. Each row reuses the single-create
// schema. Capped at 1000 rows so one upload can't blow the request
// body / transaction.
export const importVoucherEntriesSchema = z.object({
  rows: z.array(createVoucherEntrySchema).min(1).max(1000),
});

export type CreateVoucherEntryInput = z.infer<typeof createVoucherEntrySchema>;
export type UpdateVoucherEntryInput = z.infer<typeof updateVoucherEntrySchema>;
export type VoucherQuery = z.infer<typeof voucherQuerySchema>;
export type ReorderVoucherEntriesInput = z.infer<
  typeof reorderVoucherEntriesSchema
>;
export type ImportVoucherEntriesInput = z.infer<
  typeof importVoucherEntriesSchema
>;
