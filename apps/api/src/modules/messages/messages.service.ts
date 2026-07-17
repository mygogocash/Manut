import { PERMISSIONS } from "@/common/constants/permissions";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import {
  assertCanAccessChannel,
  hasMessagePermission,
  type MessageAccessUser,
} from "@/modules/messages/messages.access";
import { messageBus } from "@/modules/messages/messages.bus";
import {
  directChannelName,
  messagesRepository,
} from "@/modules/messages/messages.repository";
import type {
  CreateChannelInput,
  SendMessageInput,
  UpdateChannelInput,
} from "@/modules/messages/messages.validation";
import { uploadsRepository } from "@/modules/uploads/uploads.repository";

function accessUserFrom(user: string | MessageAccessUser): MessageAccessUser {
  return typeof user === "string" ? { id: user, permissions: [] } : user;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeChannel(raw: any) {
  const type = raw.type === "direct" ? "dm" : "channel";
  const members = Array.isArray(raw.members)
    ? raw.members.map((m: { userId?: string }) =>
        typeof m === "string" ? m : m.userId,
      )
    : null;
  return {
    id: raw.id,
    name: raw.title ?? raw.name ?? "",
    description: raw.description ?? null,
    isPrivate: raw.type === "private" || raw.type === "direct",
    type,
    members,
    createdBy: raw.createdBy,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    creator: raw.creator,
    _count: raw._count ?? { messages: 0 },
    ...(raw.unreadCount !== undefined ? { unreadCount: raw.unreadCount } : {}),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function serializeMessage(raw: any) {
  const isDeleted = raw.deletedForEveryoneAt != null;
  return {
    id: raw.id,
    channelId: raw.conversationId ?? raw.channelId,
    authorId: raw.authorId,
    content: isDeleted ? "" : (raw.content ?? ""),
    isDeleted,
    deletedAt: raw.deletedForEveryoneAt ?? null,
    isPinned: raw.isPinned ?? false,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    author: raw.author,
    attachments: isDeleted ? [] : (raw.attachments ?? []),
    readBy: raw.readBy ?? [],
  };
}

export const messagesService = {
  async listChannels(user?: string | MessageAccessUser) {
    const actor = user ? accessUserFrom(user) : null;
    const channels = actor
      ? await messagesRepository.listChannelsForUser(actor.id, {
          includePrivateChannels: hasMessagePermission(
            actor,
            PERMISSIONS.MESSAGES_ADMIN,
          ),
        })
      : await messagesRepository.findAllChannels();

    if (!actor || channels.length === 0) {
      return { data: channels.map(serializeChannel) };
    }

    const ids = channels.map((c) => c.id);
    const counts = await messagesRepository.countUnreadByChannel(actor.id, ids);
    const enriched = channels.map((c) =>
      serializeChannel({ ...c, unreadCount: counts[c.id] ?? 0 }),
    );
    return { data: enriched };
  },

  /**
   * Total unread message count across every channel the user can see.
   * Drives the badge on the main sidebar "Messaging" entry. Implemented
   * as `listChannels` minus the serialisation step so visibility rules
   * (private channel access, etc.) stay in one place.
   */
  async getUnreadSummary(user: string | MessageAccessUser) {
    const actor = accessUserFrom(user);
    const channels = await messagesRepository.listChannelsForUser(actor.id, {
      includePrivateChannels: hasMessagePermission(
        actor,
        PERMISSIONS.MESSAGES_ADMIN,
      ),
    });
    if (channels.length === 0) return { data: { total: 0 } };
    const counts = await messagesRepository.countUnreadByChannel(
      actor.id,
      channels.map((c) => c.id),
    );
    const total = Object.values(counts).reduce((s, n) => s + n, 0);
    return { data: { total } };
  },

  async markChannelRead(
    userId: string,
    channelId: string,
    actor?: MessageAccessUser,
  ) {
    const channel = await messagesRepository.findChannelById(channelId);
    if (!channel) throw new NotFoundException("Channel not found");
    if (actor) assertCanAccessChannel(actor, channel);
    const result = await messagesRepository.markChannelRead(userId, channelId);
    messageBus.publish({
      type: "channel.read",
      channelId,
      payload: {
        userId,
        lastReadAt:
          result.lastReadAt?.toISOString() ?? new Date().toISOString(),
      },
    });
    return result;
  },

  async getChannel(id: string, actor?: MessageAccessUser) {
    const channel = await messagesRepository.findChannelById(id);
    if (!channel) throw new NotFoundException("Channel not found");
    if (actor) assertCanAccessChannel(actor, channel);
    return { data: serializeChannel(channel) };
  },

  async createChannel(createdBy: string, input: CreateChannelInput) {
    try {
      const channel = await messagesRepository.createChannel({
        name: input.name,
        description: input.description,
        isPrivate: input.isPrivate,
        members: input.members,
        createdBy,
      });
      const serialized = serializeChannel(channel);
      messageBus.publish({
        type: "channel.created",
        channelId: channel.id,
        payload: serialized,
      });
      return serialized;
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        err.code === "P2002"
      ) {
        throw new ConflictException("Channel name already exists");
      }
      throw err;
    }
  },

  async updateChannel(id: string, input: UpdateChannelInput) {
    const channel = await messagesRepository.findChannelById(id);
    if (!channel) throw new NotFoundException("Channel not found");

    try {
      const updated = await messagesRepository.updateChannel(id, input);
      const serialized = serializeChannel(updated);
      messageBus.publish({
        type: "channel.updated",
        channelId: updated.id,
        payload: serialized,
      });
      return { data: serialized };
    } catch (err: unknown) {
      if (
        err &&
        typeof err === "object" &&
        "code" in err &&
        err.code === "P2002"
      ) {
        throw new ConflictException("Channel name already exists");
      }
      throw err;
    }
  },

  async deleteChannel(id: string) {
    const channel = await messagesRepository.findChannelById(id);
    if (!channel) throw new NotFoundException("Channel not found");
    await messagesRepository.deleteChannel(id);
    messageBus.publish({
      type: "channel.deleted",
      channelId: id,
      payload: serializeChannel(channel),
    });
  },

  /**
   * Hide a conversation for the current user only. When every member has
   * hidden the thread (e.g. both sides of a DM), the row is hard-deleted.
   */
  async hideConversation(
    channelId: string,
    userId: string,
    actor?: MessageAccessUser,
  ) {
    const channel = await messagesRepository.findChannelById(channelId);
    if (!channel) throw new NotFoundException("Channel not found");
    if (actor) assertCanAccessChannel(actor, channel);

    await messagesRepository.hideConversationForUser(userId, channelId);

    const allLeft = await messagesRepository.allMembersHaveLeft(channelId);
    if (allLeft) {
      await messagesRepository.deleteChannel(channelId);
      messageBus.publish({
        type: "channel.deleted",
        channelId,
        payload: serializeChannel(channel),
      });
      return { data: { hidden: true, hardDeleted: true } };
    }

    return { data: { hidden: true, hardDeleted: false } };
  },

  async listMessages(
    channelId: string,
    page: number,
    limit: number,
    actor?: MessageAccessUser,
  ) {
    const channel = await messagesRepository.findChannelById(channelId);
    if (!channel) throw new NotFoundException("Channel not found");
    if (actor) assertCanAccessChannel(actor, channel);

    const { data, total } = await messagesRepository.findMessages(
      channelId,
      page,
      limit,
    );
    const ids = data.map((m) => m.id);
    const attachments =
      await messagesRepository.findAttachmentsForMessages(ids);

    const reads =
      channel.type === "direct"
        ? await messagesRepository.findChannelReads(channelId)
        : [];

    const enriched = data.map((m) =>
      serializeMessage({
        ...m,
        attachments: attachments.filter(
          (a: { linkedId: string | null }) => a.linkedId === m.id,
        ),
        readBy: reads
          .filter(
            (r) =>
              r.userId !== m.authorId &&
              r.lastReadAt != null &&
              r.lastReadAt >= m.createdAt,
          )
          .map((r) => r.userId),
      }),
    );
    return {
      data: enriched,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  },

  async sendMessage(
    channelId: string,
    authorId: string,
    input: SendMessageInput,
    actor?: MessageAccessUser,
  ) {
    const channel = await messagesRepository.findChannelById(channelId);
    if (!channel) throw new NotFoundException("Channel not found");
    if (actor) assertCanAccessChannel(actor, channel);

    const created = await messagesRepository.createMessage({
      channelId,
      authorId,
      content: input.content,
    });

    const attachmentIds = input.attachmentIds ?? [];
    const attachments =
      attachmentIds.length > 0
        ? await uploadsRepository.linkToMessage(
            attachmentIds,
            created.id,
            authorId,
          )
        : [];

    const payload = serializeMessage({ ...created, attachments });
    messageBus.publish({
      type: "message.created",
      channelId,
      payload,
    });
    return payload;
  },

  async deleteMessage(
    messageId: string,
    actor?: MessageAccessUser,
    expectedChannelId?: string,
  ) {
    const message = await messagesRepository.findMessageById(messageId);
    if (!message) throw new NotFoundException("Message not found");
    if (message.deletedForEveryoneAt) {
      throw new BadRequestException("Message is already deleted");
    }
    if (expectedChannelId && message.conversationId !== expectedChannelId) {
      throw new NotFoundException("Message not found");
    }
    if (actor) {
      const channel = await messagesRepository.findChannelById(
        message.conversationId,
      );
      if (!channel) throw new NotFoundException("Channel not found");
      assertCanAccessChannel(actor, channel);
      const isAuthor = message.authorId === actor.id;
      const isAdmin = hasMessagePermission(actor, PERMISSIONS.MESSAGES_ADMIN);
      if (!isAuthor && !isAdmin) {
        throw new ForbiddenException("You can only delete your own messages");
      }
    }
    const deletedBy = actor?.id ?? message.authorId;
    const deleted = await messagesRepository.softDeleteMessage(
      messageId,
      deletedBy,
    );
    const payload = serializeMessage({ ...deleted, attachments: [] });
    messageBus.publish({
      type: "message.deleted",
      channelId: message.conversationId,
      payload,
    });
    return payload;
  },

  async listMessageableUsers(currentUserId: string) {
    const users = await messagesRepository.listActiveUsers(currentUserId);
    return { data: users.filter((u) => u.id !== currentUserId) };
  },

  async signalTyping(
    channelId: string,
    actor: { userId: string; userName: string; permissions?: string[] },
  ) {
    if (actor.permissions) {
      const channel = await messagesRepository.findChannelById(channelId);
      if (!channel) throw new NotFoundException("Channel not found");
      assertCanAccessChannel(
        { id: actor.userId, permissions: actor.permissions },
        channel,
      );
    }
    messageBus.publish({
      type: "typing",
      channelId,
      payload: {
        userId: actor.userId,
        userName: actor.userName,
        until: Date.now() + 5000,
      },
    });
  },

  async createDirectMessage(currentUserId: string, otherUserIds: string[]) {
    const others = Array.from(new Set(otherUserIds));
    if (others.length === 0) {
      throw new BadRequestException("At least one other user is required");
    }
    if (others.includes(currentUserId)) {
      throw new BadRequestException("Cannot include yourself in DM members");
    }

    const memberIds = Array.from(new Set([currentUserId, ...others])).sort();
    const existing = await messagesRepository.findDirectChannel(memberIds);
    if (existing) {
      await messagesRepository.restoreConversationMembership(
        currentUserId,
        existing.id,
      );
      const refreshed = await messagesRepository.findChannelById(existing.id);
      const serialized = serializeChannel(refreshed ?? existing);
      messageBus.publish({
        type: "channel.created",
        channelId: existing.id,
        payload: serialized,
      });
      return serialized;
    }

    const channel = await messagesRepository.createChannel({
      name: directChannelName(memberIds),
      isPrivate: true,
      type: "dm",
      members: memberIds,
      createdBy: currentUserId,
    });
    const serialized = serializeChannel(channel);
    messageBus.publish({
      type: "channel.created",
      channelId: channel.id,
      payload: serialized,
    });
    return serialized;
  },
};
