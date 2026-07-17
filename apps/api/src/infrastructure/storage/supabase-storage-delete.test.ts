import { beforeEach, describe, expect, it, vi } from "vitest";

import { deleteFile } from "@/infrastructure/storage/supabase-storage";

const mocks = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    cashAdvanceRequest: { count: vi.fn() },
    fileUpload: { deleteMany: vi.fn() },
    legalSignature: { count: vi.fn() },
  };
  return {
    remove: vi.fn(),
    transaction: vi.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
    tx,
  };
});

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: { $transaction: mocks.transaction },
}));

vi.mock("@/infrastructure/supabase/admin", () => ({
  isSupabaseConfigured: true,
  supabaseAdmin: {
    storage: {
      from: vi.fn(() => ({ remove: mocks.remove })),
    },
  },
}));

describe("deleteFile application-evidence retention", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.tx.$queryRaw.mockResolvedValue([{ id: "upload-1" }]);
    mocks.tx.cashAdvanceRequest.count.mockResolvedValue(0);
    mocks.tx.legalSignature.count.mockResolvedValue(0);
    mocks.tx.fileUpload.deleteMany.mockResolvedValue({ count: 1 });
    mocks.remove.mockResolvedValue({ error: null });
  });

  it("deletes upload metadata before removing an unreferenced object", async () => {
    await expect(
      deleteFile("documents", "legal/draft.pdf"),
    ).resolves.toBeUndefined();

    expect(mocks.tx.fileUpload.deleteMany).toHaveBeenCalledWith({
      where: { id: { in: ["upload-1"] } },
    });
    expect(mocks.remove).toHaveBeenCalledWith(["legal/draft.pdf"]);
  });

  it("removes a just-uploaded object even when registry creation never succeeded", async () => {
    mocks.tx.$queryRaw.mockResolvedValue([]);

    await expect(
      deleteFile("documents", "payroll/unregistered.pdf"),
    ).resolves.toBeUndefined();

    expect(mocks.tx.fileUpload.deleteMany).not.toHaveBeenCalled();
    expect(mocks.remove).toHaveBeenCalledWith(["payroll/unregistered.pdf"]);
  });

  it("never removes an object retained by legal signing evidence", async () => {
    mocks.tx.legalSignature.count.mockResolvedValue(1);

    await expect(deleteFile("documents", "legal/signed.pdf")).rejects.toThrow(
      "retained by an application record",
    );

    expect(mocks.tx.fileUpload.deleteMany).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });

  it("never removes a committed cash-advance disbursement proof", async () => {
    mocks.tx.cashAdvanceRequest.count.mockResolvedValue(1);

    await expect(
      deleteFile("documents", "cash-advance/proof.pdf"),
    ).rejects.toThrow("retained by an application record");

    expect(mocks.tx.fileUpload.deleteMany).not.toHaveBeenCalled();
    expect(mocks.remove).not.toHaveBeenCalled();
  });
});
