import type { Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";
import { BUSINESS_UNIT_UNASSIGNED } from "@/modules/business-units/business-units.validation";

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
  // BD-feedback — narrow to accounts that have at least one
  // opportunity at this stage. Uses Prisma `some` rather than `every`
  // so a single qualifying deal is enough.
  stage?: string;
  // Archive view toggle. Falsy → active only (archivedAt = null); true →
  // archived only (archivedAt not null). Applied to the shared `where` so
  // findMany + count stay in sync.
  archived?: boolean;
  // Business-unit tag filter. A code matches records carrying it;
  // BUSINESS_UNIT_UNASSIGNED matches untagged records.
  businessUnit?: string;
}

/**
 * The list `where`, extracted so the bulk select-and-act path can resolve
 * "all matching" through the SAME predicate the page renders.
 *
 * Exported for exactly the reason `buildOpportunityWhere` is: if the bulk
 * endpoint rebuilt this filter itself the two could drift, and a bulk action
 * would then hit rows the user never saw. Mirrors `buildInvestorWhere`.
 */
export function buildAccountWhere(
  filters: ListAccountsFilters,
): Prisma.AccountWhereInput {
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
  // Business-unit tag. Containment for a code, emptiness for the
  // "Unassigned" view. Set on the shared `where` so findMany + count
  // agree — a mismatch would show a total the page can never reach.
  if (filters.businessUnit === BUSINESS_UNIT_UNASSIGNED) {
    where.businessUnits = { isEmpty: true };
  } else if (filters.businessUnit) {
    where.businessUnits = { has: filters.businessUnit };
  }

  // Archive filter always wins — set last so the default (archived falsy)
  // pins the list to active rows (archivedAt = null).
  where.archivedAt = filters.archived ? { not: null } : null;

  return where;
}

export class AccountRepository {
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
    where: Prisma.AccountWhereInput,
    take: number,
  ): Promise<Array<{ id: string; ownerId: string; archivedAt: Date | null }>> {
    return prisma.account.findMany({
      where,
      select: { id: true, ownerId: true, archivedAt: true },
      take,
    });
  }

  async findIdsAndUnits(
    where: Prisma.AccountWhereInput,
    take: number,
  ): Promise<Array<{ id: string; businessUnits: string[] }>> {
    return prisma.account.findMany({
      where,
      select: { id: true, businessUnits: true },
      take,
    });
  }

  async findMany(filters: ListAccountsFilters, page: number, limit: number) {
    const where = buildAccountWhere(filters);

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

  // Case-insensitive name match for §11.2 fallback. Returns the first
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
