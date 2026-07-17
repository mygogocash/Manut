import { prisma } from "@/infrastructure/database/prisma";

export const holidaysRepository = {
  async findMany(
    filters: { entityId?: string; year?: number },
    page: number,
    limit: number,
  ) {
    const where: {
      entityId?: string;
      date?: { gte: Date; lt: Date };
    } = {};
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.year) {
      where.date = {
        gte: new Date(Date.UTC(filters.year, 0, 1)),
        lt: new Date(Date.UTC(filters.year + 1, 0, 1)),
      };
    }
    const [data, total] = await Promise.all([
      prisma.publicHoliday.findMany({
        where,
        include: { entity: { select: { id: true, name: true, code: true } } },
        orderBy: { date: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.publicHoliday.count({ where }),
    ]);
    return { data, total };
  },

  async findById(id: string) {
    return prisma.publicHoliday.findUnique({
      where: { id },
      include: { entity: { select: { id: true, name: true, code: true } } },
    });
  },

  async create(input: {
    entityId: string;
    date: Date;
    name: string;
    notes?: string | null;
    isActive: boolean;
  }) {
    return prisma.publicHoliday.create({
      data: input,
      include: { entity: { select: { id: true, name: true, code: true } } },
    });
  },

  async update(
    id: string,
    input: {
      date?: Date;
      name?: string;
      notes?: string | null;
      isActive?: boolean;
    },
  ) {
    return prisma.publicHoliday.update({
      where: { id },
      data: input,
      include: { entity: { select: { id: true, name: true, code: true } } },
    });
  },

  async delete(id: string) {
    return prisma.publicHoliday.delete({ where: { id } });
  },
};
