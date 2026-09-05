import { z } from "zod";

export const CAMPAIGN_STATUSES = [
  "planned",
  "scheduled",
  "live",
  "completed",
  "cancelled",
] as const;

export const CREATIVE_KINDS = ["image", "video", "pdf", "link"] as const;
export const CREATIVE_SOURCES = [
  "upload",
  "drive",
  "canva",
  "figma",
  "other",
] as const;
export const PREDICTION_FORMATS = ["xlsx", "csv"] as const;

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD");
const optionalDate = dateStr.nullable().optional();
const optionalInt = z.coerce.number().int().nonnegative().nullable().optional();

export const createCampaignSchema = z.object({
  name: z.string().trim().min(1).max(300),
  campaignDate: dateStr,
  hours: z.coerce.number().nonnegative().max(100000).nullable().optional(),
  ownerId: z.string().uuid().nullable().optional(),
  status: z.enum(CAMPAIGN_STATUSES).default("planned"),
  country: z.string().trim().max(100).nullable().optional(),
  // Optional BNII telco-partner UUID for DAU/MAU attribution.
  partnerId: z.string().uuid().nullable().optional(),
  product: z.string().trim().max(150).nullable().optional(),
  channel: z.string().trim().max(100).nullable().optional(),
  campaignType: z.string().trim().max(100).nullable().optional(),
  objective: z.string().trim().max(2000).nullable().optional(),
  targetAudience: z.string().trim().max(2000).nullable().optional(),
  leversSequence: z.string().trim().max(4000).nullable().optional(),
  copyText: z.string().trim().max(8000).nullable().optional(),
  expectedReach: optionalInt,
  actualReach: optionalInt,
  budget: z.coerce.number().nonnegative().nullable().optional(),
  currency: z.string().trim().min(1).max(10).default("USD"),
  notes: z.string().trim().max(4000).nullable().optional(),
  // Multi-select lever ids applied on create.
  leverIds: z.array(z.string()).optional(),
});

export const updateCampaignSchema = createCampaignSchema.partial();

export const campaignQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(20),
  search: z.string().trim().optional(),
  status: z.enum(CAMPAIGN_STATUSES).optional(),
  ownerId: z.string().uuid().optional(),
  // Calendar range (inclusive) — used by the daily/weekly/monthly views.
  from: optionalDate,
  to: optionalDate,
  // When "true", return ONLY archived campaigns; anything else (incl. absent)
  // shows active only. Explicit string compare — z.coerce.boolean() would turn
  // "false" into true. Archive is orthogonal to `status`.
  archived: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

export const setLeversSchema = z.object({
  leverIds: z.array(z.string()),
});

// ── Levers config (admin-configurable) ──
export const createLeverSchema = z.object({
  name: z.string().trim().min(1).max(100),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});
export const updateLeverSchema = createLeverSchema.partial();

// Reject non-http(s) URLs (e.g. `javascript:` / `data:`) so a stored creative
// or prediction link can never become an executable href in the client.
const httpUrl = z
  .string()
  .trim()
  .url()
  .max(2000)
  .refine((u) => {
    try {
      const p = new URL(u);
      return p.protocol === "http:" || p.protocol === "https:";
    } catch {
      return false;
    }
  }, "URL must use http or https");

// ── Creatives ──
export const createCreativeSchema = z.object({
  kind: z.enum(CREATIVE_KINDS),
  source: z.enum(CREATIVE_SOURCES).default("upload"),
  name: z.string().trim().min(1).max(300),
  url: httpUrl,
  mimeType: z.string().trim().max(150).nullable().optional(),
  size: z.coerce.number().int().nonnegative().nullable().optional(),
});

// ── Predictions ──
export const createPredictionSchema = z.object({
  format: z.enum(PREDICTION_FORMATS),
  name: z.string().trim().min(1).max(300),
  url: httpUrl,
  mimeType: z.string().trim().max(150).nullable().optional(),
  size: z.coerce.number().int().nonnegative().nullable().optional(),
});

export type CreateCampaignInput = z.output<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.output<typeof updateCampaignSchema>;
export type CampaignQuery = z.output<typeof campaignQuerySchema>;
export type SetLeversInput = z.output<typeof setLeversSchema>;
export type CreateLeverInput = z.output<typeof createLeverSchema>;
export type UpdateLeverInput = z.output<typeof updateLeverSchema>;
export type CreateCreativeInput = z.output<typeof createCreativeSchema>;
export type CreatePredictionInput = z.output<typeof createPredictionSchema>;
