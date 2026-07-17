import { logger } from "@/common/utils/logger";
import { prisma } from "@/infrastructure/database/prisma";
import {
  createExchangeRateService,
  type ExchangeRateService,
} from "@/modules/exchange-rates/exchange-rates.service";

// Revenue Analytics aggregates rows that may live in different
// currencies (THB expenses, USD invoices, etc.). All KPIs surface in a
// single report currency — default USD — so each amount is converted via
// `ExchangeRateService.resolveRate` before it joins the running total.
//
// Rows whose source currency has no rate path to USD (neither direct
// nor inverse) are treated as 0 and logged. We keep the public response
// shape identical to the pre-FX implementation; callers don't need to
// know FX happened.

const REPORT_CURRENCY = "USD";

function getDateRange(period: string): Date {
  const now = new Date();
  switch (period) {
    case "3m":
      return new Date(now.getFullYear(), now.getMonth() - 3, 1);
    case "6m":
      return new Date(now.getFullYear(), now.getMonth() - 6, 1);
    case "ytd":
      return new Date(now.getFullYear(), 0, 1);
    case "all":
      return new Date(2000, 0, 1);
    case "12m":
    default:
      return new Date(now.getFullYear(), now.getMonth() - 12, 1);
  }
}

async function convert(
  fx: ExchangeRateService,
  amount: number,
  currency: string,
  context: string,
): Promise<number> {
  const from = (currency || REPORT_CURRENCY).toUpperCase();
  const lookup = await fx.resolveRate(from, REPORT_CURRENCY);
  if (lookup.source === "missing") {
    logger.warn("Revenue Analytics: no FX rate path; treating amount as 0", {
      context,
      from,
      to: REPORT_CURRENCY,
      amount,
    });
    return 0;
  }
  return amount * lookup.rate;
}

export class RevenueRepository {
  async getInvestmentSummary(period: string, entityId?: string) {
    const since = getDateRange(period);
    const fx = createExchangeRateService();

    const investments = await prisma.investment.findMany({
      where: {
        date: { gte: since },
        ...(entityId ? { investor: { adder: { entityId } } } : {}),
      },
      select: { amount: true, currency: true },
    });

    let total = 0;
    for (const inv of investments) {
      total += await convert(
        fx,
        Number(inv.amount),
        inv.currency,
        "investments",
      );
    }

    const count = investments.length;
    return {
      totalInvestments: total,
      investorCount: count,
      avgInvestment: count > 0 ? total / count : 0,
    };
  }

  async getExpenseSummary(period: string, entityId?: string) {
    const since = getDateRange(period);
    const fx = createExchangeRateService();

    const where: Record<string, unknown> = {
      date: { gte: since },
      status: { not: "rejected" },
    };
    if (entityId) where.entityId = entityId;

    const expenses = await prisma.expense.findMany({
      where,
      select: { amount: true, currency: true, date: true },
      orderBy: { date: "asc" },
    });

    const monthlyMap = new Map<string, number>();
    for (const row of expenses) {
      const key = `${row.date.getFullYear()}-${String(row.date.getMonth() + 1).padStart(2, "0")}`;
      const usd = await convert(
        fx,
        Number(row.amount),
        row.currency,
        "expenses",
      );
      monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + usd);
    }

    return Array.from(monthlyMap.entries())
      .map(([month, total]) => ({ month, total }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  async getInvoiceSummary(period: string, entityId?: string) {
    const since = getDateRange(period);
    const fx = createExchangeRateService();

    const where: Record<string, unknown> = { issueDate: { gte: since } };
    if (entityId) where.entityId = entityId;

    const invoices = await prisma.invoice.findMany({
      where,
      select: { status: true, amount: true, currency: true },
    });

    const summary: Record<string, { count: number; total: number }> = {};
    let grandTotal = 0;

    for (const row of invoices) {
      const usd = await convert(
        fx,
        Number(row.amount),
        row.currency,
        "invoices",
      );
      const bucket = summary[row.status] ?? { count: 0, total: 0 };
      bucket.count += 1;
      bucket.total += usd;
      summary[row.status] = bucket;
      grandTotal += usd;
    }

    return { byStatus: summary, grandTotal };
  }

  async getRevenueByEntity() {
    const fx = createExchangeRateService();

    const entities = await prisma.entity.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        code: true,
        invoices: {
          where: { status: "paid" },
          select: { amount: true, currency: true },
        },
        expenses: {
          where: { status: { not: "rejected" } },
          select: { amount: true, currency: true },
        },
      },
    });

    const results = [];
    for (const entity of entities) {
      let revenue = 0;
      for (const inv of entity.invoices) {
        revenue += await convert(
          fx,
          Number(inv.amount),
          inv.currency,
          "revenue-by-entity:invoices",
        );
      }
      let expenses = 0;
      for (const exp of entity.expenses) {
        expenses += await convert(
          fx,
          Number(exp.amount),
          exp.currency,
          "revenue-by-entity:expenses",
        );
      }
      results.push({
        id: entity.id,
        name: entity.name,
        code: entity.code,
        revenue,
        expenses,
        netIncome: revenue - expenses,
      });
    }

    return results;
  }

  async getDealsPipelineValue() {
    // The legacy `Deal` model has no per-row currency column, so values
    // are assumed to already be denominated in `REPORT_CURRENCY` (USD).
    // When that schema gets a `currency` field, convert here too.
    const result = await prisma.deal.groupBy({
      by: ["stage"],
      _count: { id: true },
      _sum: { value: true },
    });

    return result.map((row) => ({
      stage: row.stage,
      count: row._count.id,
      totalValue: Number(row._sum.value ?? 0),
    }));
  }

  async getMonthlyComparison(period: string, entityId?: string) {
    const since = getDateRange(period);
    const fx = createExchangeRateService();

    const where: Record<string, unknown> = {
      issueDate: { gte: since },
      status: "paid",
    };
    if (entityId) where.entityId = entityId;

    const invoices = await prisma.invoice.findMany({
      where,
      select: { issueDate: true, amount: true, currency: true },
      orderBy: { issueDate: "asc" },
    });

    const monthlyMap = new Map<string, number>();
    for (const inv of invoices) {
      const key = `${inv.issueDate.getFullYear()}-${String(inv.issueDate.getMonth() + 1).padStart(2, "0")}`;
      const usd = await convert(
        fx,
        Number(inv.amount),
        inv.currency,
        "monthly-comparison",
      );
      monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + usd);
    }

    const months = Array.from(monthlyMap.entries())
      .map(([month, revenue]) => ({ month, revenue }))
      .sort((a, b) => a.month.localeCompare(b.month));

    return months.map((month, index) => {
      const previousRevenue = months[index - 1]?.revenue ?? 0;
      return {
        ...month,
        previousRevenue,
        growth:
          previousRevenue > 0
            ? ((month.revenue - previousRevenue) / previousRevenue) * 100
            : 0,
      };
    });
  }
}

export const revenueRepository = new RevenueRepository();
