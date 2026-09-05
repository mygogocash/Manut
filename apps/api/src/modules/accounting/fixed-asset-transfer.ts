/**
 * Asset transfers — location, custodian and cross-entity (WS3). Pure, no DB.
 *
 * Three kinds share one request shape but are fundamentally different events:
 *
 *   location   — the asset moves desk/floor/branch. No money moves.
 *   custodian  — the assigned user changes. No money moves.
 *   entity     — the asset LEAVES one legal entity's books and ARRIVES on
 *                another's. This is a disposal plus an acquisition, not a field
 *                update, and it is the only kind that touches the GL.
 *
 * WHY A PLAN OBJECT. A cross-entity move must produce two journal entries in two
 * entities that commit atomically, and each side has its own period lock and its
 * own category mapping. Deciding all of that up front — before anything is
 * written — is what lets the caller assert both periods, resolve both entities'
 * accounts, and refuse the whole transfer if either side is not ready.
 *
 * TRANSFER VALUE. Under common control the asset carries at NET BOOK VALUE: the
 * destination inherits the cost and the accumulated depreciation, so group
 * carrying amount is unchanged and no gain arises. Carrying only the cost — the
 * obvious mistake — silently restates NBV upward by the whole accumulated
 * depreciation, which looks like a plausible asset and reconciles to nothing.
 *
 * REMAINING LIFE. The destination continues the ORIGINAL remaining life. A fresh
 * full life at the destination understates the charge for the rest of the
 * asset's life and lets a group extend an asset's life indefinitely by moving it.
 */

import { Prisma } from "@nexora/database";

const D = Prisma.Decimal;
type Decimal = Prisma.Decimal;

export type TransferKind = "location" | "custodian" | "entity";

export interface TransferAsset {
  id: string;
  entityId: string;
  assetNo: string | null;
  quantity: number;
  purchasePrice: Decimal;
  startDate: Date;
  usefulLifeMonths: number;
  location: string | null;
  assignedUser: string | null;
  status: string;
  categoryCode: string;
}

export interface TransferRequest {
  kind: TransferKind;
  transferDate: Date;
  toLocation?: string | null;
  toCustodian?: string | null;
  toEntityId?: string | null;
  reason?: string | null;
}

/** Field changes to apply to the source asset row. */
export interface TransferFieldChanges {
  location?: string | null;
  assignedUser?: string | null;
}

export interface CrossEntityPlan {
  fromEntityId: string;
  toEntityId: string;
  /** Cost and accumulated depreciation carried across — NBV is preserved. */
  costTransferred: Decimal;
  accumulatedTransferred: Decimal;
  netBookValue: Decimal;
  quantity: number;
  /** The destination continues this many months, not a fresh full life. */
  remainingLifeMonths: number;
  /**
   * The destination needs a category with this code. It is a separate row —
   * FixedAssetCategory is @@unique([entityId, code]) — so the destination entity
   * must already have one or the transfer cannot complete.
   */
  requiredCategoryCode: string;
}

export interface TransferPlan {
  kind: TransferKind;
  transferDate: Date;
  fieldChanges: TransferFieldChanges;
  /** Present only for a cross-entity move. */
  crossEntity: CrossEntityPlan | null;
  /** True when the plan moves value and therefore needs GL posting + approval. */
  movesValue: boolean;
  /** Human summary for the movement trail. */
  summary: string;
}

export class TransferValidationError extends Error {}

/**
 * Validate a transfer request against the asset and produce the plan.
 * Throws TransferValidationError with a specific message — the caller maps it
 * to BadRequestException.
 */
export function planTransfer(
  asset: TransferAsset,
  req: TransferRequest,
  ctx: { accumulatedDepreciation: Decimal },
): TransferPlan {
  if (!["active", "idle"].includes(asset.status)) {
    throw new TransferValidationError(
      `Cannot transfer an asset with status "${asset.status}"`,
    );
  }
  if (req.transferDate.getTime() < asset.startDate.getTime()) {
    throw new TransferValidationError(
      "Transfer date cannot precede the asset's start date",
    );
  }

  if (req.kind === "location") {
    const to = (req.toLocation ?? "").trim();
    if (!to) {
      throw new TransferValidationError("A destination location is required");
    }
    if (to === (asset.location ?? "").trim()) {
      throw new TransferValidationError(
        "The asset is already at that location",
      );
    }
    return {
      kind: "location",
      transferDate: req.transferDate,
      fieldChanges: { location: to },
      crossEntity: null,
      movesValue: false,
      summary: `Location ${asset.location ?? "—"} → ${to}`,
    };
  }

  if (req.kind === "custodian") {
    const to = (req.toCustodian ?? "").trim();
    if (!to) {
      throw new TransferValidationError("A destination custodian is required");
    }
    if (to === (asset.assignedUser ?? "").trim()) {
      throw new TransferValidationError(
        "The asset is already held by that user",
      );
    }
    return {
      kind: "custodian",
      transferDate: req.transferDate,
      fieldChanges: { assignedUser: to },
      crossEntity: null,
      movesValue: false,
      summary: `Custodian ${asset.assignedUser ?? "—"} → ${to}`,
    };
  }

  // Cross-entity.
  const toEntityId = (req.toEntityId ?? "").trim();
  if (!toEntityId) {
    throw new TransferValidationError("A destination entity is required");
  }
  if (toEntityId === asset.entityId) {
    throw new TransferValidationError(
      "The destination entity is the same as the source entity",
    );
  }

  const cost = new D(asset.purchasePrice);
  const accumulated = new D(ctx.accumulatedDepreciation);
  const nbv = cost.minus(accumulated);

  return {
    kind: "entity",
    transferDate: req.transferDate,
    fieldChanges: {},
    crossEntity: {
      fromEntityId: asset.entityId,
      toEntityId,
      costTransferred: cost,
      accumulatedTransferred: accumulated,
      netBookValue: nbv,
      quantity: asset.quantity,
      remainingLifeMonths: remainingMonths(
        asset.startDate,
        asset.usefulLifeMonths,
        req.transferDate,
      ),
      requiredCategoryCode: asset.categoryCode,
    },
    movesValue: true,
    summary: `Entity transfer at NBV ${nbv.toFixed(2)} (cost ${cost.toFixed(
      2,
    )} less accumulated ${accumulated.toFixed(2)})`,
  };
}

function remainingMonths(
  startDate: Date,
  usefulLifeMonths: number,
  atDate: Date,
): number {
  const elapsed =
    (atDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 +
    (atDate.getUTCMonth() - startDate.getUTCMonth());
  return Math.max(0, usefulLifeMonths - Math.max(0, elapsed));
}
