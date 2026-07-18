import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  dashboardStatsSchema,
  getDashboardStats,
} from "../src/dashboard/dashboard";

const stats = {
  kpis: {
    totalEmployees: 12,
    activeProjects: 3,
    pendingLeaves: 2,
    pendingTravels: 0,
    pendingExpenses: 1,
    expensesThisMonth: 4500,
  },
  pendingActions: [
    {
      kind: "leave" as const,
      id: "leave-1",
      title: "Approve leave",
      subtitle: "Person · Annual leave",
      href: "/leave",
      createdAt: "2026-07-01T10:00:00.000Z",
    },
  ],
  expenseSummary: [{ month: "2026-07", expenses: 1200 }],
  projectStatusBreakdown: [{ status: "active", count: 3 }],
  employeesByDepartment: [{ department: "Operations", count: 5 }],
};

describe("dashboard contracts", () => {
  it("projects KPIs, pending actions, and chart series while stripping extras", () => {
    const parsed = dashboardStatsSchema.parse({
      ...stats,
      recentNews: [{ id: "news-1" }],
    });
    expect(parsed).toEqual(stats);
    expect(parsed).not.toHaveProperty("recentNews");
  });

  it("defaults missing chart series to empty arrays", () => {
    const parsed = dashboardStatsSchema.parse({
      kpis: stats.kpis,
      pendingActions: stats.pendingActions,
    });
    expect(parsed.expenseSummary).toEqual([]);
    expect(parsed.projectStatusBreakdown).toEqual([]);
    expect(parsed.employeesByDepartment).toEqual([]);
  });

  it("loads dashboard stats and forwards aborts", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({
      data: {
        ...stats,
        urgentItems: [],
      },
    });
    const client = { get } as unknown as ApiClient;

    await expect(getDashboardStats(client, signal)).resolves.toEqual(stats);
    expect(get).toHaveBeenCalledWith("/dashboard/stats", { signal });
  });
});
