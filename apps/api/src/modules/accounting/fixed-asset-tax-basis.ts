/**
 * Fixed Asset TAX basis resolution + tax-rate period validation (WS5 wiring).
 * Pure, no DB — the seam between the register rows and the deferred tax engine
 * (`fixed-asset-deferred-tax.ts`), which this module deliberately does not
 * reimplement: it only assembles the inputs that engine is fed.
 *
 * THE ONE RULE THIS FILE EXISTS TO ENFORCE. An asset's tax useful life may come
 * from the asset itself or from its CATEGORY's default — but when neither is
 * configured the answer is `null`, never the BOOK life. Falling back to the book
 * life makes tax WDV equal book carrying amount, so the temporary difference is
 * exactly zero and the schedule renders a clean, plausible, entirely wrong
 * 0.00 for every asset. `null` flows on to `taxWdv: null`, which the engine
 * turns into a named exclusion plus a coverage percentage — a partial schedule
 * that cannot read as complete.
 *
 * KNOWN GAP (same shape as the one documented on assetEventHistory). The tax
 * anchor (`openingTaxWdv` / `openingTaxAsOfDate`) is read from the LIVE row and
 * is not rebuilt from the event chain, because no event writes a tax-basis
 * snapshot yet. Cost and quantity ARE point-in-time (they come from the book
 * state), so a partial disposal already scales the tax computation's cost; only
 * a cut-over tax anchor on a partially-disposed asset is stale. When disposals
 * start writing `openingTaxWdvBefore`, thread it through `bookState`'s caller
 * and pass it here instead of the live value.
 */

import type { Prisma } from "@nexora/database";

import type { DepreciationInput } from "@/modules/accounting/fixed-asset-depreciation";

/** The tax-basis columns as stored on a FixedAsset row. */
export interface TaxBasisAsset {
  taxUsefulLifeMonths: number | null;
  openingTaxWdv: Prisma.Decimal | null;
  openingTaxAsOfDate: Date | null;
}

/** The class-level default, as stored on a FixedAssetCategory row. */
export interface TaxBasisCategory {
  taxUsefulLifeMonths: number | null;
}

/**
 * The tax useful life in force for an asset: its own, else its category's
 * default, else null.
 *
 * Null is the whole point — see the file header. A non-positive life is treated
 * as absent too: it is not a tax basis, and feeding it to the engine would
 * produce a zero daily rate and a WDV frozen at cost.
 */
export function resolveTaxUsefulLifeMonths(
  asset: TaxBasisAsset,
  category?: TaxBasisCategory | null,
): number | null {
  const own = asset.taxUsefulLifeMonths;
  if (own != null && own > 0) return own;
  const fromCategory = category?.taxUsefulLifeMonths;
  if (fromCategory != null && fromCategory > 0) return fromCategory;
  return null;
}

/**
 * The engine input for the asset's TAX depreciation, or null when it has no tax
 * basis at all.
 *
 * Cost, quantity and start date are shared with the book basis (they describe
 * the same physical asset, and `bookState` has already been rebuilt to the
 * report date). Only the life and the cut-over anchor differ — which is exactly
 * what a book/tax temporary difference is.
 *
 * Returning null rather than a defaulted input is what keeps the "no tax basis
 * ⇒ excluded" guarantee at this layer instead of hoping every caller remembers.
 */
export function taxDepreciationInput(
  bookState: DepreciationInput,
  asset: TaxBasisAsset,
  category?: TaxBasisCategory | null,
): DepreciationInput | null {
  const taxUsefulLifeMonths = resolveTaxUsefulLifeMonths(asset, category);
  if (taxUsefulLifeMonths == null) return null;
  return {
    purchasePrice: bookState.purchasePrice,
    quantity: bookState.quantity,
    startDate: bookState.startDate,
    usefulLifeMonths: taxUsefulLifeMonths,
    // All-or-nothing: an anchor value with no date (or the reverse) would make
    // the engine silently depreciate from startDate instead.
    openingBookValue:
      asset.openingTaxWdv != null && asset.openingTaxAsOfDate != null
        ? asset.openingTaxWdv.toString()
        : null,
    openingAsOfDate:
      asset.openingTaxWdv != null && asset.openingTaxAsOfDate != null
        ? asset.openingTaxAsOfDate
        : null,
  };
}

// ── Effective-dated rate periods (admin-side validation) ────────────────────

/** The date range of one EntityTaxRate row. `effectiveTo: null` = open-ended. */
export interface TaxRateRange {
  effectiveFrom: Date;
  effectiveTo: Date | null;
}

/** Inclusive-inclusive overlap; a null end date is treated as +infinity. */
export function taxRatePeriodsOverlap(
  a: TaxRateRange,
  b: TaxRateRange,
): boolean {
  const aTo = a.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY;
  const bTo = b.effectiveTo?.getTime() ?? Number.POSITIVE_INFINITY;
  return a.effectiveFrom.getTime() <= bTo && b.effectiveFrom.getTime() <= aTo;
}

/**
 * The first existing period the candidate collides with, or undefined.
 *
 * The engine tolerates overlap (latest-starting period wins, so a BOI promotion
 * can be layered over a headline rate) but the ADMIN surface refuses it, so
 * exactly one rate is in force on any date and nobody has to know the tiebreak
 * to predict the schedule. Layering is still expressible: close the headline
 * period the day before the promotion starts, add the promotion, then add a
 * resumption period from the day after it ends.
 */
export function findOverlappingTaxRate<T extends TaxRateRange & { id: string }>(
  candidate: TaxRateRange,
  existing: readonly T[],
  excludeId?: string,
): T | undefined {
  return existing.find(
    (r) => r.id !== excludeId && taxRatePeriodsOverlap(candidate, r),
  );
}
