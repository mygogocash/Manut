import { PERMISSIONS } from "@nexora/contracts";
import type {
  CreateChannelInput,
  SendMessageInput,
  UpdateChannelInput,
} from "@nexora/contracts/modules/messages/messages.validation";
import type { Db } from "@nexora/db";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "../http-exception.js";
import * as uploadsRepo from "../uploads/upload.repository.js";
import {
  assertCanAccessChannel,
  hasMessagePermission,
  type MessageAccessUser,
} from "./messages.access.js";
import * as repo from "./messages.repository.js";

function accessUserFrom(user: string | MessageAccessUser): MessageAccessUser {
  return typeof user === "string" ? { id: user, permissions: [] } : user;
}

function isPgUnique(err: unknown) {
  return err && typeof err === "object" && "code" in err && (err as { code: string }).code === "23505";
}

function serializeChannel(raw: {
  id: string;
  title: string | null;
  type: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  creator?: { id: string; name: string; avatarUrl: string | null } | null;
  members: { userId: string; role: string }[];
  _count: { messages: number };
  unreadCount?: number;
}) {
  const type = raw.type === "direct" ? "dm" : "channel";
  return {
    id: raw.id,
    name: raw.title ?? "",
    description: null,
    isPrivate: raw.type === "private" || raw.type === "direct",
    type,
    members: raw.members.map((m) => m.userId),
    createdBy: raw.createdBy,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    creator: raw.creator,
    _count: raw._count,
    ...(raw.unreadCount !== undefined ? { unreadCount: raw.unreadCount } : {}),
  };
}

function serializeMessage(raw: {
  id: string;
  conversationId: string;
  authorId: string;
  content: string | null;
  deletedForEveryoneAt?: string | null;
  createdAt: string;
  updatedAt: string;
  author?: { id: string; name: string; avatarUrl: string | null };
  attachments?: unknown[];
  readBy?: string[];
}) {
  const isDeleted = raw.deletedForEveryoneAt != null;
  return {
    id: raw.id,
    channelId: raw.conversationId,
    authorId: raw.authorId,
    content: isDeleted ? "" : (raw.content ?? ""),
    isDeleted,
    deletedAt: raw.deletedForEveryoneAt ?? null,
    isPinned: false,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    author: raw.author,
    attachments: isDeleted ? [] : (raw.attachments ?? []),
    readBy: raw.readBy ?? [],
  };
}

export async function listChannels(db: Db, user?: string | MessageAccessUser) {
  const actor = user ? accessUserFrom(user) : null;
  const channels = actor
    ? await repo.listChannelsForUser(db, actor.id, {
        includePrivateChannels: hasMessagePermission(actor, PERMISSIONS.MESSAGES_ADMIN),
      })
    : await repo.findAllChannels(db);
  if (!actor || channels.length === 0) {
    return { data: channels.filter(Boolean).map((c) => serializeChannel(c!)) };
  }
  const ids = channels.map((c) => c!.id);
  const counts = await repo.countUnreadByChannel(db, actor.id, ids);
  return {
    data: channels.filter(Boolean).map((c) => serializeChannel({ ...c!, unreadCount: counts[c!.id] ?? 0 })),
  };
}

export async function getUnreadSummary(db: Db, user: string | MessageAccessUser) {
  const actor = accessUserFrom(user);
  const channels = await repo.listChannelsForUser(db, actor.id, {
    includePrivateChannels: hasMessagePermission(actor, PERMISSIONS.MESSAGES_ADMIN),
  });
  if (channels.length === 0) return { data: { total: 0 } };
  const counts = await repo.countUnreadByChannel(
    db,
    actor.id,
    channels.map((c) => c!.id),
  );
  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  return { data: { total } };
}

export async function markChannelRead(db: Db, userId: string, channelId: string, actor?: MessageAccessUser) {
  const channel = await repo.findChannelById(db, channelId);
  if (!channel) throw new NotFoundException("Channel not found");
  if (actor) assertCanAccessChannel(actor, { id: channel.id, type: channel.type, members: channel.members });
  return repo.markChannelRead(db, userId, channelId);
}

export async function getChannel(db: Db, id: string, actor?: MessageAccessUser) {
  const channel = await repo.findChannelById(db, id);
  if (!channel) throw new NotFoundException("Channel not found");
  if (actor) assertCanAccessChannel(actor, { id: channel.id, type: channel.type, members: channel.members });
  return { data: serializeChannel(channel) };
}

export async function createChannel(db: Db, createdBy: string, input: CreateChannelInput) {
  try {
    const channel = await repo.createChannel(db, {
      name: input.name,
      isPrivate: input.isPrivate,
      members: input.members,
      createdBy,
    });
    return serializeChannel(channel!);
  } catch (err) {
    if (isPgUnique(err)) throw new ConflictException("Channel name already exists");
    throw err;
  }
}

export async function updateChannel(db: Db, id: string, input: UpdateChannelInput) {
  const channel = await repo.findChannelById(db, id);
  if (!channel) throw new NotFoundException("Channel not found");
  try {
    const updated = await repo.updateChannel(db, id, input);
    return { data: serializeChannel(updated!) };
  } catch (err) {
    if (isPgUnique(err)) throw new ConflictException("Channel name already exists");
    throw err;
  }
}

