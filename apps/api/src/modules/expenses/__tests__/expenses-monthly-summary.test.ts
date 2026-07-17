import { afterEach, describe, expect, it, vi } from "vitest";

import { PERMISSIONS } from "@/common/constants/permissions";
import { expenseReportsService } from "@/modules/expenses/expense-reports.service";
import { expensesRepository } from "@/modules/expenses/expenses.repository";
import { arrayAt } from "@/test-utils/assertions";

// 1 IDR ≈ 0.0018296 THB. XYZ has no rate on file.
const IDR_RATE = 0.0018296;
const HR = [PERMISSIONS.EXPENSE_HR_READ];

function mockRates() {
  return vi
    .spyOn(expensesRepository, "convertAmount")
    .mockImplementation(async (amount, from) => {
      const cur = from.trim().toUpperCase();
      if (cur === "IDR") {
        return { converted: amount * IDR_RATE, rate: IDR_RATE };
      }
      if (cur === "XYZ") return null;
      return { converted: amount, rate: 1 };
    });
}

function mockCounts(rows: { period: string; status: string; n: number }[]) {
  vi.spyOn(expensesRepository, "summaryReportCounts").mockResolvedValue(
    rows.map((r) => ({
      period: r.period,
      status: r.status,
      _count: { _all: r.n },
    })) as never,
  );
}

function mockLines(
  rows: {
    period: string;
    amount: string;
    currency: string;
    reportId: string;
  }[],
) {
  vi.spyOn(expensesRepository, "findReportLinesForSummary").mockResolvedValue(
    rows.map((r) => ({
      amount: r.amount,
      currency: r.currency,
      date: new Date("2026-06-03T00:00:00.000Z"),
      reportId: r.reportId,
      report: { period: r.period },
    })) as never,
  );
}

describe("monthlySummary (workspace-wide monthly roll-up)", () => {
  afterEach(() => vi.restoreAllMocks());

  it("rejects callers without expense:hr-read", async () => {
    await expect(
      expenseReportsService.monthlySummary(["expense:read"], {}),
    ).rejects.toThrow(/hr-read/);
  });

  it("groups by period, sums THB per-line, and sorts newest first", async () => {
    mockRates();
    mockCounts([
      { period: "2026-06", status: "payroll_processed", n: 2 },
      { period: "2026-05", status: "approved", n: 1 },
    ]);
    mockLines([
      { period: "2026-06", amount: "604", currency: "THB", reportId: "a" },
      { period: "2026-06", amount: "1157400", currency: "IDR", reportId: "a" },
      { period: "2026-05", amount: "500", currency: "THB", reportId: "b" },
    ]);

    const { data, totals } = await expenseReportsService.monthlySummary(HR, {});

    expect(data.map((d) => d.period)).toEqual(["2026-06", "2026-05"]);
    const june = arrayAt(data, 0, "June expense summary");
    expect(june.reportCount).toBe(2);
    expect(june.expenseCount).toBe(2);
    expect(june.converted).toBe(true);
    expect(june.byStatus).toEqual({ payroll_processed: 2 });
    expect(june.totalThb).toBe(
      Math.round((604 + Math.round(1157400 * IDR_RATE * 100) / 100) * 100) /
        100,
    );
    expect(totals.reportCount).toBe(3);
    expect(totals.expenseCount).toBe(3);
    expect(totals.totalThb).toBe(Math.round((june.totalThb + 500) * 100) / 100);
  });

  it("flags a month with a missing rate and excludes the unconverted line", async () => {
    mockRates();
    mockCounts([{ period: "2026-06", status: "submitted", n: 1 }]);
    mockLines([
      { period: "2026-06", amount: "604", currency: "THB", reportId: "a" },
      { period: "2026-06", amount: "100", currency: "XYZ", reportId: "a" },
    ]);

    const { data, totals } = await expenseReportsService.monthlySummary(HR, {});

    const june = arrayAt(data, 0, "June expense summary");
    expect(june.converted).toBe(false);
    expect(june.missingRates).toContain("XYZ");
    expect(june.totalThb).toBe(604); // XYZ line not summed
    expect(totals.converted).toBe(false);
  });

  it("memoises rate lookups per currency|date", async () => {
    const spy = mockRates();
    mockCounts([{ period: "2026-06", status: "approved", n: 1 }]);
    mockLines([
      { period: "2026-06", amount: "100000", currency: "IDR", reportId: "a" },
      { period: "2026-06", amount: "57000", currency: "IDR", reportId: "a" },
      { period: "2026-06", amount: "48260", currency: "IDR", reportId: "a" },
    ]);

    await expenseReportsService.monthlySummary(HR, {});
    expect(spy).toHaveBeenCalledTimes(1);
  });
});
