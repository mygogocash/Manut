import { describe, expect, it } from "vitest";

import {
  effectiveVestedToDate,
  monthsBetweenInclusive,
  rollupGrants,
  type VestingGrant,
} from "@/modules/hrms/esop-vesting";

// Anchored to the equity summary dashboard. "Today" is fixed
// so the elapsed-month math is deterministic (2026-06-18).
const NOW = new Date(Date.UTC(2026, 5, 18));

// Executive Equity: 50,000 shares vesting Jan-2025 → Dec-2027 (36 months
// inclusive). Elapsed Jan-25 → Jun-26 = 17 months → ceil(50000*17/36).
const executiveGrant: VestingGrant = {
  shares: 50_000,
  grantDate: new Date(Date.UTC(2025, 0, 1)),
  vestingMonths: 36,
  cliffMonths: 0,
  allocationStartMonth: new Date(Date.UTC(2025, 0, 1)),
};

describe("monthsBetweenInclusive", () => {
  it("counts both endpoints (Jan-25 → Dec-27 = 36, not 35)", () => {
    expect(
      monthsBetweenInclusive(
        new Date(Date.UTC(2025, 0, 1)),
        new Date(Date.UTC(2027, 11, 1)),
      ),
    ).toBe(36);
  });

  it("Sep-24 → Aug-26 = 24", () => {
    expect(
      monthsBetweenInclusive(
        new Date(Date.UTC(2024, 8, 1)),
        new Date(Date.UTC(2026, 7, 1)),
      ),
    ).toBe(24);
  });

  it("same month (or end before start) means outright = 0", () => {
    const jan = new Date(Date.UTC(2025, 0, 1));
    expect(monthsBetweenInclusive(jan, jan)).toBe(0);
    expect(monthsBetweenInclusive(jan, new Date(Date.UTC(2024, 0, 1)))).toBe(0);
  });
});

describe("effectiveVestedToDate", () => {
  it("matches the report's auto figure (Executive Equity = 23,612)", () => {
    expect(effectiveVestedToDate(executiveGrant, NOW)).toBe(23_612);
  });

  it("a manual override wins for a scheduled grant", () => {
    expect(
      effectiveVestedToDate(
        { ...executiveGrant, vestedToDateOverride: 240 },
        NOW,
      ),
    ).toBe(240);
  });

  it("an outright grant is fully vested and ignores any override", () => {
    const outright: VestingGrant = {
      shares: 1_000,
      grantDate: new Date(Date.UTC(2025, 0, 1)),
      vestingMonths: 0,
      cliffMonths: null,
      allocationStartMonth: null,
    };
    expect(effectiveVestedToDate(outright, NOW)).toBe(1_000);
    expect(
      effectiveVestedToDate({ ...outright, vestedToDateOverride: 5 }, NOW),
    ).toBe(1_000);
  });
});

describe("rollupGrants vested-to-date", () => {
  it("sums the auto figure across scheduled grants", () => {
    const r = rollupGrants(
      [
        executiveGrant,
        {
          shares: 1_000,
          grantDate: new Date(Date.UTC(2025, 0, 1)),
          vestingMonths: 0,
          cliffMonths: null,
        },
      ],
      NOW,
    );
    expect(r.grandTotal).toBe(51_000);
    expect(r.vesting).toBe(50_000);
    expect(r.vested).toBe(1_000);
    expect(r.vestedToDate).toBe(23_612);
  });

  it("honors an override in the pool total (so the card equals the rows)", () => {
    const r = rollupGrants(
      [{ ...executiveGrant, vestedToDateOverride: 240 }],
      NOW,
    );
    expect(r.vestedToDate).toBe(240);
  });
});
