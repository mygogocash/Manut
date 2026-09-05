import type { RevenueQuery } from "@nexora/contracts/modules/revenue/revenue.validation";
import type { Db } from "@nexora/db";
import * as repo from "./revenue.repository";

export async function getDashboard(db: Db, query: RevenueQuery) {
  const { period, entityId } = query;
  const [investments, expenses, invoices, revenueByEntity, bnry, pipeline, monthly] = await Promise.all([
    repo.getInvestmentSummary(db, period, entityId),
    repo.getExpenseSummary(db, period, entityId),
    repo.getInvoiceSummary(db, period, entityId),
    repo.getRevenueByEntity(db),
    repo.getBnryTransactionSummary(db, period),
    repo.getDealsPipelineValue(db),
    repo.getMonthlyComparison(db, period, entityId),
  ]);
  return { investments, expenses, invoices, revenueByEntity, bnry, pipeline, monthly };
}

export async function getInvestments(db: Db, query: RevenueQuery) {
  return repo.getInvestmentSummary(db, query.period, query.entityId);
}

export async function getExpenses(db: Db, query: RevenueQuery) {
  return repo.getExpenseSummary(db, query.period, query.entityId);
}

export async function getInvoices(db: Db, query: RevenueQuery) {
  return repo.getInvoiceSummary(db, query.period, query.entityId);
}
