/**
 * Fixed Asset point-in-time state — pure, no DB.
 *
 * Extracted from AccountingService (where these were private methods, so no
 * other module could reach them) and generalised from "disposals" to "asset
 * events" ahead of Phase 2.
 *
 * WHY THE GENERALISATION MATTERS. A disposal permanently reduces the live row's
 * cost and quantity, so valuing a PAST date against today's row restates
 * history — that was PR #1014. Phase 2 adds two more carrying-amount mutators
 * (impairment re-anchors NBV; a cross-entity transfer removes the asset), and
 * if each ships its own lookup, the second one to land silently restates the
 * first. One event chain, consulted once, is the fix.
 *
 * The contract: every event carries a snapshot of the asset's depreciable state
 * IMMEDIATELY BEFORE it happened. To value date D, find the EARLIEST event
 * dated after D — its "before" snapshot is the state that was true at D, since
 * every later event is already folded into it. Legacy rows written before the
 * snapshot columns existed carry nulls and fall back to the live values, which
 * is exactly the old behaviour.
 */

import type { Decimal } from "./money-decimal";

import type { DepreciationInput } from "./fixed-asset-depreciation";

/**
 * Statuses that mean "still on the books". Kept here (rather than imported from
 * fixed-asset-reports) so this module stays dependency-free for the engine.
 */
export const USING_STATUSES = new Set(["active", "idle", "pending_disposal"]);

/**
 * Event kinds that change an asset's depreciable state. Only "disposal" is
 * written today; the rest are Phase 2 and are declared now so the union — and
 * every switch over it — is exhaustive from the start.
 */
export type AssetEventKind =
  | "disposal"
  | "impairment"
  | "revaluation"
  | "transfer";

/**
 * A carrying-amount-changing event plus the state that was true before it.
 * `null` on any *Before field means "not snapshotted" (a pre-#1014 legacy row),
 * NOT "was zero" — those fall back to the live asset.
 */
export interface AssetEvent {
  kind: AssetEventKind;
  effectiveDate: Date;
  quantityBefore: number | null;
  costBefore: Decimal | null;
  openingBookValueBefore: Decimal | null;
  /**
   * The cut-over anchor date in force before this event. Disposals never move
   * it, so the disposal adapter leaves this null and the live value is used.
   * Impairment RE-ANCHORS the asset (that is what an impairment is), so it must
   * record its own — otherwise a past-dated report would value a pre-impairment
   * date against the post-impairment anchor and understate the register.
   */
  openingAsOfDateBefore?: Date | null;
}

/** The live-row shape every helper here reads. */
export interface AssetStateRow {
  purchasePrice: Decimal;
  quantity: number;
  startDate: Date;
  usefulLifeMonths: number;
  openingBookValue: Decimal | null;
  openingAsOfDate: Date | null;
}

export interface AssetLifecycleRow {
  disposalDate: Date | null;
  status: string;
}

/** Live register row → engine input. No event history applied. */
export function toDepreciationInput(asset: AssetStateRow): DepreciationInput {
  return {
    purchasePrice: asset.purchasePrice.toString(),
    quantity: asset.quantity,
    startDate: asset.startDate,
    usefulLifeMonths: asset.usefulLifeMonths,
    openingBookValue: asset.openingBookValue?.toString() ?? null,
    openingAsOfDate: asset.openingAsOfDate ?? null,
  };
}

/**
 * The asset's depreciable state as it stood on `date`, rebuilt from the event
 * chain. Falls back to the live row when no event follows `date`.
 */
export function assetStateAt(
  asset: AssetStateRow,
  events: readonly AssetEvent[],
  date: Date,
): DepreciationInput {
  const base = toDepreciationInput(asset);
  const earliest = earliestEventAfter(events, date);
  if (!earliest) return base;
  return {
    ...base,
    purchasePrice: earliest.costBefore!.toString(),
    quantity: earliest.quantityBefore ?? asset.quantity,
    openingBookValue: earliest.openingBookValueBefore?.toString() ?? null,
    // An anchor value with no anchor date would make the engine treat the asset
    // as depreciating from startDate, so the pair must stay all-or-nothing.
    openingAsOfDate: earliest.openingBookValueBefore
      ? (earliest.openingAsOfDateBefore ?? asset.openingAsOfDate ?? null)
      : null,
  };
}

