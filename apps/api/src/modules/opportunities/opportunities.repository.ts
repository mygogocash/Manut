import type { Prisma } from "@nexora/database";

import {
  BadRequestException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import { BUSINESS_UNIT_UNASSIGNED } from "@/modules/business-units/business-units.validation";
import {
  type DealUnitStage,
  dealUnitStages,
} from "@/modules/crm-shared/deal-unit-stages";

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
  // Per-unit stages for the card chips. The board is one card per partner,
  // so the column says only where the DEAL is (the least-advanced unit under
  // the roll-up) and the chips have to say where each unit is. Two scalars
  // per tagged unit, at most a handful of rows per deal.
  businessUnitProgress: { select: { businessUnit: true, stage: true } },
} satisfies Prisma.OpportunityInclude;

export interface ListOpportunitiesFilters {
  search?: string;
  stage?: string;
  accountId?: string;
  ownerId?: string;
  ownerScope?: string[];
  country?: string;
  region?: string;
  // When true, return ONLY archived opportunities; false / undefined returns
  // active (non-archived) rows only.
  archived?: boolean;
  // Business-unit tag filter. A code matches records carrying it;
  // BUSINESS_UNIT_UNASSIGNED matches untagged records.
  businessUnit?: string;
}

/**
 * Board-level filters the kanban applies to both the cards and the header
 * rollup. A subset of the list filters: no pagination, and no `stage` (the
 * rollup groups BY stage, so narrowing to one would empty the other columns).
 */
export type PipelineSummaryFilters = Pick<
  ListOpportunitiesFilters,
  "ownerId" | "country" | "region" | "businessUnit"
>;

/**
 * The single source of truth for which opportunities a filter set selects.
 *
 * Extracted so `findMany` (the cards), its `count` (the page total) and
 * `pipelineSummary` (the kanban column headers) cannot drift apart. Before
 * this, `/pipeline` ignored every filter, so turning on a geo or owner
 * filter left the column counts and per-currency totals describing a
 * different row set than the cards underneath them (CLAUDE.md — paginated
 * aggregates must come from a rollup over the SAME where).
 */
export function buildOpportunityWhere(
  filters: ListOpportunitiesFilters,
): Prisma.OpportunityWhereInput {
  const where: Prisma.OpportunityWhereInput = {};

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

  // BD-feedback (Vivek, May 2026) — geo filters resolve through the
  // related account. Multiple account-filter keys merge into a single
  // nested `account` where so Prisma issues one join, not several.
  if (filters.country || filters.region) {
    where.account = {
      ...(filters.country && { country: filters.country }),
      ...(filters.region && { region: filters.region }),
    };
  }

  // Business-unit tag. Containment for a code, emptiness for the
  // "Unassigned" view. Set on the shared `where` so findMany + count
  // agree — a mismatch would show a total the page can never reach.
  if (filters.businessUnit === BUSINESS_UNIT_UNASSIGNED) {
    where.businessUnits = { isEmpty: true };
  } else if (filters.businessUnit) {
    where.businessUnits = { has: filters.businessUnit };
  }

  // Reversible archive is orthogonal to stage: the default view excludes
  // archived rows (archivedAt = null); archived=true returns only archived
  // ones. Set on the shared `where` so findMany + count (pagination) match.
  where.archivedAt = filters.archived ? { not: null } : null;

  return where;
}

/**
 * Attach the per-unit chip stages to a row read with `opportunityInclude`.
 *
 * Applied here rather than in the service so EVERY read path — list, detail,
 * create, update, the account-sync lookup — puts the same `units` array on
 * the wire. A card and the dialog that edits it must never disagree about
 * where a unit is, and the only way to guarantee that is one choke point.
 *
 * `businessUnitProgress` stays on the payload too: the Edit dialog's per-unit
 * table needs the raw rows to know which units have a row at all.
 */
function withUnits<
  T extends {
    stage: string;
    businessUnits: string[];
    businessUnitProgress: { businessUnit: string; stage: string }[];
  },
>(row: T): T & { units: DealUnitStage[] } {
  return {
    ...row,
    units: dealUnitStages(
      row.businessUnits,
      row.businessUnitProgress,
      row.stage,
    ),
  };
}

