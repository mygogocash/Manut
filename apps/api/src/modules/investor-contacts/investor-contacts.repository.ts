import type { Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";

const contactInclude = {
  owner: { select: { id: true, name: true, email: true } },
  account: { select: { id: true, name: true } },
} satisfies Prisma.InvestorContactInclude;

export interface ListInvestorContactsFilters {
  search?: string;
  accountId?: string;
  ownerId?: string;
  // Archived view toggle. false/undefined → active rows (archivedAt IS NULL);
  // true → archived rows (archivedAt IS NOT NULL).
  archived?: boolean;
  ownerScope?: string[];
  fundraisingEntity?: string;
}

export class InvestorContactRepository {
  async findMany(
    filters: ListInvestorContactsFilters,
    page: number,
    limit: number,
  ) {
    const where: Prisma.InvestorContactWhereInput = {};

    if (filters.accountId) where.accountId = filters.accountId;
    if (filters.ownerId) where.ownerId = filters.ownerId;
    if (filters.ownerScope) where.ownerId = { in: filters.ownerScope };
    if (filters.fundraisingEntity) {
      where.fundraisingEntity = filters.fundraisingEntity;
    }
    // Shared by findMany + count below — default view hides archived rows.
    where.archivedAt = filters.archived ? { not: null } : null;
    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: "insensitive" } },
        { lastName: { contains: filters.search, mode: "insensitive" } },
        { email: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.investorContact.findMany({
        where,
        include: contactInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.investorContact.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string) {
    return prisma.investorContact.findUnique({
      where: { id },
      include: contactInclude,
    });
  }

  async create(data: Prisma.InvestorContactCreateInput) {
    return prisma.investorContact.create({ data, include: contactInclude });
  }

  async update(id: string, data: Prisma.InvestorContactUpdateInput) {
    return prisma.investorContact.update({
      where: { id },
      data,
      include: contactInclude,
    });
  }

  async delete(id: string) {
    return prisma.investorContact.delete({ where: { id } });
  }
}

export const investorContactRepository = new InvestorContactRepository();
