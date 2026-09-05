import type { Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";
import type { OwMetricKey } from "@/modules/marketing/ow-aliases";
import { AMOUNT_KEYS } from "@/modules/marketing/ow-analytics-map";

type MetricRowInput = {
  date: Date;
  telco: string;
  values: Record<string, number>;
  txMetrics?: Record<string, number>;
  isIntraday: boolean;
  sourceTab: string;
};

// Build the Prisma column payload: amount keys → bigint, counts → int,
// txMetrics → JSON (omitted when absent). Pure — unit tested.
export function buildMetricUpdateData(
  row: MetricRowInput,
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    isIntraday: row.isIntraday,
    sourceTab: row.sourceTab,
  };
  for (const [k, v] of Object.entries(row.values)) {
    if (v == null) continue;
    const key = k as OwMetricKey;
    data[key] = AMOUNT_KEYS.has(key) ? BigInt(Math.round(v)) : Math.round(v);
  }
  if (row.txMetrics && Object.keys(row.txMetrics).length) {
    data.txMetrics = row.txMetrics;
  }
  return data;
}

const creatorSelect = { id: true, name: true, email: true } as const;

const includes = {
  creator: { select: creatorSelect },
} satisfies Prisma.MarketingCampaignInclude;

export class MarketingRepository {
  async findMany(
    filters: { search?: string; status?: string },
    page: number,
    limit: number,
  ) {
    const where: Prisma.MarketingCampaignWhereInput = {};
    if (filters.status) where.status = filters.status;
    if (filters.search) {
      where.title = { contains: filters.search, mode: "insensitive" };
    }

    const [data, total] = await Promise.all([
      prisma.marketingCampaign.findMany({
        where,
        include: includes,
        // Most recent / upcoming campaign date first; createdAt is the
        // deterministic tie-breaker for same-day rows.
        orderBy: [{ campaignDate: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.marketingCampaign.count({ where }),
    ]);

    return { data, total };
  }

  async findById(id: string) {
    return prisma.marketingCampaign.findUnique({
      where: { id },
      include: includes,
    });
  }

  // Lightweight full scan for the dashboard. The campaign table is
  // hand-curated (small), so aggregating in JS is simpler + cheaper than
  // several grouped queries.
  async findAllForDashboard() {
    return prisma.marketingCampaign.findMany({
      orderBy: { campaignDate: "asc" },
      select: {
        id: true,
        title: true,
        campaignDate: true,
        hours: true,
        status: true,
        leversPulled: true,
      },
    });
  }

  async create(data: Prisma.MarketingCampaignUncheckedCreateInput) {
    return prisma.marketingCampaign.create({ data, include: includes });
  }

  async update(id: string, data: Prisma.MarketingCampaignUncheckedUpdateInput) {
    return prisma.marketingCampaign.update({
      where: { id },
      data,
      include: includes,
    });
  }

  async delete(id: string) {
    return prisma.marketingCampaign.delete({ where: { id } });
  }

  // ── OW holistic dashboard ────────────────────────────────────
  // Full campaign detail (incl. copy/design + prediction file) for the
  // holistic dashboard's campaign overlay + (later) AI recaps.
  async findCampaignsWithFullDetail() {
    return prisma.marketingCampaign.findMany({
      orderBy: { campaignDate: "asc" },
      select: {
        id: true,
        title: true,
        campaignDate: true,
        hours: true,
        status: true,
        leversPulled: true,
        copyDesign: true,
        predictionFileUrl: true,
        predictionFileName: true,
      },
    });
  }

  // Upsert normalized per (date,telco) metrics from a sheet ingest.
  // Idempotent on the (date,telco) unique key — re-runs overwrite.
  async upsertDailyMetrics(
    rows: Array<{
      date: Date;
      telco: string;
      values: Record<string, number>;
      txMetrics?: Record<string, number>;
      isIntraday: boolean;
      sourceTab: string;
    }>,
  ) {
    let count = 0;
    for (const r of rows) {
      const data = buildMetricUpdateData(r);
      await prisma.owDailyMetric.upsert({
        where: { date_telco: { date: r.date, telco: r.telco } },
        create: {
          date: r.date,
          telco: r.telco,
          ...data,
        } as Prisma.OwDailyMetricUncheckedCreateInput,
        update: { ...data } as Prisma.OwDailyMetricUncheckedUpdateInput,
      });
      count++;
    }
    return count;
  }

  async getLatestSnapshot() {
    return prisma.owSnapshot.findFirst({ orderBy: { generatedAt: "desc" } });
  }

  // payload is `unknown` so callers can pass a typed object literal
  // without tripping Prisma's strict InputJsonValue (CLAUDE.md gotcha).
  async createSnapshot(payload: unknown) {
    return prisma.owSnapshot.create({
      data: { payload: payload as Prisma.InputJsonValue },
    });
  }
}

export const marketingRepository = new MarketingRepository();
