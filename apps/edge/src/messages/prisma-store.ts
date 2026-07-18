import { createPrismaClient, type PrismaClient } from "@manut/database";

import { hyperdriveConnectionString } from "../hyperdrive";
import type { RuntimeBindings } from "../runtime";
import type {
  CreateChannelStoreInput,
  MessagesChannelRecord,
  MessagesMessageRecord,
  MessagesStore,
} from "./store";
import { directChannelName } from "./store";

const creatorSelect = { id: true, name: true, avatarUrl: true } as const;
const authorSelect = { id: true, name: true, avatarUrl: true } as const;

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function mapChannel(raw: {
  id: string;
  title: string | null;
  type: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  directKey?: string | null;
  members: Array<{ userId: string; role: string; leftAt?: Date | null }>;
  creator?: { id: string; name: string | null; avatarUrl: string | null } | null;
  _count?: { messages: number };
}): MessagesChannelRecord {
  return {
    id: raw.id,
    title: raw.title,
    type: raw.type,
    createdBy: raw.createdBy,
    createdAt: asIso(raw.createdAt),
    updatedAt: asIso(raw.updatedAt),
    directKey: raw.directKey ?? null,
    members: raw.members.map((member) => ({
      userId: member.userId,
      role: member.role,
      leftAt: member.leftAt ? asIso(member.leftAt) : null,
    })),
    creator: raw.creator ?? undefined,
    _count: raw._count,
  };
}

function mapMessage(raw: {
  id: string;
  conversationId: string;
  authorId: string;
  content: string | null;
  deletedForEveryoneAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  author?: { id: string; name: string | null; avatarUrl: string | null } | null;
}): MessagesMessageRecord {
  return {
    id: raw.id,
    conversationId: raw.conversationId,
    authorId: raw.authorId,
    content: raw.content,
    deletedForEveryoneAt: raw.deletedForEveryoneAt
      ? asIso(raw.deletedForEveryoneAt)
      : null,
    createdAt: asIso(raw.createdAt),
    updatedAt: asIso(raw.updatedAt),
    author: raw.author ?? null,
  };
}

const channelInclude = {
  creator: { select: creatorSelect },
  members: { select: { userId: true, role: true, leftAt: true } },
  _count: { select: { messages: true } },
} as const;

