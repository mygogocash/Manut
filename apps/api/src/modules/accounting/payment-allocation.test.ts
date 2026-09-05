import { describe, expect, it } from "vitest";

import {
  allocateFifo,
  type AllocationInput,
  type OpenInvoice,
  validateAllocations,
} from "@/modules/accounting/payment-allocation";

describe("allocateFifo", () => {
  it("spreads the total oldest-first, leaving the last invoice partly settled", () => {
    const invoices: OpenInvoice[] = [
      { invoiceId: "A", outstanding: 100 },
      { invoiceId: "B", outstanding: 100 },
      { invoiceId: "C", outstanding: 100 },
    ];
    const allocs = allocateFifo(250, invoices);
    expect(allocs).toEqual([
      { invoiceId: "A", amount: 100, whtAmount: 0 },
      { invoiceId: "B", amount: 100, whtAmount: 0 },
      { invoiceId: "C", amount: 50, whtAmount: 0 },
    ]);
  });

  it("derives per-invoice WHT from the invoice rate", () => {
    const allocs = allocateFifo(1000, [
      { invoiceId: "A", outstanding: 1000, whtRate: 0.03 },
    ]);
    expect(allocs).toEqual([{ invoiceId: "A", amount: 1000, whtAmount: 30 }]);
  });

  it("skips zero-balance invoices and stops when the amount is exhausted", () => {
    const allocs = allocateFifo(500, [
      { invoiceId: "A", outstanding: 0 },
      { invoiceId: "B", outstanding: 300 },
      { invoiceId: "C", outstanding: 300 },
    ]);
    expect(allocs).toEqual([
      { invoiceId: "B", amount: 300, whtAmount: 0 },
      { invoiceId: "C", amount: 200, whtAmount: 0 },
    ]);
  });

  it("leaves the overflow unallocated when the total exceeds the open balance", () => {
    const allocs = allocateFifo(1000, [
      { invoiceId: "A", outstanding: 300 },
      { invoiceId: "B", outstanding: 300 },
    ]);
    // Only 600 can be applied; the caller detects the 400 over-payment.
    expect(allocs.reduce((s, a) => s + a.amount, 0)).toBe(600);
  });
});

describe("validateAllocations", () => {
  const outstanding = new Map<string, number>([
    ["A", 600],
    ["B", 500],
  ]);

  it("accepts in-range allocations and rolls up the net cash + WHT", () => {
    // `amount` is the net cash applied; WHT is additional.
    const allocs: AllocationInput[] = [
      { invoiceId: "A", amount: 600, whtAmount: 18 },
      { invoiceId: "B", amount: 400, whtAmount: 12 },
    ];
    const r = validateAllocations(allocs, outstanding);
    expect(r.valid).toBe(true);
    expect(r.totalAmount).toBe(1000);
    expect(r.totalWht).toBe(30);
  });

  it("rejects an over-application beyond the outstanding balance", () => {
    const r = validateAllocations(
      [{ invoiceId: "A", amount: 700, whtAmount: 0 }],
      outstanding,
    );
    expect(r.valid).toBe(false);
    expect(r.errors.some((e) => e.includes("exceeds"))).toBe(true);
  });

  it("rejects duplicates, unknown invoices, and empty input", () => {
    expect(
      validateAllocations(
        [
          { invoiceId: "A", amount: 100, whtAmount: 0 },
          { invoiceId: "A", amount: 100, whtAmount: 0 },
        ],
        outstanding,
      ).valid,
    ).toBe(false);

    expect(
      validateAllocations(
        [{ invoiceId: "Z", amount: 100, whtAmount: 0 }],
        outstanding,
      ).valid,
    ).toBe(false);

    const empty = validateAllocations([], outstanding);
    expect(empty.valid).toBe(false);
    expect(empty.errors).toContain("At least one allocation is required");
  });
});
