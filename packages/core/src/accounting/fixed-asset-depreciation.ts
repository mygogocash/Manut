/**
 * Fixed Asset — daily straight-line depreciation engine (pure, no DB).
 *
 * Thailand statutory register rules (PRD §3):
 *   memoValue        = 1.00 x quantity            (1 baht per unit held to disposal)
 *   totalDays        = actual calendar days(startDate -> startDate + usefulLife)
 *   depreciableBase  = purchasePrice - memoValue
 *   dailyRate        = depreciableBase / totalDays          (FULL precision, never pre-rounded)
 *   accumulatedDep   = clamp(dailyRate x daysElapsed, ..., depreciableBase)
 *   netBookValue     = clamp(purchasePrice - accumulatedDep toward memoValue)
 *
 * All money math runs on Prisma.Decimal so the running total never drifts on
 * FP rounding; only the final accumulated/NBV figures are rounded to 2 dp.
 * The daily rate is kept at full precision and multiplied before rounding —
 * PRD worked example 1 relies on this (40.9123... x 502 = 20,537.99, not the
 * 4-dp-rounded 20,537.97).
 *
 * Two depreciation modes:
 *   - from-start  (new / post-cut-over assets): depreciate from startDate,
 *     day 1 = startDate (inclusive).
 *   - opening-balance (pre-cut-over load): anchor NBV at `openingBookValue`
 *     as at `openingAsOfDate`, keep the original daily rate, and depreciate
 *     FORWARD from the anchor. The final-period true-up (closing NBV == memo
 *     exactly) absorbs the rounding residual entirely in the last period —
 *     it is never spread.
 *
 * Negative purchase price = a contra line (trade discount / credit note):
 * the memo, base, rate and NBV all carry the sign, so the release is a CREDIT
 * to depreciation and the line is presented at its 1.00 magnitude (PRD §4.11,
 * worked example 2).
 */

import { Decimal, D } from "./money-decimal";



/** Memo value held per unit until disposal / write-off (PRD §2). */
export const MEMO_PER_UNIT = new D(1);

const MS_PER_DAY = 86_400_000;

export interface DepreciationInput {
  /** Cost excluding VAT. Negative = contra line (credit note / trade discount). */
  purchasePrice: number | string | Decimal;
  quantity: number;
  /** Depreciation start date (defaults to purchase date at the caller). */
  startDate: Date;
  usefulLifeMonths: number;
  /**
   * Cut-over anchor. When both are set the asset is an opening-balance load:
   * NBV is anchored at `openingBookValue` as at `openingAsOfDate` and
   * depreciated forward. When null the asset depreciates from `startDate`.
   */
  openingBookValue?: number | string | Decimal | null;
  openingAsOfDate?: Date | null;
}

export interface DepreciationResult {
  totalDays: number;
  /** Signed, full-precision daily rate (for display round to 4 dp). */
  dailyRate: Decimal;
  /** Signed memo value (+qty for assets, -qty for contra lines). */
  memoValue: Decimal;
  depreciableBase: Decimal;
  /** Rounded to 2 dp. */
  accumulatedDepreciation: Decimal;
  /** Rounded to 2 dp; floored at the memo value (never past it, never negative for a positive asset). */
  netBookValue: Decimal;
}

/** Whole calendar days between two dates, counted at UTC midnight (@db.Date is midnight UTC). */
export function daysBetween(from: Date, to: Date): number {
  return Math.round((utcMidnight(to) - utcMidnight(from)) / MS_PER_DAY);
}

function utcMidnight(d: Date): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** startDate + N months as a calendar anniversary, clamping day-of-month (e.g. 31 Jan + 1m = 28/29 Feb). */
export function addMonths(d: Date, months: number): Date {
  const target = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1),
  );
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0),
  ).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), lastDay));
  return target;
}

function round2(v: Decimal): Decimal {
  return v.toDecimalPlaces(2, D.ROUND_HALF_UP);
}

/**
 * Compute accumulated depreciation + net book value for an asset as at a date.
 * See the file header for the two modes and the contra-line sign handling.
 */
export function computeDepreciation(
  input: DepreciationInput,
  asOfDate: Date,
): DepreciationResult {
  const price = new D(input.purchasePrice);
  const qty = new D(input.quantity);
  const sign = price.isNegative() ? -1 : 1;
  const memoValue = MEMO_PER_UNIT.times(qty).times(sign);
  const depreciableBase = price.minus(memoValue);
  const endDate = addMonths(input.startDate, input.usefulLifeMonths);
  const totalDays = daysBetween(input.startDate, endDate);
  const dailyRate = totalDays > 0 ? depreciableBase.div(totalDays) : new D(0);

  const opening =
    input.openingBookValue != null && input.openingAsOfDate != null;

  let nbv: Decimal;
  if (utcMidnight(asOfDate) >= utcMidnight(endDate)) {
    // Final-period true-up: closing NBV is exactly the memo value; any rounding
    // residual lands here, never spread across earlier periods (PRD §3, ex. 1).
    nbv = memoValue;
  } else if (utcMidnight(asOfDate) < utcMidnight(input.startDate)) {
    // Not yet in service on this date — no depreciation has run, whichever
    // mode we are in. This guard MUST precede the opening branch: an asset can
    // carry a cut-over anchor dated before its own start date (the sheet holds
    // Purchase Date and Start Date separately), and depreciating forward from
    // the anchor would charge days the asset was not yet in service.
    nbv = opening ? new D(input.openingBookValue!) : price;
  } else if (opening) {
    const anchor = new D(input.openingBookValue!);
    if (utcMidnight(asOfDate) <= utcMidnight(input.openingAsOfDate!)) {
      nbv = anchor;
    } else {
      // Charge forward only from the later of the anchor date and the day
      // before the asset entered service, so a deferred start never accrues
      // depreciation for its pre-service days.
      const dayBeforeStart = new Date(
        utcMidnight(input.startDate) - MS_PER_DAY,
      );
      const chargeFrom =
        utcMidnight(dayBeforeStart) > utcMidnight(input.openingAsOfDate!)
          ? dayBeforeStart
          : input.openingAsOfDate!;
      const elapsed = Math.max(0, daysBetween(chargeFrom, asOfDate));
      const forwardDep = dailyRate.times(elapsed);
      nbv = floorTowardMemo(anchor.minus(forwardDep), memoValue, sign);
    }
  } else {
    // Day 1 is the start date itself (inclusive) — PRD worked example 3.
    const elapsed = daysBetween(input.startDate, asOfDate) + 1;
    const accum = clampMagnitude(dailyRate.times(elapsed), depreciableBase);
    nbv = floorTowardMemo(price.minus(accum), memoValue, sign);
  }

  return {
    totalDays,
    dailyRate,
    memoValue,
    depreciableBase,
    accumulatedDepreciation: round2(price.minus(nbv)),
    netBookValue: round2(nbv),
  };
}

