import type { Prisma } from "@manut/database";

import { prisma } from "@/infrastructure/database/prisma";

const authorSelect = {
  id: true,
  name: true,
  avatarUrl: true,
  jobTitle: true,
} as const;

export const newsRepository = {
  async findAll(page: number, limit: number) {
    const [data, total] = await Promise.all([
      prisma.companyNews.findMany({
        include: { author: { select: authorSelect } },
        orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.companyNews.count(),
    ]);
    return { data, total };
  },

  async findById(id: string) {
    return prisma.companyNews.findUnique({
      where: { id },
      include: { author: { select: authorSelect } },
    });
  },

  async update(
    id: string,
    data: {
      title?: string;
      content?: string;
      category?: string;
      isPinned?: boolean;
    },
  ) {
    return prisma.companyNews.update({
      where: { id },
      data,
      include: { author: { select: authorSelect } },
    });
  },

  async create(data: {
    title: string;
    content: string;
    category?: string;
    isPinned: boolean;
    authorId: string;
    attachments?: Prisma.InputJsonValue;
  }) {
    return prisma.companyNews.create({
      data,
      include: { author: { select: authorSelect } },
    });
  },

  async delete(id: string) {
    return prisma.companyNews.delete({ where: { id } });
  },
};
