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
import { directChannelName } from "./store";

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
    attachments: isDeleted ? [] : (raw.attachments ?? []),
    readBy: [],
  };
}

const ATTACHMENT_ID_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

function normalizeAttachmentIds(attachmentIds: string[]): string[] {
  if (attachmentIds.length > 20) {
    throw new HttpError(
      400,
      "INVALID_MESSAGE",
      "Maximum 20 attachments per message",
    );
  }
  for (const id of attachmentIds) {
    if (!ATTACHMENT_ID_UUID.test(id)) {
      throw new HttpError(
        400,
        "INVALID_MESSAGE",
        "each attachmentId must be a valid uuid",
      );
    }
  }
  return attachmentIds;
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

function asIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : value;
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

    async getUnreadSummary(userId: string) {
      const permissions = await store.loadPermissions(userId);
      const user = accessUser(userId, permissions);
      assertPermission(user, MESSAGES_READ);

      const channels = await store.listChannelsForUser(userId, {
        includePrivateChannels: hasMessagePermission(user, MESSAGES_ADMIN),
      });
      if (channels.length === 0) {
        return { data: { total: 0 } };
      }
      const counts = await store.countUnreadByChannel(
        userId,
        channels.map((channel) => channel.id),
      );
      const total = Object.values(counts).reduce((sum, count) => sum + count, 0);
      return { data: { total } };
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
      const attachments = await store.findAttachmentsForMessages(
        result.data.map((message) => message.id),
      );
      return {
        data: result.data.map((message) =>
          serializeMessage({
            ...message,
            attachments: attachments.filter(
              (attachment) => attachment.linkedId === message.id,
            ),
          }),
        ),
        meta: {
          page,
          limit,
          total: result.total,
          totalPages: Math.max(1, Math.ceil(result.total / limit)),
        },
      };
    },

    async sendMessage(
      channelId: string,
      userId: string,
      content: string,
      attachmentIds: string[] = [],
    ) {
      const permissions = await store.loadPermissions(userId);
      const user = accessUser(userId, permissions);
      assertPermission(user, MESSAGES_CREATE);

      const channel = await store.findChannelById(channelId);
      if (!channel) {
        throw new HttpError(404, "CHANNEL_NOT_FOUND", "Channel not found.");
      }
      assertChannelAccess(user, channel);

      const trimmed = content.trim();
      const normalizedIds = normalizeAttachmentIds(attachmentIds);
      if (!trimmed && normalizedIds.length === 0) {
        throw new HttpError(
          400,
          "INVALID_MESSAGE",
          "Either content or at least one attachment is required",
        );
      }

      const message = await store.createMessage({
        authorId: userId,
        channelId,
        content: trimmed,
      });
      const attachments =
        normalizedIds.length > 0
          ? await store.linkAttachmentsToMessage(
              normalizedIds,
              message.id,
              userId,
            )
          : [];
      return { data: serializeMessage({ ...message, attachments }) };
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
      if (existing.deletedForEveryoneAt != null) {
        throw new HttpError(
          400,
          "MESSAGE_ALREADY_DELETED",
          "Message is already deleted.",
        );
      }

      const isAuthor = existing.authorId === userId;
      const isAdmin = hasMessagePermission(user, MESSAGES_ADMIN);
      if (!isAuthor && !isAdmin) {
        throw new HttpError(
          403,
          "FORBIDDEN",
          "You can only delete your own messages.",
        );
      }

      const deleted = await store.softDeleteMessage(messageId, userId);
      if (!deleted) {
        throw new HttpError(404, "MESSAGE_NOT_FOUND", "Message not found.");
      }
      return { data: serializeMessage(deleted) };
    },

    async markChannelRead(channelId: string, userId: string) {
      const permissions = await store.loadPermissions(userId);
      const user = accessUser(userId, permissions);
      assertPermission(user, MESSAGES_READ);

      const channel = await store.findChannelById(channelId);
      if (!channel) {
        throw new HttpError(404, "CHANNEL_NOT_FOUND", "Channel not found.");
      }
      assertChannelAccess(user, channel);

      const result = await store.markChannelRead(userId, channelId);
      return {
        channelId,
        lastReadAt: asIso(result.lastReadAt),
        userId,
      };
    },

    async signalTyping(channelId: string, userId: string) {
      const permissions = await store.loadPermissions(userId);
      const user = accessUser(userId, permissions);
      assertPermission(user, MESSAGES_CREATE);

      const channel = await store.findChannelById(channelId);
      if (!channel) {
        throw new HttpError(404, "CHANNEL_NOT_FOUND", "Channel not found.");
      }
      assertChannelAccess(user, channel);

      const profile = await store.findUserProfile(userId);
      return {
        userId,
        userName: profile?.name ?? "User",
        until: Date.now() + 5000,
      };
    },

    async hideConversation(channelId: string, userId: string) {
      const permissions = await store.loadPermissions(userId);
      const user = accessUser(userId, permissions);
      assertPermission(user, MESSAGES_READ);

      const channel = await store.findChannelById(channelId);
      if (!channel) {
        throw new HttpError(404, "CHANNEL_NOT_FOUND", "Channel not found.");
      }
      assertChannelAccess(user, channel);

      await store.hideConversationForUser(userId, channelId);
      const allLeft = await store.allMembersHaveLeft(channelId);
      if (allLeft) {
        await store.deleteChannel(channelId);
        return {
          data: { hidden: true, hardDeleted: true },
          deletedChannel: serializeChannel(channel),
        };
      }
      return {
        data: { hidden: true, hardDeleted: false },
        deletedChannel: null,
      };
    },

    async listMessageableUsers(userId: string) {
      const permissions = await store.loadPermissions(userId);
      const user = accessUser(userId, permissions);
      assertPermission(user, MESSAGES_CREATE);
      const users = await store.listActiveUsers(userId);
      return { data: users.filter((entry) => entry.id !== userId) };
    },

    async createDirectMessage(userId: string, otherUserIds: string[]) {
      const permissions = await store.loadPermissions(userId);
      const user = accessUser(userId, permissions);
      assertPermission(user, MESSAGES_CREATE);

      const others = Array.from(new Set(otherUserIds));
      if (others.length === 0) {
        throw new HttpError(
          400,
          "INVALID_DM",
          "At least one other user is required.",
        );
      }
      if (others.includes(userId)) {
        throw new HttpError(
          400,
          "INVALID_DM",
          "Cannot include yourself in DM members.",
        );
      }

      const memberIds = Array.from(new Set([userId, ...others])).sort();
      const existing = await store.findDirectChannel(memberIds);
      if (existing) {
        await store.restoreConversationMembership(userId, existing.id);
        const refreshed = await store.findChannelById(existing.id);
        return { data: serializeChannel(refreshed ?? existing) };
      }

      const channel = await store.createChannel({
        name: directChannelName(memberIds),
        isPrivate: true,
        type: "dm",
        members: memberIds,
        createdBy: userId,
      });
      return { data: serializeChannel(channel) };
    },

    async createChannel(
      userId: string,
      input: { name: string; isPrivate: boolean; members?: string[] },
    ) {
      const permissions = await store.loadPermissions(userId);
      const user = accessUser(userId, permissions);
      assertPermission(user, MESSAGES_CREATE);

      const name = input.name.trim();
      if (!name) {
        throw new HttpError(400, "INVALID_CHANNEL", "Name is required.");
      }

      const channel = await store.createChannel({
        name,
        isPrivate: input.isPrivate,
        members: input.members,
        createdBy: userId,
      });
      return { data: serializeChannel(channel) };
    },

    async updateChannel(
      channelId: string,
      userId: string,
      input: { name?: string },
    ) {
      const permissions = await store.loadPermissions(userId);
      const user = accessUser(userId, permissions);
      assertPermission(user, MESSAGES_ADMIN);

      const channel = await store.findChannelById(channelId);
      if (!channel) {
        throw new HttpError(404, "CHANNEL_NOT_FOUND", "Channel not found.");
      }

      const name = input.name?.trim();
      if (name !== undefined && name.length === 0) {
        throw new HttpError(400, "INVALID_CHANNEL", "Name is required.");
      }

      const updated = await store.updateChannel(channelId, {
        ...(name !== undefined ? { name } : {}),
      });
      return { data: serializeChannel(updated) };
    },

    async deleteChannel(channelId: string, userId: string) {
      const permissions = await store.loadPermissions(userId);
      const user = accessUser(userId, permissions);
      assertPermission(user, MESSAGES_ADMIN);

      const channel = await store.findChannelById(channelId);
      if (!channel) {
        throw new HttpError(404, "CHANNEL_NOT_FOUND", "Channel not found.");
      }
      await store.deleteChannel(channelId);
      return { data: { success: true }, deletedChannel: serializeChannel(channel) };
    },
  };
}

export type MessagesService = ReturnType<typeof createMessagesService>;
