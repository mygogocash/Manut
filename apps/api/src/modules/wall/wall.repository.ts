import type { Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";

const postInclude = {
  author: { select: { id: true, name: true, avatarUrl: true, jobTitle: true } },
  comments: {
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: { createdAt: "asc" as const },
  },
} satisfies Prisma.WallPostInclude;

export const wallRepository = {
  async findAll(page: number, limit: number) {
    const [data, total] = await Promise.all([
      prisma.wallPost.findMany({
        include: postInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.wallPost.count(),
    ]);
    return { data, total };
  },

  async findById(id: string) {
    return prisma.wallPost.findUnique({ where: { id }, include: postInclude });
  },

  async create(data: {
    authorId: string;
    content: string;
    type: string;
    attachments?: Prisma.InputJsonValue;
  }) {
    return prisma.wallPost.create({ data, include: postInclude });
  },

  async updateReactions(id: string, reactions: Record<string, string[]>) {
    return prisma.wallPost.update({
      where: { id },
      data: { reactions },
      include: postInclude,
    });
  },

  async addComment(data: {
    postId: string;
    authorId: string;
    content: string;
  }) {
    return prisma.wallComment.create({
      data,
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  },

  async update(id: string, data: { content: string }) {
    return prisma.wallPost.update({
      where: { id },
      data,
      include: postInclude,
    });
  },

  async delete(id: string) {
    return prisma.wallPost.delete({ where: { id } });
  },
};
