import type { Prisma } from "@manut/database";

import { prisma } from "@/infrastructure/database/prisma";

export class BlogsRepository {
  async findAll(params?: { search?: string; page?: number; limit?: number }) {
    const { search, page = 1, limit = 20 } = params ?? {};
    const skip = (page - 1) * limit;

    const where: Prisma.BlogWhereInput = search
      ? { title: { contains: search, mode: "insensitive" } }
      : {};

    return Promise.all([
      prisma.blog.findMany({
        where,
        include: { author: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.blog.count({ where }),
    ]);
  }

  async findAllForExport(search?: string) {
    const where: Prisma.BlogWhereInput = search
      ? { title: { contains: search, mode: "insensitive" } }
      : {};

    return prisma.blog.findMany({
      where,
      include: { author: { select: { id: true, name: true } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async findById(id: string) {
    return prisma.blog.findUnique({
      where: { id },
      include: { author: { select: { id: true, name: true } } },
    });
  }

  async create(data: Prisma.BlogCreateInput) {
    return prisma.blog.create({
      data,
      include: { author: { select: { id: true, name: true } } },
    });
  }

  async update(id: string, data: Prisma.BlogUpdateInput) {
    return prisma.blog.update({
      where: { id },
      data,
      include: { author: { select: { id: true, name: true } } },
    });
  }

  async delete(id: string) {
    return prisma.blog.delete({ where: { id } });
  }
}

export const blogsRepository = new BlogsRepository();
