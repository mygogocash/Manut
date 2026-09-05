/**
 * Revaluation / impairment approval — the WIRING around the pure engine (WS2).
 *
 * recogniseRemeasurement is already covered by fixed-asset-revaluation.test.ts.
 * What is only testable here is everything the service is responsible for: that
 * the carrying amount BEFORE comes from the depreciation engine rather than a
 * column, that the returned balances are persisted back onto the asset so the
 * NEXT remeasurement splits against them, that the point-in-time snapshot
 * columns are written, and that a closed period blocks the whole thing.
 */

import { Prisma } from "@nexora/database";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import {
  BadRequestException,
  ForbiddenException,
} from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import { assertPostingPeriodOpen } from "@/modules/accounting/accounting.locks";
import { accountingRepository } from "@/modules/accounting/accounting.repository";
import { accountingService } from "@/modules/accounting/accounting.service";

vi.mock("@/modules/accounting/accounting.repository", () => ({
  accountingRepository: {
    findFixedAssetRemeasurementById: vi.fn(),
    findApprovedDisposals: vi.fn(),
    findApprovedRemeasurements: vi.fn(),
    getMakerCheckerSetting: vi.fn(),
  },
}));

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: { $transaction: vi.fn() },
}));

vi.mock("@/modules/accounting/accounting.locks", () => ({
  assertPostingPeriodOpen: vi.fn(),
  paymentReconciled: vi.fn(),
}));

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
const D = (v: string) => new Prisma.Decimal(v);

/**
 * 100,000 over 60 months from 01-Jan-2025, no cut-over anchor. At 01-Jan-2026
 * the engine carries it at 79,956.39 — the figure the service must MEASURE,
 * not the 100,000 sitting in purchasePrice nor the null openingBookValue.
 */
const CARRYING_AT_EFFECTIVE = "79956.39";

const ASSET = {
  id: "asset-1",
  entityId: "entity-1",
  assetNo: "FA-IT-2025-001",
  name: "Server rack",
  categoryCode: "IT",
  quantity: 1,
  purchasePrice: D("100000.00"),
  startDate: d("2025-01-01"),
  usefulLifeMonths: 60,
  openingBookValue: null,
  openingAsOfDate: null,
  status: "active",
  disposalDate: null,
  createdBy: "user-1",
  revaluationSurplus: D("0"),
  impairmentPlLoss: D("0"),
};

const ROW = {
  id: "rm-1",
  assetId: "asset-1",
  entityId: "entity-1",
  kind: "impairment",
  effectiveDate: d("2026-01-01"),
  carryingBefore: D(CARRYING_AT_EFFECTIVE),
  carryingAfter: D("60000.00"),
  status: "pending",
  createdBy: "user-1",
  asset: ASSET,
};

/** Transaction double capturing the writes the approve path attempts. */
function makeTx() {
  return {
    fixedAssetRemeasurement: {
      update: vi.fn().mockResolvedValue({ ...ROW, status: "approved" }),
    },
    fixedAsset: { update: vi.fn().mockResolvedValue(ASSET) },
  };
}

function useTx(tx: ReturnType<typeof makeTx>) {
  (prisma.$transaction as Mock).mockImplementation(
    (fn: (t: unknown) => unknown) => fn(tx),
  );
  return tx;
}

/** The `data` payload of the single remeasurement-row update. */
function rowUpdate(tx: ReturnType<typeof makeTx>) {
  return tx.fixedAssetRemeasurement.update.mock.calls[0]![0]!.data as Record<
    string,
    unknown
  >;
}

/** The `data` payload of the single asset update. */
function assetUpdate(tx: ReturnType<typeof makeTx>) {
  return tx.fixedAsset.update.mock.calls[0]![0]!.data as Record<
    string,
    unknown
  >;
}

/** Narrow a captured money column back to a Decimal for comparison. */
const dec = (v: unknown) => v as Prisma.Decimal;

function mockRow(overrides: Record<string, unknown> = {}) {
  (
    accountingRepository.findFixedAssetRemeasurementById as Mock
  ).mockResolvedValue({ ...ROW, ...overrides });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockRow();
  (accountingRepository.findApprovedDisposals as Mock).mockResolvedValue([]);
  (accountingRepository.findApprovedRemeasurements as Mock).mockResolvedValue(
    [],
  );
  (accountingRepository.getMakerCheckerSetting as Mock).mockResolvedValue(null);
});