/**
 * Depreciation charged BETWEEN two valuation points — the figure a monthly
 * journal posts, which `computeDepreciation` does not return.
 *
 * The engine is point-in-time: it answers "what is accumulated depreciation as
 * at date X". A period charge is the difference between two such answers, and
 * deriving it any other way (rate × days) silently disagrees with the register
 * at three boundaries: the memo-value floor at end of life, the final-period
 * true-up, and the opening-balance anchor.
 *
 * Both states must be produced by `assetStateAt` for their OWN date, and both
 * dates clamped by `assetAsOf`. That is what makes a mid-period disposal charge
 * only up to the disposal date, and a mid-period addition charge only from its
 * start date — without either, the caller re-derives history from the live row.
 *
 * The result is signed and deliberately NOT clamped at zero: a contra line
 * (credit note) releases a credit, so its charge is negative and posts on the
 * opposite side. Clamping would silently drop the release.
 */
export function periodDepreciationCharge(
  opening: { state: DepreciationInput; asOf: Date },
  closing: { state: DepreciationInput; asOf: Date },
): Decimal {
  const open = computeDepreciation(opening.state, opening.asOf);
  const close = computeDepreciation(closing.state, closing.asOf);
  return close.accumulatedDepreciation.minus(open.accumulatedDepreciation);
}

export interface DisposalInput {
  unitsDisposed: number;
  disposalDate: Date;
  /** Selling price excluding VAT; 0 for a write-off. */
  proceeds: number | string | Decimal;
}

export interface DisposalResult {
  /** NBV of the disposed units at the disposal date (depreciation run to & incl. that date). */
  nbvDisposed: Decimal;
  /** proceeds - nbvDisposed; positive = gain, negative = loss. */
  gainLoss: Decimal;
  costRemoved: Decimal;
  accumulatedRemoved: Decimal;
  memoRemoved: Decimal;
  /** The line that continues after a partial disposal. */
  remaining: { quantity: number; purchasePrice: Decimal };
}

/**
 * Dispose part (or all) of a multi-unit line. Cost, accumulated depreciation
 * and memo value are removed PRO RATA by units (PRD §3.D / worked example 3);
 * the line continues with the remaining quantity at a proportional cost.
 * Depreciation is run to and including the disposal date.
 */
export function computeDisposal(
  input: DepreciationInput,
  disposal: DisposalInput,
): DisposalResult {
  const qty = input.quantity;
  const units = disposal.unitsDisposed;
  if (units <= 0 || units > qty) {
    throw new Error(
      `Cannot dispose ${units} of ${qty} units — units must be between 1 and ${qty}`,
    );
  }
  const price = new D(input.purchasePrice);
  const proceeds = new D(disposal.proceeds);
  const fraction = new D(units).div(qty);

  const atDisposal = computeDepreciation(input, disposal.disposalDate);
  const nbvFull = price.minus(atDisposal.accumulatedDepreciation);

  const costRemoved = round2(price.times(fraction));
  const accumulatedRemoved = round2(
    atDisposal.accumulatedDepreciation.times(fraction),
  );
  const memoRemoved = round2(atDisposal.memoValue.times(fraction));
  const nbvDisposed = round2(nbvFull.times(fraction));
  const gainLoss = round2(proceeds.minus(nbvDisposed));

  const remainingUnits = qty - units;
  return {
    nbvDisposed,
    gainLoss,
    costRemoved,
    accumulatedRemoved,
    memoRemoved,
    remaining: {
      quantity: remainingUnits,
      purchasePrice:
        remainingUnits === 0
          ? new D(0)
          : round2(price.times(new D(remainingUnits).div(qty))),
    },
  };
}

/**
 * Clamp `nbv` so it never passes the memo floor: a positive asset can never
 * fall below its memo (+), a contra line can never rise above its memo (-).
 */
function floorTowardMemo(
  nbv: Decimal,
  memoValue: Decimal,
  sign: number,
): Decimal {
  return sign >= 0 ? D.max(nbv, memoValue) : D.min(nbv, memoValue);
}

/** Clamp accumulated depreciation so it stays within [0, base] (or [base, 0] for a contra line). */
function clampMagnitude(accum: Decimal, base: Decimal): Decimal {
  const zero = new D(0);
  return base.isNegative()
    ? D.max(D.min(accum, zero), base)
    : D.min(D.max(accum, zero), base);
}
