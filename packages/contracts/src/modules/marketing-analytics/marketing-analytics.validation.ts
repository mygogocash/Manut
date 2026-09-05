import { z } from "zod";

export const metricsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(500).default(25),
  search: z.string().trim().optional(),
  group: z.enum(["core", "transaction-type", "field"]).optional(),
});

export type MetricsQuery = z.output<typeof metricsQuerySchema>;

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD");

export const metricsQueryBodySchema = z.object({
  dateFrom: dateStr,
  dateTo: dateStr,
  metrics: z.array(z.string().trim().min(1)).min(1).max(30),
  partnerIds: z.array(z.string().trim().min(1)).max(9).optional(),
});

export type MetricsQueryBody = z.output<typeof metricsQueryBodySchema>;

// Raw Data explorer, scoped to one telco partner. `partnerId` defaults to the
// first configured partner; `days` is the rollup window.
export const rawFieldsQuerySchema = z.object({
  partnerId: z.string().trim().min(1).optional(),
  days: z.coerce.number().int().min(1).max(365).default(30),
});

export type RawFieldsQuery = z.output<typeof rawFieldsQuerySchema>;

// Canonical metrics catalog evaluated for one partner. The window defaults to
// 120 days so the catalog's 30-day windows and [t-30] lookbacks can resolve.
export const partnerMetricsQuerySchema = z.object({
  partnerId: z.string().trim().min(1).optional(),
  days: z.coerce.number().int().min(2).max(365).default(120),
});

export type PartnerMetricsQuery = z.output<typeof partnerMetricsQuerySchema>;

// DAU→MAU analytics dashboard (the OneWave workbook exhibits). All optional —
// the service defaults the range, DAU metric, as-of and forecast dates.
export const dauMauQuerySchema = z.object({
  dateFrom: dateStr.optional(),
  dateTo: dateStr.optional(),
  dauMetric: z.string().trim().min(1).max(120).optional(),
  asOf: dateStr.optional(),
  forecastDate: dateStr.optional(),
  /**
   * Which accounts count towards the totals, comma-separated partner ids.
   *
   * Absent means every account. An explicitly EMPTY list is rejected rather
   * than quietly read as "all": a total over no accounts is not a number the
   * page can show, and silently substituting everything would report figures
   * for accounts the caller had just deselected.
   */
  accounts: z
    .string()
    .trim()
    .max(2000)
    .transform((v) =>
      v
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k.length > 0),
    )
    .refine((keys) => keys.length > 0, {
      message: "accounts must name at least one account",
    })
    .optional(),
});

export type DauMauQuery = z.output<typeof dauMauQuerySchema>;

const learningSchema = z.object({
  tag: z.string().trim().min(1).max(60),
  text: z.string().trim().min(1).max(600),
});
const playSchema = z.object({
  step: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(120),
  text: z.string().trim().min(1).max(800),
});

export const overviewContentSchema = z.object({
  learningsShared: z.array(learningSchema).max(20),
  learningsPerTelco: z.record(
    z.string().trim().min(1).max(60),
    z.array(z.string().trim().min(1).max(400)).max(20),
  ),
  macroHeadline: z.string().trim().max(300),
  macroBody: z.string().trim().max(2000),
  macroPlays: z.array(playSchema).max(10),
});

export type OverviewContentInput = z.output<typeof overviewContentSchema>;

/**
 * Host-app baseline override. Every field is nullable on purpose: a null is an
 * admin asserting "no public figure exists", which is a real value distinct
 * from omitting the override entirely (see partner-host-baselines.ts).
 */
export const hostBaselineBodySchema = z.object({
  hostDau: z.number().int().nonnegative().nullable(),
  hostMau: z.number().int().nonnegative().nullable(),
  hostSessionSec: z.number().int().nonnegative().nullable(),
});
export type HostBaselineBody = z.infer<typeof hostBaselineBodySchema>;

/**
 * Recipients of the daily DAU/MAU drift alert.
 *
 * An empty array is a valid, meaningful value — it turns the alert off while
 * leaving the check itself running and reporting, which is the state every
 * environment starts in. Emails are lower-cased and de-duped on write, and
 * again on read, so a row edited by hand in SQL behaves the same as one saved
 * through the UI.
 */
export const driftRecipientsBodySchema = z.object({
  recipients: z.array(z.string().trim().email()).max(50),
});
export type DriftRecipientsBody = z.infer<typeof driftRecipientsBodySchema>;
