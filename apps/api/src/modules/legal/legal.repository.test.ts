import { beforeEach, describe, expect, it, vi } from "vitest";

import { legalRepository } from "@/modules/legal/legal.repository";

const db = vi.hoisted(() => {
  const tx = {
    $queryRaw: vi.fn(),
    legalDocument: { delete: vi.fn(), update: vi.fn() },
    legalSignature: {
      count: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  };
  return {
    signatureUpdateMany: vi.fn(),
    transaction: vi.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
    tx,
  };
});

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    $transaction: db.transaction,
    legalSignature: { updateMany: db.signatureUpdateMany },
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  db.signatureUpdateMany.mockResolvedValue({ count: 1 });
});

const artifact = {
  bucket: "documents",
  path: "legal/agreement.pdf",
  sha256: "a".repeat(64),
  size: 128,
  mimeType: "application/pdf",
  fileName: "agreement.pdf",
  title: "Employment agreement",
  kind: "contract",
  sourceFileUrl: "https://storage.example/legal/agreement.pdf",
  sourceFileName: "agreement.pdf",
  uploadId: "77777777-7777-4777-8777-777777777777",
};

const lockedDocument = {
  fileName: artifact.sourceFileName,
  fileUrl: artifact.sourceFileUrl,
  kind: artifact.kind,
  status: "active",
  title: artifact.title,
};

describe("legalRepository.claimSignatureInvite", () => {
  it("reclaims a pending invite after its five-minute claim lease expires", async () => {
    const claimedAt = new Date("2026-07-17T12:05:00.000Z");

    await expect(
      legalRepository.claimSignatureInvite("signature-1", claimedAt),
    ).resolves.toBe(true);

    expect(db.signatureUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "signature-1",
        status: "pending",
        OR: [
          { sentAt: null },
          { sentAt: { lt: new Date("2026-07-17T12:00:00.000Z") } },
        ],
      },
      data: { sentAt: claimedAt },
    });
  });
});

describe("legalRepository signing-evidence fencing", () => {
  it("does not replace signing-relevant fields once evidence exists", async () => {
    db.tx.$queryRaw.mockResolvedValue([
      { id: "44444444-4444-4444-8444-444444444444" },
    ]);
    db.tx.legalSignature.count.mockResolvedValue(1);

    await expect(
      legalRepository.updateBeforeSigning(
        "44444444-4444-4444-8444-444444444444",
        { fileUrl: "https://storage.example/replacement.pdf" },
      ),
    ).resolves.toBeNull();

    expect(db.tx.legalDocument.update).not.toHaveBeenCalled();
  });

  it("does not cascade-delete a document once evidence exists", async () => {
    db.tx.$queryRaw.mockResolvedValue([
      { id: "44444444-4444-4444-8444-444444444444" },
    ]);
    db.tx.legalSignature.count.mockResolvedValue(1);

    await expect(
      legalRepository.removeBeforeSigning(
        "44444444-4444-4444-8444-444444444444",
      ),
    ).resolves.toBe(false);

    expect(db.tx.legalDocument.delete).not.toHaveBeenCalled();
  });
});

