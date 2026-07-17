import type { Prisma } from "@manut/database";

import { prisma } from "@/infrastructure/database/prisma";

const uploaderSelect = {
  uploader: { select: { id: true, name: true, email: true } },
} satisfies Prisma.DataRoomDocumentInclude;

export class DataRoomRepository {
  async findMany(
    filters: { category?: string; search?: string },
    page: number,
    limit: number,
  ) {
    const where: Prisma.DataRoomDocumentWhereInput = {};

    if (filters.search) {
      where.name = { contains: filters.search, mode: "insensitive" };
    }
    if (filters.category) where.category = filters.category;

    const [data, total] = await Promise.all([
      prisma.dataRoomDocument.findMany({
        where,
        include: uploaderSelect,
        orderBy: { uploadedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.dataRoomDocument.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string) {
    return prisma.dataRoomDocument.findUnique({
      where: { id },
      include: uploaderSelect,
    });
  }

  async create(data: Prisma.DataRoomDocumentCreateInput) {
    return prisma.dataRoomDocument.create({ data, include: uploaderSelect });
  }

  async update(id: string, data: Prisma.DataRoomDocumentUpdateInput) {
    return prisma.dataRoomDocument.update({
      where: { id },
      data,
      include: uploaderSelect,
    });
  }

  async delete(id: string) {
    return prisma.dataRoomDocument.delete({ where: { id } });
  }

  async getCategorySummary() {
    const result = await prisma.dataRoomDocument.groupBy({
      by: ["category"],
      _count: { id: true },
      _sum: { fileSize: true },
    });

    return result.map((row) => ({
      category: row.category,
      count: row._count.id,
      totalSize: Number(row._sum.fileSize ?? 0),
    }));
  }
}

export const dataRoomRepository = new DataRoomRepository();
