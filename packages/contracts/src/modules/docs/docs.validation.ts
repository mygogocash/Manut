import { z } from "zod";

// Marketing feedback round #2 — wiki / sticky repository.

const slugRegex = /^[a-z0-9][a-z0-9-]*$/;
const uuidSchema = z.string().uuid();

export const wikiPageAttachmentSchema = z.object({
  url: z.string().url(),
  name: z.string().min(1).max(300),
  mimeType: z.string().max(150),
  size: z.coerce.number().int().nonnegative(),
});

export const createWikiPageSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  // RichTextEditor produces HTML; allow up to ~256 KB which is plenty
  // for any realistic page (Confluence's per-page limit is ~5 MB but
  // we'd rather force splits than store walls of text in one row).
  body: z.string().min(1, "Body is required").max(262_144),
  parentId: uuidSchema.optional().nullable(),
  position: z.coerce.number().int().min(0).max(10_000).optional(),
  folder: z.string().max(100).optional().or(z.literal("")),
  slug: z
    .string()
    .max(150)
    .regex(slugRegex, "Slug must be lowercase, digits, hyphens")
    .optional()
    .or(z.literal("")),
  isPublished: z.boolean().default(true),
  isRestricted: z.boolean().default(false),
  // Files uploaded with the page (docs / sheets / PDFs / images /
  // video). Each entry mirrors what `/api/uploads/multipart`
  // returns: { url, name, mimeType, size }. Cap at 20 to keep the
  // FE list scrollable.
  attachments: z.array(wikiPageAttachmentSchema).max(20).default([]),
});

export const updateWikiPageSchema = createWikiPageSchema.partial();

export const listWikiPagesSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(50),
  folder: z.string().optional(),
  search: z.string().optional(),
  // Admins / authors flip this on to see archived rows.
  includeUnpublished: z
    .union([z.literal("true"), z.literal("false"), z.boolean()])
    .optional()
    .transform((v) => v === true || v === "true"),
});

export const moveWikiPageSchema = z.object({
  parentId: uuidSchema.optional().nullable(),
  position: z.coerce.number().int().min(0).max(10_000),
});

export const wikiPagePermissionSchema = z.object({
  userId: uuidSchema,
  level: z.enum(["read", "edit"]),
});

export const extractWikiAttachmentSchema = z.object({
  url: z.string().url(),
  mimeType: z.string().min(1).max(150),
});

export type CreateWikiPageInput = z.infer<typeof createWikiPageSchema>;
export type UpdateWikiPageInput = z.infer<typeof updateWikiPageSchema>;
export type WikiPageAttachmentInput = z.infer<typeof wikiPageAttachmentSchema>;
export type ExtractWikiAttachmentInput = z.infer<
  typeof extractWikiAttachmentSchema
>;
export type ListWikiPagesQuery = z.infer<typeof listWikiPagesSchema>;
export type MoveWikiPageInput = z.infer<typeof moveWikiPageSchema>;
export type WikiPagePermissionInput = z.infer<typeof wikiPagePermissionSchema>;
