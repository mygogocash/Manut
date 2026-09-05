import { describe, expect, it } from "vitest";

import {
  computeDepreciation,
  computeDisposal,
  daysBetween,
} from "./fixed-asset-depreciation";

/**
 * The four PRD worked examples are the acceptance spec for the engine.
 * Dates are @db.Date semantics → construct at UTC midnight.
 */
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

describe("fixed asset depreciation — PRD worked example 1 (projector, opening balance)", () => {
  const input = {
    purchasePrice: 44800,
    quantity: 1,
    startDate: d("2024-05-17"),
    usefulLifeMonths: 36,
    openingBookValue: 20539,
    openingAsOfDate: d("2025-12-31"),
  };

  it("total days = 1095 and original daily rate = 40.9123", () => {
    const r = computeDepreciation(input, d("2025-12-31"));
    expect(r.totalDays).toBe(1095);
    expect(r.dailyRate.toFixed(4)).toBe("40.9123");
  });

  it("at cut-over the NBV is the imported book value and opening accumulated dep is derived", () => {
    const r = computeDepreciation(input, d("2025-12-31"));
    expect(r.netBookValue.toFixed(2)).toBe("20539.00");
    expect(r.accumulatedDepreciation.toFixed(2)).toBe("24261.00"); // 44,800 − 20,539
  });

  it("closing NBV at end of life is exactly the memo value (final-period true-up)", () => {
    const r = computeDepreciation(input, d("2027-05-17"));
    expect(r.netBookValue.toFixed(2)).toBe("1.00");
    expect(r.accumulatedDepreciation.toFixed(2)).toBe("44799.00");
  });
});

describe("fixed asset depreciation — PRD worked example 2 (hardware cabling credit note, contra line)", () => {
  const creditNote = {
    purchasePrice: -12900,
    quantity: 1,
    startDate: d("2024-12-17"),
    usefulLifeMonths: 60,
  };
  const relatedAsset = {
    purchasePrice: 59420,
    quantity: 1,
    startDate: d("2024-12-17"),
    usefulLifeMonths: 60,
  };

  it("total days = 1826 (one leap day in the 5-year window)", () => {
    expect(computeDepreciation(creditNote, d("2025-01-01")).totalDays).toBe(
      1826,
    );
  });

  it("contra daily rate is a credit of -7.0641 and the line is carried at -1.00", () => {
    const r = computeDepreciation(creditNote, d("2029-12-17"));
    expect(r.dailyRate.toFixed(4)).toBe("-7.0641");
    expect(r.memoValue.toFixed(2)).toBe("-1.00");
    expect(r.netBookValue.toFixed(2)).toBe("-1.00");
    expect(r.accumulatedDepreciation.toFixed(2)).toBe("-12899.00"); // released credit
  });

  it("related asset daily rate is 32.5405 and the pair nets to 46,520.00 over the life", () => {
    const asset = computeDepreciation(relatedAsset, d("2029-12-17"));
    const contra = computeDepreciation(creditNote, d("2029-12-17"));
    expect(asset.dailyRate.toFixed(4)).toBe("32.5405");
    expect(asset.accumulatedDepreciation.toFixed(2)).toBe("59419.00");
    const netOverLife = asset.accumulatedDepreciation.plus(
      contra.accumulatedDepreciation,
    );
    expect(netOverLife.toFixed(2)).toBe("46520.00");
  });
});

describe("fixed asset depreciation — PRD worked example 3 (office chairs, 3 of 8 disposed)", () => {
  // startDate chosen so 2026-12-31 is the 694th day (inclusive) and life = 1826 days.
  const input = {
    purchasePrice: 20859.84,
    quantity: 8,
    startDate: d("2025-02-06"),
    usefulLifeMonths: 60,
  };

  it("694 inclusive days to the disposal date → accumulated dep 7,925.07", () => {
    expect(daysBetween(input.startDate, d("2026-12-31")) + 1).toBe(694);
    const r = computeDepreciation(input, d("2026-12-31"));
    expect(r.accumulatedDepreciation.toFixed(2)).toBe("7925.07");
  });

  it("disposing 3 of 8 removes cost/dep/memo pro rata and books the loss", () => {
    const r = computeDisposal(input, {
      unitsDisposed: 3,
      disposalDate: d("2026-12-31"),
      proceeds: 3000,
    });
    expect(r.costRemoved.toFixed(2)).toBe("7822.44"); // 20,859.84 × 3/8
    expect(r.accumulatedRemoved.toFixed(2)).toBe("2971.90");
    expect(r.memoRemoved.toFixed(2)).toBe("3.00");
    expect(r.nbvDisposed.toFixed(2)).toBe("4850.54");
    expect(r.gainLoss.toFixed(2)).toBe("-1850.54"); // loss
    expect(r.remaining.quantity).toBe(5);
    expect(r.remaining.purchasePrice.toFixed(2)).toBe("13037.40");
  });
});

