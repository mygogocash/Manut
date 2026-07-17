import type { Prisma } from "@manut/database";

import { prisma } from "@/infrastructure/database/prisma";

const opportunityInclude = {
  account: {
    select: {
      id: true,
      name: true,
      ownerId: true,
      country: true,
      region: true,
    },
  },
  contact: { select: { id: true, firstName: true, lastName: true } },
  owner: { select: { id: true, name: true, email: true } },
} satisfies Prisma.RevenueOpportunityInclude;

export interface ListOpportunitiesFilters {
  search?: string;
  stage?: string;
  accountId?: string;
  ownerId?: string;
  ownerScope?: string[];
  country?: string;
  region?: string;
}

export class OpportunityRepository {
  async findMany(
    filters: ListOpportunitiesFilters,
    page: number,
    limit: number,
  ) {
    const where: Prisma.RevenueOpportunityWhereInput = {};

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search, mode: "insensitive" } },
        {
          account: {
            name: { contains: filters.search, mode: "insensitive" },
          },
        },
      ];
    }
    if (filters.stage) where.stage = filters.stage;
    if (filters.accountId) where.accountId = filters.accountId;
    if (filters.ownerId) where.ownerId = filters.ownerId;
    if (filters.ownerScope) where.ownerId = { in: filters.ownerScope };

    // Geographic filters resolve through the
    // related account. Multiple account-filter keys merge into a single
    // nested `account` where so Prisma issues one join, not several.
    if (filters.country || filters.region) {
      where.account = {
        ...(filters.country && { country: filters.country }),
        ...(filters.region && { region: filters.region }),
      };
    }

    const [data, total] = await Promise.all([
      prisma.revenueOpportunity.findMany({
        where,
        include: opportunityInclude,
        // Manual within-column order first (lower = higher up); newest
        // first within a tie so freshly-created cards surface at the top.
        orderBy: [{ sortOrderWithinStage: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.revenueOpportunity.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string) {
    return prisma.revenueOpportunity.findUnique({
      where: { id },
      include: opportunityInclude,
    });
  }

  /** Latest opportunity on an account — used for account ↔ pipeline sync. */
  async findLatestByAccountId(accountId: string) {
    return prisma.revenueOpportunity.findFirst({
      where: { accountId },
      orderBy: { updatedAt: "desc" },
      include: opportunityInclude,
    });
  }

  async create(data: Prisma.RevenueOpportunityCreateInput) {
    return prisma.revenueOpportunity.create({
      data,
      include: opportunityInclude,
    });
  }

  async update(id: string, data: Prisma.RevenueOpportunityUpdateInput) {
    return prisma.revenueOpportunity.update({
      where: { id },
      data,
      include: opportunityInclude,
    });
  }

  async delete(id: string) {
    return prisma.revenueOpportunity.delete({ where: { id } });
  }

  // Slim fetch for reorder validation — just the fields needed to confirm
  // each id exists, sits in the expected stage, and is in the owner scope.
  // When `ownerId` is supplied (owner-scoped caller), foreign rows simply
  // don't match — so a foreign id is indistinguishable from a missing one
  // (no existence/ownership oracle), per the investors bulk-action rule.
  async findManyByIds(ids: string[], ownerId?: string) {
    return prisma.revenueOpportunity.findMany({
      where: { id: { in: ids }, ...(ownerId ? { ownerId } : {}) },
      select: { id: true, stage: true, ownerId: true },
    });
  }

  // Every opportunity id in a stage, in current display order. Owner-scoped
  // when `ownerId` is set. Used to renumber the WHOLE stage on a reorder so a
  // partially-loaded column can't leave un-loaded rows colliding at 0.
  async listStageIdsOrdered(stage: string, ownerId?: string) {
    const rows = await prisma.revenueOpportunity.findMany({
      where: { stage, ...(ownerId ? { ownerId } : {}) },
      orderBy: [{ sortOrderWithinStage: "asc" }, { createdAt: "desc" }],
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  // Write the manual within-column order for one stage. `orderedIds` is the
  // column top-to-bottom; each row's sortOrderWithinStage becomes its index.
  // No unique constraint on the column, so a single-phase transaction is
  // safe (no negative-park dance needed). Returns the touched count.
  async reorderWithinStage(orderedIds: string[]) {
    await prisma.$transaction(
      orderedIds.map((id, idx) =>
        prisma.revenueOpportunity.update({
          where: { id },
          data: { sortOrderWithinStage: idx },
        }),
      ),
    );
    return orderedIds.length;
  }

  // Slim row set for the cross-currency forecast.
  // Returns one row per opportunity with just the columns the service
  // needs to weight + convert. closed_won / closed_lost rows are
  // excluded so the forecast reflects only active pipeline.
  async forecastRows(scope: { ownerScope?: string[] }) {
    const where: Prisma.RevenueOpportunityWhereInput = {
      // closed_won / closed_lost are terminal; "live" deals are already
      // won (revenue started) so they're excluded from the forward
      // weighted forecast too.
      stage: { notIn: ["closed_won", "closed_lost", "live"] },
    };
    if (scope.ownerScope) where.ownerId = { in: scope.ownerScope };

    return prisma.revenueOpportunity.findMany({
      where,
      select: {
        id: true,
        stage: true,
        currency: true,
        value: true,
        probability: true,
      },
    });
  }

  // Populate the country / region selects
  // on the pipeline view. Returns only distinct non-null values from
  // accounts that currently hold at least one opportunity inside the
  // caller's owner scope, so dead options never show up in the picker.
  async filterOptions(scope: { ownerScope?: string[] }) {
    const where: Prisma.RevenueAccountWhereInput = {
      opportunities: { some: {} },
    };
    if (scope.ownerScope) {
      where.opportunities = {
        some: { ownerId: { in: scope.ownerScope } },
      };
    }

    const rows = await prisma.revenueAccount.findMany({
      where,
      select: { country: true, region: true },
    });

    const countries = Array.from(
      new Set(rows.map((r) => r.country).filter((v): v is string => !!v)),
    ).sort((a, b) => a.localeCompare(b));
    const regions = Array.from(
      new Set(rows.map((r) => r.region).filter((v): v is string => !!v)),
    ).sort((a, b) => a.localeCompare(b));

    return { countries, regions };
  }

  // Flat row set for the Sales CRM dashboard. One row per opportunity
  // joined with its account's geo + reach metrics + engagement type, so
  // the client can compute every exhibit (KPI tiles, stage/industry
  // charts, region×stage matrix, country bars, world map, deal table)
  // from a single owner-scoped fetch. Dataset is small (tens of rows),
  // so we return everything rather than pre-aggregating server-side.
  async dashboardRows(scope: { ownerScope?: string[] }) {
    const where: Prisma.RevenueOpportunityWhereInput = {};
    if (scope.ownerScope) where.ownerId = { in: scope.ownerScope };

    return prisma.revenueOpportunity.findMany({
      where,
      select: {
        id: true,
        name: true,
        stage: true,
        value: true,
        currency: true,
        probability: true,
        launchDate: true,
        revenueLaunchDate: true,
        account: {
          select: {
            id: true,
            name: true,
            country: true,
            region: true,
            industry: true,
            totalUsers: true,
            appUsers: true,
            engagementType: true,
          },
        },
        owner: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // Per-stage rollup for the kanban header. Returns count + per-currency
  // sum because the pipeline does not perform implicit FX. Restricted to a scope so
  // managers see their team only when crm:team-read is absent.
  async pipelineSummary(scope: { ownerScope?: string[] }) {
    const where: Prisma.RevenueOpportunityWhereInput = {};
    if (scope.ownerScope) where.ownerId = { in: scope.ownerScope };

    const grouped = await prisma.revenueOpportunity.groupBy({
      by: ["stage", "currency"],
      where,
      _count: { id: true },
      _sum: { value: true },
    });

    return grouped.map((row) => ({
      stage: row.stage,
      currency: row.currency,
      count: row._count.id,
      totalValue: Number(row._sum.value ?? 0),
    }));
  }

  // ─── Stage config ───────────────────────────────────────

  async listStageConfigs() {
    return prisma.revenueStageConfig.findMany({
      orderBy: { sortOrder: "asc" },
    });
  }

  async findStageConfig(key: string) {
    return prisma.revenueStageConfig.findUnique({ where: { key } });
  }

  async upsertStageConfig(
    key: string,
    data: {
      label: string;
      probability: number;
      sortOrder: number;
      color?: string;
    },
  ) {
    return prisma.revenueStageConfig.upsert({
      where: { key },
      create: { key, ...data, color: data.color ?? "border-t-zinc-500" },
      update: data,
    });
  }
}

export const opportunityRepository = new OpportunityRepository();
