import { describe, expect, it } from "vitest";

import {
  type BillForSummary,
  summarizeExpenses,
} from "@/modules/accounting/expense-summary";

const bill = (
  amount: number,
  accountId: string | null,
  label: string | null,
): BillForSummary => ({
  amount,
  categoryAccountId: accountId,
  categoryLabel: label,
});

describe("summarizeExpenses", () => {
  it("totals and groups by category, sorted by spend desc", () => {
    const s = summarizeExpenses([
      bill(2000, "util", "5100 — Utilities"),
      bill(500, "util", "5100 — Utilities"),
      bill(3000, "rent", "5200 — Rent"),
    ]);
    expect(s.total).toBe(5500);
    expect(s.byCategory.map((b) => b.label)).toEqual([
      "5200 — Rent",
      "5100 — Utilities",
    ]);
    expect(s.byCategory[0]!.total).toBe(3000);
    expect(s.byCategory[1]!.total).toBe(2500);
  });

  it("buckets uncategorized bills under a null-account 'Uncategorized'", () => {
    const s = summarizeExpenses([bill(100, null, null), bill(50, null, null)]);
    expect(s.total).toBe(150);
    expect(s.byCategory).toHaveLength(1);
    expect(s.byCategory[0]).toMatchObject({
      accountId: null,
      label: "Uncategorized",
      total: 150,
    });
  });

  it("is empty for no bills", () => {
    const s = summarizeExpenses([]);
    expect(s.total).toBe(0);
    expect(s.byCategory).toEqual([]);
  });

  it("rounds accumulation to 2dp", () => {
    const s = summarizeExpenses([bill(33.33, "a", "A"), bill(33.34, "a", "A")]);
    expect(s.byCategory[0]!.total).toBe(66.67);
  });
});
