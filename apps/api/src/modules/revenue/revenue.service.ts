import { revenueRepository } from "@/modules/revenue/revenue.repository";
import type { RevenueQuery } from "@/modules/revenue/revenue.validation";

export class RevenueService {
  async getDashboard(query: RevenueQuery) {
    const { period, entityId } = query;

    const [
      investments,
      expenses,
      invoices,
      revenueByEntity,
      pipeline,
      monthly,
    ] = await Promise.all([
      revenueRepository.getInvestmentSummary(period, entityId),
      revenueRepository.getExpenseSummary(period, entityId),
      revenueRepository.getInvoiceSummary(period, entityId),
      revenueRepository.getRevenueByEntity(),
      revenueRepository.getDealsPipelineValue(),
      revenueRepository.getMonthlyComparison(period, entityId),
    ]);

    return {
      investments,
      expenses,
      invoices,
      revenueByEntity,
      pipeline,
      monthly,
    };
  }

  async getInvestments(query: RevenueQuery) {
    return revenueRepository.getInvestmentSummary(query.period, query.entityId);
  }

  async getExpenses(query: RevenueQuery) {
    return revenueRepository.getExpenseSummary(query.period, query.entityId);
  }

  async getInvoices(query: RevenueQuery) {
    return revenueRepository.getInvoiceSummary(query.period, query.entityId);
  }
}

export const revenueService = new RevenueService();
