import { z } from "zod";

// Shared chip-attachment shape — matches HelpdeskTicket.attachments.
// Stored as a JSON column so we don't need a per-module join table for
// the v1 home-page composer surfaces.
const attachmentSchema = z.object({
  name: z.string().min(1).max(300),
  url: z.string().url(),
  mimeType: z.string().max(200).optional(),
  size: z.number().int().nonnegative().optional(),
});

export const createPostSchema = z.object({
  content: z.string().min(1, "Content is required").max(5000),
  type: z.string().default("post"),
  attachments: z.array(attachmentSchema).max(10).optional(),
});

export type WallAttachment = z.infer<typeof attachmentSchema>;

export const reactSchema = z.object({
  reaction: z.enum(["like", "love", "celebrate"]),
});

export const addCommentSchema = z.object({
  content: z.string().min(1, "Comment is required").max(2000),
});

export const updatePostSchema = z.object({
  content: z.string().min(1, "Content is required").max(5000),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type ReactInput = z.infer<typeof reactSchema>;
export type AddCommentInput = z.infer<typeof addCommentSchema>;
