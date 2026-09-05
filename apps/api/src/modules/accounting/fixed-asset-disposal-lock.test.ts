import { Prisma } from "@nexora/database";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { BadRequestException } from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import { assertPostingPeriodOpen } from "@/modules/accounting/accounting.locks";
import { accountingRepository } from "@/modules/accounting/accounting.repository";
import { accountingService } from "@/modules/accounting/accounting.service";

vi.mock("@/modules/accounting/accounting.repository", () => ({
  accountingRepository: {
    findFixedAssetDisposalById: vi.fn(),
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

const ASSET = {
  id: "asset-1",
  quantity: 8,
  purchasePrice: new Prisma.Decimal("20859.84"),
  startDate: d("2025-02-06"),
  usefulLifeMonths: 60,
  openingBookValue: null,
  openingAsOfDate: null,
  status: "active",
};

const DISPOSAL = {
  id: "disp-1",
  entityId: "entity-1",
  assetId: "asset-1",
  disposalType: "sale",
  disposalDate: d("2026-12-31"),
  unitsDisposed: 3,
  proceeds: new Prisma.Decimal("3000"),
  status: "pending",
  createdBy: "user-1",
  asset: ASSET,
};

/** Transaction double capturing the writes the approve path attempts. */
function makeTx() {
  return {
    fixedAssetDisposal: {
      update: vi.fn().mockResolvedValue({ ...DISPOSAL, status: "approved" }),
    },
    fixedAsset: { update: vi.fn().mockResolvedValue(ASSET) },
  };
}

describe("fixed asset disposal — fiscal period guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (accountingRepository.findFixedAssetDisposalById as Mock).mockResolvedValue(
      DISPOSAL,
    );
    (accountingRepository.getMakerCheckerSetting as Mock).mockResolvedValue(
      null,
    );
  });

  it("asserts the disposal date's period before writing anything", async () => {
    const tx = makeTx();
    (prisma.$transaction as Mock).mockImplementation(
      (fn: (t: unknown) => unknown) => fn(tx),
    );

    await accountingService.approveFixedAssetDisposal("disp-1", "approver-1");

    // The DISPOSAL date governs the period — not today, and not the asset's
    // purchase date. A disposal approved in March for a December date belongs
    // to December.
    expect(assertPostingPeriodOpen).toHaveBeenCalledWith(
      tx,
      "entity-1",
      DISPOSAL.disposalDate,
    );
    expect(tx.fixedAssetDisposal.update).toHaveBeenCalled();
  });

  it("refuses the approval and writes nothing when the period is closed", async () => {
    const tx = makeTx();
    (prisma.$transaction as Mock).mockImplementation(
      (fn: (t: unknown) => unknown) => fn(tx),
    );
    (assertPostingPeriodOpen as Mock).mockRejectedValueOnce(
      new BadRequestException("Fiscal period 2026-12 is closed"),
    );

    await expect(
      accountingService.approveFixedAssetDisposal("disp-1", "approver-1"),
    ).rejects.toThrow(/closed/);

    // The guard runs first inside the transaction, so neither the disposal nor
    // the asset row is touched — value must not move into a closed month.
    expect(tx.fixedAssetDisposal.update).not.toHaveBeenCalled();
    expect(tx.fixedAsset.update).not.toHaveBeenCalled();
  });
});
