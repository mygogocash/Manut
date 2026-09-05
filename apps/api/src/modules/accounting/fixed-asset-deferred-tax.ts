/**
 * Deferred tax on the book-versus-tax useful life difference (WS5). Pure, no DB.
 *
 * A fixed asset depreciates twice: once over its BOOK life (what the financial
 * statements show) and once over its TAX life (what the Revenue Department
 * allows). The gap between the two carrying amounts is a temporary difference,
 * and tax on that difference is a deferred tax liability or asset.
 *
 * THE FAILURE MODE THIS MODULE IS SHAPED AROUND. Deferred tax is a single number
 * on the face of the P&L and balance sheet that nobody can eyeball. The obvious
 * convenience — `taxUsefulLifeMonths ?? usefulLifeMonths` — computes a temporary
 * difference of exactly zero for every asset and renders a clean, plausible,
 * completely wrong `0.00`. So an asset with no tax basis is EXCLUDED and
 * reported by name; it is never silently defaulted. A schedule that covers 40 of
 * 300 assets must say so on its face.
 *
 * The same reasoning governs the rate. A default 20% applied to a BOI-promoted
 * entity taxed at 0% conjures a liability that does not exist, so the rate is
 * looked up per entity and per date and its absence is an exclusion, not a
 * fallback.
 *
 * SCOPE. This measures the fixed-asset COMPONENT of deferred tax only.
 * Provisions, unrealised FX and employee benefits are outside it, so the output
 * must be labelled a component and never presented as the entity's deferred tax.
 */

import { Prisma } from "@nexora/database";

const D = Prisma.Decimal;
type Decimal = Prisma.Decimal;

/**
 * An effective-dated corporate income tax rate. Dated because the difference
 * must be measured at the rate expected to apply when it REVERSES (IAS 12.47),
 * and because BOI promotions start and end on fixed dates.
 */
export interface TaxRatePeriod {
  /** Inclusive. */
  effectiveFrom: Date;
  /** Inclusive; null = open-ended. */
  effectiveTo: Date | null;
  /** Percent, e.g. 20 for 20%. */
  ratePercent: number;
  label?: string;
}

/**
 * The rate in force on `date`, or null when none is configured. Null is a hard
 * stop for the caller, never a cue to assume a headline rate.
 */
export function resolveTaxRate(
  rates: readonly TaxRatePeriod[],
  date: Date,
): TaxRatePeriod | null {
  const t = date.getTime();
  const matches = rates.filter(
    (r) =>
      r.effectiveFrom.getTime() <= t &&
      (r.effectiveTo === null || r.effectiveTo.getTime() >= t),
  );
  if (matches.length === 0) return null;
  // Latest-starting wins, so a BOI promotion layered over a headline rate takes
  // precedence for the window it covers.
  return matches.reduce((best, r) =>
    r.effectiveFrom.getTime() > best.effectiveFrom.getTime() ? r : best,
  );
}

export interface DeferredTaxAssetInput {
  assetId: string;
  assetNo: string | null;
  name: string;
  categoryCode: string;
  /** Book carrying amount at the reporting date. */
  bookCarrying: Decimal;
  /**
   * Tax written-down value at the reporting date, or null when the asset has no
   * tax basis configured. Null EXCLUDES the asset — it never defaults to book.
   */
  taxWdv: Decimal | null;
}

export type ExclusionReason = "no-tax-basis" | "no-tax-rate";

export interface DeferredTaxLine {
  assetId: string;
  assetNo: string | null;
  name: string;
  categoryCode: string;
  bookCarrying: Decimal;
  taxWdv: Decimal;
  /** book − tax. Positive = taxable difference (DTL), negative = deductible (DTA). */
  temporaryDifference: Decimal;
  ratePercent: number;
  /** Positive = liability, negative = asset. */
  deferredTax: Decimal;
}

export interface DeferredTaxExclusion {
  assetId: string;
  assetNo: string | null;
  name: string;
  reason: ExclusionReason;
}

export interface DeferredTaxSchedule {
  asOf: Date;
  ratePercent: number | null;
  rateLabel: string | null;
  lines: DeferredTaxLine[];
  /** Assets deliberately left out — surfaced so a partial schedule cannot read as complete. */
  exclusions: DeferredTaxExclusion[];
  totals: {
    bookCarrying: Decimal;
    taxWdv: Decimal;
    temporaryDifference: Decimal;
    /** Net position: positive = net liability, negative = net asset. */
    deferredTax: Decimal;
    deferredTaxLiability: Decimal;
    deferredTaxAsset: Decimal;
  };
  coverage: {
    assetsIncluded: number;
    assetsExcluded: number;
    /** 0-100, or null when there were no assets at all. */
    percentIncluded: number | null;
  };
}

const zero = () => new D(0);

export function buildDeferredTaxSchedule(
  assets: readonly DeferredTaxAssetInput[],
  ctx: { asOf: Date; rates: readonly TaxRatePeriod[] },
): DeferredTaxSchedule {
  const rate = resolveTaxRate(ctx.rates, ctx.asOf);
  const lines: DeferredTaxLine[] = [];
  const exclusions: DeferredTaxExclusion[] = [];

  for (const a of assets) {
    if (a.taxWdv === null) {
      exclusions.push({
        assetId: a.assetId,
        assetNo: a.assetNo,
        name: a.name,
        reason: "no-tax-basis",
      });
      continue;
    }
    if (rate === null) {
      exclusions.push({
        assetId: a.assetId,
        assetNo: a.assetNo,
        name: a.name,
        reason: "no-tax-rate",
      });
      continue;
    }
    const temporaryDifference = a.bookCarrying.minus(a.taxWdv);
    const deferredTax = temporaryDifference
      .times(rate.ratePercent)
      .dividedBy(100)
      .toDecimalPlaces(2, D.ROUND_HALF_UP);
    lines.push({
      assetId: a.assetId,
      assetNo: a.assetNo,
      name: a.name,
      categoryCode: a.categoryCode,
      bookCarrying: a.bookCarrying,
      taxWdv: a.taxWdv,
      temporaryDifference,
      ratePercent: rate.ratePercent,
      deferredTax,
    });
  }

  const sum = (pick: (l: DeferredTaxLine) => Decimal) =>
    lines.reduce((s, l) => s.plus(pick(l)), zero());

  // Liability and asset are reported gross as well as net: IAS 12 offsetting is
  // an entity-level judgement, and a net figure alone hides a large DTA sitting
  // against a large DTL.
  const dtl = lines
    .filter((l) => l.deferredTax.isPositive())
    .reduce((s, l) => s.plus(l.deferredTax), zero());
  const dta = lines
    .filter((l) => l.deferredTax.isNegative())
    .reduce((s, l) => s.plus(l.deferredTax.negated()), zero());

  const total = assets.length;
  return {
    asOf: ctx.asOf,
    ratePercent: rate?.ratePercent ?? null,
    rateLabel: rate?.label ?? null,
    lines,
    exclusions,
    totals: {
      bookCarrying: sum((l) => l.bookCarrying),
      taxWdv: sum((l) => l.taxWdv),
      temporaryDifference: sum((l) => l.temporaryDifference),
      deferredTax: sum((l) => l.deferredTax),
      deferredTaxLiability: dtl,
      deferredTaxAsset: dta,
    },
    coverage: {
      assetsIncluded: lines.length,
      assetsExcluded: exclusions.length,
      percentIncluded:
        total === 0 ? null : Math.round((lines.length / total) * 1000) / 10,
    },
  };
}
