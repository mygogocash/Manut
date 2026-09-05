import type { Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";

const adderSelect = { id: true, name: true, avatarUrl: true } as const;

export const companyDatesRepository = {
  async findUpcoming(page: number, limit: number) {
    const now = new Date();
    const [data, total] = await Promise.all([
      prisma.companyDate.findMany({
        where: { date: { gte: now } },
        include: { adder: { select: adderSelect } },
        orderBy: { date: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.companyDate.count({ where: { date: { gte: now } } }),
    ]);
    return { data, total };
  },

  async findById(id: string) {
    return prisma.companyDate.findUnique({
      where: { id },
      include: { adder: { select: adderSelect } },
    });
  },

  async update(
    id: string,
    data: {
      title?: string;
      date?: Date;
      type?: string;
      location?: string;
    },
  ) {
    return prisma.companyDate.update({
      where: { id },
      data,
      include: { adder: { select: adderSelect } },
    });
  },

  async create(data: {
    title: string;
    date: Date;
    type: string;
    location?: string;
    addedBy: string;
    attachments?: Prisma.InputJsonValue;
  }) {
    return prisma.companyDate.create({
      data,
      include: { adder: { select: adderSelect } },
    });
  },

  async delete(id: string) {
    return prisma.companyDate.delete({ where: { id } });
  },
};
