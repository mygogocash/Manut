import type { Prisma } from "@manut/database";

import { prisma } from "@/infrastructure/database/prisma";

const accountInclude = {
  owner: { select: { id: true, name: true, email: true } },
  _count: { select: { contacts: true } },
} satisfies Prisma.InvestorAccountInclude;

export interface ListInvestorAccountsFilters {
  search?: string;
  region?: string;
  ownerId?: string;
  ownerScope?: string[];
}

export class InvestorAccountRepository {
  async findMany(
    filters: ListInvestorAccountsFilters,
    page: number,
    limit: number,
  ) {
    const where: Prisma.InvestorAccountWhereInput = {};

    if (filters.region) where.region = filters.region;
    if (filters.ownerId) where.ownerId = filters.ownerId;
    if (filters.ownerScope) where.ownerId = { in: filters.ownerScope };
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { location: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.investorAccount.findMany({
        where,
        include: accountInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.investorAccount.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string) {
    return prisma.investorAccount.findUnique({
      where: { id },
      include: accountInclude,
    });
  }

  async create(data: Prisma.InvestorAccountCreateInput) {
    return prisma.investorAccount.create({ data, include: accountInclude });
  }

  async update(id: string, data: Prisma.InvestorAccountUpdateInput) {
    return prisma.investorAccount.update({
      where: { id },
      data,
      include: accountInclude,
    });
  }

  async delete(id: string) {
    return prisma.investorAccount.delete({ where: { id } });
  }
}

export const investorAccountRepository = new InvestorAccountRepository();
