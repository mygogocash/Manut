import { describe, expect, it } from "vitest";

import {
  type AgingInvoiceInput,
  buildAgingSummary,
} from "@/modules/accounting/accounting.aging";

// Fixed reference date so bucket boundaries are exact and clock-independent.
const asOf = new Date("2026-08-04T00:00:00.000Z");

// Helper: a due date N days before `asOf` (N days overdue).
const dueDaysAgo = (n: number) => new Date(asOf.getTime() - n * 86_400_000);

describe("buildAgingSummary", () => {
  it("buckets each open document by how overdue it is, all five buckets", () => {
    const rows: AgingInvoiceInput[] = [
      { dueDate: dueDaysAgo(-10), outstandingBase: 100 }, // due in future
      { dueDate: dueDaysAgo(0), outstandingBase: 50 }, // due today → not yet due
      { dueDate: dueDaysAgo(15), outstandingBase: 30 }, // 1-30
      { dueDate: dueDaysAgo(45), outstandingBase: 20 }, // 31-60
      { dueDate: dueDaysAgo(75), outstandingBase: 10 }, // 61-90
      { dueDate: dueDaysAgo(120), outstandingBase: 5 }, // 90+
    ];
    const s = buildAgingSummary(rows, asOf);
    expect(s.buckets).toEqual({
      notYetDue: 150,
      d1_30: 30,
      d31_60: 20,
      d61_90: 10,
      d90plus: 5,
    });
    expect(s.total).toBe(215);
    expect(s.count).toBe(6);
  });

  it("splits the old 60+ tail at the 90-day boundary", () => {
    const rows: AgingInvoiceInput[] = [
      { dueDate: dueDaysAgo(61), outstandingBase: 1 }, // first day of 61-90
      { dueDate: dueDaysAgo(90), outstandingBase: 2 }, // last day of 61-90
      { dueDate: dueDaysAgo(91), outstandingBase: 4 }, // first day of 90+
    ];
    const s = buildAgingSummary(rows, asOf);
    expect(s.buckets.d61_90).toBe(3);
    expect(s.buckets.d90plus).toBe(4);
  });

  it("keeps the bucket sum equal to the grand total (no float drift)", () => {
    const rows: AgingInvoiceInput[] = [
      { dueDate: dueDaysAgo(5), outstandingBase: 0.1 },
      { dueDate: dueDaysAgo(5), outstandingBase: 0.2 },
      { dueDate: dueDaysAgo(40), outstandingBase: 0.1 },
    ];
    const s = buildAgingSummary(rows, asOf);
    const bucketSum = Object.values(s.buckets).reduce((a, b) => a + b, 0);
    expect(bucketSum).toBe(s.total);
    expect(s.total).toBe(0.4);
  });

  it("returns all-zero buckets for an empty set", () => {
    const s = buildAgingSummary([], asOf);
    expect(s.total).toBe(0);
    expect(s.count).toBe(0);
    expect(s.buckets).toEqual({
      notYetDue: 0,
      d1_30: 0,
      d31_60: 0,
      d61_90: 0,
      d90plus: 0,
    });
  });
});