describe("fixed asset depreciation — PRD worked example 4 (post cut-over asset)", () => {
  const input = {
    purchasePrice: 13150,
    quantity: 1,
    startDate: d("2026-01-13"),
    usefulLifeMonths: 60,
    // Post cut-over: no opening anchor → depreciates from start, opening accum 0.
  };

  it("opening accumulated dep is 0 at start and daily rate is 7.2010", () => {
    const atStart = computeDepreciation(input, d("2026-01-13"));
    expect(atStart.dailyRate.toFixed(4)).toBe("7.2010");
    // Day 1 only — one day's depreciation, rounded to 2 dp money.
    expect(atStart.accumulatedDepreciation.toFixed(2)).toBe("7.20");
    const before = computeDepreciation(input, d("2026-01-12"));
    expect(before.accumulatedDepreciation.toFixed(2)).toBe("0.00");
  });

  it("closing NBV at end of life is exactly the memo value", () => {
    const r = computeDepreciation(input, d("2031-01-13"));
    expect(r.netBookValue.toFixed(2)).toBe("1.00");
  });
});

describe("fixed asset depreciation — invariants & edge cases", () => {
  it("net book value never falls below the memo value on any date", () => {
    const input = {
      purchasePrice: 10000,
      quantity: 1,
      startDate: d("2020-01-01"),
      usefulLifeMonths: 12,
    };
    // Long past end of life — must hold at memo, never negative.
    const r = computeDepreciation(input, d("2030-01-01"));
    expect(r.netBookValue.toFixed(2)).toBe("1.00");
  });

  it("a write-off (no proceeds) books the full remaining NBV as a loss", () => {
    const input = {
      purchasePrice: 5000,
      quantity: 1,
      startDate: d("2026-01-01"),
      usefulLifeMonths: 60,
    };
    const r = computeDisposal(input, {
      unitsDisposed: 1,
      disposalDate: d("2026-07-01"),
      proceeds: 0,
    });
    expect(r.gainLoss.toFixed(2)).toBe(r.nbvDisposed.times(-1).toFixed(2));
  });

  it("rejects disposing more units than are on hand", () => {
    const input = {
      purchasePrice: 800,
      quantity: 8,
      startDate: d("2026-01-01"),
      usefulLifeMonths: 60,
    };
    expect(() =>
      computeDisposal(input, {
        unitsDisposed: 9,
        disposalDate: d("2026-06-01"),
        proceeds: 0,
      }),
    ).toThrow(/between 1 and 8/);
  });
});

describe("fixed asset depreciation — deferred in-service date (regression)", () => {
  // An asset can carry a cut-over anchor dated BEFORE its own start date (the
  // sheet holds Purchase Date and Start Date separately). Depreciating forward
  // from the anchor charged days the asset was not yet in service.
  const input = {
    purchasePrice: 60000,
    quantity: 1,
    startDate: d("2026-03-01"),
    usefulLifeMonths: 60,
    openingBookValue: 60000,
    openingAsOfDate: d("2025-12-31"),
  };

  it("charges nothing before the start date even with an earlier anchor", () => {
    const r = computeDepreciation(input, d("2026-02-01"));
    expect(r.netBookValue.toFixed(2)).toBe("60000.00");
    expect(r.accumulatedDepreciation.toFixed(2)).toBe("0.00");
    const eve = computeDepreciation(input, d("2026-02-28"));
    expect(eve.accumulatedDepreciation.toFixed(2)).toBe("0.00");
  });

  it("starts charging on the start date, not the anchor date", () => {
    // Day 1 in service = 2026-03-01 → exactly one day of depreciation.
    const r = computeDepreciation(input, d("2026-03-01"));
    expect(Number(r.accumulatedDepreciation)).toBeGreaterThan(0);
    expect(Number(r.accumulatedDepreciation)).toBeLessThan(
      Number(r.dailyRate) * 2,
    );
  });
});

describe("fixed asset — point-in-time state after a partial disposal (regression)", () => {
  // A partial disposal permanently reduces the live row's cost + quantity.
  // Reports rebuild the pre-disposal state from the disposal's *Before snapshot,
  // so an old-dated report is NOT restated against today's reduced cost.
  const original = {
    purchasePrice: 20859.84,
    quantity: 8,
    startDate: d("2025-02-06"),
    usefulLifeMonths: 60,
  };

  it("valuing a date before the disposal uses the pre-disposal cost + quantity", () => {
    const beforeDisposal = computeDepreciation(original, d("2026-06-30"));

    // After approving 3-of-8 on 2026-12-31 the live row becomes qty 5 / cost
    // 13,037.40 (see worked example 3). Valuing 2026-06-30 against THAT would
    // understate the register by the disposed units' book value.
    const reduced = {
      ...original,
      purchasePrice: 13037.4,
      quantity: 5,
    };
    const restated = computeDepreciation(reduced, d("2026-06-30"));
    expect(Number(restated.netBookValue)).toBeLessThan(
      Number(beforeDisposal.netBookValue),
    );

    // Rebuilding from the snapshot (costBefore / quantityBefore) reproduces the
    // original figures exactly — this is what assetStateAt feeds the engine.
    const rebuilt = computeDepreciation(
      { ...reduced, purchasePrice: 20859.84, quantity: 8 },
      d("2026-06-30"),
    );
    expect(rebuilt.netBookValue.toFixed(2)).toBe(
      beforeDisposal.netBookValue.toFixed(2),
    );
    expect(rebuilt.accumulatedDepreciation.toFixed(2)).toBe(
      beforeDisposal.accumulatedDepreciation.toFixed(2),
    );
  });
});
