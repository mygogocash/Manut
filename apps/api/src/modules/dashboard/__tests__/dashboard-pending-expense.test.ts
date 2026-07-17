import { afterEach, describe, expect, it, vi } from "vitest";

import { dashboardRepository } from "@/modules/dashboard/dashboard.repository";
import { dashboardService } from "@/modules/dashboard/dashboard.service";
import { expenseReportsService } from "@/modules/expenses/expense-reports.service";

// Methods getStats fans out over. Counts/sums return a number; every other
// read is a list that the payload `.map`s or passes through, so [] is safe.
const NUMERIC_METHODS = [
  "countActiveEmployees",
  "countActiveProjects",
  "countPendingLeaveRequests",
  "countPendingTravelRequests",
  "sumExpensesCurrentMonth",
] as const;

const LIST_METHODS = [
  "getRecentWallPosts",
  "getRecentNews",
  "getUpcomingCompanyDates",
  "getPendingLeaveRequests",
  "getPendingTravelRequests",
  "getExpenseSummaryByMonth",
  "getProjectStatusBreakdown",
  "getEmployeesByDepartment",
  "getActiveProjectsWithProgress",
  "getUrgentItems",
  "getOpenSurveyFormsForUser",
  "getOpenSurveysForUser",
  "getUpcomingBirthdays",
  "getCrmRemindersForUser",
  "getCrmNotificationsForUser",
] as const;

function stubRepository() {
  for (const m of NUMERIC_METHODS) {
    vi.spyOn(dashboardRepository, m).mockResolvedValue(0 as never);
  }
  for (const m of LIST_METHODS) {
    vi.spyOn(dashboardRepository, m).mockResolvedValue([] as never);
  }
}

describe("dashboardService.getStats — pending expenses (v1)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("sources the expense pending action from Expenses and links to /expenses", async () => {
    stubRepository();
    vi.spyOn(expenseReportsService, "listReports").mockResolvedValue({
      data: [
        {
          id: "report-1",
          title: "June Expenses",
          period: "2026-06",
          createdAt: new Date("2026-06-15T00:00:00Z"),
          employee: { id: "emp-1", name: "Alice", department: "Product" },
          _count: { expenses: 3 },
        },
      ],
      meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
    } as never);

    const stats = await dashboardService.getStats("approver-1", []);

    const expenseActions = stats.pendingActions.filter(
      (a) => a.kind === "expense",
    );
    expect(expenseActions).toHaveLength(1);
    expect(expenseActions[0]).toMatchObject({
      id: "report-1",
      title: "Alice — June Expenses",
      subtitle: "Product · Expenses · 2026-06",
      href: "/expenses",
    });

    // KPI badge and the list share the one v1 query (meta.total).
    expect(stats.kpis.pendingExpenses).toBe(1);
    expect(stats.pendingExpenseRequests[0]).toMatchObject({
      id: "report-1",
      title: "June Expenses",
      expenseCount: 3,
    });
  });

  it("passes the caller's identity + permissions into the v1 approver query", async () => {
    stubRepository();
    const spy = vi
      .spyOn(expenseReportsService, "listReports")
      .mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
      } as never);

    await dashboardService.getStats("approver-1", ["expense:hr-read"]);

    expect(spy).toHaveBeenCalledWith(
      "approver-1",
      ["expense:hr-read"],
      expect.objectContaining({ pendingForMe: true }),
    );
  });
});