describe("remeasurement approval — the carrying amount is measured, not read", () => {
  it("takes carryingBefore from the depreciation engine at the effective date", async () => {
    const tx = useTx(makeTx());

    await accountingService.approveFixedAssetRemeasurement("rm-1", "app-1");

    // 79,956.39 — one year of straight-line off a 100,000 cost. Reading
    // purchasePrice (100,000) or openingBookValue (null) would both be wrong,
    // and both are wrong in a way that looks entirely plausible on the row.
    expect(dec(rowUpdate(tx).carryingBefore).toFixed(2)).toBe(
      CARRYING_AT_EFFECTIVE,
    );
  });

  it("splits the movement to profit or loss when the asset carries no surplus", async () => {
    const tx = useTx(makeTx());

    await accountingService.approveFixedAssetRemeasurement("rm-1", "app-1");

    const data = rowUpdate(tx);
    expect(dec(data.movement).toFixed(2)).toBe("-19956.39");
    expect(dec(data.profitOrLoss).toFixed(2)).toBe("-19956.39");
    expect(dec(data.oci).toFixed(2)).toBe("0.00");
    // profitOrLoss + oci must reconstitute the movement exactly.
    expect(dec(data.profitOrLoss).plus(dec(data.oci)).toFixed(2)).toBe(
      dec(data.movement).toFixed(2),
    );
  });

  it("rolls the cumulative balances forward onto the asset", async () => {
    const tx = useTx(makeTx());

    await accountingService.approveFixedAssetRemeasurement("rm-1", "app-1");

    const data = rowUpdate(tx);
    expect(dec(data.plLossAfter).toFixed(2)).toBe("19956.39");
    expect(dec(data.surplusAfter).toFixed(2)).toBe("0.00");
    // The asset is the source of truth the NEXT remeasurement splits against,
    // so the row alone is not enough — the balances must land here too.
    const asset = assetUpdate(tx);
    expect(dec(asset.impairmentPlLoss).toFixed(2)).toBe("19956.39");
    expect(dec(asset.revaluationSurplus).toFixed(2)).toBe("0.00");
  });

  it("consumes an existing revaluation surplus before charging profit", async () => {
    // Same movement, different history: 5,000 of surplus in OCI absorbs the
    // first 5,000 of the write-down (IAS 16.40).
    mockRow({
      asset: { ...ASSET, revaluationSurplus: D("5000.00") },
    });
    const tx = useTx(makeTx());

    await accountingService.approveFixedAssetRemeasurement("rm-1", "app-1");

    const data = rowUpdate(tx);
    expect(dec(data.oci).toFixed(2)).toBe("-5000.00");
    expect(dec(data.profitOrLoss).toFixed(2)).toBe("-14956.39");
    expect(dec(data.surplusAfter).toFixed(2)).toBe("0.00");
    expect(dec(data.plLossAfter).toFixed(2)).toBe("14956.39");
  });
});

describe("remeasurement approval — the point-in-time snapshot", () => {
  it("records the asset's pre-event state, including the anchor DATE", async () => {
    mockRow({
      asset: {
        ...ASSET,
        openingBookValue: D("90000.00"),
        openingAsOfDate: d("2025-06-30"),
      },
    });
    const tx = useTx(makeTx());

    await accountingService.approveFixedAssetRemeasurement("rm-1", "app-1");

    const data = rowUpdate(tx);
    expect(data.quantityBefore).toBe(1);
    expect(dec(data.costBefore).toFixed(2)).toBe("100000.00");
    expect(dec(data.openingBookValueBefore).toFixed(2)).toBe("90000.00");
    // Unlike a disposal, approving this MOVES the anchor date — without the
    // snapshot every pre-event date would be valued against the post-event one.
    expect(data.openingAsOfDateBefore).toEqual(d("2025-06-30"));
  });

  it("re-anchors the live asset at the new carrying amount on the effective date", async () => {
    const tx = useTx(makeTx());

    await accountingService.approveFixedAssetRemeasurement("rm-1", "app-1");

    const asset = assetUpdate(tx);
    expect(asset.openingBookValue).toBe("60000.00");
    expect(asset.openingAsOfDate).toEqual(d("2026-01-01"));
  });

  it("posts no journal entry yet — linkedJeId is untouched", async () => {
    const tx = useTx(makeTx());

    await accountingService.approveFixedAssetRemeasurement("rm-1", "app-1");

    expect(rowUpdate(tx)).not.toHaveProperty("linkedJeId");
  });
});

describe("remeasurement approval — guards", () => {
  it("asserts the EFFECTIVE date's period, not the approval date's", async () => {
    const tx = useTx(makeTx());

    await accountingService.approveFixedAssetRemeasurement("rm-1", "app-1");

    expect(assertPostingPeriodOpen).toHaveBeenCalledWith(
      tx,
      "entity-1",
      ROW.effectiveDate,
    );
  });

  it("refuses the approval and writes nothing when the period is closed", async () => {
    const tx = useTx(makeTx());
    (assertPostingPeriodOpen as Mock).mockRejectedValueOnce(
      new BadRequestException("Fiscal period 2026-01 is closed"),
    );

    await expect(
      accountingService.approveFixedAssetRemeasurement("rm-1", "app-1"),
    ).rejects.toThrow(/closed/);

    // The guard runs first inside the transaction, so neither the remeasurement
    // nor the asset's balances are touched — recognition must not land in a
    // closed month.
    expect(tx.fixedAssetRemeasurement.update).not.toHaveBeenCalled();
    expect(tx.fixedAsset.update).not.toHaveBeenCalled();
  });

  it("blocks self-approval when maker-checker is on", async () => {
    (accountingRepository.getMakerCheckerSetting as Mock).mockResolvedValue({
      value: { blockSelfApproval: true },
    });
    useTx(makeTx());

    await expect(
      accountingService.approveFixedAssetRemeasurement("rm-1", "user-1"),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("refuses an already-approved row", async () => {
    mockRow({ status: "approved" });

    await expect(
      accountingService.approveFixedAssetRemeasurement("rm-1", "app-1"),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it("refuses an impairment that would write the asset UP", async () => {
    // The engine would happily split it as an increase — under a label that
    // says the opposite, and with no IAS 36.117 ceiling applied.
    mockRow({ carryingAfter: D("95000.00") });
    useTx(makeTx());

    await expect(
      accountingService.approveFixedAssetRemeasurement("rm-1", "app-1"),
    ).rejects.toThrow(/must reduce the carrying amount/);
  });
});
