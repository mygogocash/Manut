import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import { getRevenueDashboard } from "../src/revenue/revenue";

const dashboard = {
  investments: {
    totalInvestments: 1_250_000,
    investorCount: 4,
    avgInvestment: 312_500,
  },
  expenses: [
    { month: "2026-01", total: 10_000 },
    { month: "2026-02", total: 12_500 },
  ],
  invoices: {
    byStatus: {
      paid: { count: 3, total: 80_000 },
      sent: { count: 2, total: 40_000 },
    },
    grandTotal: 120_000,
  },
  revenueByEntity: [
    {
      id: "clentity00000000000000001",
      name: "Manut Ops",
      code: "OPS",
      revenue: 90_000,
      expenses: 22_500,
      netIncome: 67_500,
    },
  ],
  pipeline: [
    { stage: "qualified", count: 2, totalValue: 50_000 },
    { stage: "proposal", count: 1, totalValue: 25_000 },
  ],
  monthly: [
    {
      month: "2026-01",
      revenue: 40_000,
      previousRevenue: 30_000,
      growth: 33.33,
    },
    {
      month: "2026-02",
      revenue: 50_000,
      previousRevenue: 40_000,
      growth: 25,
    },
  ],
};

describe("revenue foundation contracts", () => {
  it("projects dashboard KPIs and strips chart/detail payloads", async () => {
    const get = vi.fn().mockResolvedValue({ data: dashboard });
    const client = { get } as unknown as ApiClient;

    const result = await getRevenueDashboard(client, { period: "12m" });
    expect(result).toEqual({
      period: "12m",
      totalInvestments: 1_250_000,
      investorCount: 4,
      totalInvoiced: 120_000,
      invoiceCount: 5,
      totalExpenses: 22_500,
      pipelineValue: 75_000,
      latestGrowth: 25,
    });
    expect(result).not.toHaveProperty("investments");
    expect(result).not.toHaveProperty("expenses");
    expect(result).not.toHaveProperty("invoices");
    expect(result).not.toHaveProperty("revenueByEntity");
    expect(result).not.toHaveProperty("pipeline");
    expect(result).not.toHaveProperty("monthly");
    expect(get).toHaveBeenCalledWith(
      "/revenue/dashboard?period=12m",
      undefined,
    );
  });

  it("defaults period to 12m and forwards entityId", async () => {
    const get = vi.fn().mockResolvedValue({
      data: {
        investments: { totalInvestments: 0, investorCount: 0, avgInvestment: 0 },
        expenses: [],
        invoices: { byStatus: {}, grandTotal: 0 },
        revenueByEntity: [],
        pipeline: [],
        monthly: [],
      },
    });
    const client = { get } as unknown as ApiClient;

    const result = await getRevenueDashboard(client, {
      entityId: "clentity00000000000000001",
    });
    expect(result.period).toBe("12m");
    expect(result.latestGrowth).toBeNull();
    expect(get).toHaveBeenCalledWith(
      "/revenue/dashboard?period=12m&entityId=clentity00000000000000001",
      undefined,
    );
  });
});
