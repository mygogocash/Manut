/**
 * Revaluation and impairment — the IAS 16 / IAS 36 recognition split (WS2).
 *
 * Pure, no DB. Given the carrying amount before and after a remeasurement, this
 * decides how much hits PROFIT OR LOSS and how much hits OTHER COMPREHENSIVE
 * INCOME, and returns the asset's updated cumulative balances.
 *
 * WHY THIS IS ITS OWN MODULE. The split is not a formatting choice — it decides
 * whether a number lands in reported profit or in equity. A revaluation surplus
 * posted to P&L instead of OCI misstates profit with a journal that balances
 * perfectly and looks entirely unremarkable. There is no downstream check that
 * catches it, so the rule is encoded once, here, with the standard's ordering
 * made explicit.
 *
 * THE ORDERING RULES (IAS 16.39-40, IAS 36.60-61, IAS 36.119-120):
 *
 *   INCREASE  → OCI (revaluation surplus)
 *               EXCEPT to the extent it reverses a decrease previously charged
 *               to P&L for the SAME asset — that much goes to P&L first.
 *
 *   DECREASE  → P&L
 *               EXCEPT to the extent the asset carries a revaluation surplus in
 *               OCI — that much is taken against the surplus first.
 *
 * Both exceptions are per-asset and depend on history, which is why the caller
 * must carry `surplusBalance` and `plLossBalance` forward rather than recomputing
 * them from the current carrying amount. Two assets with identical carrying
 * amounts can split the same movement completely differently.
 *
 * The two directions are NOT symmetric, and getting that backwards is the
 * classic error: an increase reverses prior P&L losses first, then goes to OCI;
 * a decrease consumes prior OCI surplus first, then goes to P&L.
 */

import { Prisma } from "@nexora/database";

const D = Prisma.Decimal;
type Decimal = Prisma.Decimal;
type Amt = number | string | Decimal;

/** What kind of remeasurement produced the movement. */
export type RemeasurementKind =
  | "revaluation"
  | "impairment"
  | "impairment_reversal";

/**
 * The asset's cumulative recognition history. Both are non-negative running
 * balances, NOT derivable from the carrying amount.
 */
export interface RemeasurementBalances {
  /** Revaluation surplus sitting in OCI/equity for this asset. */
  surplusBalance: Decimal;
  /** Cumulative decrease previously charged to P&L for this asset. */
  plLossBalance: Decimal;
}

export interface RemeasurementInput {
  kind: RemeasurementKind;
  carryingBefore: Amt;
  carryingAfter: Amt;
  balances: {
    surplusBalance: Amt;
    plLossBalance: Amt;
  };
  /**
   * IAS 36.117 caps an impairment REVERSAL at the carrying amount that would
   * have existed (net of depreciation) had no impairment been recognised.
   * Required for `impairment_reversal`; ignored otherwise.
   */
  reversalCap?: Amt | null;
}

export interface RemeasurementResult {
  /** Signed movement in carrying amount: positive = increase. */
  movement: Decimal;
  /** Amount recognised in profit or loss. Positive = gain/reversal, negative = expense. */
  profitOrLoss: Decimal;
  /** Amount recognised in OCI. Positive = surplus arising, negative = surplus consumed. */
  otherComprehensiveIncome: Decimal;
  /** Balances after this event — persist these on the asset. */
  balances: RemeasurementBalances;
  /** Set when `reversalCap` clipped the movement. */
  cappedAt?: Decimal;
}

const zero = () => new D(0);

/**
 * Split a remeasurement between P&L and OCI and roll the cumulative balances.
 *
 * Invariant asserted by the tests: profitOrLoss + otherComprehensiveIncome
 * always equals movement exactly. Any rounding introduced here would surface as
 * an unbalanced journal, since assertBalanced permits no epsilon.
 */
export function recogniseRemeasurement(
  input: RemeasurementInput,
): RemeasurementResult {
  const before = new D(input.carryingBefore);
  let after = new D(input.carryingAfter);
  let surplus = new D(input.balances.surplusBalance);
  let plLoss = new D(input.balances.plLossBalance);
  let cappedAt: Decimal | undefined;

  // IAS 36.117: a reversal may not lift the carrying amount above what it would
  // have been had the asset never been impaired. Without this a reversal
  // quietly becomes an unrecognised revaluation.
  if (input.kind === "impairment_reversal" && input.reversalCap != null) {
    const cap = new D(input.reversalCap);
    if (after.greaterThan(cap)) {
      after = cap;
      cappedAt = cap;
    }
  }

  const movement = after.minus(before);

  if (movement.isZero()) {
    return {
      movement,
      profitOrLoss: zero(),
      otherComprehensiveIncome: zero(),
      balances: { surplusBalance: surplus, plLossBalance: plLoss },
      cappedAt,
    };
  }

  let profitOrLoss: Decimal;
  let oci: Decimal;

  if (movement.isPositive()) {
    // An increase reverses prior P&L losses FIRST, then builds surplus in OCI.
    const toPl = D.min(movement, plLoss);
    profitOrLoss = toPl;
    oci = movement.minus(toPl);
    plLoss = plLoss.minus(toPl);
    surplus = surplus.plus(oci);
  } else {
    // A decrease consumes prior OCI surplus FIRST, then charges P&L.
    const magnitude = movement.negated();
    const fromSurplus = D.min(magnitude, surplus);
    oci = fromSurplus.negated();
    profitOrLoss = magnitude.minus(fromSurplus).negated();
    surplus = surplus.minus(fromSurplus);
    plLoss = plLoss.plus(profitOrLoss.negated());
  }

  return {
    movement,
    profitOrLoss,
    otherComprehensiveIncome: oci,
    balances: { surplusBalance: surplus, plLossBalance: plLoss },
    cappedAt,
  };
}

/**
 * The carrying amount a remeasurement re-anchors the asset at, expressed as the
 * engine's opening-balance pair so depreciation continues on the NEW amount over
 * the REMAINING life (IAS 16.31, IAS 36.63).
 *
 * This pair IS written onto the asset's `openingBookValue` / `openingAsOfDate`
 * columns by `approveFixedAssetRemeasurement` — that write is what makes
 * depreciation continue on the new amount instead of the old one.
 *
 * History survives it not by leaving those columns alone, but because approval
 * snapshots the PRE-event pair onto the remeasurement row
 * (`openingBookValueBefore` / `openingAsOfDateBefore`); `remeasurementToEvent`
 * feeds that into the event chain, so `assetStateAt` still values any
 * pre-remeasurement date on the old basis — see fixed-asset-state.ts.
 *
 * So do NOT "protect the cut-over anchor" by dropping the live-row write: the
 * register would keep depreciating the OLD carrying amount and the remeasurement
 * would have no effect on any date after it.
 */
export function remeasurementAnchor(
  newCarryingAmount: Amt,
  effectiveDate: Date,
): { openingBookValue: string; openingAsOfDate: Date } {
  return {
    openingBookValue: new D(newCarryingAmount).toFixed(2),
    openingAsOfDate: effectiveDate,
  };
}

/**
 * Remaining useful life in whole months at a date. A remeasurement does not
 * restart the life — depreciating the new amount over a FRESH full life
 * understates the charge for the rest of the asset's life, which is the second
 * classic error after the OCI split.
 */
export function remainingLifeMonths(
  startDate: Date,
  usefulLifeMonths: number,
  atDate: Date,
): number {
  const elapsed =
    (atDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 +
    (atDate.getUTCMonth() - startDate.getUTCMonth());
  return Math.max(0, usefulLifeMonths - Math.max(0, elapsed));
}
