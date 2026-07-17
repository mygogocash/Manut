import type { Prisma } from "@manut/database";

import { prisma } from "@/infrastructure/database/prisma";

const contactInclude = {
  account: {
    select: { id: true, name: true, ownerId: true },
  },
} satisfies Prisma.RevenueContactInclude;

export interface ListContactsFilters {
  search?: string;
  accountId?: string;
  // Restrict to contacts whose Account.ownerId is in this set. Used by the
  // service to enforce account ownership scope.
  accountOwnerScope?: string[];
}

export class ContactRepository {
  async findMany(filters: ListContactsFilters, page: number, limit: number) {
    const where: Prisma.RevenueContactWhereInput = {};

    if (filters.search) {
      where.OR = [
        { firstName: { contains: filters.search, mode: "insensitive" } },
        { lastName: { contains: filters.search, mode: "insensitive" } },
        { email: { contains: filters.search, mode: "insensitive" } },
      ];
    }
    if (filters.accountId) where.accountId = filters.accountId;
    if (filters.accountOwnerScope) {
      where.account = { ownerId: { in: filters.accountOwnerScope } };
    }

    const [data, total] = await Promise.all([
      prisma.revenueContact.findMany({
        where,
        include: contactInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.revenueContact.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string) {
    return prisma.revenueContact.findUnique({
      where: { id },
      include: contactInclude,
    });
  }

  async countForAccount(accountId: string) {
    return prisma.revenueContact.count({ where: { accountId } });
  }

  async create(data: Prisma.RevenueContactCreateInput) {
    return prisma.revenueContact.create({ data, include: contactInclude });
  }

  async update(id: string, data: Prisma.RevenueContactUpdateInput) {
    return prisma.revenueContact.update({
      where: { id },
      data,
      include: contactInclude,
    });
  }

  // Demote every other contact on the same account so only one row carries
  // is_primary = true. Run inside the same transaction as the promote.
  async clearPrimaryForAccount(
    tx: Prisma.TransactionClient,
    accountId: string,
    keepContactId: string,
  ) {
    return tx.revenueContact.updateMany({
      where: { accountId, id: { not: keepContactId }, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  async delete(id: string) {
    return prisma.revenueContact.delete({ where: { id } });
  }
}

export const contactRepository = new ContactRepository();
