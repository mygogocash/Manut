import { z } from "zod";

const dateTimeString = z
  .string()
  .datetime({ offset: true, message: "Must be ISO 8601 datetime" });

function preprocessOmitEmptyToNull(val: unknown): unknown {
  if (val === undefined) return undefined;
  if (val === null || val === "") return null;
  return val;
}

const updateNullableDateTime = z.preprocess(
  preprocessOmitEmptyToNull,
  z.union([dateTimeString, z.null()]).optional(),
);

const updateNullableId = z.preprocess(
  preprocessOmitEmptyToNull,
  z.union([z.string().min(1), z.null()]).optional(),
);

export const ANNOUNCEMENT_KINDS = [
  "policy",
  "authorized-persons",
  "handbook",
  "compliance",
  "other",
] as const;

export const ANNOUNCEMENT_STATUSES = [
  "draft",
  "published",
  "archived",
] as const;

// A single inline attachment uploaded with the announcement. Files live
// in the private `documents` Supabase bucket; the service mints signed
// URLs on read.
const attachmentInputSchema = z.object({
  fileUrl: z.string().min(1, "fileUrl is required").max(2000),
  fileName: z.string().min(1, "fileName is required").max(300),
});

export const createAnnouncementSchema = z.object({
  title: z.string().min(1, "Title is required").max(300),
  body: z.string().min(1, "Body is required"),
  kind: z.enum(ANNOUNCEMENT_KINDS).default("other"),
  entityId: z.string().min(1).optional(),
  status: z.enum(ANNOUNCEMENT_STATUSES).default("draft"),
  publishedAt: dateTimeString.optional(),
  expiresAt: dateTimeString.optional(),
  requiresAck: z.coerce.boolean().default(false),
  pinned: z.coerce.boolean().default(false),
  attachments: z.array(attachmentInputSchema).max(20).optional().default([]),
});

export const updateAnnouncementSchema = z.object({
  title: z.string().min(1).max(300).optional(),
  body: z.string().min(1).optional(),
  kind: z.enum(ANNOUNCEMENT_KINDS).optional(),
  entityId: updateNullableId,
  status: z.enum(ANNOUNCEMENT_STATUSES).optional(),
  publishedAt: updateNullableDateTime,
  expiresAt: updateNullableDateTime,
  requiresAck: z.coerce.boolean().optional(),
  pinned: z.coerce.boolean().optional(),
  // Full replacement of the attachment list — caller passes the
  // final set, server diffs against the current rows. NULL = leave
  // attachments alone (most edits don't touch files).
  attachments: z.array(attachmentInputSchema).max(20).optional(),
});

export const announcementQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  // 'all' (admin view) | 'mine' (filtered to my entity + global) — the
  // controller defaults to 'mine' unless the caller has manage perms.
  scope: z.enum(["all", "mine"]).default("mine"),
  status: z.enum(ANNOUNCEMENT_STATUSES).optional(),
  kind: z.enum(ANNOUNCEMENT_KINDS).optional(),
  entityId: updateNullableId,
  search: z.string().max(200).optional(),
  // When true, surface only items that the current user has not yet
  // acked (and that require an ack). Lets the dashboard banner stay
  // cheap.
  unackedOnly: z.coerce.boolean().optional(),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;
export type UpdateAnnouncementInput = z.infer<typeof updateAnnouncementSchema>;
export type AnnouncementQuery = z.infer<typeof announcementQuerySchema>;
