import { z } from "zod";

// Google's continuation tokens are opaque base64-encoded blobs that
// can run ~1.5–2 KB once a search query is involved. The previous
// `max(500)` cap rejected legitimate tokens with a generic
// "Validation failed" toast on the "Load more" button. 4096 leaves
// headroom without inviting unbounded payloads.
const PAGE_TOKEN_MAX = 4096;

export const GMAIL_FOLDER_VALUES = [
  "inbox",
  "sent",
  "drafts",
  "starred",
  "important",
  "snoozed",
  "spam",
  "trash",
] as const;

export const gmailListSchema = z.object({
  folder: z.enum(GMAIL_FOLDER_VALUES).default("inbox").optional(),
  // Optional Gmail label ID for listing arbitrary user labels (`Label_*`).
  // When set, the FE supplies the id verbatim and the BE skips the
  // `folder → label` mapping. Capped to a sensible length to keep the
  // querystring small and reject obvious junk.
  labelId: z.string().min(1).max(128).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  pageToken: z.string().min(1).max(PAGE_TOKEN_MAX).optional(),
});

export const gmailReadSchema = z.object({
  messageId: z.string().min(1, "messageId is required"),
});

// `addLabelIds` / `removeLabelIds` accept Gmail's label IDs (system or
// user). The Gmail API allows up to 100 labels per modify request;
// keeping the cap at 20 covers any realistic UI flow (star toggle,
// mark unread, bulk-label).
export const gmailModifySchema = z.object({
  messageId: z.string().min(1, "messageId is required"),
  addLabelIds: z.array(z.string().min(1).max(128)).max(20).optional(),
  removeLabelIds: z.array(z.string().min(1).max(128)).max(20).optional(),
});

export const gmailTrashSchema = z.object({
  messageId: z.string().min(1, "messageId is required"),
});

const gmailAttachmentSchema = z.object({
  filename: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(127),
  contentBase64: z.string().min(1).max(20_000_000),
});

export const gmailSendSchema = z.object({
  to: z.string().min(1).max(2000),
  cc: z.string().max(2000).optional(),
  subject: z.string().min(1).max(998),
  body: z.string().max(500_000).optional(),
  bodyHtml: z.string().max(500_000).optional(),
  inReplyTo: z.string().max(998).optional(),
  references: z.string().max(4000).optional(),
  threadId: z.string().max(128).optional(),
  attachments: z.array(gmailAttachmentSchema).max(10).optional(),
});

export const driveListSchema = z.object({
  query: z.string().max(500).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  pageToken: z.string().min(1).max(PAGE_TOKEN_MAX).optional(),
});

export const oauthStartSchema = z.object({
  redirect: z.string().min(1).max(2048).optional(),
});

export const oauthCallbackSchema = z.object({
  code: z.string().default(""),
  state: z.string().min(1, "state is required"),
  error: z.string().optional(),
});

export type GmailListInput = z.infer<typeof gmailListSchema>;
export type GmailReadInput = z.infer<typeof gmailReadSchema>;
export type GmailSendInput = z.infer<typeof gmailSendSchema>;
export type GmailModifyInput = z.infer<typeof gmailModifySchema>;
export type GmailTrashInput = z.infer<typeof gmailTrashSchema>;
export type DriveListInput = z.infer<typeof driveListSchema>;
export type OauthStartInput = z.infer<typeof oauthStartSchema>;
export type OauthCallbackInput = z.infer<typeof oauthCallbackSchema>;
