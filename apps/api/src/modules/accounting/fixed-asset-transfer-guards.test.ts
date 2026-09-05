import { Prisma } from "@nexora/database";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { BadRequestException } from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import { assertPostingPeriodOpen } from "@/modules/accounting/accounting.locks";
import { accountingRepository } from "@/modules/accounting/accounting.repository";
import { accountingService } from "@/modules/accounting/accounting.service";
import { computeDepreciation } from "@/modules/accounting/fixed-asset-depreciation";

vi.mock("@/modules/accounting/accounting.repository", () => ({
  accountingRepository: {
    findFixedAssetById: vi.fn(),
    countPendingDisposalsForAsset: vi.fn(),
    countPendingTransfersForAsset: vi.fn(),
    createFixedAssetTransfer: vi.fn(),
    findFixedAssetTransferById: vi.fn(),
    rejectFixedAssetTransfer: vi.fn(),
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

const ACTOR = "user-1";
const READ_ALL = ["accounting:read-all"];

const ASSET = {
  id: "asset-1",
  entityId: "entity-1",
  assetNo: "IT-0001",
  categoryCode: "IT-LAPTOP",
  location: "HQ Floor 3",
  assignedUser: "Somchai",
  quantity: 8,
  purchasePrice: new Prisma.Decimal("20859.84"),
  status: "active",
  createdBy: ACTOR,
  startDate: d("2025-02-06"),
  usefulLifeMonths: 60,
  openingBookValue: null,
  openingAsOfDate: null,
};

const TRANSFER_DATE = d("2026-06-30");

function pendingTransfer(overrides: Record<string, unknown> = {}) {
  return {
    id: "trf-1",
    assetId: ASSET.id,
    entityId: ASSET.entityId,
    kind: "location",
    transferDate: TRANSFER_DATE,
    fromLocation: "HQ Floor 3",
    toLocation: "HQ Floor 7",
    fromCustodian: null,
    toCustodian: null,
    toEntityId: null,
    reason: null,
    status: "pending",
    createdBy: ACTOR,
    asset: ASSET,
    ...overrides,
  };
}

/** Transaction double capturing the writes the approve path attempts. */
function makeTx() {
  return {
    fixedAssetTransfer: {
      update: vi.fn().mockResolvedValue({ id: "trf-1", status: "approved" }),
    },
    fixedAsset: { update: vi.fn().mockResolvedValue(ASSET) },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  (accountingRepository.findFixedAssetById as Mock).mockResolvedValue(ASSET);
  (
    accountingRepository.countPendingDisposalsForAsset as Mock
  ).mockResolvedValue(0);
  (
    accountingRepository.countPendingTransfersForAsset as Mock
  ).mockResolvedValue(0);
  (accountingRepository.createFixedAssetTransfer as Mock).mockImplementation(
    (data: Record<string, unknown>) =>
      Promise.resolve({ id: "trf-1", ...data }),
  );
  (accountingRepository.getMakerCheckerSetting as Mock).mockResolvedValue(null);
});

describe("submitFixedAssetTransfer — one open request at a time", () => {
  it("refuses a transfer while a disposal is still pending", async () => {
    (
      accountingRepository.countPendingDisposalsForAsset as Mock
    ).mockResolvedValue(1);

    await expect(
      accountingService.submitFixedAssetTransfer(
        "asset-1",
        { kind: "location", transferDate: "2026-06-30", toLocation: "Rayong" },
        ACTOR,
        READ_ALL,
      ),
    ).rejects.toThrow(/pending disposal/);

    // Both claims are on the same units; letting them queue up means whichever
    // is approved second is applied to a row the first already changed.
    expect(
      accountingRepository.createFixedAssetTransfer,
    ).not.toHaveBeenCalled();
  });

  it("refuses a second pending transfer on the same asset", async () => {
    (
      accountingRepository.countPendingTransfersForAsset as Mock
    ).mockResolvedValue(1);

    await expect(
      accountingService.submitFixedAssetTransfer(
        "asset-1",
        { kind: "location", transferDate: "2026-06-30", toLocation: "Rayong" },
        ACTOR,
        READ_ALL,
      ),
    ).rejects.toThrow(/pending transfer/);

    expect(
      accountingRepository.createFixedAssetTransfer,
    ).not.toHaveBeenCalled();
  });
});

describe("submitFixedAssetTransfer — engine validation mapping", () => {
  it("maps a TransferValidationError to a 400, not a 500", async () => {
    const promise = accountingService.submitFixedAssetTransfer(
      "asset-1",
      // Already at this location — the engine refuses it.
      {
        kind: "location",
        transferDate: "2026-06-30",
        toLocation: ASSET.location,
      },
      ACTOR,
      READ_ALL,
    );

    await expect(promise).rejects.toBeInstanceOf(BadRequestException);
    await expect(promise).rejects.toThrow(/already at that location/);
    expect(
      accountingRepository.createFixedAssetTransfer,
    ).not.toHaveBeenCalled();
  });

  it("refuses a transfer of an asset that is no longer in service", async () => {
    (accountingRepository.findFixedAssetById as Mock).mockResolvedValue({
      ...ASSET,
      status: "disposed",
    });

    await expect(
      accountingService.submitFixedAssetTransfer(
        "asset-1",
        { kind: "location", transferDate: "2026-06-30", toLocation: "Rayong" },
        ACTOR,
        READ_ALL,
      ),
    ).rejects.toThrow(/status "disposed"/);
  });
});

describe("submitFixedAssetTransfer — cross-entity value carried", () => {
  it("carries cost AND accumulated depreciation as at the transfer date", async () => {
    await accountingService.submitFixedAssetTransfer(
      "asset-1",
      {
        kind: "entity",
        transferDate: "2026-06-30",
        toEntityId: "entity-2",
      },
      ACTOR,
      READ_ALL,
    );

    const data = (accountingRepository.createFixedAssetTransfer as Mock).mock
      .calls[0][0];
    // Accumulated depreciation is the figure AT THE TRANSFER DATE, not today's
    // — a move filed in March for a January date carries January's numbers.
    const expected = computeDepreciation(
      {
        purchasePrice: ASSET.purchasePrice.toString(),
        quantity: ASSET.quantity,
        startDate: ASSET.startDate,
        usefulLifeMonths: ASSET.usefulLifeMonths,
        openingBookValue: null,
        openingAsOfDate: null,
      },
      TRANSFER_DATE,
    ).accumulatedDepreciation;

    expect(data.toEntityId).toBe("entity-2");
    expect(String(data.costTransferred)).toBe(ASSET.purchasePrice.toString());
    expect(String(data.accumulatedTransferred)).toBe(expected.toString());
    // Carrying only the cost would restate NBV upward by the whole accumulated
    // depreciation, so a non-zero accumulated figure is the point of the test.
    expect(expected.greaterThan(0)).toBe(true);
    // The destination continues the ORIGINAL remaining life, never a fresh one.
    expect(data.remainingLifeMonths).toBe(44);
  });
});

describe("approveFixedAssetTransfer — cross-entity is refused, but guarded first", () => {
  beforeEach(() => {
    (accountingRepository.findFixedAssetTransferById as Mock).mockResolvedValue(
      pendingTransfer({ kind: "entity", toEntityId: "entity-2" }),
    );
  });

  it("asserts BOTH entities' periods and then refuses, writing nothing", async () => {
    const tx = makeTx();
    (prisma.$transaction as Mock).mockImplementation(
      (fn: (t: unknown) => unknown) => fn(tx),
    );

    await expect(
      accountingService.approveFixedAssetTransfer("trf-1", "approver-1"),
    ).rejects.toThrow(/not yet available/);

    // Value would leave one entity's books and land on another's, so BOTH
    // periods govern — and both are asserted at the transfer date, not today.
    expect(assertPostingPeriodOpen).toHaveBeenCalledWith(
      tx,
      "entity-1",
      TRANSFER_DATE,
    );
    expect(assertPostingPeriodOpen).toHaveBeenCalledWith(
      tx,
      "entity-2",
      TRANSFER_DATE,
    );
    expect(tx.fixedAssetTransfer.update).not.toHaveBeenCalled();
    expect(tx.fixedAsset.update).not.toHaveBeenCalled();
  });

  it("fails on a closed period before it ever reaches the refusal", async () => {
    const tx = makeTx();
    (prisma.$transaction as Mock).mockImplementation(
      (fn: (t: unknown) => unknown) => fn(tx),
    );
    (assertPostingPeriodOpen as Mock).mockRejectedValueOnce(
      new BadRequestException("Fiscal period 2026-06 is closed"),
    );

    await expect(
      accountingService.approveFixedAssetTransfer("trf-1", "approver-1"),
    ).rejects.toThrow(/closed/);
    expect(tx.fixedAssetTransfer.update).not.toHaveBeenCalled();
  });
});

describe("approveFixedAssetTransfer — location / custodian", () => {
  it("applies the plan's field changes and re-stamps the from* trail", async () => {
    const tx = makeTx();
    (prisma.$transaction as Mock).mockImplementation(
      (fn: (t: unknown) => unknown) => fn(tx),
    );
    (accountingRepository.findFixedAssetTransferById as Mock).mockResolvedValue(
      // Filed when the asset was on Floor 3; it has since been moved to Floor 5.
      pendingTransfer({
        fromLocation: "HQ Floor 3",
        toLocation: "HQ Floor 7",
        asset: { ...ASSET, location: "HQ Floor 5" },
      }),
    );

    await accountingService.approveFixedAssetTransfer("trf-1", "approver-1");

    expect(tx.fixedAsset.update).toHaveBeenCalledWith({
      where: { id: "asset-1" },
      data: { location: "HQ Floor 7" },
    });
    const update = tx.fixedAssetTransfer.update.mock.calls[0][0];
    expect(update.data.status).toBe("approved");
    // The trail records where the asset ACTUALLY moved from, not where it sat
    // when the request was filed.
    expect(update.data.fromLocation).toBe("HQ Floor 5");
    // No value moves, so the fiscal-period lock has nothing to govern here.
    expect(assertPostingPeriodOpen).not.toHaveBeenCalled();
  });

  it("blocks self-approval when maker-checker is on", async () => {
    (accountingRepository.getMakerCheckerSetting as Mock).mockResolvedValue({
      value: { blockSelfApproval: true },
    });
    (accountingRepository.findFixedAssetTransferById as Mock).mockResolvedValue(
      pendingTransfer(),
    );

    await expect(
      accountingService.approveFixedAssetTransfer("trf-1", ACTOR),
    ).rejects.toThrow(/Maker-checker/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuses to approve a transfer that is not pending", async () => {
    (accountingRepository.findFixedAssetTransferById as Mock).mockResolvedValue(
      pendingTransfer({ status: "rejected" }),
    );

    await expect(
      accountingService.approveFixedAssetTransfer("trf-1", "approver-1"),
    ).rejects.toThrow(/status "rejected"/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("raises a conflict when the asset moved out from under the request", async () => {
    (accountingRepository.findFixedAssetTransferById as Mock).mockResolvedValue(
      // Someone already put the asset on Floor 7 by hand.
      pendingTransfer({ asset: { ...ASSET, location: "HQ Floor 7" } }),
    );

    await expect(
      accountingService.approveFixedAssetTransfer("trf-1", "approver-1"),
    ).rejects.toThrow(/Cannot approve: .*already at that location/);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});

describe("rejectFixedAssetTransfer", () => {
  it("stamps the rejection and leaves the asset row untouched", async () => {
    (accountingRepository.findFixedAssetTransferById as Mock).mockResolvedValue(
      pendingTransfer(),
    );
    (accountingRepository.rejectFixedAssetTransfer as Mock).mockResolvedValue({
      id: "trf-1",
      status: "rejected",
    });

    const out = await accountingService.rejectFixedAssetTransfer(
      "trf-1",
      "approver-1",
      "Wrong destination",
    );

    expect(out.status).toBe("rejected");
    expect(accountingRepository.rejectFixedAssetTransfer).toHaveBeenCalledWith(
      "trf-1",
      "approver-1",
      "Wrong destination",
    );
    // Unlike a disposal, submit never parked the asset, so there is nothing to
    // unwind — no transaction, no asset write.
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("refuses to reject a transfer that is not pending", async () => {
    (accountingRepository.findFixedAssetTransferById as Mock).mockResolvedValue(
      pendingTransfer({ status: "approved" }),
    );

    await expect(
      accountingService.rejectFixedAssetTransfer("trf-1", "approver-1", "no"),
    ).rejects.toThrow(/status "approved"/);
    expect(
      accountingRepository.rejectFixedAssetTransfer,
    ).not.toHaveBeenCalled();
  });
});
