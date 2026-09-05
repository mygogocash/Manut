import { describe, expect, it } from "vitest";

import {
  type ReconTxn,
  summarizeReconciliation,
} from "@/modules/accounting/bank-reconciliation";

// A small statement: two reconciled rows (+1000 in, −300 out) and one
// outstanding deposit (+500 in). Book balance = 1000 − 300 + 500 = 1200.
const TXNS: ReconTxn[] = [
  { amount: 1000, direction: "in", reconciled: true },
  { amount: 300, direction: "out", reconciled: true },
  { amount: 500, direction: "in", reconciled: false },
];

describe("summarizeReconciliation", () => {
  it("splits reconciled vs outstanding and totals the signed movements", () => {
    const s = summarizeReconciliation(TXNS);
    expect(s.transactionCount).toBe(3);
    expect(s.reconciledCount).toBe(2);
    expect(s.unreconciledCount).toBe(1);
    expect(s.reconciledAmount).toBe(700); // 1000 − 300
    expect(s.unreconciledAmount).toBe(500);
    expect(s.bookBalance).toBe(1200);
    expect(s.statementBalance).toBeNull();
    expect(s.difference).toBeNull();
    expect(s.balanced).toBe(false); // no statement figure supplied
  });

  it("treats a null direction as an already-signed amount", () => {
    const s = summarizeReconciliation([
      { amount: -250, direction: null, reconciled: true },
      { amount: 400, reconciled: true },
    ]);
    expect(s.bookBalance).toBe(150);
  });

  it("computes the closing-figure difference and is not balanced while items are outstanding", () => {
    // Statement says 1200 but 500 is still outstanding → book ties (diff 0) yet
    // NOT fully reconciled because an item is unmatched.
    const s = summarizeReconciliation(TXNS, 1200);
    expect(s.difference).toBe(0);
    expect(s.balanced).toBe(false);
  });

  it("is balanced only when the book ties AND nothing is outstanding", () => {
    const allReconciled: ReconTxn[] = [
      { amount: 1000, direction: "in", reconciled: true },
      { amount: 300, direction: "out", reconciled: true },
    ];
    const s = summarizeReconciliation(allReconciled, 700);
    expect(s.difference).toBe(0);
    expect(s.balanced).toBe(true);
  });

  it("reports a non-zero difference when the statement disagrees with the book", () => {
    const s = summarizeReconciliation(TXNS, 1500);
    expect(s.difference).toBe(300); // 1500 − 1200
    expect(s.balanced).toBe(false);
  });
});
