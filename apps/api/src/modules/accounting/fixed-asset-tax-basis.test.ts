import { Prisma } from "@nexora/database";
import { describe, expect, it } from "vitest";

import {
  buildDeferredTaxSchedule,
  type DeferredTaxAssetInput,
  type TaxRatePeriod,
} from "@/modules/accounting/fixed-asset-deferred-tax";
import {
  computeDepreciation,
  type DepreciationInput,
} from "@/modules/accounting/fixed-asset-depreciation";
import {
  findOverlappingTaxRate,
  resolveTaxUsefulLifeMonths,
  type TaxBasisAsset,
  type TaxBasisCategory,
  taxDepreciationInput,
  taxRatePeriodsOverlap,
} from "@/modules/accounting/fixed-asset-tax-basis";

const D = Prisma.Decimal;
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const HEADLINE: TaxRatePeriod = {
  effectiveFrom: d("2020-01-01"),
  effectiveTo: null,
  ratePercent: 20,
  label: "Headline 20%",
};

/** Book basis: 120,000 over 5 years from 1 Jan 2024. */
const bookState: DepreciationInput = {
  purchasePrice: "120000",
  quantity: 1,
  startDate: d("2024-01-01"),
  usefulLifeMonths: 60,
  openingBookValue: null,
  openingAsOfDate: null,
};

const asset = (over: Partial<TaxBasisAsset> = {}): TaxBasisAsset => ({
  taxUsefulLifeMonths: null,
  openingTaxWdv: null,
  openingTaxAsOfDate: null,
  ...over,
});

describe("tax basis — which useful life applies", () => {
  it("uses the asset's own tax life when it has one", () => {
    expect(
      resolveTaxUsefulLifeMonths(asset({ taxUsefulLifeMonths: 36 }), {
        taxUsefulLifeMonths: 60,
      }),
    ).toBe(36);
  });

  it("falls back to the CATEGORY's tax life when the asset has none", () => {
    // The legitimate fallback: a class default set once covers every asset in
    // it, and editing the class reaches assets already loaded.
    expect(
      resolveTaxUsefulLifeMonths(asset(), { taxUsefulLifeMonths: 60 }),
    ).toBe(60);
  });

  it("returns null when NEITHER has one — never the book life", () => {
    expect(
      resolveTaxUsefulLifeMonths(asset(), { taxUsefulLifeMonths: null }),
    ).toBeNull();
    expect(resolveTaxUsefulLifeMonths(asset(), undefined)).toBeNull();
    expect(resolveTaxUsefulLifeMonths(asset(), null)).toBeNull();
  });

  it("treats a non-positive life as absent rather than as a basis", () => {
    // A zero life gives the engine a zero daily rate and a WDV frozen at cost,
    // which would report a large fictional temporary difference.
    expect(
      resolveTaxUsefulLifeMonths(asset({ taxUsefulLifeMonths: 0 }), {
        taxUsefulLifeMonths: 48,
      }),
    ).toBe(48);
    expect(
      resolveTaxUsefulLifeMonths(asset({ taxUsefulLifeMonths: 0 }), null),
    ).toBeNull();
  });
});

describe("tax basis — engine input assembly", () => {
  it("keeps cost / quantity / start date and swaps only the life", () => {
    const input = taxDepreciationInput(
      bookState,
      asset({ taxUsefulLifeMonths: 36 }),
    );
    expect(input).not.toBeNull();
    expect(input!.purchasePrice).toBe("120000");
    expect(input!.quantity).toBe(1);
    expect(input!.startDate).toEqual(d("2024-01-01"));
    expect(input!.usefulLifeMonths).toBe(36);
    expect(input!.openingBookValue).toBeNull();
  });

  it("carries the tax cut-over anchor when BOTH halves are present", () => {
    const input = taxDepreciationInput(
      bookState,
      asset({
        taxUsefulLifeMonths: 36,
        openingTaxWdv: new D("40000"),
        openingTaxAsOfDate: d("2025-12-31"),
      }),
    );
    expect(input!.openingBookValue).toBe("40000");
    expect(input!.openingAsOfDate).toEqual(d("2025-12-31"));
  });

  it("drops a half-configured anchor rather than depreciating from startDate with it", () => {
    const input = taxDepreciationInput(
      bookState,
      asset({ taxUsefulLifeMonths: 36, openingTaxWdv: new D("40000") }),
    );
    expect(input!.openingBookValue).toBeNull();
    expect(input!.openingAsOfDate).toBeNull();
  });

  it("returns null — not a book-life default — when there is no tax basis", () => {
    expect(taxDepreciationInput(bookState, asset(), null)).toBeNull();
  });
});

