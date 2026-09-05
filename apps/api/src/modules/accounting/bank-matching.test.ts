import { describe, expect, it } from "vitest";

import {
  daysBetween,
  matchBankTransaction,
  type MatchDoc,
  wantedTypeFor,
} from "@/modules/accounting/bank-matching";

const bill = (over: Partial<MatchDoc>): MatchDoc => ({
  invoiceId: "i1",
  invoiceNo: "BILL-1",
  type: "payable",
  outstanding: 2000,
  date: "2026-07-20",
  counterparty: "Water Co",
  ...over,
});

describe("daysBetween / wantedTypeFor", () => {
  it("counts whole days between ISO dates", () => {
    expect(daysBetween("2026-07-25", "2026-07-20")).toBe(5);
    expect(daysBetween("2026-07-20", "2026-07-25")).toBe(-5);
  });
  it("maps direction to the settleable side", () => {
    expect(wantedTypeFor("in")).toBe("receivable");
    expect(wantedTypeFor("out")).toBe("payable");
    expect(wantedTypeFor(null)).toBeNull();
  });
});

describe("matchBankTransaction", () => {
  const txn = { amount: 2000, date: "2026-07-22", direction: "out" as const };

  it("auto-matches a single exact-amount bill within the date window", () => {
    const r = matchBankTransaction(txn, [bill({})], 5);
    expect(r.matched?.invoiceId).toBe("i1");
    expect(r.candidates).toHaveLength(1);
  });

  it("does NOT auto-match when two bills share the amount (manual pick)", () => {
    const r = matchBankTransaction(
      txn,
      [bill({ invoiceId: "a" }), bill({ invoiceId: "b" })],
      5,
    );
    expect(r.matched).toBeNull();
    expect(r.candidates).toHaveLength(2);
  });

  it("no candidate when amount differs → needs a journal entry", () => {
    const r = matchBankTransaction(txn, [bill({ outstanding: 1999 })], 5);
    expect(r.matched).toBeNull();
    expect(r.candidates).toHaveLength(0);
  });

  it("excludes a bill whose date is outside the window", () => {
    // due 2026-07-20, txn 2026-07-22 → 2 days; window 1 excludes it.
    const r = matchBankTransaction(txn, [bill({})], 1);
    expect(r.candidates).toHaveLength(0);
  });

  it("respects direction — money out does not match a receivable", () => {
    const r = matchBankTransaction(txn, [bill({ type: "receivable" })], 5);
    expect(r.candidates).toHaveLength(0);
  });

  it("money in matches a receivable of the same amount/date", () => {
    const r = matchBankTransaction(
      { amount: 2000, date: "2026-07-22", direction: "in" },
      [bill({ type: "receivable", invoiceNo: "INV-1" })],
      5,
    );
    expect(r.matched?.invoiceNo).toBe("INV-1");
  });

  it("tolerates sub-cent amount dust", () => {
    const r = matchBankTransaction(
      { amount: 2000.004, date: "2026-07-22", direction: "out" },
      [bill({})],
      5,
    );
    expect(r.matched?.invoiceId).toBe("i1");
  });
});
