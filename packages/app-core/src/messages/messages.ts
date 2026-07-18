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

const channelMessageApiSchema = z
  .object({
    id: z.string().min(1),
    channelId: z.string().min(1).optional(),
    content: z.string().nullable().optional(),
    isDeleted: z.boolean().optional(),
    createdAt: z.string().min(1),
    author: z
      .object({
        id: z.string().min(1),
        name: z.string().nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();

export const channelMessageSchema = channelMessageApiSchema.transform(
  (message) => ({
    id: message.id,
    channelId: message.channelId ?? null,
    content: message.isDeleted ? "" : (message.content ?? ""),
    isDeleted: message.isDeleted ?? false,
    createdAt: message.createdAt,
    authorName: message.author?.name?.trim() || "Unknown",
    authorId: message.author?.id ?? null,
  }),
);

const channelMessagesResponseSchema = z
  .object({
    data: z.array(channelMessageSchema),
    meta: z
      .object({
        page: z.number().int().positive(),
        limit: z.number().int().positive(),
        total: z.number().int().nonnegative(),
        totalPages: z.number().int().nonnegative(),
      })
      .partial()
      .optional(),
  })
  .passthrough()
  .transform((value) => ({
    data: value.data,
    meta: {
      page: value.meta?.page ?? 1,
      limit: value.meta?.limit ?? value.data.length,
      total: value.meta?.total ?? value.data.length,
      totalPages: value.meta?.totalPages ?? 1,
    },
  }));

export type ChannelMessage = z.infer<typeof channelMessageSchema>;
export type ChannelMessageList = z.infer<typeof channelMessagesResponseSchema>;

export const CHANNEL_MESSAGES_QUERY_ROOT = [
  "messages",
  "channel-messages",
] as const;

export function channelMessagesQueryKey(
  channelId: string,
  params: { page?: number; limit?: number } = {},
) {
  return [
    ...CHANNEL_MESSAGES_QUERY_ROOT,
    channelId,
    { page: params.page ?? 1, limit: params.limit ?? 50 },
  ] as const;
}

export async function listChannelMessages(
  client: ApiClient,
  channelId: string,
  params: { page?: number; limit?: number } = {},
  signal?: RequestAbortSignal,
): Promise<ChannelMessageList> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 50;
  const query = `page=${encodeURIComponent(String(page))}&limit=${encodeURIComponent(String(limit))}`;
  const response = await client.get<unknown>(
    `/messages/channels/${encodeURIComponent(channelId)}/messages?${query}`,
    signal ? { signal } : undefined,
  );
  return channelMessagesResponseSchema.parse(response);
}
