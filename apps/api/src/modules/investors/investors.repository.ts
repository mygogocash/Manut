import type { Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";
import { INVESTOR_TAG_UNTAGGED } from "@/modules/investor-tags/investor-tags.validation";
import { parseInvestmentAmount } from "@/modules/investors/investment-amount";

const adderSelect = { id: true, name: true, avatarUrl: true } as const;

// Shared filter → Prisma where. Used by the list, the bulk select-all
// path, and the pipeline totals so "all matching" acts on exactly the
// rows the list shows.
export interface InvestorFilters {
  search?: string;
  status?: string;
  /**
   * Restrict to a SET of statuses — what the pipeline board actually shows.
   *
   * The board renders one column per configured stage, but a row's `status` is
   * an open string: legacy values (`new`, `prospect`, `active`, `inactive`,
   * `declined` — see investor-pipeline.ts) exist on real rows and appear in NO
   * column. So "select all N matching" from the board, sent without this
   * facet, resolves to a WIDER set than the board counted: the bar offers 214
   * and the write touches 220.
   *
   * Takes precedence over `status` — the board sends the set, the list sends
   * the single value, and no caller sends both.
   */
  statusIn?: string[];
  type?: string;
  addedBy?: string;
  fundraisingEntity?: string;
  // Archive is orthogonal to the pipeline stage: undefined leaves the
  // filter off (existing callers unaffected); false = active only
  // (archivedAt null); true = archived only (archivedAt set).
  archived?: boolean;
  // Searchable label. A real code matches investors carrying it; the
  // reserved `__none__` sentinel means "untagged". Codes are validated
  // lowercase/dash-only, so the sentinel can never collide with one.
  tag?: string;
}

export function buildInvestorWhere(
  filters: InvestorFilters,
): Prisma.InvestorWhereInput {
  const where: Prisma.InvestorWhereInput = {};
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { contactName: { contains: filters.search, mode: "insensitive" } },
      { contactEmail: { contains: filters.search, mode: "insensitive" } },
    ];
  }
  if (filters.type) where.type = filters.type;
  // An empty statusIn is treated as "no stage filter" rather than "match
  // nothing": it means the board has no configured stages, and silently
  // matching zero rows there would look like data loss.
  if (filters.statusIn && filters.statusIn.length > 0) {
    where.status = { in: filters.statusIn };
  } else if (filters.status) {
    where.status = filters.status;
  }
  if (filters.addedBy) where.addedBy = filters.addedBy;
  if (filters.fundraisingEntity) {
    where.fundraisingEntity = filters.fundraisingEntity;
  }
  if (filters.archived !== undefined) {
    where.archivedAt = filters.archived ? { not: null } : null;
  }
  if (filters.tag) {
    where.tags =
      filters.tag === INVESTOR_TAG_UNTAGGED
        ? { isEmpty: true }
        : { has: filters.tag };
  }
  return where;
}

