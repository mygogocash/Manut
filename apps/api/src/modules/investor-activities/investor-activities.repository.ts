import type { Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";

const activityInclude = {
  owner: { select: { id: true, name: true, email: true } },
  investor: { select: { id: true, name: true } },
} satisfies Prisma.InvestorActivityInclude;

export interface ListInvestorActivitiesFilters {
  type?: string;
  investorId?: string;
  ownerId?: string;
  ownerScope?: string[];
  fundraisingEntity?: string;
}

export class InvestorActivityRepository {
  async findMany(
    filters: ListInvestorActivitiesFilters,
    page: number,
    limit: number,
  ) {
    const where: Prisma.InvestorActivityWhereInput = {};

    if (filters.type) where.type = filters.type;
    if (filters.investorId) where.investorId = filters.investorId;
    if (filters.ownerId) where.ownerId = filters.ownerId;
    if (filters.ownerScope) where.ownerId = { in: filters.ownerScope };
    if (filters.fundraisingEntity) {
      where.investor = { fundraisingEntity: filters.fundraisingEntity };
    }

    const [data, total] = await Promise.all([
      prisma.investorActivity.findMany({
        where,
        include: activityInclude,
        orderBy: [{ occurredAt: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.investorActivity.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string) {
    return prisma.investorActivity.findUnique({
      where: { id },
      include: activityInclude,
    });
  }

  async create(data: Prisma.InvestorActivityCreateInput) {
    return prisma.investorActivity.create({ data, include: activityInclude });
  }

  async update(id: string, data: Prisma.InvestorActivityUpdateInput) {
    return prisma.investorActivity.update({
      where: { id },
      data,
      include: activityInclude,
    });
  }

  async delete(id: string) {
    return prisma.investorActivity.delete({ where: { id } });
  }
}

export const investorActivityRepository = new InvestorActivityRepository();
