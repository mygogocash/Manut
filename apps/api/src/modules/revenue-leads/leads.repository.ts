import type { Prisma } from "@manut/database";

import { prisma } from "@/infrastructure/database/prisma";

const leadInclude = {
  owner: { select: { id: true, name: true, email: true } },
  convertedOpportunity: { select: { id: true, name: true, stage: true } },
} satisfies Prisma.RevenueLeadInclude;

export interface ListLeadsFilters {
  search?: string;
  status?: string;
  source?: string;
  ownerId?: string;
  // Caller-set scope: when undefined, return all matching rows; when set, restrict
  // to rows owned by one of these user ids. Used by the service layer to enforce
  // Owner-only records without crm:team-read.
  ownerScope?: string[];
}

export interface ListStaleLeadsFilters {
  search?: string;
  ownerId?: string;
  ownerScope?: string[];
  // Cutoff date — rows older than this with no recent activity surface as
  // stale. The service computes `now - STALE_LEAD_DAYS` and passes it in.
  cutoff: Date;
}

export class LeadRepository {
  async findMany(filters: ListLeadsFilters, page: number, limit: number) {
    const where: Prisma.RevenueLeadWhereInput = {};

    if (filters.search) {
      where.OR = [
        { company: { contains: filters.search, mode: "insensitive" } },
        { firstName: { contains: filters.search, mode: "insensitive" } },
        { lastName: { contains: filters.search, mode: "insensitive" } },
        { email: { contains: filters.search, mode: "insensitive" } },
      ];
    }
    if (filters.status) where.status = filters.status;
    if (filters.source) where.source = filters.source;
    if (filters.ownerId) where.ownerId = filters.ownerId;
    if (filters.ownerScope) where.ownerId = { in: filters.ownerScope };

    const [data, total] = await Promise.all([
      prisma.revenueLead.findMany({
        where,
        include: leadInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.revenueLead.count({ where }),
    ]);

    return { data, total };
  }

  // Stale = status ∈ {new, contacted} AND created at least
  // STALE_LEAD_DAYS ago AND no activity in that window. We use a relation
  // filter (`activities: { none }`) instead of a join + max(occurredAt) so
  // Prisma compiles to a single EXISTS sub-select.
  async findStale(filters: ListStaleLeadsFilters, page: number, limit: number) {
    const where: Prisma.RevenueLeadWhereInput = {
      status: { in: ["new", "contacted"] },
      createdAt: { lt: filters.cutoff },
      activities: { none: { occurredAt: { gte: filters.cutoff } } },
    };

    if (filters.search) {
      where.OR = [
        { company: { contains: filters.search, mode: "insensitive" } },
        { firstName: { contains: filters.search, mode: "insensitive" } },
        { lastName: { contains: filters.search, mode: "insensitive" } },
        { email: { contains: filters.search, mode: "insensitive" } },
      ];
    }
    if (filters.ownerId) where.ownerId = filters.ownerId;
    if (filters.ownerScope) where.ownerId = { in: filters.ownerScope };

    const [data, total] = await Promise.all([
      prisma.revenueLead.findMany({
        where,
        include: leadInclude,
        // Oldest first — the rep should triage the most-aged row at the top.
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.revenueLead.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string) {
    return prisma.revenueLead.findUnique({
      where: { id },
      include: leadInclude,
    });
  }

  async create(data: Prisma.RevenueLeadCreateInput) {
    return prisma.revenueLead.create({ data, include: leadInclude });
  }

  async update(id: string, data: Prisma.RevenueLeadUpdateInput) {
    return prisma.revenueLead.update({
      where: { id },
      data,
      include: leadInclude,
    });
  }

  async delete(id: string) {
    return prisma.revenueLead.delete({ where: { id } });
  }
}

export const leadRepository = new LeadRepository();
