import { z } from "zod";

// Workspace-admin CRUD over the
// finance.exchange_rates table. Codes are 3-letter ISO 4217 strings,
// uppercased on the way in. Rate is a positive decimal stored at
// (18, 8) precision in Postgres.

const isoCode = z
  .string()
  .length(3, "Use a 3-letter ISO currency code")
  .regex(/^[A-Za-z]{3}$/, "Letters only")
  .transform((v) => v.toUpperCase());

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format");

export const createExchangeRateSchema = z
  .object({
    baseCurrency: isoCode,
    currency: isoCode,
    rate: z.coerce.number().positive("Rate must be greater than zero"),
    effectiveDate: dateString,
    source: z.string().max(50).optional(),
  })
  .refine((d) => d.baseCurrency !== d.currency, {
    message: "Base currency cannot equal target currency",
    path: ["currency"],
  });

export const updateExchangeRateSchema = z
  .object({
    rate: z.coerce.number().positive().optional(),
    source: z.string().max(50).optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), {
    message: "At least one field is required",
  });

export const listExchangeRatesSchema = z.object({
  baseCurrency: isoCode.optional(),
  currency: isoCode.optional(),
  // When `latestOnly=true`, the service returns one row per (base,
  // currency) pair — the freshest by effectiveDate. Default false so
  // admins see the full history they can manage.
  latestOnly: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "true"),
});

export type CreateExchangeRateInput = z.infer<typeof createExchangeRateSchema>;
export type UpdateExchangeRateInput = z.infer<typeof updateExchangeRateSchema>;
export type ListExchangeRatesQuery = z.infer<typeof listExchangeRatesSchema>;
