import { beforeEach, describe, expect, it, vi } from "vitest";

import { uploadsRepository } from "@/modules/uploads/uploads.repository";

const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    cashAdvanceRequest: { count: vi.fn() },
    fileUpload: { delete: vi.fn() },
    legalSignature: { count: vi.fn() },
  };
  return {
    count: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
    transaction: vi.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
    tx,
  };
});

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    $transaction: mocks.transaction,
    fileUpload: {
      count: mocks.count,
      findMany: mocks.findMany,
      updateMany: mocks.updateMany,
    },
  },
}));

describe("uploadsRepository protected application artifacts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.count.mockResolvedValue(0);
    mocks.findMany.mockResolvedValue([]);
    mocks.updateMany.mockResolvedValue({ count: 0 });
    mocks.tx.cashAdvanceRequest.count.mockResolvedValue(0);
    mocks.tx.legalSignature.count.mockResolvedValue(0);
  });

  it("omits payslip and committed-proof artifacts from the generic owner list", async () => {
    await uploadsRepository.findAll("user-a", 1, 20);

    const where = {
      uploadedBy: "user-a",
      OR: [
        { purpose: null },
        {
          purpose: {
            notIn: ["payslip-document", "cash-advance-disbursement-proof"],
          },
        },
      ],
    };
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where }),
    );
    expect(mocks.count).toHaveBeenCalledWith({ where });
  });

  it("does not let the original uploader delete a payslip artifact", async () => {
    mocks.tx.$queryRaw.mockResolvedValue([
      {
        bucket: "documents",
        path: "payroll/payslip.pdf",
        purpose: "payslip-document",
        uploadedBy: "user-a",
      },
    ]);

    await expect(
      uploadsRepository.removeOwnedIfUnreferenced("upload-1", "user-a"),
    ).resolves.toEqual({ status: "protected" });

    expect(mocks.tx.fileUpload.delete).not.toHaveBeenCalled();
  });

  it("retains a committed cash proof even if registry purpose is corrupted", async () => {
    mocks.tx.$queryRaw.mockResolvedValue([
      {
        bucket: "documents",
        path: "cash-advance/proof.pdf",
        purpose: "unexpected-purpose",
        uploadedBy: "user-a",
      },
    ]);
    mocks.tx.cashAdvanceRequest.count.mockResolvedValue(1);

    await expect(
      uploadsRepository.removeOwnedIfUnreferenced("upload-1", "user-a"),
    ).resolves.toEqual({ status: "protected" });

    expect(mocks.tx.fileUpload.delete).not.toHaveBeenCalled();
  });

  it("atomically excludes module-controlled uploads from message relinking", async () => {
    await expect(
      uploadsRepository.linkToMessage(
        ["cash-proof-upload", "payslip-upload"],
        "message-1",
        "user-a",
      ),
    ).resolves.toEqual([]);

    const relinkableWhere = {
      id: { in: ["cash-proof-upload", "payslip-upload"] },
      uploadedBy: "user-a",
      OR: [
        { purpose: null },
        {
          purpose: {
            notIn: ["payslip-document", "cash-advance-disbursement-proof"],
          },
        },
      ],
    };
    expect(mocks.updateMany).toHaveBeenCalledWith({
      where: relinkableWhere,
      data: { linkedTo: "message", linkedId: "message-1" },
    });
  });

  it("returns only uploads that remain linked to the new message", async () => {
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.findMany.mockResolvedValue([{ id: "ordinary-upload" }]);

    await expect(
      uploadsRepository.linkToMessage(
        ["ordinary-upload", "concurrently-relinked-upload"],
        "message-1",
        "user-a",
      ),
    ).resolves.toEqual([{ id: "ordinary-upload" }]);

    expect(mocks.findMany).toHaveBeenCalledWith({
      where: {
        id: {
          in: ["ordinary-upload", "concurrently-relinked-upload"],
        },
        uploadedBy: "user-a",
        OR: [
          { purpose: null },
          {
            purpose: {
              notIn: ["payslip-document", "cash-advance-disbursement-proof"],
            },
          },
        ],
        linkedTo: "message",
        linkedId: "message-1",
      },
    });
  });
});
