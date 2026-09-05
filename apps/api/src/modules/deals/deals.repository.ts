import type { Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";

const dealInclude = {
  owner: { select: { id: true, name: true, email: true } },
  partner: { select: { id: true, company: true } },
} satisfies Prisma.DealInclude;

export interface ListDealsFilters {
  search?: string;
  stage?: string;
  type?: string;
  ownerId?: string;
  // Caller-set scope: when undefined, return all matching rows; when
  // set, restrict to rows owned by one of these user ids. Used by the
  // service layer to enforce "own records only" without `crm:team-read`
  // — same shape as `LeadRepository.ListLeadsFilters.ownerScope`.
  ownerScope?: string[];
}

export class DealRepository {
  async findMany(filters: ListDealsFilters, page: number, limit: number) {
    const where: Prisma.DealWhereInput = {};

    if (filters.search) {
      where.company = { contains: filters.search, mode: "insensitive" };
    }
    if (filters.stage) where.stage = filters.stage;
    if (filters.type) where.type = filters.type;
    if (filters.ownerId) where.ownerId = filters.ownerId;
    if (filters.ownerScope) where.ownerId = { in: filters.ownerScope };

    const [data, total] = await Promise.all([
      prisma.deal.findMany({
        where,
        include: dealInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.deal.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string) {
    return prisma.deal.findUnique({
      where: { id },
      include: dealInclude,
    });
  }

  async create(data: Prisma.DealCreateInput) {
    return prisma.deal.create({ data, include: dealInclude });
  }

  async update(id: string, data: Prisma.DealUpdateInput) {
    return prisma.deal.update({ where: { id }, data, include: dealInclude });
  }

  async delete(id: string) {
    return prisma.deal.delete({ where: { id } });
  }

  async pipelineSummary(ownerScope?: string[]) {
    const result = await prisma.deal.groupBy({
      by: ["stage"],
      _count: { id: true },
      _sum: { value: true },
      where: ownerScope ? { ownerId: { in: ownerScope } } : undefined,
    });

    return result.map((row) => ({
      stage: row.stage,
      count: row._count.id,
      totalValue: Number(row._sum.value ?? 0),
    }));
  }
}

export const dealRepository = new DealRepository();
