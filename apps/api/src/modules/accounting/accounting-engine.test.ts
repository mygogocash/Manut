import { describe, expect, it } from "vitest";

import {
  bucketForDaysOverdue,
  daysOverdue,
} from "@/modules/accounting/accounting.aging";
import {
  assertBalanced,
  computeEntryTotals,
  normalizeLines,
} from "@/modules/accounting/gl-posting.service";
import { formatDocNumber } from "@/modules/accounting/numbering.service";
import {
  computeDocumentTotals,
  computeTaxLine,
} from "@/modules/accounting/tax.service";

describe("tax.service", () => {
  it("computes VAT 7% and WHT 3% on a single line", () => {
    const c = computeTaxLine({
      quantity: 1,
      unitPrice: 1000,
      taxRate: 0.07,
      whtRate: 0.03,
    });
    expect(c.lineTotal.toFixed(2)).toBe("1000.00");
    expect(c.taxAmount.toFixed(2)).toBe("70.00");
    expect(c.whtAmount.toFixed(2)).toBe("30.00");
  });

  it("rounds per line to 2dp (half-up) and sums document totals", () => {
    // 3 × 33.333 = 99.999 -> 100.00; VAT 7% of 100.00 = 7.00
    const totals = computeDocumentTotals([
      { quantity: 3, unitPrice: 33.333, taxRate: 0.07 },
      { quantity: 2, unitPrice: 250, taxRate: 0.07 },
    ]);
    expect(totals.subtotal.toFixed(2)).toBe("600.00"); // 100.00 + 500.00
    expect(totals.taxTotal.toFixed(2)).toBe("42.00"); // 7.00 + 35.00
    expect(totals.whtTotal.toFixed(2)).toBe("0.00");
    // grandTotal = subtotal + VAT (WHT is not added to face value)
    expect(totals.grandTotal.toFixed(2)).toBe("642.00");
  });

  it("treats missing rates as zero", () => {
    const c = computeTaxLine({ quantity: 5, unitPrice: 20 });
    expect(c.lineTotal.toFixed(2)).toBe("100.00");
    expect(c.taxAmount.toFixed(2)).toBe("0.00");
    expect(c.whtAmount.toFixed(2)).toBe("0.00");
  });
});

describe("accounting.aging", () => {
  const due = new Date("2026-01-01T00:00:00.000Z");

  it("counts whole days overdue", () => {
    expect(daysOverdue(due, new Date("2026-01-01T00:00:00.000Z"))).toBe(0);
    expect(daysOverdue(due, new Date("2026-01-31T00:00:00.000Z"))).toBe(30);
    expect(daysOverdue(due, new Date("2025-12-25T00:00:00.000Z"))).toBe(-7);
  });

  it("maps days-overdue to the right bucket at every boundary", () => {
    expect(bucketForDaysOverdue(-5)).toBe("notYetDue");
    expect(bucketForDaysOverdue(0)).toBe("notYetDue");
    expect(bucketForDaysOverdue(1)).toBe("d1_30");
    expect(bucketForDaysOverdue(30)).toBe("d1_30");
    expect(bucketForDaysOverdue(31)).toBe("d31_60");
    expect(bucketForDaysOverdue(60)).toBe("d31_60");
    expect(bucketForDaysOverdue(61)).toBe("d61_90");
    expect(bucketForDaysOverdue(90)).toBe("d61_90");
    expect(bucketForDaysOverdue(91)).toBe("d90plus");
    expect(bucketForDaysOverdue(999)).toBe("d90plus");
  });
});

describe("gl-posting invariants", () => {
  it("drops fully-zero lines during normalization", () => {
    const lines = normalizeLines([
      { accountId: "a", debit: 100 },
      { accountId: "b", credit: 100 },
      { accountId: "c", debit: 0, credit: 0 },
    ]);
    expect(lines).toHaveLength(2);
  });

  it("accepts a balanced entry and returns matching totals", () => {
    const lines = normalizeLines([
      { accountId: "ar", debit: 107 },
      { accountId: "rev", credit: 100 },
      { accountId: "vat", credit: 7 },
    ]);
    const { totalDebit, totalCredit } = assertBalanced(lines);
    expect(totalDebit.toFixed(2)).toBe("107.00");
    expect(totalCredit.toFixed(2)).toBe("107.00");
  });

  it("rejects an unbalanced entry", () => {
    const lines = normalizeLines([
      { accountId: "ar", debit: 107 },
      { accountId: "rev", credit: 100 },
    ]);
    expect(() => assertBalanced(lines)).toThrow(/Unbalanced/);
  });

  it("rejects an entry with no non-zero lines", () => {
    const lines = normalizeLines([{ accountId: "x", debit: 0, credit: 0 }]);
    expect(() => assertBalanced(lines)).toThrow(/no non-zero lines/);
  });

  it("sums decimals without floating-point drift", () => {
    const lines = normalizeLines([
      { accountId: "a", debit: 0.1 },
      { accountId: "b", debit: 0.2 },
      { accountId: "c", credit: 0.3 },
    ]);
    const { totalDebit, totalCredit } = computeEntryTotals(lines);
    // 0.1 + 0.2 === 0.30000000000000004 in float; Decimal keeps it exact.
    expect(totalDebit.toFixed(2)).toBe("0.30");
    expect(totalCredit.toFixed(2)).toBe("0.30");
    expect(totalDebit.equals(totalCredit)).toBe(true);
  });
});

describe("numbering formatter", () => {
  it("zero-pads to the configured width", () => {
    expect(formatDocNumber("INV-", 1, 5)).toBe("INV-00001");
    expect(formatDocNumber("JE-", 42, 6)).toBe("JE-000042");
    expect(formatDocNumber("PO-", 123456, 5)).toBe("PO-123456");
  });
});
