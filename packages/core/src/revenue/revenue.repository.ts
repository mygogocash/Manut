import { and, asc, count, eq, gte, isNull, ne, sql } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";
import { resolveRate } from "../lib/fx";

const REPORT_CURRENCY = "USD";

function getDateRange(period: string): string {
  const now = new Date();
  let d: Date;
  switch (period) {
    case "3m":
      d = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      break;
    case "6m":
      d = new Date(now.getFullYear(), now.getMonth() - 6, 1);
      break;
    case "ytd":
      d = new Date(now.getFullYear(), 0, 1);
      break;
    case "all":
      d = new Date(2000, 0, 1);
      break;
    case "12m":
    default:
      d = new Date(now.getFullYear(), now.getMonth() - 12, 1);
  }
  return d.toISOString().slice(0, 10);
}

async function convert(db: Db, amount: number, currency: string): Promise<number> {
  const from = (currency || REPORT_CURRENCY).toUpperCase();
  const lookup = await resolveRate(db, from, REPORT_CURRENCY);
  if (lookup.source === "missing") return 0;
  return amount * lookup.rate;
}

export async function getInvestmentSummary(db: Db, period: string, entityId?: string) {
  const since = getDateRange(period);
  const rows = entityId
    ? await db
        .select({ amount: schema.investments.amount, currency: schema.investments.currency })
        .from(schema.investments)
        .innerJoin(schema.investors, eq(schema.investments.investorId, schema.investors.id))
        .innerJoin(schema.users, eq(schema.investors.addedBy, schema.users.id))
        .where(and(gte(schema.investments.date, since), eq(schema.users.entityId, entityId)))
    : await db
        .select({ amount: schema.investments.amount, currency: schema.investments.currency })
        .from(schema.investments)
        .where(gte(schema.investments.date, since));

  let total = 0;
  for (const inv of rows) total += await convert(db, Number(inv.amount), inv.currency);
  const countN = rows.length;
  return { totalInvestments: total, investorCount: countN, avgInvestment: countN > 0 ? total / countN : 0 };
}

export async function getExpenseSummary(db: Db, period: string, entityId?: string) {
  const since = getDateRange(period);
  const parts = [gte(schema.expenses.date, since), ne(schema.expenses.status, "rejected")];
  if (entityId) parts.push(eq(schema.expenses.entityId, entityId));
  const rows = await db
    .select({ amount: schema.expenses.amount, currency: schema.expenses.currency, date: schema.expenses.date })
    .from(schema.expenses)
    .where(and(...parts))
    .orderBy(asc(schema.expenses.date));

  const monthlyMap = new Map<string, number>();
  for (const row of rows) {
    const d = row.date ?? since;
    const key = d.slice(0, 7);
    const usd = await convert(db, Number(row.amount), row.currency);
    monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + usd);
  }
  return Array.from(monthlyMap.entries())
    .map(([month, total]) => ({ month, total }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export async function getInvoiceSummary(db: Db, period: string, entityId?: string) {
  const since = getDateRange(period);
  const parts = [gte(schema.invoices.issueDate, since), isNull(schema.invoices.deletedAt)];
  if (entityId) parts.push(eq(schema.invoices.entityId, entityId));
  const rows = await db
    .select({ status: schema.invoices.status, amount: schema.invoices.amount, currency: schema.invoices.currency })
    .from(schema.invoices)
    .where(and(...parts));

  const summary: Record<string, { count: number; total: number }> = {};
  let grandTotal = 0;
  for (const row of rows) {
    const usd = await convert(db, Number(row.amount), row.currency);
    const bucket = summary[row.status] ?? { count: 0, total: 0 };
    bucket.count += 1;
    bucket.total += usd;
    summary[row.status] = bucket;
    grandTotal += usd;
  }
  return { byStatus: summary, grandTotal };
}

export async function getRevenueByEntity(db: Db) {
  const entities = await db
    .select({ id: schema.entities.id, name: schema.entities.name, code: schema.entities.code })
    .from(schema.entities)
    .where(eq(schema.entities.isActive, true));

  const results = [];
  for (const entity of entities) {
    const invoices = await db
      .select({ amount: schema.invoices.amount, currency: schema.invoices.currency })
      .from(schema.invoices)
      .where(and(eq(schema.invoices.entityId, entity.id), eq(schema.invoices.status, "paid")));
    const expenses = await db
      .select({ amount: schema.expenses.amount, currency: schema.expenses.currency })
      .from(schema.expenses)
      .where(and(eq(schema.expenses.entityId, entity.id), ne(schema.expenses.status, "rejected")));

    let revenue = 0;
    for (const inv of invoices) revenue += await convert(db, Number(inv.amount), inv.currency);
    let expenseTotal = 0;
    for (const exp of expenses) expenseTotal += await convert(db, Number(exp.amount), exp.currency);
    results.push({ id: entity.id, name: entity.name, code: entity.code, revenue, expenses: expenseTotal, netIncome: revenue - expenseTotal });
  }
  return results;
}

export async function getBnryTransactionSummary(db: Db, period: string) {
  const since = getDateRange(period);
  const [row] = await db
    .select({ total: sql<string>`coalesce(sum(${schema.bnryTransactions.amount}), 0)`, n: count() })
    .from(schema.bnryTransactions)
    .where(gte(schema.bnryTransactions.date, since));
  return { totalVolume: Number(row?.total ?? 0), transactionCount: Number(row?.n ?? 0) };
}

export async function getDealsPipelineValue(db: Db) {
  const rows = await db
    .select({ stage: schema.deals.stage, n: count(), total: sql<string>`coalesce(sum(${schema.deals.value}), 0)` })
    .from(schema.deals)
    .groupBy(schema.deals.stage);
  return rows.map((r) => ({ stage: r.stage, count: Number(r.n), totalValue: Number(r.total) }));
}

export async function getMonthlyComparison(db: Db, period: string, entityId?: string) {
  const since = getDateRange(period);
  const parts = [gte(schema.invoices.issueDate, since), eq(schema.invoices.status, "paid"), isNull(schema.invoices.deletedAt)];
  if (entityId) parts.push(eq(schema.invoices.entityId, entityId));
  const rows = await db
    .select({ issueDate: schema.invoices.issueDate, amount: schema.invoices.amount, currency: schema.invoices.currency })
    .from(schema.invoices)
    .where(and(...parts))
    .orderBy(asc(schema.invoices.issueDate));

  const monthlyMap = new Map<string, number>();
  for (const inv of rows) {
    const key = (inv.issueDate ?? since).slice(0, 7);
    const usd = await convert(db, Number(inv.amount), inv.currency);
    monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + usd);
  }
  const months = Array.from(monthlyMap.entries())
    .map(([month, revenue]) => ({ month, revenue }))
    .sort((a, b) => a.month.localeCompare(b.month));
  return months.map((m, i) => {
    const prev = i > 0 ? months[i - 1] : undefined;
    const previousRevenue = prev?.revenue ?? 0;
    const growth =
      prev && prev.revenue > 0 ? ((m.revenue - prev.revenue) / prev.revenue) * 100 : 0;
    return { ...m, previousRevenue, growth };
  });
}