export async function deleteChannel(db: Db, id: string) {
  const channel = await repo.findChannelById(db, id);
  if (!channel) throw new NotFoundException("Channel not found");
  await repo.deleteChannel(db, id);
}

export async function hideConversation(db: Db, channelId: string, userId: string, actor?: MessageAccessUser) {
  const channel = await repo.findChannelById(db, channelId);
  if (!channel) throw new NotFoundException("Channel not found");
  if (actor) assertCanAccessChannel(actor, { id: channel.id, type: channel.type, members: channel.members });
  await repo.hideConversationForUser(db, userId, channelId);
  const allLeft = await repo.allMembersHaveLeft(db, channelId);
  if (allLeft) {
    await repo.deleteChannel(db, channelId);
    return { data: { hidden: true, hardDeleted: true } };
  }
  return { data: { hidden: true, hardDeleted: false } };
}

export async function listMessages(db: Db, channelId: string, page: number, limit: number, actor?: MessageAccessUser) {
  const channel = await repo.findChannelById(db, channelId);
  if (!channel) throw new NotFoundException("Channel not found");
  if (actor) assertCanAccessChannel(actor, { id: channel.id, type: channel.type, members: channel.members });
  const { data, total } = await repo.findMessages(db, channelId, page, limit);
  const ids = data.map((m) => m.id);
  const attachments = await uploadsRepo.findAttachmentsForMessages(db, ids);
  const reads = channel.type === "direct" ? await repo.findChannelReads(db, channelId) : [];
  const enriched = data.map((m) =>
    serializeMessage({
      ...m,
      attachments: attachments.filter((a) => a.linkedId === m.id),
      readBy: reads
        .filter((r) => r.userId !== m.authorId && r.lastReadAt != null && r.lastReadAt >= m.createdAt)
        .map((r) => r.userId),
    }),
  );
  return { data: enriched, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
}

export async function sendMessage(
  db: Db,
  channelId: string,
  authorId: string,
  input: SendMessageInput,
  actor?: MessageAccessUser,
) {
  const channel = await repo.findChannelById(db, channelId);
  if (!channel) throw new NotFoundException("Channel not found");
  if (actor) assertCanAccessChannel(actor, { id: channel.id, type: channel.type, members: channel.members });
  const created = await repo.createMessage(db, { channelId, authorId, content: input.content });
  const attachmentIds = input.attachmentIds ?? [];
  const linked =
    attachmentIds.length > 0 ? await uploadsRepo.linkToMessage(db, attachmentIds, created.id, authorId) : [];
  return serializeMessage({ ...created, attachments: linked });
}

export async function deleteMessage(
  db: Db,
  messageId: string,
  actor?: MessageAccessUser,
  expectedChannelId?: string,
) {
  const message = await repo.findMessageById(db, messageId);
  if (!message) throw new NotFoundException("Message not found");
  if (message.deletedForEveryoneAt) throw new BadRequestException("Message is already deleted");
  if (expectedChannelId && message.conversationId !== expectedChannelId) {
    throw new NotFoundException("Message not found");
  }
  if (actor) {
    const channel = await repo.findChannelById(db, message.conversationId);
    if (!channel) throw new NotFoundException("Channel not found");
    assertCanAccessChannel(actor, { id: channel.id, type: channel.type, members: channel.members });
    const isAuthor = message.authorId === actor.id;
    const isAdmin = hasMessagePermission(actor, PERMISSIONS.MESSAGES_ADMIN);
    if (!isAuthor && !isAdmin) throw new ForbiddenException("You can only delete your own messages");
  }
  const deletedBy = actor?.id ?? message.authorId;
  const deleted = await repo.softDeleteMessage(db, messageId, deletedBy);
  return serializeMessage({ ...deleted, attachments: [] });
}

export async function listMessageableUsers(db: Db, currentUserId: string) {
  const users = await repo.listActiveUsers(db, currentUserId);
  return { data: users.filter((u) => u.id !== currentUserId) };
}

/** WebSocket bus omitted on edge — typing is a no-op. */
export async function signalTyping(_db: Db, _channelId: string, _actor: { userId: string; userName: string; permissions?: string[] }) {
  return;
}

export async function createDirectMessage(db: Db, currentUserId: string, otherUserIds: string[]) {
  const others = Array.from(new Set(otherUserIds));
  if (others.length === 0) throw new BadRequestException("At least one other user is required");
  if (others.includes(currentUserId)) throw new BadRequestException("Cannot include yourself in DM members");
  const memberIds = Array.from(new Set([currentUserId, ...others])).sort();
  const existing = await repo.findDirectChannel(db, memberIds);
  if (existing) {
    await repo.restoreConversationMembership(db, currentUserId, existing.id);
    const refreshed = await repo.findChannelById(db, existing.id);
    return serializeChannel(refreshed ?? existing);
  }
  const channel = await repo.createChannel(db, {
    name: repo.directChannelName(memberIds),
    isPrivate: true,
    type: "dm",
    members: memberIds,
    createdBy: currentUserId,
  });
  return serializeChannel(channel!);
}
