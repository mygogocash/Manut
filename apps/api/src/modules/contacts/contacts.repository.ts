import type { Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";

const contactInclude = {
  account: {
    select: { id: true, name: true, ownerId: true },
  },
} satisfies Prisma.ContactInclude;

export interface ListContactsFilters {
  search?: string;
  accountId?: string;
  // Restrict to contacts whose Account.ownerId is in this set. Used by the
  // service to enforce PRD §7 ownership scope.
  accountOwnerScope?: string[];
  // true = archived rows only; false/undefined = active rows only.
  archived?: boolean;
}

export class ContactRepository {
  async findMany(filters: ListContactsFilters, page: number, limit: number) {
    const where: Prisma.ContactWhereInput = {};

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
    // Default (active) view excludes archived rows; the Archived tab flips it.
    where.archivedAt = filters.archived ? { not: null } : null;

    const [data, total] = await Promise.all([
      prisma.contact.findMany({
        where,
        include: contactInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.contact.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string) {
    return prisma.contact.findUnique({
      where: { id },
      include: contactInclude,
    });
  }

  async countForAccount(accountId: string) {
    return prisma.contact.count({ where: { accountId } });
  }

  async create(data: Prisma.ContactCreateInput) {
    return prisma.contact.create({ data, include: contactInclude });
  }

  async update(id: string, data: Prisma.ContactUpdateInput) {
    return prisma.contact.update({
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
    return tx.contact.updateMany({
      where: { accountId, id: { not: keepContactId }, isPrimary: true },
      data: { isPrimary: false },
    });
  }

  async delete(id: string) {
    return prisma.contact.delete({ where: { id } });
  }
}

export const contactRepository = new ContactRepository();