describe("tax basis → deferred tax schedule", () => {
  const scheduleFor = (a: TaxBasisAsset, category: TaxBasisCategory | null) => {
    const asOf = d("2026-12-31");
    const taxState = taxDepreciationInput(bookState, a, category);
    const line: DeferredTaxAssetInput = {
      assetId: "a1",
      assetNo: "FA-IT-2026-001",
      name: "Server",
      categoryCode: "IT",
      bookCarrying: computeDepreciation(bookState, asOf).netBookValue,
      taxWdv: taxState
        ? computeDepreciation(taxState, asOf).netBookValue
        : null,
    };
    return buildDeferredTaxSchedule([line], { asOf, rates: [HEADLINE] });
  };

  it("measures a real difference off the CATEGORY's tax life", () => {
    // 3y tax life vs 5y book life at 31-12-2026: tax is fully written down to
    // the 1 baht memo while book still carries ~48k, so the difference — and
    // the deferred tax liability — must be non-zero.
    const s = scheduleFor(asset(), { taxUsefulLifeMonths: 36 });
    expect(s.lines).toHaveLength(1);
    expect(s.exclusions).toHaveLength(0);
    expect(s.lines[0]!.taxWdv.toFixed(2)).toBe("1.00");
    expect(s.lines[0]!.temporaryDifference.isPositive()).toBe(true);
    expect(s.totals.deferredTaxLiability.isZero()).toBe(false);
  });

  it("EXCLUDES an asset with neither life instead of defaulting to book", () => {
    // The failure this whole workstream is shaped around: falling back to the
    // book life makes taxWdv === bookCarrying, so the difference is exactly
    // zero and the schedule renders a clean, plausible, entirely wrong 0.00
    // with full coverage. The asset must be named as an exclusion instead.
    const s = scheduleFor(asset(), null);
    expect(s.lines).toHaveLength(0);
    expect(s.exclusions).toEqual([
      {
        assetId: "a1",
        assetNo: "FA-IT-2026-001",
        name: "Server",
        reason: "no-tax-basis",
      },
    ]);
    expect(s.coverage).toEqual({
      assetsIncluded: 0,
      assetsExcluded: 1,
      percentIncluded: 0,
    });
  });
});

describe("entity tax rate periods — overlap detection", () => {
  const range = (from: string, to: string | null) => ({
    effectiveFrom: d(from),
    effectiveTo: to ? d(to) : null,
  });

  it("treats a null end date as open-ended", () => {
    expect(
      taxRatePeriodsOverlap(
        range("2020-01-01", null),
        range("2030-01-01", "2030-12-31"),
      ),
    ).toBe(true);
  });

  it("counts a shared boundary date as an overlap", () => {
    expect(
      taxRatePeriodsOverlap(
        range("2020-01-01", "2024-12-31"),
        range("2024-12-31", "2029-12-31"),
      ),
    ).toBe(true);
  });

  it("accepts adjacent periods that meet but do not overlap", () => {
    expect(
      taxRatePeriodsOverlap(
        range("2020-01-01", "2024-12-31"),
        range("2025-01-01", "2029-12-31"),
      ),
    ).toBe(false);
  });

  it("names the clashing row, and ignores the row being edited", () => {
    const existing = [
      { id: "r1", ...range("2020-01-01", "2024-12-31") },
      { id: "r2", ...range("2025-01-01", null) },
    ];
    expect(
      findOverlappingTaxRate(range("2026-01-01", "2026-12-31"), existing)?.id,
    ).toBe("r2");
    // Editing r2 in place must not collide with itself.
    expect(
      findOverlappingTaxRate(range("2025-06-01", null), existing, "r2"),
    ).toBeUndefined();
  });
});
