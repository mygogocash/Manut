import type { Prisma } from "@manut/database";

import { prisma } from "@/infrastructure/database/prisma";
import { parseInvestmentAmount } from "@/modules/investors/investment-amount";

const adderSelect = { id: true, name: true, avatarUrl: true } as const;

// Shared filter → Prisma where. Used by the list, the bulk select-all
// path, and the pipeline totals so "all matching" acts on exactly the
// rows the list shows.
export function buildInvestorWhere(filters: {
  search?: string;
  type?: string;
  status?: string;
  addedBy?: string;
}): Prisma.InvestorWhereInput {
  const where: Prisma.InvestorWhereInput = {};
  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: "insensitive" } },
      { contactName: { contains: filters.search, mode: "insensitive" } },
      { contactEmail: { contains: filters.search, mode: "insensitive" } },
    ];
  }
  if (filters.type) where.type = filters.type;
  if (filters.status) where.status = filters.status;
  if (filters.addedBy) where.addedBy = filters.addedBy;
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
  ) {
    const where = buildInvestorWhere({ search, type, status, addedBy });

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

  async dashboardKpis() {
    const [totalInvestors, investments, pipelineRows, statusGroups] =
      await Promise.all([
        prisma.investor.count(),
        prisma.investment.findMany({
          select: { amount: true, currency: true, status: true, type: true },
        }),
        prisma.investor.findMany({
          select: { estInvestment: true, actInvestment: true },
        }),
        prisma.investor.groupBy({
          by: ["status"],
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
  async pipelineTotals(addedBy?: string) {
    const rows = await prisma.investor.findMany({
      where: addedBy ? { addedBy } : {},
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
};