describe("legalRepository.createSignatures", () => {
  it("rejects an empty signing batch before opening a transaction", async () => {
    await expect(
      legalRepository.createSignatures(
        "44444444-4444-4444-8444-444444444444",
        "55555555-5555-4555-8555-555555555555",
        artifact,
        [],
      ),
    ).rejects.toThrow("At least one signer is required");

    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("force-binds every signature row to the locked document artifact", async () => {
    db.tx.$queryRaw.mockResolvedValue([
      { ...lockedDocument, currentSigningBatchId: null },
    ]);
    db.tx.legalSignature.findMany.mockResolvedValue([]);
    db.tx.legalSignature.create.mockResolvedValue({ id: "signature-1" });

    await expect(
      legalRepository.createSignatures(
        "44444444-4444-4444-8444-444444444444",
        "55555555-5555-4555-8555-555555555555",
        artifact,
        [
          {
            createdById: "66666666-6666-4666-8666-666666666666",
            signerEmail: "signer@manut.example",
            signerName: "Signer",
            token: "new-token",
          },
        ],
      ),
    ).resolves.toEqual([{ id: "signature-1" }]);

    expect(db.tx.legalSignature.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        batchId: "55555555-5555-4555-8555-555555555555",
        documentId: "44444444-4444-4444-8444-444444444444",
        documentSnapshotBucket: artifact.bucket,
        documentSnapshotPath: artifact.path,
        documentSnapshotUploadId: artifact.uploadId,
        documentSnapshotSha256: artifact.sha256,
        documentSnapshotSize: artifact.size,
        documentSnapshotMimeType: artifact.mimeType,
        documentSnapshotFileName: artifact.fileName,
        documentSnapshotTitle: artifact.title,
        documentSnapshotKind: artifact.kind,
      }),
      include: expect.any(Object),
    });
  });

  it("rejects a snapshot when the locked document changed during hashing", async () => {
    db.tx.$queryRaw.mockResolvedValue([
      {
        ...lockedDocument,
        currentSigningBatchId: null,
        fileUrl: "https://storage.example/legal/replacement.pdf",
      },
    ]);

    await expect(
      legalRepository.createSignatures(
        "44444444-4444-4444-8444-444444444444",
        "55555555-5555-4555-8555-555555555555",
        artifact,
        [
          {
            createdById: "66666666-6666-4666-8666-666666666666",
            signerEmail: "signer@manut.example",
            signerName: "Signer",
            token: "new-token",
          },
        ],
      ),
    ).resolves.toBeNull();

    expect(db.tx.legalSignature.create).not.toHaveBeenCalled();
  });

  it("does not recover a fresh unclaimed signing batch", async () => {
    const currentBatchId = "11111111-1111-4111-8111-111111111111";
    const justCreated = new Date();
    db.tx.$queryRaw.mockResolvedValue([
      { ...lockedDocument, currentSigningBatchId: currentBatchId },
    ]);
    db.tx.legalSignature.findMany
      .mockResolvedValueOnce([
        {
          batchId: currentBatchId,
          id: "22222222-2222-4222-8222-222222222222",
          sentAt: null,
          status: "pending",
        },
      ])
      .mockResolvedValueOnce([
        {
          createdAt: justCreated,
          id: "22222222-2222-4222-8222-222222222222",
          sentAt: null,
          status: "pending",
        },
      ]);

    await expect(
      legalRepository.createSignatures(
        "44444444-4444-4444-8444-444444444444",
        "55555555-5555-4555-8555-555555555555",
        artifact,
        [
          {
            createdById: "66666666-6666-4666-8666-666666666666",
            signerEmail: "next@manut.example",
            signerName: "Next Signer",
            token: "new-token",
          },
        ],
      ),
    ).resolves.toBeNull();

    expect(db.tx.legalSignature.updateMany).not.toHaveBeenCalled();
    expect(db.tx.legalDocument.update).not.toHaveBeenCalled();
    expect(db.tx.legalSignature.create).not.toHaveBeenCalled();
  });

  it("does not supersede a sequential batch after an earlier signer completed", async () => {
    const currentBatchId = "11111111-1111-4111-8111-111111111111";
    db.tx.$queryRaw.mockResolvedValue([
      { ...lockedDocument, currentSigningBatchId: currentBatchId },
    ]);
    db.tx.legalSignature.findMany
      .mockResolvedValueOnce([
        {
          batchId: currentBatchId,
          id: "22222222-2222-4222-8222-222222222222",
          sentAt: null,
          status: "pending",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: "33333333-3333-4333-8333-333333333333",
          sentAt: new Date("2026-07-17T11:00:00.000Z"),
          status: "signed",
        },
        {
          id: "22222222-2222-4222-8222-222222222222",
          sentAt: null,
          status: "pending",
        },
      ]);

    await expect(
      legalRepository.createSignatures(
        "44444444-4444-4444-8444-444444444444",
        "55555555-5555-4555-8555-555555555555",
        artifact,
        [
          {
            createdById: "66666666-6666-4666-8666-666666666666",
            signerEmail: "next@manut.example",
            signerName: "Next Signer",
            token: "new-token",
          },
        ],
      ),
    ).resolves.toBeNull();

    expect(db.tx.legalSignature.updateMany).not.toHaveBeenCalled();
    expect(db.tx.legalDocument.update).not.toHaveBeenCalled();
    expect(db.tx.legalSignature.create).not.toHaveBeenCalled();
  });

  it("rolls back stale-batch recovery when a pending invite changes concurrently", async () => {
    const currentBatchId = "11111111-1111-4111-8111-111111111111";
    const staleClaim = new Date("2000-01-01T00:00:00.000Z");
    db.tx.$queryRaw.mockResolvedValue([
      { ...lockedDocument, currentSigningBatchId: currentBatchId },
    ]);
    db.tx.legalSignature.findMany
      .mockResolvedValueOnce([
        {
          batchId: currentBatchId,
          id: "22222222-2222-4222-8222-222222222222",
          sentAt: staleClaim,
          status: "pending",
        },
        {
          batchId: currentBatchId,
          id: "33333333-3333-4333-8333-333333333333",
          sentAt: null,
          status: "pending",
        },
      ])
      .mockResolvedValueOnce([
        {
          createdAt: staleClaim,
          id: "22222222-2222-4222-8222-222222222222",
          sentAt: staleClaim,
          status: "pending",
        },
        {
          createdAt: staleClaim,
          id: "33333333-3333-4333-8333-333333333333",
          sentAt: null,
          status: "pending",
        },
      ]);
    db.tx.legalSignature.updateMany.mockResolvedValue({ count: 1 });

    await expect(
      legalRepository.createSignatures(
        "44444444-4444-4444-8444-444444444444",
        "55555555-5555-4555-8555-555555555555",
        artifact,
        [
          {
            createdById: "66666666-6666-4666-8666-666666666666",
            signerEmail: "next@manut.example",
            signerName: "Next Signer",
            token: "new-token",
          },
        ],
      ),
    ).rejects.toThrow("The existing signing workflow changed");

    expect(db.tx.legalDocument.update).not.toHaveBeenCalled();
    expect(db.tx.legalSignature.create).not.toHaveBeenCalled();
  });
});