export function createPrismaMessagesStore(client: PrismaClient): MessagesStore {
  return {
    async loadPermissions(userId) {
      const permissions = new Set<string>();
      const userWithRoles = await client.user.findUnique({
        where: { id: userId },
        include: {
          userRoles: {
            include: {
              role: {
                include: { rolePermissions: true },
              },
            },
          },
          moduleAccessGrants: true,
        },
      });
      if (!userWithRoles) return permissions;

      const isSuperAdmin = userWithRoles.userRoles.some(
        (userRole) => userRole.role.isSystem && userRole.role.name === "Admin",
      );
      if (isSuperAdmin) {
        permissions.add("messages:read");
        permissions.add("messages:create");
        permissions.add("messages:delete");
        permissions.add("messages:admin");
      } else {
        for (const userRole of userWithRoles.userRoles) {
          for (const rolePerm of userRole.role.rolePermissions) {
            permissions.add(rolePerm.permissionCode);
          }
        }
      }

      for (const access of userWithRoles.moduleAccessGrants) {
        if (!access.granted) {
          for (const perm of [...permissions]) {
            if (perm.startsWith(`${access.moduleId}:`)) {
              permissions.delete(perm);
            }
          }
        }
      }

      return permissions;
    },

    async findUserProfile(userId) {
      const user = await client.user.findUnique({
        where: { id: userId },
        select: { id: true, name: true },
      });
      return user;
    },

    async listActiveUsers(excludeUserId) {
      return client.user.findMany({
        where: { isActive: true, id: { not: excludeUserId } },
        select: { id: true, name: true, avatarUrl: true },
        orderBy: { name: "asc" },
      });
    },

    async listChannelsForUser(userId, options) {
      const rows = await client.conversation.findMany({
        where: {
          members: {
            some: {
              userId,
              leftAt: null,
            },
          },
          ...(options.includePrivateChannels
            ? {}
            : {
                OR: [
                  { type: "group" },
                  { type: "direct" },
                  {
                    AND: [
                      { type: "private" },
                      { members: { some: { userId, leftAt: null } } },
                    ],
                  },
                ],
              }),
        },
        include: channelInclude,
        orderBy: { updatedAt: "desc" },
      });
      return rows.map(mapChannel);
    },

    async findChannelById(id) {
      const row = await client.conversation.findUnique({
        where: { id },
        include: channelInclude,
      });
      return row ? mapChannel(row) : null;
    },

    async countUnreadByChannel(userId, channelIds) {
      if (channelIds.length === 0) return {};
      const memberships = await client.conversationMember.findMany({
        where: { userId, conversationId: { in: channelIds } },
        select: { conversationId: true, lastReadAt: true },
      });
      const readMap = new Map(
        memberships.map((membership) => [
          membership.conversationId,
          membership.lastReadAt,
        ]),
      );
      const counts = await Promise.all(
        channelIds.map(async (channelId) => {
          const lastReadAt = readMap.get(channelId);
          const count = await client.message.count({
            where: {
              conversationId: channelId,
              authorId: { not: userId },
              ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
            },
          });
          return [channelId, count] as const;
        }),
      );
      return Object.fromEntries(counts);
    },

    async findMessages(channelId, page, limit) {
      const [data, total] = await Promise.all([
        client.message.findMany({
          where: { conversationId: channelId },
          include: { author: { select: authorSelect } },
          orderBy: { createdAt: "asc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        client.message.count({ where: { conversationId: channelId } }),
      ]);
      return { data: data.map(mapMessage), total };
    },

    async createMessage(input) {
      const message = await client.message.create({
        data: {
          conversationId: input.channelId,
          authorId: input.authorId,
          content: input.content,
        },
        include: { author: { select: authorSelect } },
      });
      await client.conversation.update({
        where: { id: input.channelId },
        data: { lastMessageAt: new Date(), updatedAt: new Date() },
      });
      return mapMessage(message);
    },

    async findMessageById(id) {
      const row = await client.message.findUnique({
        where: { id },
        include: { author: { select: authorSelect } },
      });
      return row ? mapMessage(row) : null;
    },

    async softDeleteMessage(id, deletedBy) {
      const row = await client.message.update({
        where: { id },
        data: {
          deletedForEveryoneAt: new Date(),
          deletedBy,
          content: null,
        },
        include: { author: { select: authorSelect } },
      });
      return mapMessage(row);
    },

    async markChannelRead(userId, channelId) {
      const row = await client.conversationMember.update({
        where: {
          conversationId_userId: {
            conversationId: channelId,
            userId,
          },
        },
        data: { lastReadAt: new Date() },
      });
      return { lastReadAt: asIso(row.lastReadAt ?? new Date()) };
    },

    async hideConversationForUser(userId, channelId) {
      await client.conversationMember.update({
        where: {
          conversationId_userId: { conversationId: channelId, userId },
        },
        data: { leftAt: new Date() },
      });
    },

    async allMembersHaveLeft(channelId) {
      const members = await client.conversationMember.findMany({
        where: { conversationId: channelId },
        select: { leftAt: true },
      });
      return members.length > 0 && members.every((member) => member.leftAt != null);
    },

    async deleteChannel(id) {
      await client.conversation.delete({ where: { id } });
    },

    async createChannel(input: CreateChannelStoreInput) {
      const conversationType =
        input.type === "dm" ? "direct" : input.isPrivate ? "private" : "group";
      const memberIds = Array.from(
        new Set([input.createdBy, ...(input.members ?? [])]),
      );
      const row = await client.conversation.create({
        data: {
          title: input.name,
          directKey: conversationType === "direct" ? input.name : undefined,
          type: conversationType,
          createdBy: input.createdBy,
          members: {
            create: memberIds.map((userId) => ({
              userId,
              role: userId === input.createdBy ? "admin" : "member",
            })),
          },
        },
        include: channelInclude,
      });
      return mapChannel(row);
    },

    async updateChannel(id, input) {
      const row = await client.conversation.update({
        where: { id },
        data: {
          ...(input.name !== undefined ? { title: input.name } : {}),
        },
        include: channelInclude,
      });
      return mapChannel(row);
    },

    async findDirectChannel(memberIds) {
      const key = directChannelName(memberIds);
      const row = await client.conversation.findUnique({
        where: { directKey: key },
        include: channelInclude,
      });
      return row ? mapChannel(row) : null;
    },

    async restoreConversationMembership(userId, channelId) {
      await client.conversationMember.update({
        where: {
          conversationId_userId: { conversationId: channelId, userId },
        },
        data: { leftAt: null },
      });
    },
  };
}

export function createHyperdriveMessagesStore(
  env: RuntimeBindings,
): MessagesStore {
  const client = createPrismaClient(hyperdriveConnectionString(env));
  return createPrismaMessagesStore(client);
}
