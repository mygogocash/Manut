import { Prisma } from "@nexora/database";
import { describe, expect, it } from "vitest";

import {
  buildDeferredTaxSchedule,
  type DeferredTaxAssetInput,
  resolveTaxRate,
  type TaxRatePeriod,
} from "./fixed-asset-deferred-tax";

const D = Prisma.Decimal;
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const dec = (n: string) => new D(n);

const HEADLINE: TaxRatePeriod = {
  effectiveFrom: d("2020-01-01"),
  effectiveTo: null,
  ratePercent: 20,
  label: "Headline 20%",
};

const asset = (
  over: Partial<DeferredTaxAssetInput> = {},
): DeferredTaxAssetInput => ({
  assetId: "a1",
  assetNo: "FA-IT-2026-001",
  name: "Laptop",
  categoryCode: "IT",
  bookCarrying: dec("60000"),
  taxWdv: dec("40000"),
  ...over,
});

describe("deferred tax — effective-dated rate resolution", () => {
  const BOI: TaxRatePeriod = {
    effectiveFrom: d("2025-01-01"),
    effectiveTo: d("2029-12-31"),
    ratePercent: 0,
    label: "BOI promotion",
  };

  it("picks the rate in force on the date", () => {
    expect(resolveTaxRate([HEADLINE], d("2026-12-31"))?.ratePercent).toBe(20);
  });

  it("a BOI promotion overrides the headline rate for its window", () => {
    // Applying 20% to a BOI entity taxed at 0% conjures a liability that does
    // not exist — the later-starting period must win.
    expect(resolveTaxRate([HEADLINE, BOI], d("2026-12-31"))?.ratePercent).toBe(
      0,
    );
  });

  it("falls back to the headline rate once the promotion expires", () => {
    expect(resolveTaxRate([HEADLINE, BOI], d("2030-06-30"))?.ratePercent).toBe(
      20,
    );
  });

  it("returns null before any rate is effective — never a default", () => {
    expect(resolveTaxRate([HEADLINE], d("2019-12-31"))).toBeNull();
  });

  it("returns null when nothing is configured", () => {
    expect(resolveTaxRate([], d("2026-12-31"))).toBeNull();
  });
});

describe("deferred tax — measurement", () => {
  it("book above tax base is a taxable difference (liability)", () => {
    const s = buildDeferredTaxSchedule([asset()], {
      asOf: d("2026-12-31"),
      rates: [HEADLINE],
    });
    expect(s.lines[0]!.temporaryDifference.toFixed(2)).toBe("20000.00");
    expect(s.lines[0]!.deferredTax.toFixed(2)).toBe("4000.00");
    expect(s.totals.deferredTaxLiability.toFixed(2)).toBe("4000.00");
    expect(s.totals.deferredTaxAsset.toFixed(2)).toBe("0.00");
  });

  it("book below tax base is a deductible difference (asset)", () => {
    const s = buildDeferredTaxSchedule(
      [asset({ bookCarrying: dec("30000"), taxWdv: dec("45000") })],
      { asOf: d("2026-12-31"), rates: [HEADLINE] },
    );
    expect(s.lines[0]!.deferredTax.toFixed(2)).toBe("-3000.00");
    expect(s.totals.deferredTaxAsset.toFixed(2)).toBe("3000.00");
    expect(s.totals.deferredTaxLiability.toFixed(2)).toBe("0.00");
  });

  it("reports liability and asset gross as well as net", () => {
    // A net figure alone hides a large DTA sitting against a large DTL, and
    // IAS 12 offsetting is an entity-level judgement, not this report's call.
    const s = buildDeferredTaxSchedule(
      [
        asset({
          assetId: "a1",
          bookCarrying: dec("60000"),
          taxWdv: dec("40000"),
        }),
        asset({
          assetId: "a2",
          bookCarrying: dec("10000"),
          taxWdv: dec("35000"),
        }),
      ],
      { asOf: d("2026-12-31"), rates: [HEADLINE] },
    );
    expect(s.totals.deferredTaxLiability.toFixed(2)).toBe("4000.00");
    expect(s.totals.deferredTaxAsset.toFixed(2)).toBe("5000.00");
    expect(s.totals.deferredTax.toFixed(2)).toBe("-1000.00");
  });

  it("a BOI entity at 0% produces no deferred tax at all", () => {
    const s = buildDeferredTaxSchedule([asset()], {
      asOf: d("2026-12-31"),
      rates: [
        HEADLINE,
        {
          effectiveFrom: d("2025-01-01"),
          effectiveTo: d("2029-12-31"),
          ratePercent: 0,
          label: "BOI",
        },
      ],
    });
    expect(s.lines[0]!.temporaryDifference.toFixed(2)).toBe("20000.00");
    expect(s.lines[0]!.deferredTax.toFixed(2)).toBe("0.00");
    expect(s.rateLabel).toBe("BOI");
  });
});

describe("deferred tax — an asset without a tax basis is EXCLUDED, never defaulted", () => {
  it("excludes it and names it rather than computing a zero difference", () => {
    // Defaulting taxWdv to the book value yields a temporary difference of
    // exactly zero and a clean, plausible, entirely wrong 0.00.
    const s = buildDeferredTaxSchedule(
      [asset({ assetId: "a1", taxWdv: null, name: "Unconfigured laptop" })],
      { asOf: d("2026-12-31"), rates: [HEADLINE] },
    );
    expect(s.lines).toHaveLength(0);
    expect(s.exclusions).toHaveLength(1);
    expect(s.exclusions[0]).toMatchObject({
      name: "Unconfigured laptop",
      reason: "no-tax-basis",
    });
    expect(s.totals.deferredTax.toFixed(2)).toBe("0.00");
  });

  it("excludes every asset when no rate is configured", () => {
    const s = buildDeferredTaxSchedule([asset()], {
      asOf: d("2026-12-31"),
      rates: [],
    });
    expect(s.lines).toHaveLength(0);
    expect(s.ratePercent).toBeNull();
    expect(s.exclusions[0]!.reason).toBe("no-tax-rate");
  });

  it("reports coverage so a partial schedule cannot read as complete", () => {
    const s = buildDeferredTaxSchedule(
      [
        asset({ assetId: "a1" }),
        asset({ assetId: "a2" }),
        asset({ assetId: "a3", taxWdv: null }),
        asset({ assetId: "a4", taxWdv: null }),
      ],
      { asOf: d("2026-12-31"), rates: [HEADLINE] },
    );
    expect(s.coverage).toEqual({
      assetsIncluded: 2,
      assetsExcluded: 2,
      percentIncluded: 50,
    });
  });

  it("returns null coverage rather than 0% for an empty register", () => {
    const s = buildDeferredTaxSchedule([], {
      asOf: d("2026-12-31"),
      rates: [HEADLINE],
    });
    expect(s.coverage.percentIncluded).toBeNull();
  });
});
