import { Prisma } from "@nexora/database";
import { describe, expect, it } from "vitest";

import {
  planTransfer,
  type TransferAsset,
  TransferValidationError,
} from "./fixed-asset-transfer";

const D = Prisma.Decimal;
const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

const ASSET: TransferAsset = {
  id: "a1",
  entityId: "entity-th",
  assetNo: "FA-IT-2026-001",
  quantity: 1,
  purchasePrice: new D("60000"),
  startDate: d("2026-01-01"),
  usefulLifeMonths: 60,
  location: "HQ 3F",
  assignedUser: "somchai",
  status: "active",
  categoryCode: "IT",
};

const ctx = { accumulatedDepreciation: new D("24000") };

describe("transfer — location and custodian move no value", () => {
  it("plans a location change as a field update", () => {
    const plan = planTransfer(
      ASSET,
      { kind: "location", transferDate: d("2027-01-01"), toLocation: "HQ 5F" },
      ctx,
    );
    expect(plan.fieldChanges).toEqual({ location: "HQ 5F" });
    expect(plan.movesValue).toBe(false);
    expect(plan.crossEntity).toBeNull();
  });

  it("plans a custodian change as a field update", () => {
    const plan = planTransfer(
      ASSET,
      { kind: "custodian", transferDate: d("2027-01-01"), toCustodian: "nong" },
      ctx,
    );
    expect(plan.fieldChanges).toEqual({ assignedUser: "nong" });
    expect(plan.movesValue).toBe(false);
  });

  it("rejects a no-op move", () => {
    expect(() =>
      planTransfer(
        ASSET,
        {
          kind: "location",
          transferDate: d("2027-01-01"),
          toLocation: "HQ 3F",
        },
        ctx,
      ),
    ).toThrow(/already at that location/);
  });

  it("requires a destination", () => {
    expect(() =>
      planTransfer(
        ASSET,
        { kind: "location", transferDate: d("2027-01-01"), toLocation: "  " },
        ctx,
      ),
    ).toThrow(TransferValidationError);
  });
});

describe("transfer — cross-entity carries NET BOOK VALUE", () => {
  const plan = planTransfer(
    ASSET,
    {
      kind: "entity",
      transferDate: d("2028-01-01"),
      toEntityId: "entity-sg",
    },
    ctx,
  );

  it("carries cost AND accumulated depreciation, not cost alone", () => {
    // Carrying only the cost silently restates NBV upward by the whole
    // accumulated depreciation — a plausible-looking asset that reconciles to
    // nothing at group level.
    expect(plan.crossEntity!.costTransferred.toFixed(2)).toBe("60000.00");
    expect(plan.crossEntity!.accumulatedTransferred.toFixed(2)).toBe(
      "24000.00",
    );
    expect(plan.crossEntity!.netBookValue.toFixed(2)).toBe("36000.00");
  });

  it("continues the ORIGINAL remaining life, not a fresh one", () => {
    // 60-month asset, 24 months elapsed by 2028-01-01 → 36 remain. A fresh 60
    // would let the group extend an asset's life just by moving it.
    expect(plan.crossEntity!.remainingLifeMonths).toBe(36);
  });

  it("is flagged as moving value, so it needs approval and posting", () => {
    expect(plan.movesValue).toBe(true);
  });

  it("names the category the destination entity must already have", () => {
    // FixedAssetCategory is @@unique([entityId, code]) — the destination needs
    // its own row, the source's cannot be reused.
    expect(plan.crossEntity!.requiredCategoryCode).toBe("IT");
  });

  it("rejects a transfer to the same entity", () => {
    expect(() =>
      planTransfer(
        ASSET,
        {
          kind: "entity",
          transferDate: d("2028-01-01"),
          toEntityId: "entity-th",
        },
        ctx,
      ),
    ).toThrow(/same as the source/);
  });

  it("requires a destination entity", () => {
    expect(() =>
      planTransfer(
        ASSET,
        { kind: "entity", transferDate: d("2028-01-01") },
        ctx,
      ),
    ).toThrow(/destination entity is required/);
  });

  it("carries a fully depreciated asset at its memo value, not at zero life", () => {
    const plan = planTransfer(
      ASSET,
      {
        kind: "entity",
        transferDate: d("2032-01-01"),
        toEntityId: "entity-sg",
      },
      { accumulatedDepreciation: new D("59999") },
    );
    expect(plan.crossEntity!.netBookValue.toFixed(2)).toBe("1.00");
    expect(plan.crossEntity!.remainingLifeMonths).toBe(0);
  });
});

describe("transfer — guards", () => {
  it("refuses an asset that is not active or idle", () => {
    expect(() =>
      planTransfer(
        { ...ASSET, status: "disposed" },
        { kind: "location", transferDate: d("2027-01-01"), toLocation: "X" },
        ctx,
      ),
    ).toThrow(/status "disposed"/);
  });

  it("refuses a transfer dated before the asset existed", () => {
    expect(() =>
      planTransfer(
        ASSET,
        { kind: "location", transferDate: d("2025-06-01"), toLocation: "X" },
        ctx,
      ),
    ).toThrow(/precede the asset's start date/);
  });
});
