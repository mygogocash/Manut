import { z } from "zod";

export const createChannelSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
  isPrivate: z.boolean().default(false),
  members: z.array(z.string()).optional(),
});

export const updateChannelSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).optional(),
  description: z.string().max(500).nullable().optional(),
});

export const sendMessageSchema = z
  .object({
    content: z.string().max(10000).default(""),
    attachmentIds: z
      .array(z.string().uuid("each attachmentId must be a valid uuid"))
      .max(20, "Maximum 20 attachments per message")
      .optional(),
  })
  .refine(
    (val) =>
      (val.content && val.content.trim().length > 0) ||
      (val.attachmentIds && val.attachmentIds.length > 0),
    { message: "Either content or at least one attachment is required" },
  );

export const createDmSchema = z.object({
  userIds: z
    .array(z.string().uuid("each userId must be a valid uuid"))
    .min(1, "At least one userId is required")
    .max(20, "Maximum 20 members per DM"),
});

export type CreateChannelInput = z.infer<typeof createChannelSchema>;
export type UpdateChannelInput = z.infer<typeof updateChannelSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type CreateDmInput = z.infer<typeof createDmSchema>;
