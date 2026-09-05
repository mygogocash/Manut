import { z } from "zod";

export const createVisaArticleSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  // TipTap HTML body. Sanitized on render; capped to keep payloads sane.
  body: z.string().min(1, "Body is required").max(100_000),
  // Null/empty = applies to all countries / visa types.
  country: z.string().max(100).optional().or(z.literal("")),
  visaType: z.string().max(100).optional().or(z.literal("")),
  tags: z.array(z.string().min(1).max(40)).max(20).default([]),
  isActive: z.boolean().default(true),
  entityId: z.string().optional().or(z.literal("")),
});

export const updateVisaArticleSchema = createVisaArticleSchema.partial();

export const visaArticleQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  country: z.string().optional(),
  visaType: z.string().optional(),
  includeInactive: z.coerce.boolean().default(false),
});

export const visaArticleForRecordSchema = z.object({
  country: z.string().optional(),
  visaType: z.string().optional(),
});

export type CreateVisaArticleInput = z.infer<typeof createVisaArticleSchema>;
export type UpdateVisaArticleInput = z.infer<typeof updateVisaArticleSchema>;
export type VisaArticleQuery = z.infer<typeof visaArticleQuerySchema>;
export type VisaArticleForRecordQuery = z.infer<
  typeof visaArticleForRecordSchema
>;
