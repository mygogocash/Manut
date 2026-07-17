import { prisma } from "@/infrastructure/database/prisma";

const creatorSelect = { id: true, name: true, avatarUrl: true } as const;
const authorSelect = { id: true, name: true, avatarUrl: true } as const;

export function directChannelName(userIds: string[]) {
  return `dm:${[...userIds].sort().join(":")}`;
}

export const messagesRepository = {
  async findUserAuthorizationById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        deletedAt: true,
        entityId: true,
      },
    });
  },

  async findAllChannels() {
    return prisma.conversation.findMany({
      include: {
        creator: { select: creatorSelect },
        members: { select: { userId: true, role: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  },

  async findChannelById(id: string) {
    return prisma.conversation.findUnique({
      where: { id },
      include: {
        creator: { select: creatorSelect },
        members: { select: { userId: true, role: true } },
        _count: { select: { messages: true } },
      },
    });
  },

  async createChannel(data: {
    name: string;
    description?: string;
    isPrivate: boolean;
    members?: string[];
    createdBy: string;
    type?: string;
  }) {
    const conversationType =
      data.type === "dm" ? "direct" : data.isPrivate ? "private" : "group";

    return prisma.conversation.create({
      data: {
        title: data.name,
        directKey: conversationType === "direct" ? data.name : undefined,
        type: conversationType,
        createdBy: data.createdBy,
        members: {
          create: [
            { userId: data.createdBy, role: "admin" },
            ...(data.members ?? [])
              .filter((id) => id !== data.createdBy)
              .map((userId) => ({ userId, role: "member" as const })),
          ],
        },
      },
      include: {
        creator: { select: creatorSelect },
        members: { select: { userId: true, role: true } },
        _count: { select: { messages: true } },
      },
    });
  },

  async findDirectChannel(userIds: string[]) {
    const key = directChannelName(userIds);
    return prisma.conversation.findUnique({
      where: { directKey: key },
      include: {
        creator: { select: creatorSelect },
        members: { select: { userId: true, role: true } },
        _count: { select: { messages: true } },
      },
    });
  },

  async listChannelsForUser(
    userId: string,
    options: { includePrivateChannels?: boolean } = {},
  ) {
    return prisma.conversation.findMany({
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
      include: {
        creator: { select: creatorSelect },
        members: { select: { userId: true, role: true } },
        _count: { select: { messages: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
  },

  async updateChannel(
    id: string,
    data: { name?: string; description?: string | null },
  ) {
    return prisma.conversation.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { title: data.name } : {}),
      },
      include: {
        creator: { select: creatorSelect },
        members: { select: { userId: true, role: true } },
        _count: { select: { messages: true } },
      },
    });
  },

  async deleteChannel(id: string) {
    return prisma.conversation.delete({ where: { id } });
  },

  async hideConversationForUser(userId: string, channelId: string) {
    return prisma.conversationMember.update({
      where: {
        conversationId_userId: { conversationId: channelId, userId },
      },
      data: { leftAt: new Date() },
    });
  },

  async restoreConversationMembership(userId: string, channelId: string) {
    return prisma.conversationMember.update({
      where: {
        conversationId_userId: { conversationId: channelId, userId },
      },
      data: { leftAt: null },
    });
  },

  async allMembersHaveLeft(channelId: string) {
    const members = await prisma.conversationMember.findMany({
      where: { conversationId: channelId },
      select: { leftAt: true },
    });
    return members.length > 0 && members.every((m) => m.leftAt != null);
  },

  async findMessages(channelId: string, page: number, limit: number) {
    const [data, total] = await Promise.all([
      prisma.message.findMany({
        where: { conversationId: channelId },
        include: { author: { select: authorSelect } },
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.message.count({ where: { conversationId: channelId } }),
    ]);
    return { data, total };
  },

  async createMessage(data: {
    channelId: string;
    authorId: string;
    content: string;
  }) {
    const message = await prisma.message.create({
      data: {
        conversationId: data.channelId,
        authorId: data.authorId,
        content: data.content,
      },
      include: { author: { select: authorSelect } },
    });

    await prisma.conversation.update({
      where: { id: data.channelId },
      data: { lastMessageAt: new Date(), updatedAt: new Date() },
    });

    return message;
  },

  async findMessageById(id: string) {
    return prisma.message.findUnique({ where: { id } });
  },

  async softDeleteMessage(id: string, deletedBy: string) {
    return prisma.message.update({
      where: { id },
      data: {
        deletedForEveryoneAt: new Date(),
        deletedBy,
        content: null,
      },
      include: { author: { select: authorSelect } },
    });
  },

  async findAttachmentsForMessages(messageIds: string[]) {
    if (messageIds.length === 0) return [];
    return prisma.fileUpload.findMany({
      where: { linkedTo: "message", linkedId: { in: messageIds } },
      orderBy: { createdAt: "asc" },
    });
  },

  async listActiveUsers(_excludeUserId: string) {
    return prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true, avatarUrl: true },
      orderBy: { name: "asc" },
    });
  },

  async markChannelRead(userId: string, channelId: string) {
    const now = new Date();
    return prisma.conversationMember.update({
      where: {
        conversationId_userId: {
          conversationId: channelId,
          userId,
        },
      },
      data: { lastReadAt: now },
    });
  },

  async findChannelReads(channelId: string) {
    return prisma.conversationMember.findMany({
      where: { conversationId: channelId },
      select: { userId: true, lastReadAt: true },
    });
  },

  async countUnreadByChannel(
    userId: string,
    channelIds: string[],
  ): Promise<Record<string, number>> {
    if (channelIds.length === 0) return {};

    const memberships = await prisma.conversationMember.findMany({
      where: { userId, conversationId: { in: channelIds } },
      select: { conversationId: true, lastReadAt: true },
    });
    const readMap = new Map<string, Date | null>(
      memberships.map((m) => [m.conversationId, m.lastReadAt]),
    );

    const counts = await Promise.all(
      channelIds.map(async (channelId) => {
        const lastReadAt = readMap.get(channelId);
        const count = await prisma.message.count({
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
};
