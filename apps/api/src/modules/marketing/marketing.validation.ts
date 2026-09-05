import { z } from "zod";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD format");

const campaignBodySchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  campaignDate: dateString,
  // Campaign duration in hours (fractional allowed).
  hours: z.coerce.number().nonnegative().max(100000).nullish(),
  leversPulled: z.string().max(20000).nullish(),
  // Rich-text HTML (copy + inline image URLs — not base64, see
  // RichTextEditor). Generous cap for embedded image markup.
  copyDesign: z.string().max(200000).nullish(),
  // Prediction xlsx already uploaded to storage; we persist its URL.
  predictionFileUrl: z.string().url().nullish().or(z.literal("")),
  predictionFileName: z.string().max(300).nullish(),
  status: z.string().max(20).optional(),
});

export const createMarketingCampaignSchema = campaignBodySchema;
export const updateMarketingCampaignSchema = campaignBodySchema.partial();

export const marketingCampaignQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50),
  search: z.string().optional(),
  status: z.string().optional(),
});

export type CreateMarketingCampaignInput = z.infer<
  typeof createMarketingCampaignSchema
>;
export type UpdateMarketingCampaignInput = z.infer<
  typeof updateMarketingCampaignSchema
>;
export type MarketingCampaignQuery = z.infer<
  typeof marketingCampaignQuerySchema
>;
