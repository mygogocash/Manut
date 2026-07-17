import type { Prisma } from "@manut/database";

import { prisma } from "@/infrastructure/database/prisma";

const leadInclude = {
  owner: { select: { id: true, name: true, email: true } },
} satisfies Prisma.InvestorLeadInclude;

export interface ListInvestorLeadsFilters {
  status?: string;
  search?: string;
  ownerId?: string;
  ownerScope?: string[];
}

export class InvestorLeadRepository {
  async findMany(
    filters: ListInvestorLeadsFilters,
    page: number,
    limit: number,
  ) {
    const where: Prisma.InvestorLeadWhereInput = {};

    if (filters.status) where.status = filters.status;
    if (filters.ownerId) where.ownerId = filters.ownerId;
    if (filters.ownerScope) where.ownerId = { in: filters.ownerScope };
    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { company: { contains: filters.search, mode: "insensitive" } },
        { email: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.investorLead.findMany({
        where,
        include: leadInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.investorLead.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string) {
    return prisma.investorLead.findUnique({
      where: { id },
      include: leadInclude,
    });
  }

  async create(data: Prisma.InvestorLeadCreateInput) {
    return prisma.investorLead.create({ data, include: leadInclude });
  }

  async update(id: string, data: Prisma.InvestorLeadUpdateInput) {
    return prisma.investorLead.update({
      where: { id },
      data,
      include: leadInclude,
    });
  }

  async delete(id: string) {
    return prisma.investorLead.delete({ where: { id } });
  }
}

export const investorLeadRepository = new InvestorLeadRepository();