export const investorsRepository = {
  async findAll(
    page: number,
    limit: number,
    search?: string,
    type?: string,
    status?: string,
    addedBy?: string,
    sortBy?: string,
    sortOrder?: "asc" | "desc",
    archived?: boolean,
    fundraisingEntity?: string,
    // Appended rather than folded into an options object: this signature is
    // already ten positional params, and reshaping it would churn every
    // caller for no behaviour change. Worth doing, separately.
    tag?: string,
  ) {
    const where = buildInvestorWhere({
      search,
      type,
      status,
      addedBy,
      archived,
      fundraisingEntity,
      tag,
    });

    // Sortable column whitelist — keeps the caller from sneaking
    // arbitrary Prisma sort keys past the API boundary. Anything
    // outside the whitelist falls through to the manual-order
    // default (sortOrder asc, createdAt desc).
    // Keys mirror the FE column keys (data-table sends `col.key`
    // verbatim) AND the canonical Prisma field names so callers
    // hitting the API directly can use either spelling.
    const SORTABLE: Record<string, Prisma.InvestorOrderByWithRelationInput> = {
      name: { name: "asc" },
      type: { type: "asc" },
      status: { status: "asc" },
      contact: { contactName: "asc" },
      contactName: { contactName: "asc" },
      location: { location: "asc" },
      region: { region: "asc" },
      title: { title: "asc" },
      revenueStream: { revenueStream: "asc" },
      lastContact: { lastContactDate: "asc" },
      lastContactDate: { lastContactDate: "asc" },
      nextAction: { nextAction: "asc" },
      actInvestment: { actInvestment: "asc" },
      estInvestment: { estInvestment: "asc" },
      crossSell: { crossSell: "asc" },
      createdAt: { createdAt: "asc" },
    };
    const order: Prisma.InvestorOrderByWithRelationInput | undefined =
      sortBy && SORTABLE[sortBy]
        ? Object.fromEntries(
            Object.entries(SORTABLE[sortBy]).map(([k]) => [
              k,
              sortOrder === "desc" ? "desc" : "asc",
            ]),
          )
        : undefined;

    const [data, total] = await Promise.all([
      prisma.investor.findMany({
        where,
        include: {
          adder: { select: adderSelect },
          _count: { select: { investments: true } },
        },
        // Caller-driven sort wins when supplied; manual rep ordering
        // is the default with `createdAt desc` tie-break so fresh
        // inserts (sortOrder = 0) surface above older zeros.
        orderBy: order ?? [{ sortOrder: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.investor.count({ where }),
    ]);
    return { data, total };
  },

  async findById(id: string) {
    return prisma.investor.findUnique({
      where: { id },
      include: {
        adder: { select: adderSelect },
        investments: { orderBy: { date: "desc" } },
      },
    });
  },

  async create(data: Prisma.InvestorUncheckedCreateInput) {
    return prisma.investor.create({
      data,
      include: { adder: { select: adderSelect } },
    });
  },

  async update(id: string, data: Prisma.InvestorUncheckedUpdateInput) {
    return prisma.investor.update({
      where: { id },
      data,
      include: {
        adder: { select: adderSelect },
        investments: { orderBy: { date: "desc" } },
      },
    });
  },

  async delete(id: string) {
    return prisma.investor.delete({ where: { id } });
  },

  /**
   * (name, fundraisingEntity) -> id, for the bulk importer's match step.
   *
   * The importer used to have no match step at all, so re-running it created a
   * second copy of every row. There is no natural code on an investor, so the
   * firm name scoped to its fundraising vehicle is the key: the same fund can
   * legitimately exist once under TBH and once under TBL, and those are two
   * records, not a duplicate.
   */
  async findImportMatches() {
    return prisma.investor.findMany({
      select: {
        id: true,
        name: true,
        fundraisingEntity: true,
        // Needed for the primary identity tier: a lead list holds many people
        // at one firm, so the name cannot distinguish them.
        linkedinUrl: true,
      },
    });
  },

  async reorder(orderedIds: string[]) {
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.investor.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
  },

  async findIdsOwnedBy(ids: string[], addedBy: string) {
    return prisma.investor.findMany({
      where: { id: { in: ids }, addedBy },
      select: { id: true },
    });
  },

  async dashboardKpis(fundraisingEntity?: string) {
    const investorScope = fundraisingEntity ? { fundraisingEntity } : undefined;
    const [totalInvestors, investments, pipelineRows, statusGroups] =
      await Promise.all([
        prisma.investor.count({ where: investorScope }),
        prisma.investment.findMany({
          where: investorScope ? { investor: investorScope } : undefined,
          select: { amount: true, currency: true, status: true, type: true },
        }),
        prisma.investor.findMany({
          where: investorScope,
          select: { estInvestment: true, actInvestment: true },
        }),
        prisma.investor.groupBy({
          by: ["status"],
          where: investorScope,
          _count: { _all: true },
        }),
      ]);

    let totalEstInvestment = 0;
    let totalActInvestment = 0;
    for (const row of pipelineRows) {
      totalEstInvestment += parseInvestmentAmount(row.estInvestment);
      totalActInvestment += parseInvestmentAmount(row.actInvestment);
    }

    let totalCommitted = 0;
    let totalReceived = 0;
    const byCurrency: Record<string, { committed: number; received: number }> =
      {};

    for (const inv of investments) {
      const amount = Number(inv.amount);
      if (!byCurrency[inv.currency]) {
        byCurrency[inv.currency] = { committed: 0, received: 0 };
      }

      const currencyData = byCurrency[inv.currency]!;
      if (inv.status === "committed" || inv.status === "received") {
        totalCommitted += amount;
        currencyData.committed += amount;
      }
      if (inv.status === "received") {
        totalReceived += amount;
        currencyData.received += amount;
      }
    }

    const statusBreakdown: Record<string, number> = {};
    for (const group of statusGroups) {
      statusBreakdown[group.status] = group._count._all;
    }

    return {
      totalInvestors,
      totalInvestments: investments.length,
      totalCommitted,
      totalReceived,
      totalEstInvestment,
      totalActInvestment,
      statusBreakdown,
      byCurrency,
    };
  },

  // Per-stage roll-up for the pipeline column headers: count + summed
  // est/act across EVERY investor in each stage (not just the page the
  // board has loaded). est/act are free-text, so parse each in JS. Scoped
  // to `addedBy` when the caller lacks investors:read-all.
  // Per-stage est/act roll-up for the board column headers.
  //
  // Routes through buildInvestorWhere — the SAME builder the card queries use
  // — so a header can never describe a different set than the cards beneath
  // it. Previously this hardcoded `archivedAt: null` and accepted only owner +
  // entity, which meant the headers ignored the board's own search / type /
  // tag filters, and an Archived board would have shown active money.
  async pipelineTotals(filters: InvestorFilters = {}) {
    const rows = await prisma.investor.findMany({
      // `archived` defaults to false, preserving the hardcoded
      // `archivedAt: null` this replaced. Coalesced rather than spread-
      // defaulted: `{ archived: false, ...filters }` is defeated by a caller
      // passing an explicit `archived: undefined`, which would drop the filter
      // and let archived investors inflate every column header.
      where: buildInvestorWhere({
        ...filters,
        archived: filters.archived ?? false,
      }),
      select: { status: true, estInvestment: true, actInvestment: true },
    });
    const totals: Record<string, { count: number; est: number; act: number }> =
      {};
    for (const row of rows) {
      const bucket = (totals[row.status] ??= { count: 0, est: 0, act: 0 });
      bucket.count += 1;
      bucket.est += parseInvestmentAmount(row.estInvestment);
      bucket.act += parseInvestmentAmount(row.actInvestment);
    }
    return totals;
  },

  async bulkUpdate(
    where: Prisma.InvestorWhereInput,
    data: Prisma.InvestorUncheckedUpdateManyInput,
  ) {
    return prisma.investor.updateMany({ where, data });
  },

  async bulkDelete(where: Prisma.InvestorWhereInput) {
    return prisma.investor.deleteMany({ where });
  },

  async countInvestors(where: Prisma.InvestorWhereInput) {
    return prisma.investor.count({ where });
  },

  // Append ONE tag code to every matched investor that does not already carry
  // it.
  //
  // The `NOT: { tags: { has: code } }` guard is what makes this safe to run
  // over a mixed selection: Postgres arrays are not sets, so an unguarded
  // `push` would store the same code twice on a row that already had it.
  //
  // Appending per code, rather than rewriting each array to a computed union,
  // deliberately PRESERVES the order an investor's existing tags are already
  // stored in — a rewrite would have to pick an order and would churn rows
  // that gained nothing.
  async addTagCodes(where: Prisma.InvestorWhereInput, codes: string[]) {
    // ONE transaction, not a loop of independent writes. Each code needs its
    // own guarded statement, but a failure part-way through must not leave
    // some codes applied and the rest not — the caller would see a 500 with no
    // way to know which landed, and the Singapore pooler makes transient
    // mid-batch failures a real occurrence rather than a theoretical one.
    return prisma.$transaction(
      codes.map((code) =>
        prisma.investor.updateMany({
          where: { AND: [where, { NOT: { tags: { has: code } } }] },
          data: { tags: { push: code } },
        }),
      ),
    );
  },
};
