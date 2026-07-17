import type { Prisma } from "@manut/database";

import { prisma } from "@/infrastructure/database/prisma";

const announcementInclude = {
  author: { select: { id: true, name: true, email: true, avatarUrl: true } },
  entity: { select: { id: true, name: true, code: true } },
  attachments: { orderBy: { uploadedAt: "asc" } },
} satisfies Prisma.LegalAnnouncementInclude;

export interface AnnouncementFilters {
  scope: "all" | "mine";
  status?: string;
  kind?: string;
  entityId?: string | null;
  // Restrict to "global + user's entity" for the employee-facing list.
  userEntityId?: string | null;
  search?: string;
  unackedOnly?: boolean;
  userId?: string;
}

export class LegalAnnouncementRepository {
  async findMany(filters: AnnouncementFilters, page: number, limit: number) {
    const where = buildWhere(filters);
    const [data, total] = await prisma.$transaction([
      prisma.legalAnnouncement.findMany({
        where,
        include: {
          ...announcementInclude,
          ...(filters.userId
            ? {
                acks: {
                  where: { userId: filters.userId },
                  select: { userId: true, ackedAt: true },
                },
              }
            : {}),
          _count: { select: { acks: true } },
        },
        orderBy: [
          { pinned: "desc" },
          { publishedAt: { sort: "desc", nulls: "last" } },
          { createdAt: "desc" },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.legalAnnouncement.count({ where }),
    ]);
    return { data, total };
  }

  async findById(id: string, userId?: string) {
    return prisma.legalAnnouncement.findUnique({
      where: { id },
      include: {
        ...announcementInclude,
        ...(userId
          ? {
              acks: {
                where: { userId },
                select: { userId: true, ackedAt: true },
              },
            }
          : {}),
        _count: { select: { acks: true } },
      },
    });
  }

  async create(
    data: Omit<Prisma.LegalAnnouncementUncheckedCreateInput, "attachments"> & {
      attachments?: Array<{ fileUrl: string; fileName: string }>;
    },
  ) {
    const { attachments, ...rest } = data;
    return prisma.legalAnnouncement.create({
      data: {
        ...rest,
        attachments: attachments?.length ? { create: attachments } : undefined,
      },
      include: { ...announcementInclude, _count: { select: { acks: true } } },
    });
  }

  async update(
    id: string,
    data: Omit<Prisma.LegalAnnouncementUncheckedUpdateInput, "attachments"> & {
      attachments?: Array<{ fileUrl: string; fileName: string }> | null;
    },
  ) {
    const { attachments, ...rest } = data;
    // Diff-replace attachments: callers send the final list, we wipe
    // and re-insert. Keeps the API simple (no separate add/remove
    // endpoints) at the cost of a couple of extra inserts on edit.
    return prisma.$transaction(async (tx) => {
      if (attachments !== undefined && attachments !== null) {
        await tx.legalAnnouncementAttachment.deleteMany({
          where: { announcementId: id },
        });
        if (attachments.length > 0) {
          await tx.legalAnnouncementAttachment.createMany({
            data: attachments.map((a) => ({
              announcementId: id,
              fileUrl: a.fileUrl,
              fileName: a.fileName,
            })),
          });
        }
      }
      return tx.legalAnnouncement.update({
        where: { id },
        data: rest,
        include: {
          ...announcementInclude,
          _count: { select: { acks: true } },
        },
      });
    });
  }

  async remove(id: string) {
    return prisma.legalAnnouncement.delete({ where: { id } });
  }

  async ack(announcementId: string, userId: string, ip?: string | null) {
    return prisma.legalAnnouncementAck.upsert({
      where: { announcementId_userId: { announcementId, userId } },
      create: { announcementId, userId, ackedIp: ip ?? undefined },
      update: { ackedIp: ip ?? undefined },
    });
  }

  async listAckers(announcementId: string) {
    return prisma.legalAnnouncementAck.findMany({
      where: { announcementId },
      orderBy: { ackedAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
            entity: { select: { id: true, name: true } },
          },
        },
      },
    });
  }

  // Cheap unread counter for the dashboard banner — only counts items
  // that require an ack, are published, not expired, in scope of the
  // user's entity (or global), and that the user has not acked.
  async countUnackedForUser(userId: string, entityId: string | null) {
    const today = new Date();
    return prisma.legalAnnouncement.count({
      where: {
        status: "published",
        requiresAck: true,
        OR: [{ entityId: null }, ...(entityId ? [{ entityId }] : [])],
        AND: [
          {
            OR: [{ publishedAt: null }, { publishedAt: { lte: today } }],
          },
          {
            OR: [{ expiresAt: null }, { expiresAt: { gte: today } }],
          },
        ],
        acks: { none: { userId } },
      },
    });
  }
}

function buildWhere(
  filters: AnnouncementFilters,
): Prisma.LegalAnnouncementWhereInput {
  const where: Prisma.LegalAnnouncementWhereInput = {};
  if (filters.status) where.status = filters.status;
  if (filters.kind) where.kind = filters.kind;
  if (filters.entityId === null) where.entityId = null;
  else if (filters.entityId) where.entityId = filters.entityId;

  if (filters.scope === "mine") {
    // Employee view: only published items in scope of the user's entity
    // (or global), within the active publish window.
    where.status = "published";
    const today = new Date();
    where.AND = [
      {
        OR: [{ publishedAt: null }, { publishedAt: { lte: today } }],
      },
      {
        OR: [{ expiresAt: null }, { expiresAt: { gte: today } }],
      },
      {
        OR: [
          { entityId: null },
          ...(filters.userEntityId ? [{ entityId: filters.userEntityId }] : []),
        ],
      },
    ];
  }

  if (filters.search) {
    const term = filters.search;
    where.OR = [
      { title: { contains: term, mode: "insensitive" } },
      { body: { contains: term, mode: "insensitive" } },
    ];
  }

  if (filters.unackedOnly && filters.userId) {
    where.requiresAck = true;
    where.acks = { none: { userId: filters.userId } };
  }

  return where;
}

export const legalAnnouncementRepository = new LegalAnnouncementRepository();
