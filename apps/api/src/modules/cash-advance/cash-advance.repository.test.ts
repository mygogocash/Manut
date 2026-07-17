import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { prisma } from "@/infrastructure/database/prisma";
import { CashAdvanceRepository } from "@/modules/cash-advance/cash-advance.repository";

const tx = vi.hoisted(() => ({
  $queryRaw: vi.fn(),
  cashAdvanceRequest: {
    updateMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
  },
}));

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    $transaction: vi.fn(),
  },
}));

describe("CashAdvanceRepository finance transitions", () => {
  let repository: CashAdvanceRepository;

  beforeEach(() => {
    repository = new CashAdvanceRepository();
    vi.clearAllMocks();
    (prisma.$transaction as Mock).mockImplementation((callback) =>
      callback(tx),
    );
    tx.$queryRaw.mockResolvedValue([{ id: "upload-1" }]);
    tx.cashAdvanceRequest.updateMany.mockResolvedValue({ count: 1 });
    tx.cashAdvanceRequest.findUniqueOrThrow.mockResolvedValue({
      id: "ca-1",
      status: "disbursed",
    });
  });

  it("locks and rechecks the exact proof binding before storing it atomically", async () => {
    const disbursedAt = new Date("2026-07-17T02:00:00.000Z");
    const proofUrl = "https://storage.example/documents/disbursement.pdf";

    await expect(
      repository.markDisbursedIfApproved("ca-1", {
        disbursedAt,
        proofUploadId: "upload-1",
        proofUrl,
        uploadedBy: "finance-1",
      }),
    ).resolves.toEqual({ id: "ca-1", status: "disbursed" });

    const lockQuery = tx.$queryRaw.mock.calls[0]?.[0] as {
      sql: string;
      values: unknown[];
    };
    expect(lockQuery.sql).toMatch(/FROM file_uploads/);
    expect(lockQuery.sql).toMatch(
      /purpose = 'cash-advance-disbursement-proof'/,
    );
    expect(lockQuery.sql).toMatch(/linked_to = 'cash-advance'/);
    expect(lockQuery.sql).toMatch(/linked_id = /);
    expect(lockQuery.sql).toMatch(/uploaded_by = /);
    expect(lockQuery.sql).toMatch(/FOR KEY SHARE/);
    expect(lockQuery.values).toEqual(["upload-1", "ca-1", "finance-1"]);
    expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(
      tx.cashAdvanceRequest.updateMany.mock.invocationCallOrder[0] ?? 0,
    );
    expect(tx.cashAdvanceRequest.updateMany).toHaveBeenCalledWith({
      where: { id: "ca-1", status: "approved", deletedAt: null },
      data: {
        status: "disbursed",
        disbursedAt,
        disbursementProofUploadId: "upload-1",
        disbursementProofUrl: proofUrl,
      },
    });
    expect(tx.cashAdvanceRequest.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: "ca-1" },
      include: expect.any(Object),
    });
  });

  it("does not refetch when a concurrent disbursement won the transition", async () => {
    tx.cashAdvanceRequest.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      repository.markDisbursedIfApproved("ca-1", {
        disbursedAt: new Date("2026-07-17T02:00:00.000Z"),
        proofUploadId: "upload-1",
        proofUrl: "https://storage.example/documents/late.pdf",
        uploadedBy: "finance-1",
      }),
    ).resolves.toBeNull();

    expect(tx.cashAdvanceRequest.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("does not transition when deletion removed the proof before it could be locked", async () => {
    tx.$queryRaw.mockResolvedValue([]);

    await expect(
      repository.markDisbursedIfApproved("ca-1", {
        disbursedAt: new Date("2026-07-17T02:00:00.000Z"),
        proofUploadId: "upload-1",
        proofUrl: "https://storage.example/documents/deleted.pdf",
        uploadedBy: "finance-1",
      }),
    ).resolves.toBeNull();

    expect(tx.cashAdvanceRequest.updateMany).not.toHaveBeenCalled();
    expect(tx.cashAdvanceRequest.findUniqueOrThrow).not.toHaveBeenCalled();
  });

  it("compares disbursed status before storing the clear timestamp", async () => {
    const clearedAt = new Date("2026-07-17T03:00:00.000Z");
    tx.cashAdvanceRequest.findUniqueOrThrow.mockResolvedValue({
      id: "ca-1",
      status: "cleared",
    });

    await expect(
      repository.markClearedIfDisbursed("ca-1", clearedAt),
    ).resolves.toEqual({ id: "ca-1", status: "cleared" });

    expect(tx.cashAdvanceRequest.updateMany).toHaveBeenCalledWith({
      where: { id: "ca-1", status: "disbursed", deletedAt: null },
      data: { status: "cleared", clearedAt },
    });
    expect(tx.cashAdvanceRequest.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: "ca-1" },
      include: expect.any(Object),
    });
  });

  it("does not refetch when a concurrent clear won the transition", async () => {
    tx.cashAdvanceRequest.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      repository.markClearedIfDisbursed(
        "ca-1",
        new Date("2026-07-17T03:00:00.000Z"),
      ),
    ).resolves.toBeNull();

    expect(tx.cashAdvanceRequest.findUniqueOrThrow).not.toHaveBeenCalled();
  });
});
