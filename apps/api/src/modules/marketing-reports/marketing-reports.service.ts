import type { Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";

/**
 * Analytics + reports over the Campaign CRM (Phase 2) data. "Prediction" =
 * `expectedReach`, "Actual" = `actualReach`. All aggregation happens
 * server-side (never client-reduced from a page). List endpoints paginate,
 * filter, and sort in the DB; the dashboard roll-up is cached briefly.
 */

export interface ReportFilter {
  from?: string;
  to?: string;
  status?: string;
  channel?: string;
  country?: string;
  ownerId?: string;
}

function parseDate(v: string | undefined): Date | undefined {
  if (!v) return undefined;
  return new Date(`${v}T00:00:00.000Z`);
}

function buildWhere(filter: ReportFilter): Prisma.MktCampaignWhereInput {
  const where: Prisma.MktCampaignWhereInput = {};
  if (filter.status) where.status = filter.status;
  if (filter.channel) where.channel = filter.channel;
  if (filter.country) where.country = filter.country;
  if (filter.ownerId) where.ownerId = filter.ownerId;
  const from = parseDate(filter.from);
  const to = parseDate(filter.to);
  if (from || to) {
    where.campaignDate = {};
    if (from) where.campaignDate.gte = from;
    if (to) where.campaignDate.lte = to;
  }
  return where;
}

function performancePct(
  expected: number | null,
  actual: number | null,
): number | null {
  if (expected === null || actual === null || expected <= 0) return null;
  return Math.round((actual / expected) * 1000) / 10;
}

// ── Dashboard cache (short TTL — recomputed roll-ups are cheap but hot). ──
const DASH_TTL_MS = 60 * 1000;
const dashboardCache = new Map<string, { at: number; data: unknown }>();

const SORTABLE = new Set([
  "name",
  "campaignDate",
  "status",
  "expectedReach",
  "actualReach",
  "budget",
]);

export class MarketingReportsService {
  // ── Prediction vs Actual (paginated/sorted/filtered server-side) ──
  async predictionVsActual(args: {
    filter: ReportFilter;
    page: number;
    limit: number;
    sortBy: string;
    sortDir: "asc" | "desc";
  }) {
    const where = buildWhere(args.filter);
    const orderByField = SORTABLE.has(args.sortBy)
      ? args.sortBy
      : "campaignDate";
    const [rows, total] = await Promise.all([
      prisma.mktCampaign.findMany({
        where,
        select: {
          id: true,
          name: true,
          campaignDate: true,
          status: true,
          channel: true,
          expectedReach: true,
          actualReach: true,
        },
        orderBy: { [orderByField]: args.sortDir },
        skip: (args.page - 1) * args.limit,
        take: args.limit,
      }),
      prisma.mktCampaign.count({ where }),
    ]);
    return {
      data: rows.map((r) => {
        const difference =
          r.expectedReach !== null && r.actualReach !== null
            ? r.actualReach - r.expectedReach
            : null;
        return {
          id: r.id,
          name: r.name,
          campaignDate: r.campaignDate.toISOString(),
          status: r.status,
          channel: r.channel,
          predicted: r.expectedReach,
          actual: r.actualReach,
          difference,
          performancePct: performancePct(r.expectedReach, r.actualReach),
        };
      }),
      meta: { page: args.page, limit: args.limit, total },
    };
  }

  // ── Campaign Performance list (paginated/sorted/filtered) ──
  async campaignPerformance(args: {
    filter: ReportFilter;
    page: number;
    limit: number;
    sortBy: string;
    sortDir: "asc" | "desc";
  }) {
    const where = buildWhere(args.filter);
    const orderByField = SORTABLE.has(args.sortBy)
      ? args.sortBy
      : "campaignDate";
    const [rows, total] = await Promise.all([
      prisma.mktCampaign.findMany({
        where,
        select: {
          id: true,
          name: true,
          campaignDate: true,
          status: true,
          channel: true,
          country: true,
          product: true,
          budget: true,
          currency: true,
          expectedReach: true,
          actualReach: true,
          owner: { select: { id: true, name: true } },
        },
        orderBy: { [orderByField]: args.sortDir },
        skip: (args.page - 1) * args.limit,
        take: args.limit,
      }),
      prisma.mktCampaign.count({ where }),
    ]);
    return {
      data: rows.map((r) => ({
        id: r.id,
        name: r.name,
        campaignDate: r.campaignDate.toISOString(),
        status: r.status,
        channel: r.channel,
        country: r.country,
        product: r.product,
        owner: r.owner?.name ?? null,
        budget: r.budget === null ? null : Number(r.budget),
        currency: r.currency,
        expectedReach: r.expectedReach,
        actualReach: r.actualReach,
        performancePct: performancePct(r.expectedReach, r.actualReach),
      })),
      meta: { page: args.page, limit: args.limit, total },
    };
  }

  // ── Campaign Summary (daily/weekly/monthly buckets) ──
  async campaignSummary(
    granularity: "daily" | "weekly" | "monthly",
    filter: ReportFilter,
  ) {
    const where = buildWhere(filter);
    const rows = await prisma.mktCampaign.findMany({
      where,
      select: {
        campaignDate: true,
        expectedReach: true,
        actualReach: true,
        budget: true,
      },
    });
    const bucketKey = (d: Date): string => {
      const iso = d.toISOString().slice(0, 10);
      if (granularity === "daily") return iso;
      if (granularity === "monthly") return iso.slice(0, 7); // YYYY-MM
      // weekly — ISO week start (Monday)
      const day = new Date(d);
      const dow = (day.getUTCDay() + 6) % 7;
      day.setUTCDate(day.getUTCDate() - dow);
      return day.toISOString().slice(0, 10);
    };
    const map = new Map<
      string,
      { campaigns: number; expected: number; actual: number; budget: number }
    >();
    for (const r of rows) {
      const key = bucketKey(r.campaignDate);
      const cur = map.get(key) ?? {
        campaigns: 0,
        expected: 0,
        actual: 0,
        budget: 0,
      };
      cur.campaigns += 1;
      cur.expected += r.expectedReach ?? 0;
      cur.actual += r.actualReach ?? 0;
      cur.budget += r.budget === null ? 0 : Number(r.budget);
      map.set(key, cur);
    }
    return {
      data: [...map.entries()]
        .map(([period, v]) => ({
          period,
          campaigns: v.campaigns,
          expectedReach: v.expected,
          actualReach: v.actual,
          budget: Math.round(v.budget * 100) / 100,
          performancePct: performancePct(v.expected, v.actual),
        }))
        .sort((a, b) => a.period.localeCompare(b.period)),
    };
  }

  // ── Prediction Accuracy (per campaign, evaluated only when both present) ──
  async predictionAccuracy(filter: ReportFilter) {
    const where = buildWhere(filter);
    where.expectedReach = { not: null };
    where.actualReach = { not: null };
    const rows = await prisma.mktCampaign.findMany({
      where,
      select: {
        id: true,
        name: true,
        campaignDate: true,
        expectedReach: true,
        actualReach: true,
      },
      orderBy: { campaignDate: "desc" },
    });
    return {
      data: rows.map((r) => {
        const predicted = r.expectedReach ?? 0;
        const actual = r.actualReach ?? 0;
        const accuracy =
          predicted > 0
            ? Math.round(
                (1 - Math.abs(actual - predicted) / predicted) * 1000,
              ) / 10
            : null;
        return {
          id: r.id,
          name: r.name,
          campaignDate: r.campaignDate.toISOString(),
          predicted,
          actual,
          difference: actual - predicted,
          performancePct: performancePct(predicted, actual),
          accuracyPct: accuracy,
        };
      }),
    };
  }

  // ── Lever Performance ──
  async leverPerformance(filter: ReportFilter) {
    const where = buildWhere(filter);
    const rows = await prisma.mktCampaign.findMany({
      where,
      select: {
        expectedReach: true,
        actualReach: true,
        budget: true,
        levers: { select: { lever: { select: { id: true, name: true } } } },
      },
    });
    const map = new Map<
      string,
      {
        name: string;
        campaigns: number;
        expected: number;
        actual: number;
        budget: number;
        perfSum: number;
        perfCount: number;
      }
    >();
    for (const c of rows) {
      const perf = performancePct(c.expectedReach, c.actualReach);
      for (const l of c.levers) {
        const cur = map.get(l.lever.id) ?? {
          name: l.lever.name,
          campaigns: 0,
          expected: 0,
          actual: 0,
          budget: 0,
          perfSum: 0,
          perfCount: 0,
        };
        cur.campaigns += 1;
        cur.expected += c.expectedReach ?? 0;
        cur.actual += c.actualReach ?? 0;
        cur.budget += c.budget === null ? 0 : Number(c.budget);
        if (perf !== null) {
          cur.perfSum += perf;
          cur.perfCount += 1;
        }
        map.set(l.lever.id, cur);
      }
    }
    return {
      data: [...map.entries()]
        .map(([leverId, v]) => ({
          leverId,
          lever: v.name,
          campaigns: v.campaigns,
          expectedReach: v.expected,
          actualReach: v.actual,
          budget: Math.round(v.budget * 100) / 100,
          avgPerformancePct:
            v.perfCount > 0
              ? Math.round((v.perfSum / v.perfCount) * 10) / 10
              : null,
        }))
        .sort((a, b) => b.actualReach - a.actualReach),
    };
  }

  // ── Dashboard roll-up (6 sections), cached. ──
  async dashboard(filter: ReportFilter) {
    const cacheKey = JSON.stringify(filter);
    const hit = dashboardCache.get(cacheKey);
    if (hit && Date.now() - hit.at < DASH_TTL_MS) {
      return { data: hit.data };
    }

    const where = buildWhere(filter);
    const now = new Date();
    const in90 = new Date(now.getTime() + 90 * 86400000);

    const [all, statusGroups, channelGroups, budgetAgg, upcoming, leverPerf] =
      await Promise.all([
        prisma.mktCampaign.findMany({
          where,
          select: {
            campaignDate: true,
            expectedReach: true,
            actualReach: true,
          },
        }),
        prisma.mktCampaign.groupBy({
          by: ["status"],
          where,
          _count: { _all: true },
        }),
        prisma.mktCampaign.groupBy({
          by: ["channel"],
          where,
          _count: { _all: true },
        }),
        prisma.mktCampaign.aggregate({
          where,
          _sum: { budget: true, expectedReach: true, actualReach: true },
        }),
        prisma.mktCampaign.findMany({
          where: {
            campaignDate: { gte: now, lte: in90 },
            status: { notIn: ["cancelled", "completed"] },
          },
          select: {
            id: true,
            name: true,
            campaignDate: true,
            status: true,
            channel: true,
          },
          orderBy: { campaignDate: "asc" },
          take: 8,
        }),
        this.leverPerformance(filter),
      ]);

    // Prediction accuracy across evaluable campaigns.
    const evaluable = all.filter(
      (c) => c.expectedReach !== null && c.actualReach !== null,
    );
    const perfValues = evaluable
      .map((c) => performancePct(c.expectedReach, c.actualReach))
      .filter((v): v is number => v !== null);
    const avgPerformancePct =
      perfValues.length > 0
        ? Math.round(
            (perfValues.reduce((a, b) => a + b, 0) / perfValues.length) * 10,
          ) / 10
        : null;

    // Traffic trends — monthly expected vs actual (chronological).
    const trendMap = new Map<string, { expected: number; actual: number }>();
    for (const c of all) {
      const key = c.campaignDate.toISOString().slice(0, 7);
      const cur = trendMap.get(key) ?? { expected: 0, actual: 0 };
      cur.expected += c.expectedReach ?? 0;
      cur.actual += c.actualReach ?? 0;
      trendMap.set(key, cur);
    }
    const trafficTrends = [...trendMap.entries()]
      .map(([month, v]) => ({ month, ...v }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-12);

    const data = {
      campaignPerformance: {
        totalCampaigns: all.length,
        totalExpectedReach: budgetAgg._sum.expectedReach ?? 0,
        totalActualReach: budgetAgg._sum.actualReach ?? 0,
        totalBudget:
          budgetAgg._sum.budget === null ? 0 : Number(budgetAgg._sum.budget),
        avgPerformancePct,
      },
      predictionAccuracy: {
        evaluatedCampaigns: evaluable.length,
        avgPerformancePct,
      },
      trafficTrends,
      leverPerformance: leverPerf.data.slice(0, 8),
      campaignSummary: {
        byStatus: statusGroups.map((g) => ({
          status: g.status,
          count: g._count._all,
        })),
        byChannel: channelGroups
          .filter((g) => g.channel)
          .map((g) => ({ channel: g.channel as string, count: g._count._all })),
      },
      upcomingCampaigns: upcoming.map((c) => ({
        id: c.id,
        name: c.name,
        campaignDate: c.campaignDate.toISOString(),
        status: c.status,
        channel: c.channel,
      })),
    };

    dashboardCache.set(cacheKey, { at: Date.now(), data });
    return { data };
  }
}

export const marketingReportsService = new MarketingReportsService();