/**
 * The earliest event strictly after `date` that actually carries a snapshot.
 * Events without a `costBefore` are legacy rows and are skipped — using one
 * would blank the cost rather than restore it.
 */
function earliestEventAfter(
  events: readonly AssetEvent[],
  date: Date,
): AssetEvent | undefined {
  let winner: AssetEvent | undefined;
  for (const e of events) {
    if (e.costBefore == null) continue;
    if (e.effectiveDate.getTime() <= date.getTime()) continue;
    if (!winner || e.effectiveDate.getTime() < winner.effectiveDate.getTime()) {
      winner = e;
    }
  }
  return winner;
}

/**
 * Depreciation stops on the disposal date — the asset left the books there, so
 * every report values it at min(reportDate, disposalDate) rather than letting
 * the engine keep depreciating a disposed line for the rest of its life.
 */
export function assetAsOf(asset: AssetLifecycleRow, reportDate: Date): Date {
  if (!asset.disposalDate) return reportDate;
  return asset.disposalDate.getTime() < reportDate.getTime()
    ? asset.disposalDate
    : reportDate;
}

/**
 * True when the asset was still on the books on `date`. Status alone is not
 * enough: a currently-disposed asset WAS held at an earlier opening date.
 */
export function heldAt(asset: AssetLifecycleRow, date: Date): boolean {
  if (asset.disposalDate) {
    return asset.disposalDate.getTime() > date.getTime();
  }
  return USING_STATUSES.has(asset.status);
}

/** Snapshot columns as stored on an approved FixedAssetDisposal row. */
export interface DisposalSnapshotRow {
  assetId: string;
  disposalDate: Date;
  quantityBefore: number | null;
  costBefore: Decimal | null;
  openingBookValueBefore: Decimal | null;
}

/** Approved disposal → AssetEvent. */
export function disposalToEvent(row: DisposalSnapshotRow): AssetEvent {
  return {
    kind: "disposal",
    effectiveDate: row.disposalDate,
    quantityBefore: row.quantityBefore,
    costBefore: row.costBefore,
    openingBookValueBefore: row.openingBookValueBefore,
    // A disposal reduces cost/quantity pro rata but never moves the cut-over
    // anchor date, so the live value stays correct.
    openingAsOfDateBefore: null,
  };
}

/** Snapshot columns as stored on an approved FixedAssetRemeasurement row. */
export interface RemeasurementSnapshotRow {
  assetId: string;
  /** revaluation | impairment | impairment_reversal */
  kind: string;
  effectiveDate: Date;
  quantityBefore: number | null;
  costBefore: Decimal | null;
  openingBookValueBefore: Decimal | null;
  openingAsOfDateBefore: Date | null;
}

/**
 * Approved revaluation / impairment → AssetEvent.
 *
 * Unlike a disposal, a remeasurement RE-ANCHORS the asset: approving one writes
 * a new `openingBookValue` / `openingAsOfDate` pair onto the live row so
 * depreciation continues on the new carrying amount. That makes the live anchor
 * the POST-event one, so this adapter must carry its own `openingAsOfDateBefore`
 * — falling back to the live value (as the disposal adapter safely does) would
 * value every pre-remeasurement date against the post-remeasurement anchor.
 *
 * `impairment_reversal` folds into the `impairment` kind: the union describes
 * what the event did to the carrying amount, not which button raised it.
 */
export function remeasurementToEvent(
  row: RemeasurementSnapshotRow,
): AssetEvent {
  return {
    kind: row.kind === "revaluation" ? "revaluation" : "impairment",
    effectiveDate: row.effectiveDate,
    quantityBefore: row.quantityBefore,
    costBefore: row.costBefore,
    openingBookValueBefore: row.openingBookValueBefore,
    openingAsOfDateBefore: row.openingAsOfDateBefore,
  };
}

/**
 * Group events by asset id. Callers pass every event type they know about; the
 * grouping is deliberately kind-agnostic so adding impairment or transfer needs
 * no change here.
 */
export function groupEventsByAsset(
  events: ReadonlyArray<AssetEvent & { assetId: string }>,
): Map<string, AssetEvent[]> {
  const byAsset = new Map<string, AssetEvent[]>();
  for (const e of events) {
    const list = byAsset.get(e.assetId) ?? [];
    list.push(e);
    byAsset.set(e.assetId, list);
  }
  return byAsset;
}
