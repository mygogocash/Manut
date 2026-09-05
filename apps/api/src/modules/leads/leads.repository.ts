import type { Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";
import { BUSINESS_UNIT_UNASSIGNED } from "@/modules/business-units/business-units.validation";

const leadInclude = {
  owner: { select: { id: true, name: true, email: true } },
  convertedOpportunity: { select: { id: true, name: true, stage: true } },
} satisfies Prisma.LeadInclude;

export interface ListLeadsFilters {
  search?: string;
  status?: string;
  source?: string;
  ownerId?: string;
  // Archived view toggle. false/undefined → active rows (archivedAt IS NULL);
  // true → archived rows (archivedAt IS NOT NULL).
  archived?: boolean;
  // Caller-set scope: when undefined, return all matching rows; when set, restrict
  // to rows owned by one of these user ids. Used by the service layer to enforce
  // PRD §7 ("own records only" without crm:team-read).
  ownerScope?: string[];
  // Business-unit tag filter. A code matches records carrying it;
  // BUSINESS_UNIT_UNASSIGNED matches untagged records.
  businessUnit?: string;
}

export interface ListStaleLeadsFilters {
  search?: string;
  ownerId?: string;
  ownerScope?: string[];
  // Cutoff date — rows older than this with no recent activity surface as
  // stale. The service computes `now - STALE_LEAD_DAYS` and passes it in.
  cutoff: Date;
}

/**
 * The list `where`, extracted so the bulk select-and-act path can resolve
 * "all matching" through the SAME predicate the page renders. See
 * `buildAccountWhere` / `buildOpportunityWhere` for the same reasoning.
 */
export function buildLeadWhere(
  filters: ListLeadsFilters,
): Prisma.LeadWhereInput {
  const where: Prisma.LeadWhereInput = {};

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
  // Business-unit tag. Containment for a code, emptiness for the
  // "Unassigned" view. Set on the shared `where` so findMany + count
  // agree — a mismatch would show a total the page can never reach.
  if (filters.businessUnit === BUSINESS_UNIT_UNASSIGNED) {
    where.businessUnits = { isEmpty: true };
  } else if (filters.businessUnit) {
    where.businessUnits = { has: filters.businessUnit };
  }

  // Shared by findMany + count below — default view hides archived rows.
  where.archivedAt = filters.archived ? { not: null } : null;

  return where;
}

export class LeadRepository {
  /**
   * Ids + current tags for a bulk business-unit action.
   *
   * Selected by the caller's resolved `where` (which already carries owner
   * scope), and capped: a bulk write walks rows one at a time so the caller
   * can reuse the single-record service path, and an unbounded "select all
   * matching" would otherwise time the request out. Over the cap the service
   * refuses and asks the user to narrow the filter, rather than silently
   * acting on a prefix.
   */
  /**
   * Ids + the fields a bulk field-set needs to decide whether a write is
   * necessary. Same cap-and-refuse contract as `findIdsAndUnits`.
   */
  async findIdsForFieldSet(
    where: Prisma.LeadWhereInput,
    take: number,
  ): Promise<
    Array<{
      id: string;
      ownerId: string;
      archivedAt: Date | null;
      status: string;
    }>
  > {
    return prisma.lead.findMany({
      where,
      select: { id: true, ownerId: true, archivedAt: true, status: true },
      take,
    });
  }

  async findIdsAndUnits(
    where: Prisma.LeadWhereInput,
    take: number,
  ): Promise<Array<{ id: string; businessUnits: string[] }>> {
    return prisma.lead.findMany({
      where,
      select: { id: true, businessUnits: true },
      take,
    });
  }

  async findMany(filters: ListLeadsFilters, page: number, limit: number) {
    const where = buildLeadWhere(filters);

    const [data, total] = await Promise.all([
      prisma.lead.findMany({
        where,
        include: leadInclude,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.lead.count({ where }),
    ]);

    return { data, total };
  }

  // PRD §11.3 — stale = status ∈ {new, contacted} AND created at least
  // STALE_LEAD_DAYS ago AND no activity in that window. We use a relation
  // filter (`activities: { none }`) instead of a join + max(occurredAt) so
  // Prisma compiles to a single EXISTS sub-select.
  async findStale(filters: ListStaleLeadsFilters, page: number, limit: number) {
    const where: Prisma.LeadWhereInput = {
      status: { in: ["new", "contacted"] },
      createdAt: { lt: filters.cutoff },
      activities: { none: { occurredAt: { gte: filters.cutoff } } },
      // Archived leads are parked, not awaiting follow-up — keep them out of
      // the stale "needs follow-up" surface.
      archivedAt: null,
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
      prisma.lead.findMany({
        where,
        include: leadInclude,
        // Oldest first — the rep should triage the most-aged row at the top.
        orderBy: { createdAt: "asc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.lead.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string) {
    return prisma.lead.findUnique({
      where: { id },
      include: leadInclude,
    });
  }

  async create(data: Prisma.LeadCreateInput) {
    return prisma.lead.create({ data, include: leadInclude });
  }

  async update(id: string, data: Prisma.LeadUpdateInput) {
    return prisma.lead.update({ where: { id }, data, include: leadInclude });
  }

  async delete(id: string) {
    return prisma.lead.delete({ where: { id } });
  }
}

export const leadRepository = new LeadRepository();
