import { describe, expect, it } from "vitest";

import {
  monthDateRange,
  taxMonthLocked,
  taxMonthOf,
} from "@/modules/accounting/tax-filing";

describe("monthDateRange", () => {
  it("spans a 31-day month", () => {
    expect(monthDateRange(2026, 1)).toEqual({
      startDate: "2026-01-01",
      endDate: "2026-01-31",
    });
  });

  it("spans a 30-day month", () => {
    expect(monthDateRange(2026, 4)).toEqual({
      startDate: "2026-04-01",
      endDate: "2026-04-30",
    });
  });

  it("handles February in a non-leap year", () => {
    expect(monthDateRange(2026, 2)).toEqual({
      startDate: "2026-02-01",
      endDate: "2026-02-28",
    });
  });

  it("handles February in a leap year", () => {
    expect(monthDateRange(2028, 2)).toEqual({
      startDate: "2028-02-01",
      endDate: "2028-02-29",
    });
  });

  it("spans December (year boundary)", () => {
    expect(monthDateRange(2026, 12)).toEqual({
      startDate: "2026-12-01",
      endDate: "2026-12-31",
    });
  });
});

describe("taxMonthLocked", () => {
  it("locks a filed month, opens a reopened / absent one", () => {
    expect(taxMonthLocked("filed")).toBe(true);
    expect(taxMonthLocked("reopened")).toBe(false);
    expect(taxMonthLocked(null)).toBe(false);
    expect(taxMonthLocked(undefined)).toBe(false);
  });
});

describe("taxMonthOf", () => {
  it("reads the UTC year + month of a date", () => {
    expect(taxMonthOf(new Date("2026-08-04T00:00:00.000Z"))).toEqual({
      year: 2026,
      month: 8,
    });
    // Last instant of a month stays in that month.
    expect(taxMonthOf(new Date("2026-01-31T00:00:00.000Z"))).toEqual({
      year: 2026,
      month: 1,
    });
  });
});
