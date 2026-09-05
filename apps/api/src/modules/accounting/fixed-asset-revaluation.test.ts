import { Prisma } from "@nexora/database";
import { describe, expect, it } from "vitest";

import {
  recogniseRemeasurement,
  remainingLifeMonths,
  remeasurementAnchor,
} from "./fixed-asset-revaluation";

const D = Prisma.Decimal;
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const fresh = { surplusBalance: 0, plLossBalance: 0 };

/** P&L + OCI must reconstitute the movement exactly — no epsilon anywhere. */
function expectSplitExact(r: ReturnType<typeof recogniseRemeasurement>) {
  expect(r.profitOrLoss.plus(r.otherComprehensiveIncome).toFixed(2)).toBe(
    r.movement.toFixed(2),
  );
}

describe("remeasurement — a first increase goes to OCI", () => {
  const r = recogniseRemeasurement({
    kind: "revaluation",
    carryingBefore: 100000,
    carryingAfter: 130000,
    balances: fresh,
  });

  it("recognises the whole uplift in OCI, nothing in profit", () => {
    expect(r.otherComprehensiveIncome.toFixed(2)).toBe("30000.00");
    expect(r.profitOrLoss.toFixed(2)).toBe("0.00");
    expectSplitExact(r);
  });

  it("carries the surplus forward", () => {
    expect(r.balances.surplusBalance.toFixed(2)).toBe("30000.00");
    expect(r.balances.plLossBalance.toFixed(2)).toBe("0.00");
  });
});

describe("remeasurement — a first decrease goes to profit or loss", () => {
  const r = recogniseRemeasurement({
    kind: "impairment",
    carryingBefore: 100000,
    carryingAfter: 78000,
    balances: fresh,
  });

  it("charges the whole write-down to profit, nothing to OCI", () => {
    expect(r.profitOrLoss.toFixed(2)).toBe("-22000.00");
    expect(r.otherComprehensiveIncome.toFixed(2)).toBe("0.00");
    expectSplitExact(r);
  });

  it("carries the P&L loss forward for a future reversal", () => {
    expect(r.balances.plLossBalance.toFixed(2)).toBe("22000.00");
  });
});

describe("remeasurement — the two exceptions are NOT symmetric", () => {
  it("a decrease consumes an existing OCI surplus FIRST, then charges profit", () => {
    // Surplus 30,000; write down 50,000. IAS 16.40: 30,000 against the surplus
    // in OCI, only the remaining 20,000 to P&L.
    const r = recogniseRemeasurement({
      kind: "impairment",
      carryingBefore: 130000,
      carryingAfter: 80000,
      balances: { surplusBalance: 30000, plLossBalance: 0 },
    });
    expect(r.otherComprehensiveIncome.toFixed(2)).toBe("-30000.00");
    expect(r.profitOrLoss.toFixed(2)).toBe("-20000.00");
    expect(r.balances.surplusBalance.toFixed(2)).toBe("0.00");
    expect(r.balances.plLossBalance.toFixed(2)).toBe("20000.00");
    expectSplitExact(r);
  });

  it("an increase reverses a prior P&L loss FIRST, then builds OCI surplus", () => {
    // Prior loss 22,000; uplift 40,000. IAS 16.39: 22,000 back through P&L,
    // the remaining 18,000 to OCI.
    const r = recogniseRemeasurement({
      kind: "revaluation",
      carryingBefore: 78000,
      carryingAfter: 118000,
      balances: { surplusBalance: 0, plLossBalance: 22000 },
    });
    expect(r.profitOrLoss.toFixed(2)).toBe("22000.00");
    expect(r.otherComprehensiveIncome.toFixed(2)).toBe("18000.00");
    expect(r.balances.plLossBalance.toFixed(2)).toBe("0.00");
    expect(r.balances.surplusBalance.toFixed(2)).toBe("18000.00");
    expectSplitExact(r);
  });

  it("two assets at the same carrying amount split the same movement differently", () => {
    // The whole reason balances are carried rather than derived.
    const withSurplus = recogniseRemeasurement({
      kind: "impairment",
      carryingBefore: 100000,
      carryingAfter: 90000,
      balances: { surplusBalance: 10000, plLossBalance: 0 },
    });
    const withoutSurplus = recogniseRemeasurement({
      kind: "impairment",
      carryingBefore: 100000,
      carryingAfter: 90000,
      balances: fresh,
    });
    expect(withSurplus.profitOrLoss.toFixed(2)).toBe("0.00");
    expect(withoutSurplus.profitOrLoss.toFixed(2)).toBe("-10000.00");
  });
});

