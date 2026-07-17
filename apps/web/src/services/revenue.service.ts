import { api } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api.type";

// ─── Types ──────────────────────────────────────────────

export interface InvestmentSummary {
  totalInvestments: number;
  investorCount: number;
  avgInvestment: number;
}

export interface ExpenseMonth {
  month: string;
  total: number;
}

export interface InvoiceStatusDetail {
  count: number;
  total: number;
}

export interface InvoiceSummary {
  byStatus: Record<string, InvoiceStatusDetail>;
  grandTotal: number;
}

export interface EntityRevenue {
  id: string;
  name: string;
  code: string;
  revenue: number;
  expenses: number;
  netIncome: number;
}

export interface PipelineStage {
  stage: string;
  count: number;
  totalValue: number;
}

export interface MonthlyComparison {
  month: string;
  revenue: number;
  previousRevenue: number;
  growth: number;
}

export interface RevenueDashboard {
  investments: InvestmentSummary;
  expenses: ExpenseMonth[];
  invoices: InvoiceSummary;
  revenueByEntity: EntityRevenue[];
  pipeline: PipelineStage[];
  monthly: MonthlyComparison[];
}

export type RevenuePeriod = "3m" | "6m" | "12m" | "ytd" | "all";

export interface RevenueParams {
  period?: RevenuePeriod;
  entityId?: string;
}

// ─── Helpers ────────────────────────────────────────────

function buildQuery<T extends object>(params: T): string {
  const qs = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== "") {
      qs.set(key, String(val));
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}

// ─── Service ────────────────────────────────────────────

export async function getRevenueDashboard(
  params: RevenueParams = {},
): Promise<ApiSuccessResponse<RevenueDashboard>> {
  return api.get(`/revenue/dashboard${buildQuery(params)}`);
}

export async function getRevenueInvestments(
  params: RevenueParams = {},
): Promise<ApiSuccessResponse<InvestmentSummary>> {
  return api.get(`/revenue/investments${buildQuery(params)}`);
}

export async function getRevenueExpenses(
  params: RevenueParams = {},
): Promise<ApiSuccessResponse<ExpenseMonth[]>> {
  return api.get(`/revenue/expenses${buildQuery(params)}`);
}

export async function getRevenueInvoices(
  params: RevenueParams = {},
): Promise<ApiSuccessResponse<InvoiceSummary>> {
  return api.get(`/revenue/invoices${buildQuery(params)}`);
}
