import { HttpError } from "../http-error";
import {
  canAccessChannel,
  hasMessagePermission,
  type MessageAccessUser,
  MESSAGES_ADMIN,
  MESSAGES_CREATE,
  MESSAGES_DELETE,
  MESSAGES_READ,
} from "./access";
import type {
  MessagesChannelRecord,
  MessagesMessageRecord,
  MessagesStore,
} from "./store";

function accessUser(userId: string, permissions: Set<string>): MessageAccessUser {
  return { id: userId, permissions: [...permissions] };
}

function serializeChannel(
  raw: MessagesChannelRecord,
  unreadCount?: number,
): Record<string, unknown> {
  const type = raw.type === "direct" ? "dm" : "channel";
  const members = raw.members.map((member) => member.userId);
  return {
    id: raw.id,
    name: raw.title ?? "",
    description: null,
    isPrivate: raw.type === "private" || raw.type === "direct",
    type,
    members,
    createdBy: raw.createdBy,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    creator: raw.creator,
    _count: raw._count ?? { messages: 0 },
    ...(unreadCount !== undefined ? { unreadCount } : {}),
  };
}

function serializeMessage(raw: MessagesMessageRecord): Record<string, unknown> {
  const isDeleted = raw.deletedForEveryoneAt != null;
  return {
    id: raw.id,
    channelId: raw.conversationId,
    authorId: raw.authorId,
    content: isDeleted ? "" : (raw.content ?? ""),
    isDeleted,
    deletedAt: raw.deletedForEveryoneAt ?? null,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    author: raw.author ?? null,
    attachments: [],
    readBy: [],
  };
}

function assertPermission(user: MessageAccessUser, permission: string): void {
  if (!hasMessagePermission(user, permission)) {
    throw new HttpError(403, "FORBIDDEN", "Missing required permission.");
  }
}

function assertChannelAccess(
  user: MessageAccessUser,
  channel: MessagesChannelRecord,
): void {
  if (
    !canAccessChannel(user, {
      id: channel.id,
      type: channel.type,
      members: channel.members,
    })
  ) {
    throw new HttpError(
      403,
      "CHANNEL_ACCESS_DENIED",
      "You do not have access to this channel.",
    );
  }
}

export function createMessagesService(store: MessagesStore) {
  return {
    async listChannels(userId: string) {
      const permissions = await store.loadPermissions(userId);
      const user = accessUser(userId, permissions);
      assertPermission(user, MESSAGES_READ);

      const channels = await store.listChannelsForUser(userId, {
        includePrivateChannels: hasMessagePermission(user, MESSAGES_ADMIN),
      });
      if (channels.length === 0) {
        return { data: [] };
      }
      const counts = await store.countUnreadByChannel(
        userId,
        channels.map((channel) => channel.id),
      );
      return {
        data: channels.map((channel) =>
          serializeChannel(channel, counts[channel.id] ?? 0),
        ),
      };
    },

    async getChannel(channelId: string, userId: string) {
      const permissions = await store.loadPermissions(userId);
      const user = accessUser(userId, permissions);
      assertPermission(user, MESSAGES_READ);

      const channel = await store.findChannelById(channelId);
      if (!channel) {
        throw new HttpError(404, "CHANNEL_NOT_FOUND", "Channel not found.");
      }
      assertChannelAccess(user, channel);
      return { data: serializeChannel(channel) };
    },

    async listMessages(
      channelId: string,
      userId: string,
      page: number,
      limit: number,
    ) {
      const permissions = await store.loadPermissions(userId);
      const user = accessUser(userId, permissions);
      assertPermission(user, MESSAGES_READ);

      const channel = await store.findChannelById(channelId);
      if (!channel) {
        throw new HttpError(404, "CHANNEL_NOT_FOUND", "Channel not found.");
      }
      assertChannelAccess(user, channel);

      const result = await store.findMessages(channelId, page, limit);
      return {
        data: result.data.map(serializeMessage),
        meta: {
          page,
          limit,
          total: result.total,
          totalPages: Math.max(1, Math.ceil(result.total / limit)),
        },
      };
    },

    async sendMessage(channelId: string, userId: string, content: string) {
      const permissions = await store.loadPermissions(userId);
      const user = accessUser(userId, permissions);
      assertPermission(user, MESSAGES_CREATE);

      const channel = await store.findChannelById(channelId);
      if (!channel) {
        throw new HttpError(404, "CHANNEL_NOT_FOUND", "Channel not found.");
      }
      assertChannelAccess(user, channel);

      const trimmed = content.trim();
      if (!trimmed) {
        throw new HttpError(400, "INVALID_MESSAGE", "Message content is required.");
      }

      const message = await store.createMessage({
        authorId: userId,
        channelId,
        content: trimmed,
      });
      return { data: serializeMessage(message) };
    },

    async deleteMessage(
      channelId: string,
      messageId: string,
      userId: string,
    ) {
      const permissions = await store.loadPermissions(userId);
      const user = accessUser(userId, permissions);
      assertPermission(user, MESSAGES_DELETE);

      const channel = await store.findChannelById(channelId);
      if (!channel) {
        throw new HttpError(404, "CHANNEL_NOT_FOUND", "Channel not found.");
      }
      assertChannelAccess(user, channel);

      const existing = await store.findMessageById(messageId);
      if (!existing || existing.conversationId !== channelId) {
        throw new HttpError(404, "MESSAGE_NOT_FOUND", "Message not found.");
      }

      const deleted = await store.softDeleteMessage(messageId, userId);
      if (!deleted) {
        throw new HttpError(404, "MESSAGE_NOT_FOUND", "Message not found.");
      }
      return { data: serializeMessage(deleted) };
    },
  };
}

export type MessagesService = ReturnType<typeof createMessagesService>;