describe("remeasurement — partial consumption", () => {
  it("a decrease smaller than the surplus never touches profit", () => {
    const r = recogniseRemeasurement({
      kind: "impairment",
      carryingBefore: 130000,
      carryingAfter: 120000,
      balances: { surplusBalance: 30000, plLossBalance: 0 },
    });
    expect(r.profitOrLoss.toFixed(2)).toBe("0.00");
    expect(r.balances.surplusBalance.toFixed(2)).toBe("20000.00");
    expectSplitExact(r);
  });

  it("an increase smaller than the prior loss never reaches OCI", () => {
    const r = recogniseRemeasurement({
      kind: "impairment_reversal",
      carryingBefore: 78000,
      carryingAfter: 90000,
      balances: { surplusBalance: 0, plLossBalance: 22000 },
    });
    expect(r.otherComprehensiveIncome.toFixed(2)).toBe("0.00");
    expect(r.profitOrLoss.toFixed(2)).toBe("12000.00");
    expect(r.balances.plLossBalance.toFixed(2)).toBe("10000.00");
    expectSplitExact(r);
  });

  it("a nil movement recognises nothing and leaves balances untouched", () => {
    const r = recogniseRemeasurement({
      kind: "revaluation",
      carryingBefore: 100000,
      carryingAfter: 100000,
      balances: { surplusBalance: 5000, plLossBalance: 3000 },
    });
    expect(r.profitOrLoss.toFixed(2)).toBe("0.00");
    expect(r.otherComprehensiveIncome.toFixed(2)).toBe("0.00");
    expect(r.balances.surplusBalance.toFixed(2)).toBe("5000.00");
    expect(r.balances.plLossBalance.toFixed(2)).toBe("3000.00");
  });
});

describe("remeasurement — impairment reversal cap (IAS 36.117)", () => {
  it("clips the reversal to the never-impaired carrying amount", () => {
    // Would-have-been carrying amount is 85,000; a 95,000 valuation must not
    // lift the asset above it — beyond the cap it is a revaluation, not a
    // reversal, and recognising it here would skip the OCI treatment entirely.
    const r = recogniseRemeasurement({
      kind: "impairment_reversal",
      carryingBefore: 70000,
      carryingAfter: 95000,
      balances: { surplusBalance: 0, plLossBalance: 30000 },
      reversalCap: 85000,
    });
    expect(r.movement.toFixed(2)).toBe("15000.00");
    expect(r.cappedAt?.toFixed(2)).toBe("85000.00");
    expect(r.profitOrLoss.toFixed(2)).toBe("15000.00");
    expectSplitExact(r);
  });

  it("leaves a reversal below the cap alone", () => {
    const r = recogniseRemeasurement({
      kind: "impairment_reversal",
      carryingBefore: 70000,
      carryingAfter: 80000,
      balances: { surplusBalance: 0, plLossBalance: 30000 },
      reversalCap: 85000,
    });
    expect(r.cappedAt).toBeUndefined();
    expect(r.movement.toFixed(2)).toBe("10000.00");
  });

  it("ignores the cap for a revaluation, which has no such ceiling", () => {
    const r = recogniseRemeasurement({
      kind: "revaluation",
      carryingBefore: 70000,
      carryingAfter: 95000,
      balances: fresh,
      reversalCap: 85000,
    });
    expect(r.cappedAt).toBeUndefined();
    expect(r.movement.toFixed(2)).toBe("25000.00");
  });
});

describe("remeasurement — re-anchoring and remaining life", () => {
  it("anchors the engine at the new carrying amount on the event date", () => {
    const anchor = remeasurementAnchor(new D("87654.321"), d("2027-06-30"));
    expect(anchor.openingBookValue).toBe("87654.32");
    expect(anchor.openingAsOfDate).toEqual(d("2027-06-30"));
  });

  it("depreciates over the REMAINING life, not a fresh full life", () => {
    // 60-month asset started 2026-01-01, remeasured 2028-01-01: 24 months gone,
    // 36 remain. Restarting at 60 would understate the charge for the rest of
    // the asset's life.
    expect(remainingLifeMonths(d("2026-01-01"), 60, d("2028-01-01"))).toBe(36);
  });

  it("never returns a negative remaining life past end of life", () => {
    expect(remainingLifeMonths(d("2020-01-01"), 12, d("2027-01-01"))).toBe(0);
  });

  it("treats a date before the start as the full life", () => {
    expect(remainingLifeMonths(d("2026-06-01"), 60, d("2026-01-01"))).toBe(60);
  });
});
