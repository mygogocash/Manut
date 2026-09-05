import { describe, expect, it } from "vitest";

import {
  buildDepreciationSchedule,
  buildDisposalReport,
  buildFixedAssetRegisterReport,
  buildMovementReport,
} from "./fixed-asset-reports";

describe("fixed asset register report", () => {
  const lines = [
    {
      assetNo: "FA-IT-2026-002",
      name: "B",
      categoryCode: "IT",
      status: "active",
      quantity: 1,
      cost: 100,
      accumulatedDepreciation: 40,
      netBookValue: 60,
    },
    {
      assetNo: "FA-IT-2026-001",
      name: "A",
      categoryCode: "IT",
      status: "disposed",
      quantity: 1,
      cost: 200,
      accumulatedDepreciation: 200,
      netBookValue: 0,
    },
    {
      assetNo: "FA-FF-2026-001",
      name: "C",
      categoryCode: "FF",
      status: "active",
      quantity: 2,
      cost: 50,
      accumulatedDepreciation: 10,
      netBookValue: 40,
    },
  ];

  it("groups by category (sorted), sorts rows by code, and sub-totals each group", () => {
    const r = buildFixedAssetRegisterReport(lines);
    expect(r.groups.map((g) => g.categoryCode)).toEqual(["FF", "IT"]);
    const it = r.groups.find((g) => g.categoryCode === "IT")!;
    expect(it.rows.map((row) => row.assetNo)).toEqual([
      "FA-IT-2026-001",
      "FA-IT-2026-002",
    ]);
    expect(it.subtotal).toEqual({
      cost: 300,
      accumulatedDepreciation: 240,
      netBookValue: 60,
    });
  });

  it("splits using vs not-using and totals the whole set", () => {
    const r = buildFixedAssetRegisterReport(lines);
    expect(r.usingTotal.netBookValue).toBe(100); // 60 + 40 (both active)
    expect(r.notUsingTotal.netBookValue).toBe(0); // the disposed line
    expect(r.grandTotal).toEqual({
      cost: 350,
      accumulatedDepreciation: 250,
      netBookValue: 100,
    });
  });
});

describe("depreciation schedule", () => {
  it("sub-totals opening / depreciation / closing by category", () => {
    const r = buildDepreciationSchedule([
      {
        assetNo: "FA-IT-2026-001",
        name: "A",
        categoryCode: "IT",
        openingNbv: 100,
        depreciation: 10,
        closingNbv: 90,
      },
      {
        assetNo: "FA-IT-2026-002",
        name: "B",
        categoryCode: "IT",
        openingNbv: 50,
        depreciation: 5,
        closingNbv: 45,
      },
    ]);
    expect(r.total).toEqual({
      openingNbv: 150,
      depreciation: 15,
      closingNbv: 135,
    });
    expect(r.groups[0]!.subtotal.depreciation).toBe(15);
  });
});

describe("disposal report", () => {
  it("orders by disposal date and totals proceeds / NBV / gain-loss", () => {
    const r = buildDisposalReport([
      {
        assetNo: "A2",
        name: "b",
        disposalDate: "2026-12-31",
        disposalType: "disposal",
        proceeds: 3000,
        nbvDisposed: 4850.54,
        gainLoss: -1850.54,
      },
      {
        assetNo: "A1",
        name: "a",
        disposalDate: "2026-06-01",
        disposalType: "write_off",
        proceeds: 0,
        nbvDisposed: 100,
        gainLoss: -100,
      },
    ]);
    expect(r.rows.map((x) => x.assetNo)).toEqual(["A1", "A2"]);
    expect(r.total).toEqual({
      proceeds: 3000,
      nbvDisposed: 4950.54,
      gainLoss: -1950.54,
    });
  });
});

describe("movement report", () => {
  it("rolls opening/additions/disposals/depreciation/closing by category + grand total", () => {
    const r = buildMovementReport([
      {
        categoryCode: "IT",
        opening: 100,
        additions: 50,
        disposals: 10,
        depreciation: 20,
        closing: 120,
      },
      {
        categoryCode: "IT",
        opening: 0,
        additions: 30,
        disposals: 0,
        depreciation: 5,
        closing: 25,
      },
      {
        categoryCode: "FF",
        opening: 200,
        additions: 0,
        disposals: 0,
        depreciation: 40,
        closing: 160,
      },
    ]);
    const it = r.rows.find((x) => x.categoryCode === "IT")!;
    expect(it).toEqual({
      categoryCode: "IT",
      opening: 100,
      additions: 80,
      disposals: 10,
      depreciation: 25,
      closing: 145,
    });
    expect(r.total.additions).toBe(80);
    expect(r.total.closing).toBe(305);
  });
});
