import type { InputJsonValue, JsonValue, Prisma } from "@manut/database";

import { prisma } from "@/infrastructure/database/prisma";

const userSelect = { id: true, name: true, email: true } as const;

export const adminRepository = {
  async findAuditLogs(
    page: number,
    limit: number,
    filters?: { resource?: string; userId?: string; action?: string },
  ) {
    const where: Prisma.AuditLogWhereInput = {};
    if (filters?.resource) {
      where.resource = { contains: filters.resource, mode: "insensitive" };
    }
    if (filters?.userId) where.userId = filters.userId;
    if (filters?.action) where.action = filters.action;

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: userSelect } },
        orderBy: { timestamp: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);
    return { data, total };
  },

  async findAllSettings() {
    return prisma.systemSetting.findMany({ orderBy: { key: "asc" } });
  },

  async upsertSettings(settings: Array<{ key: string; value: JsonValue }>) {
    return prisma.$transaction(
      settings.map((s) =>
        prisma.systemSetting.upsert({
          where: { key: s.key },
          update: { value: s.value as InputJsonValue },
          create: { key: s.key, value: s.value as InputJsonValue },
        }),
      ),
    );
  },

  async findModuleAccessByUser(userId: string) {
    return prisma.moduleAccess.findMany({
      where: { userId },
      select: { moduleId: true, granted: true, grantedAt: true },
      orderBy: { moduleId: "asc" },
    });
  },

  async upsertModuleAccess(
    userId: string,
    modules: Array<{ moduleId: string; granted: boolean }>,
    grantedBy: string,
  ) {
    return prisma.$transaction(
      modules.map((m) =>
        prisma.moduleAccess.upsert({
          where: {
            userId_moduleId: { userId, moduleId: m.moduleId },
          },
          update: { granted: m.granted, grantedBy, grantedAt: new Date() },
          create: {
            userId,
            moduleId: m.moduleId,
            granted: m.granted,
            grantedBy,
          },
        }),
      ),
    );
  },

  // ── User Groups ──

  async findUserGroups() {
    return prisma.userGroup.findMany({
      include: {
        creator: { select: userSelect },
        _count: { select: { members: true } },
      },
      orderBy: { name: "asc" },
    });
  },

  async findUserGroupById(id: string) {
    return prisma.userGroup.findUnique({
      where: { id },
      include: {
        creator: { select: userSelect },
        members: {
          include: { user: { select: { ...userSelect, department: true } } },
          orderBy: { addedAt: "desc" },
        },
      },
    });
  },

  async createUserGroup(data: {
    name: string;
    description?: string;
    createdBy: string;
  }) {
    return prisma.userGroup.create({
      data,
      include: {
        creator: { select: userSelect },
        _count: { select: { members: true } },
      },
    });
  },

  async updateUserGroup(
    id: string,
    data: { name?: string; description?: string; isActive?: boolean },
  ) {
    return prisma.userGroup.update({
      where: { id },
      data,
      include: {
        creator: { select: userSelect },
        _count: { select: { members: true } },
      },
    });
  },

  async deleteUserGroup(id: string) {
    return prisma.userGroup.delete({ where: { id } });
  },

  async addGroupMembers(groupId: string, userIds: string[], addedBy: string) {
    const data = userIds.map((userId) => ({ groupId, userId, addedBy }));
    await prisma.userGroupMember.createMany({
      data,
      skipDuplicates: true,
    });
  },

  async removeGroupMembers(groupId: string, userIds: string[]) {
    await prisma.userGroupMember.deleteMany({
      where: { groupId, userId: { in: userIds } },
    });
  },
};
