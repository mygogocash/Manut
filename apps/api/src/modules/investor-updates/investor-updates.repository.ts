import type { Prisma } from "@manut/database";

import { prisma } from "@/infrastructure/database/prisma";

const senderSelect = {
  sender: { select: { id: true, name: true, email: true } },
} satisfies Prisma.InvestorUpdateInclude;

export class InvestorUpdateRepository {
  async findMany(filters: { status?: string }, page: number, limit: number) {
    const where: Prisma.InvestorUpdateWhereInput = {};

    if (filters.status) where.status = filters.status;

    const [data, total] = await Promise.all([
      prisma.investorUpdate.findMany({
        where,
        include: senderSelect,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.investorUpdate.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string) {
    return prisma.investorUpdate.findUnique({
      where: { id },
      include: senderSelect,
    });
  }

  async create(data: Prisma.InvestorUpdateCreateInput) {
    return prisma.investorUpdate.create({ data, include: senderSelect });
  }

  async update(id: string, data: Prisma.InvestorUpdateUpdateInput) {
    return prisma.investorUpdate.update({
      where: { id },
      data,
      include: senderSelect,
    });
  }

  async delete(id: string) {
    return prisma.investorUpdate.delete({ where: { id } });
  }

  async markAsSent(id: string, sentBy: string) {
    return prisma.investorUpdate.update({
      where: { id },
      data: {
        status: "sent",
        sentAt: new Date(),
        sender: { connect: { id: sentBy } },
      },
      include: senderSelect,
    });
  }

  async getInvestorCount() {
    return prisma.investor.count();
  }
}

export const investorUpdateRepository = new InvestorUpdateRepository();
