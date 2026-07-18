import { z } from "zod";

import type { ApiClient } from "../api/api-client";
import type { RequestAbortSignal } from "../api/api-types";

const messageChannelApiSchema = z
  .object({
    id: z.string().min(1),
    name: z.string(),
    description: z.string().nullable().optional(),
    isPrivate: z.boolean(),
    type: z.enum(["channel", "dm"]),
    unreadCount: z.number().int().nonnegative().optional(),
    _count: z
      .object({
        messages: z.number().int().nonnegative(),
      })
      .partial()
      .optional(),
    updatedAt: z.string().min(1).optional(),
  })
  .passthrough();

export const messageChannelSchema = messageChannelApiSchema.transform(
  (channel) => ({
    id: channel.id,
    name: channel.name,
    description: channel.description ?? null,
    isPrivate: channel.isPrivate,
    type: channel.type,
    unreadCount: channel.unreadCount ?? 0,
    messageCount: channel._count?.messages ?? 0,
    updatedAt: channel.updatedAt ?? null,
  }),
);

const messageChannelsResponseSchema = z
  .object({
    data: z.array(messageChannelSchema),
  })
  .strict();

export type MessageChannel = z.infer<typeof messageChannelSchema>;
export type MessageChannelList = z.infer<typeof messageChannelsResponseSchema>;

export const MESSAGE_CHANNELS_QUERY_KEY = ["messages", "channels"] as const;

export function messageChannelsQueryKey() {
  return MESSAGE_CHANNELS_QUERY_KEY;
}

export async function listMessageChannels(
  client: ApiClient,
  signal?: RequestAbortSignal,
): Promise<MessageChannelList> {
  const response = await client.get<unknown>(
    "/messages/channels",
    signal ? { signal } : undefined,
  );
  return messageChannelsResponseSchema.parse(response);
}