export class OpportunityRepository {
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
    where: Prisma.OpportunityWhereInput,
    take: number,
  ): Promise<
    Array<{
      id: string;
      ownerId: string;
      archivedAt: Date | null;
      stage: string;
    }>
  > {
    return prisma.opportunity.findMany({
      where,
      select: { id: true, ownerId: true, archivedAt: true, stage: true },
      take,
    });
  }

  async findIdsAndUnits(
    where: Prisma.OpportunityWhereInput,
    take: number,
  ): Promise<Array<{ id: string; businessUnits: string[] }>> {
    return prisma.opportunity.findMany({
      where,
      select: { id: true, businessUnits: true },
      take,
    });
  }

  async findMany(
    filters: ListOpportunitiesFilters,
    page: number,
    limit: number,
  ) {
    const where = buildOpportunityWhere(filters);

    const [data, total] = await Promise.all([
      prisma.opportunity.findMany({
        where,
        include: opportunityInclude,
        // Manual within-column order first (lower = higher up); newest
        // first within a tie so freshly-created cards surface at the top.
        orderBy: [{ sortOrderWithinStage: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.opportunity.count({ where }),
    ]);

    return { data: data.map(withUnits), total };
  }

  async findById(id: string) {
    const row = await prisma.opportunity.findUnique({
      where: { id },
      include: opportunityInclude,
    });
    return row ? withUnits(row) : row;
  }

  /** Latest opportunity on an account — used for account ↔ pipeline sync. */
  async findLatestByAccountId(accountId: string) {
    const row = await prisma.opportunity.findFirst({
      where: { accountId },
      orderBy: { updatedAt: "desc" },
      include: opportunityInclude,
    });
    return row ? withUnits(row) : row;
  }

  async create(data: Prisma.OpportunityCreateInput) {
    return withUnits(
      await prisma.opportunity.create({ data, include: opportunityInclude }),
    );
  }

  async update(id: string, data: Prisma.OpportunityUpdateInput) {
    return withUnits(
      await prisma.opportunity.update({
        where: { id },
        data,
        include: opportunityInclude,
      }),
    );
  }

  async delete(id: string) {
    return prisma.opportunity.delete({ where: { id } });
  }

  /**
   * Write a column's manual card order.
   *
   * Deal-level `sortOrderWithinStage`, because a card IS a deal: the board is
   * one card per partner. The per-unit ordering this replaced existed only
   * while a deal could hold several cards at once.
   *
   * Callers MUST have already re-fetched every id under the actor's owner
   * scope — this method takes the ids on trust. No unique constraint on
   * sort_order, so one pass is safe (no negative-park dance).
   */
  async reorderWithinStage(stageKey: string, ids: readonly string[]) {
    if (ids.length === 0) return { success: true as const, reordered: 0 };

    const rows = await prisma.opportunity.findMany({
      where: { id: { in: [...ids] } },
      select: { id: true, stage: true },
    });
    const stageById = new Map(rows.map((row) => [row.id, row.stage]));

    for (const id of ids) {
      const stage = stageById.get(id);
      if (stage === undefined) {
        throw new NotFoundException(`Opportunity ${id} was not found`);
      }
      // A card can only be ordered within the column it is actually in.
      // Without this, a stale board could renumber a deal that somebody
      // else has since dragged elsewhere.
      if (stage !== stageKey) {
        throw new BadRequestException(
          `Opportunity ${id} is not in stage ${stageKey}`,
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const [index, id] of ids.entries()) {
        await tx.opportunity.update({
          where: { id },
          data: { sortOrderWithinStage: index },
        });
      }
    });

    return { success: true as const, reordered: ids.length };
  }

  // Slim fetch for reorder validation — just the fields needed to confirm
  // each id exists, sits in the expected stage, and is in the owner scope.
  // When `ownerId` is supplied (owner-scoped caller), foreign rows simply
  // don't match — so a foreign id is indistinguishable from a missing one
  // (no existence/ownership oracle), per the investors bulk-action rule.
  async findManyByIds(ids: string[], ownerId?: string) {
    return prisma.opportunity.findMany({
      where: { id: { in: ids }, ...(ownerId ? { ownerId } : {}) },
      select: { id: true, stage: true, ownerId: true },
    });
  }

  // PRD §11.5 follow-up — slim row set for the cross-currency forecast.
  // Returns one row per opportunity with just the columns the service
  // needs to weight + convert. closed_won / closed_lost rows are
  // excluded so the forecast reflects only active pipeline.
  async forecastRows(scope: { ownerScope?: string[] }) {
    const where: Prisma.OpportunityWhereInput = {
      // closed_won / closed_lost are terminal; "live" deals are already
      // won (revenue started) so they're excluded from the forward
      // weighted forecast too.
      stage: { notIn: ["closed_won", "closed_lost", "live"] },
      // Archived deals drop out of the forecast (consistent with the board).
      archivedAt: null,
    };
    if (scope.ownerScope) where.ownerId = { in: scope.ownerScope };

    return prisma.opportunity.findMany({
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

  // BD-feedback (Vivek, May 2026) — populate the country / region selects
  // on the pipeline view. Returns only distinct non-null values from
  // accounts that currently hold at least one opportunity inside the
  // caller's owner scope, so dead options never show up in the picker.
  async filterOptions(scope: { ownerScope?: string[] }) {
    const where: Prisma.AccountWhereInput = {
      opportunities: { some: {} },
    };
    if (scope.ownerScope) {
      where.opportunities = {
        some: { ownerId: { in: scope.ownerScope } },
      };
    }

    const rows = await prisma.account.findMany({
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
    // Archived deals drop out of the analytics dashboard (consistent w/ board).
    const where: Prisma.OpportunityWhereInput = { archivedAt: null };
    if (scope.ownerScope) where.ownerId = { in: scope.ownerScope };

    return prisma.opportunity.findMany({
      where,
      select: {
        id: true,
        name: true,
        stage: true,
        value: true,
        currency: true,
        probability: true,
        businessUnits: true,
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
  // sum (PRD §11.5 — multi-currency without FX). Restricted to a scope so
  // managers see their team only when crm:team-read is absent.
  async pipelineSummary(
    scope: { ownerScope?: string[] },
    filters: PipelineSummaryFilters = {},
  ) {
    // The kanban board is the Active view — archived opportunities never show
    // as cards, so `archived: false` is forced here rather than taken from the
    // caller. Everything else goes through the SAME where builder the cards
    // use, so a filtered board's headers describe exactly the filtered cards.
    const where = buildOpportunityWhere({
      ...filters,
      ownerScope: scope.ownerScope,
      archived: false,
    });

    const grouped = await prisma.opportunity.groupBy({
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
    return prisma.opportunityStageConfig.findMany({
      orderBy: { sortOrder: "asc" },
    });
  }

  async findStageConfig(key: string) {
    return prisma.opportunityStageConfig.findUnique({ where: { key } });
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
    return prisma.opportunityStageConfig.upsert({
      where: { key },
      create: { key, ...data, color: data.color ?? "border-t-zinc-500" },
      update: data,
    });
  }
}

export const opportunityRepository = new OpportunityRepository();
