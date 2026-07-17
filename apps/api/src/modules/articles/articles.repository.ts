import type { Prisma } from "@manut/database";

import { prisma } from "@/infrastructure/database/prisma";

export class ArticlesRepository {
  async findAll(params?: { search?: string; page?: number; limit?: number }) {
    const { search, page = 1, limit = 20 } = params ?? {};
    const skip = (page - 1) * limit;

    const where: Prisma.ArticleWhereInput = search
      ? { title: { contains: search, mode: "insensitive" } }
      : {};

    return Promise.all([
      prisma.article.findMany({
        where,
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.article.count({ where }),
    ]);
  }

  async findAllForExport(search?: string) {
    const where: Prisma.ArticleWhereInput = search
      ? { title: { contains: search, mode: "insensitive" } }
      : {};

    return prisma.article.findMany({
      where,
      include: { author: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: string) {
    return prisma.article.findUnique({
      where: { id },
      include: { author: { select: { id: true, name: true } } },
    });
  }

  async create(data: Prisma.ArticleCreateInput) {
    return prisma.article.create({
      data,
      include: { author: { select: { id: true, name: true } } },
    });
  }

  async update(id: string, data: Prisma.ArticleUpdateInput) {
    return prisma.article.update({
      where: { id },
      data,
      include: { author: { select: { id: true, name: true } } },
    });
  }

  async delete(id: string) {
    return prisma.article.delete({ where: { id } });
  }
}

export const articlesRepository = new ArticlesRepository();
