import type { Prisma } from "@manut/database";

import { prisma } from "@/infrastructure/database/prisma";

const accountInclude = {
  owner: { select: { id: true, name: true, email: true } },
  partner: { select: { id: true, company: true } },
  _count: { select: { contacts: true, opportunities: true } },
  // Surface the most-recently-touched opportunity so the Accounts list
  // can show stage / probability / TCV / launch date inline (BD ask).
  // `take: 1` keeps the payload small; UI reads `[0]`. Extend to `take`
  // larger or expose all if a per-row breakdown is wanted later.
  opportunities: {
    orderBy: { updatedAt: "desc" as const },
    take: 1,
    select: {
      id: true,
      stage: true,
      probability: true,
      value: true,
      currency: true,
      launchDate: true,
      revenueLaunchDate: true,
    },
  },
} satisfies Prisma.AccountInclude;

export interface ListAccountsFilters {
  search?: string;
  industry?: string;
  country?: string;
  region?: string;
  ownerId?: string;
  partnerId?: string;
  ownerScope?: string[];
  // Narrow to accounts that have at least one
  // opportunity at this stage. Uses Prisma `some` rather than `every`
  // so a single qualifying deal is enough.
  stage?: string;
}

export class AccountRepository {
  async findMany(filters: ListAccountsFilters, page: number, limit: number) {
    const where: Prisma.AccountWhereInput = {};

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        { domain: { contains: filters.search, mode: "insensitive" } },
      ];
    }
    if (filters.industry) where.industry = filters.industry;
    if (filters.country) where.country = filters.country;
    if (filters.region) where.region = filters.region;
    if (filters.ownerId) where.ownerId = filters.ownerId;
    if (filters.partnerId) where.partnerId = filters.partnerId;
    if (filters.ownerScope) where.ownerId = { in: filters.ownerScope };
    if (filters.stage) {
      where.opportunities = { some: { stage: filters.stage } };
    }

    const [data, total] = await Promise.all([
      prisma.account.findMany({
        where,
        include: accountInclude,
        // Manual rep ordering wins; `createdAt desc` is the tie-break
        // so fresh inserts (sortOrder = 0) surface above older zeros.
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.account.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string) {
    return prisma.account.findUnique({
      where: { id },
      include: accountInclude,
    });
  }

  async findByDomain(domain: string) {
    return prisma.account.findUnique({
      where: { domain },
      select: { id: true, name: true, domain: true },
    });
  }

  // Case-insensitive name match for the fallback dedupe path. Returns the first
  // candidate; UI prompts the rep with "Did you mean ...?" and either picks
  // it or retries the create with `confirmCreate: true`.
  async findByNameInsensitive(name: string) {
    return prisma.account.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
      select: { id: true, name: true, domain: true },
    });
  }

  async create(data: Prisma.AccountCreateInput) {
    return prisma.account.create({ data, include: accountInclude });
  }

  async update(id: string, data: Prisma.AccountUpdateInput) {
    return prisma.account.update({
      where: { id },
      data,
      include: accountInclude,
    });
  }

  async delete(id: string) {
    return prisma.account.delete({ where: { id } });
  }

  async reorder(orderedIds: string[]) {
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.account.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
  }

  async findIdsByOwner(ids: string[], ownerId: string) {
    return prisma.account.findMany({
      where: { id: { in: ids }, ownerId },
      select: { id: true },
    });
  }
}

export const accountRepository = new AccountRepository();
