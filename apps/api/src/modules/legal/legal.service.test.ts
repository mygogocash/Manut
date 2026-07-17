import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { prisma } from "@/infrastructure/database/prisma";
import { sendRequiredEmail } from "@/infrastructure/email/email.service";
import {
  createSignedUrl,
  downloadToBuffer,
  parseTrustedStorageUrl,
  STORAGE_BUCKETS,
} from "@/infrastructure/storage/supabase-storage";
import { legalRepository } from "@/modules/legal/legal.repository";
import { legalService } from "@/modules/legal/legal.service";

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {
    user: { findUnique: vi.fn() },
  },
}));

vi.mock("@/infrastructure/email/email.service", () => ({
  sendEmail: vi.fn().mockResolvedValue(undefined),
  sendRequiredEmail: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/infrastructure/storage/supabase-storage", () => ({
  STORAGE_BUCKETS: { DOCUMENTS: "documents" },
  createSignedUrl: vi.fn(),
  downloadToBuffer: vi.fn(),
  parseTrustedStorageUrl: vi.fn(),
}));

vi.mock("@/lib/portal-url", () => ({
  PORTAL_URL: "https://manut.example",
}));

vi.mock("@/modules/legal/legal.repository", () => ({
  legalRepository: {
    findById: vi.fn(),
    findSignatureByToken: vi.fn(),
    findSignaturesByDocument: vi.fn(),
    createSignatures: vi.fn(),
    claimSignatureInvite: vi.fn(),
    activateSignatureInvite: vi.fn(),
    releaseSignatureInvite: vi.fn(),
    cancelSignatureBatch: vi.fn(),
    findLegalUploadByPath: vi.fn(),
    transitionSignature: vi.fn(),
    markDocumentSignedIfSignable: vi.fn(),
    update: vi.fn(),
    updateBeforeSigning: vi.fn(),
    removeBeforeSigning: vi.fn(),
  },
}));

const findById = legalRepository.findById as Mock;
const findSignatureByToken = legalRepository.findSignatureByToken as Mock;
const findSignaturesByDocument =
  legalRepository.findSignaturesByDocument as Mock;
const createSignatures = legalRepository.createSignatures as Mock;
const claimSignatureInvite = legalRepository.claimSignatureInvite as Mock;
const activateSignatureInvite = legalRepository.activateSignatureInvite as Mock;
const releaseSignatureInvite = legalRepository.releaseSignatureInvite as Mock;
const cancelSignatureBatch = legalRepository.cancelSignatureBatch as Mock;
const findLegalUploadByPath = legalRepository.findLegalUploadByPath as Mock;
const transitionSignature = legalRepository.transitionSignature as Mock;
const markDocumentSignedIfSignable =
  legalRepository.markDocumentSignedIfSignable as Mock;
const updateBeforeSigning = legalRepository.updateBeforeSigning as Mock;
const removeBeforeSigning = legalRepository.removeBeforeSigning as Mock;
const updateDocument = legalRepository.update as Mock;
const findActor = prisma.user.findUnique as Mock;
const sendInvite = sendRequiredEmail as Mock;
const parseTrustedStoredUrl = parseTrustedStorageUrl as Mock;
const createReadUrl = createSignedUrl as Mock;
const downloadStoredFile = downloadToBuffer as Mock;

const DOCUMENT_BYTES = Buffer.from("immutable legal document bytes");
const DOCUMENT_SHA256 = createHash("sha256")
  .update(DOCUMENT_BYTES)
  .digest("hex");

function signature(id: string, signerEmail: string, signingOrder: number) {
  const now = new Date("2026-07-17T00:00:00.000Z");
  return {
    id,
    documentId: "doc-1",
    batchId: "11111111-1111-4111-8111-111111111111",
    signerEmail,
    signerName: `Signer ${signingOrder}`,
    token: `token-${id}`,
    status: "sent",
    inviteMessage: null,
    sentAt: now,
    viewedAt: null,
    signedAt: null,
    declinedAt: null,
    declineReason: null,
    signatureText: null,
    signatureMethod: null,
    expiresAt: null,
    signedPdfUrl: null,
    documentSnapshotBucket: "documents",
    documentSnapshotPath: "legal/agreement.pdf",
    documentSnapshotUploadId: "77777777-7777-4777-8777-777777777777",
    documentSnapshotSha256: DOCUMENT_SHA256,
    documentSnapshotSize: DOCUMENT_BYTES.length,
    documentSnapshotMimeType: "application/pdf",
    documentSnapshotFileName: "agreement.pdf",
    documentSnapshotTitle: "Employment agreement",
    documentSnapshotKind: "contract",
    signingOrder,
    createdAt: now,
    updatedAt: now,
  };
}

beforeEach(() => {
  vi.resetAllMocks();
  findById.mockResolvedValue({
    id: "doc-1",
    title: "Employment agreement",
    kind: "contract",
    status: "draft",
    fileUrl:
      "https://storage.example/storage/v1/object/sign/documents/legal/agreement.pdf",
    fileName: "agreement.pdf",
  });
  findActor.mockResolvedValue({
    id: "actor-1",
    name: "Legal Owner",
    email: "legal@manut.example",
  });
  sendInvite.mockResolvedValue(undefined);
  claimSignatureInvite.mockResolvedValue(true);
  activateSignatureInvite.mockImplementation(
    async (id: string, sentAt: Date) => ({
      ...signature(id, `${id}@manut.example`, 1),
      sentAt,
    }),
  );
  releaseSignatureInvite.mockResolvedValue(true);
  cancelSignatureBatch.mockResolvedValue(1);
  removeBeforeSigning.mockResolvedValue(true);
  parseTrustedStoredUrl.mockReturnValue({
    bucket: STORAGE_BUCKETS.DOCUMENTS,
    path: "legal/agreement.pdf",
  });
  findLegalUploadByPath.mockResolvedValue({
    id: "upload-1",
    mimeType: "application/pdf",
    originalName: "agreement.pdf",
    size: DOCUMENT_BYTES.length,
  });
  downloadStoredFile.mockResolvedValue({
    buffer: DOCUMENT_BYTES,
    contentType: "application/pdf",
  });
});

describe("legalService signing-evidence immutability", () => {
  it("blocks replacing a document file after signing evidence exists", async () => {
    updateBeforeSigning.mockResolvedValue(null);

    await expect(
      legalService.update("doc-1", {
        fileUrl:
          "https://storage.example/storage/v1/object/sign/documents/legal/replacement.pdf",
      }),
    ).rejects.toThrow("document evidence is immutable");

    expect(legalRepository.update).not.toHaveBeenCalled();
  });

  it("blocks deleting a document after signing evidence exists", async () => {
    removeBeforeSigning.mockResolvedValue(false);

    await expect(legalService.remove("doc-1")).rejects.toThrow(
      "signing evidence cannot be deleted",
    );
  });

  it("does not replay stale explicit artifact values through the unrestricted update", async () => {
    updateDocument.mockRejectedValue(new Error("stop after capturing input"));

    await expect(
      legalService.update("doc-1", {
        title: "Employment agreement",
        kind: "contract",
        status: "draft",
        fileUrl:
          "https://storage.example/storage/v1/object/sign/documents/legal/agreement.pdf",
        fileName: "agreement.pdf",
      }),
    ).rejects.toThrow("stop after capturing input");

    expect(updateDocument).toHaveBeenCalledWith(
      "doc-1",
      expect.not.objectContaining({
        title: expect.anything(),
        kind: expect.anything(),
        status: expect.anything(),
        fileUrl: expect.anything(),
        fileName: expect.anything(),
      }),
    );
  });
});

describe("legalService.sendForSignature", () => {
  it("creates an in-house signing request without provider metadata", async () => {
    const pending = {
      ...signature("signature-1", "signer@manut.example", 1),
      status: "pending",
      sentAt: null,
    };
    createSignatures.mockResolvedValue([pending]);
    activateSignatureInvite.mockResolvedValue({
      ...pending,
      status: "sent",
      sentAt: new Date("2026-07-17T00:00:00.000Z"),
    });

    const result = await legalService.sendForSignature(
      "doc-1",
      {
        signerEmail: "Signer@Manut.Example",
        signerName: "Signer 1",
      },
      "actor-1",
    );

    expect(createSignatures).toHaveBeenCalledWith(
      "doc-1",
      expect.any(String),
      expect.objectContaining({
        bucket: "documents",
        path: "legal/agreement.pdf",
        uploadId: "upload-1",
        sha256: DOCUMENT_SHA256,
        size: DOCUMENT_BYTES.length,
        mimeType: "application/pdf",
        fileName: "agreement.pdf",
        title: "Employment agreement",
        kind: "contract",
      }),
      [
        expect.objectContaining({
          signerEmail: "signer@manut.example",
          signerName: "Signer 1",
          signingOrder: 1,
          status: "pending",
          sentAt: undefined,
        }),
      ],
    );
    expect(createSignatures.mock.calls[0]?.[3]?.[0]).not.toHaveProperty(
      "provider",
    );
    expect(createSignatures.mock.calls[0]?.[3]?.[0]).not.toHaveProperty(
      "documentId",
    );
    expect(createSignatures.mock.calls[0]?.[3]?.[0]).not.toHaveProperty(
      "batchId",
    );
    expect(downloadStoredFile).toHaveBeenCalledWith(
      "documents",
      "legal/agreement.pdf",
    );
    expect(result.data).not.toHaveProperty("provider");
    expect(result.data).not.toHaveProperty("docusignEnvelopeId");
    expect(result.data).toHaveProperty("signingOrder", 1);
    expect(sendInvite).toHaveBeenCalledOnce();
    expect(claimSignatureInvite).toHaveBeenCalledWith(
      "signature-1",
      expect.any(Date),
    );
    expect(activateSignatureInvite).toHaveBeenCalledWith(
      "signature-1",
      expect.any(Date),
    );
  });

  it("preserves sequential in-house signing and invites only the first order", async () => {
    createSignatures.mockResolvedValue([
      {
        ...signature("signature-1", "first@manut.example", 1),
        status: "pending",
        sentAt: null,
      },
      {
        ...signature("signature-2", "second@manut.example", 2),
        status: "pending",
        sentAt: null,
      },
    ]);

    const result = await legalService.sendForSignature(
      "doc-1",
      {
        signers: [
          {
            signerEmail: "first@manut.example",
            signerName: "Signer 1",
            signingOrder: 1,
          },
          {
            signerEmail: "second@manut.example",
            signerName: "Signer 2",
            signingOrder: 2,
          },
        ],
      },
      "actor-1",
    );

    expect(createSignatures).toHaveBeenCalledOnce();
    expect(createSignatures).toHaveBeenCalledWith(
      "doc-1",
      expect.any(String),
      expect.objectContaining({ sha256: DOCUMENT_SHA256 }),
      [
        expect.objectContaining({
          status: "pending",
          signingOrder: 1,
          sentAt: undefined,
        }),
        expect.objectContaining({
          status: "pending",
          signingOrder: 2,
          sentAt: undefined,
        }),
      ],
    );
    expect(sendInvite).toHaveBeenCalledOnce();
    expect(sendInvite).toHaveBeenCalledWith(
      expect.objectContaining({ to: "first@manut.example" }),
    );
    expect(createSignatures.mock.calls[0]?.[1]).toEqual(expect.any(String));
    expect(result.data).toHaveLength(2);
  });

  it("keeps an invite pending when required email delivery fails", async () => {
    const pending = {
      ...signature("signature-1", "signer@manut.example", 1),
      status: "pending",
      sentAt: null,
    };
    createSignatures.mockResolvedValue([pending]);
    sendInvite.mockRejectedValue(new Error("email provider unavailable"));

    await expect(
      legalService.sendForSignature(
        "doc-1",
        {
          signerEmail: "signer@manut.example",
          signerName: "Signer 1",
        },
        "actor-1",
      ),
    ).rejects.toThrow("email provider unavailable");

    expect(activateSignatureInvite).not.toHaveBeenCalled();
    expect(releaseSignatureInvite).toHaveBeenCalledWith(
      "signature-1",
      expect.any(Date),
    );
    expect(cancelSignatureBatch).toHaveBeenCalledWith(
      "doc-1",
      expect.any(String),
    );
  });

  it("rejects an unregistered document before creating an invitation", async () => {
    findLegalUploadByPath.mockResolvedValue(null);

    await expect(
      legalService.sendForSignature(
        "doc-1",
        {
          signerEmail: "signer@manut.example",
          signerName: "Signer 1",
        },
        "actor-1",
      ),
    ).rejects.toThrow(
      "Document file is not registered as a legal document upload",
    );

    expect(createSignatures).not.toHaveBeenCalled();
    expect(sendInvite).not.toHaveBeenCalled();
  });

  it("rejects a new signing workflow for an already signed document", async () => {
    findById.mockResolvedValue({
      id: "doc-1",
      title: "Employment agreement",
      kind: "contract",
      status: "signed",
    });

    await expect(
      legalService.sendForSignature(
        "doc-1",
        {
          signerEmail: "signer@manut.example",
          signerName: "Signer 1",
        },
        "actor-1",
      ),
    ).rejects.toThrow("Only draft or active documents can be sent");

    expect(createSignatures).not.toHaveBeenCalled();
  });
});

describe("legalService.getByToken", () => {
  it("serves the verified immutable artifact instead of mutable document fields", async () => {
    findSignatureByToken.mockResolvedValue({
      ...signature("signature-1", "signer@manut.example", 1),
      document: {
        id: "doc-1",
        title: "Replaced title",
        kind: "other",
        fileUrl: "https://storage.example/replaced-file.pdf",
        fileName: "replaced-file.pdf",
        status: "draft",
      },
    });
    createReadUrl.mockResolvedValue("https://storage.example/fresh-signed-url");

    const result = await legalService.getByToken("in-house-token");

    expect(createReadUrl).toHaveBeenCalledWith(
      "documents",
      "legal/agreement.pdf",
      300,
    );
    expect(downloadStoredFile).toHaveBeenCalledWith(
      "documents",
      "legal/agreement.pdf",
    );
    expect(result.data.document.fileUrl).toBe(
      "https://storage.example/fresh-signed-url",
    );
    expect(result.data.document.title).toBe("Employment agreement");
    expect(result.data.document.kind).toBe("contract");
    expect(result.data.document.fileName).toBe("agreement.pdf");
  });

  it("does not refresh document access for an expired signing token", async () => {
    findSignatureByToken.mockResolvedValue({
      ...signature("signature-1", "signer@manut.example", 1),
      expiresAt: new Date(0),
      document: {
        id: "doc-1",
        title: "Employment agreement",
        kind: "contract",
        fileUrl: "https://storage.example/replaced-file.pdf",
        fileName: "agreement.pdf",
        status: "draft",
      },
    });

    await expect(legalService.getByToken("expired-token")).rejects.toThrow(
      "This signing link has expired",
    );
    expect(downloadStoredFile).not.toHaveBeenCalled();
    expect(createReadUrl).not.toHaveBeenCalled();
  });

  it("rejects a signing artifact whose bytes no longer match its hash", async () => {
    findSignatureByToken.mockResolvedValue({
      ...signature("signature-1", "signer@manut.example", 1),
      document: {
        id: "doc-1",
        title: "Mutable title",
        kind: "other",
        fileUrl: "https://storage.example/replaced-file.pdf",
        fileName: "replaced-file.pdf",
        status: "draft",
      },
    });
    downloadStoredFile.mockResolvedValue({
      buffer: Buffer.from("tampered bytes"),
      contentType: "application/pdf",
    });

    await expect(legalService.getByToken("in-house-token")).rejects.toThrow(
      "failed integrity verification",
    );
    expect(createReadUrl).not.toHaveBeenCalled();
  });

  it("rejects a snapshot outside the private documents bucket", async () => {
    findSignatureByToken.mockResolvedValue({
      ...signature("signature-1", "signer@manut.example", 1),
      documentSnapshotBucket: "receipts",
      document: {
        id: "doc-1",
        title: "Employment agreement",
        kind: "contract",
        fileUrl: "https://storage.example/replaced-file.pdf",
        fileName: "payslip.pdf",
        status: "draft",
      },
    });

    await expect(legalService.getByToken("in-house-token")).rejects.toThrow(
      "no valid immutable document snapshot",
    );
    expect(downloadStoredFile).not.toHaveBeenCalled();
    expect(createReadUrl).not.toHaveBeenCalled();
  });

  it("redacts private document access after cancellation", async () => {
    findSignatureByToken.mockResolvedValue({
      ...signature("signature-1", "signer@manut.example", 1),
      status: "cancelled",
      document: {
        id: "doc-1",
        title: "Employment agreement",
        kind: "contract",
        fileUrl:
          "https://storage.example/storage/v1/object/sign/documents/actor/agreement.pdf?token=old",
        fileName: "agreement.pdf",
        status: "draft",
      },
    });

    const result = await legalService.getByToken("cancelled-token");

    expect(result.data.document.fileUrl).toBeNull();
    expect(result.data.document.title).toBe("Employment agreement");
    expect(downloadStoredFile).not.toHaveBeenCalled();
    expect(createReadUrl).not.toHaveBeenCalled();
  });
});

describe("legalService.submitSignature", () => {
  it("rejects a direct signing POST when the retained artifact was tampered", async () => {
    const active = signature("signature-1", "signer@manut.example", 1);
    findSignatureByToken.mockResolvedValue(active);
    downloadStoredFile.mockResolvedValue({
      buffer: Buffer.from("tampered bytes"),
      contentType: "application/pdf",
    });

    await expect(
      legalService.submitSignature(
        "active-token",
        { signatureText: "Signer 1", agreed: true },
        "127.0.0.1",
        "test-agent",
      ),
    ).rejects.toThrow("failed integrity verification");

    expect(transitionSignature).not.toHaveBeenCalled();
  });

  it("does not invite the next order while a parallel signer is still pending", async () => {
    const first = signature("signature-1", "first@manut.example", 1);
    const parallel = signature("signature-2", "parallel@manut.example", 1);
    const next = signature("signature-3", "next@manut.example", 2);
    findSignatureByToken.mockResolvedValue({ ...first, status: "viewed" });
    transitionSignature.mockResolvedValue({ ...first, status: "signed" });
    findSignaturesByDocument.mockResolvedValue([
      { ...first, status: "signed" },
      parallel,
      next,
    ]);

    await legalService.submitSignature(
      "token-signature-1",
      { signatureText: "Signer 1", agreed: true },
      "127.0.0.1",
      "test-agent",
    );
    await vi.waitFor(() =>
      expect(findSignaturesByDocument).toHaveBeenCalledTimes(2),
    );

    expect(sendInvite).not.toHaveBeenCalled();
  });

  it("invites the next order once when the final parallel signer completes", async () => {
    const first = signature("signature-1", "first@manut.example", 1);
    const parallel = signature("signature-2", "parallel@manut.example", 1);
    const next = signature("signature-3", "next@manut.example", 2);
    findSignatureByToken.mockResolvedValue({ ...parallel, status: "viewed" });
    transitionSignature.mockResolvedValue({ ...parallel, status: "signed" });
    findSignaturesByDocument.mockResolvedValue([
      { ...first, status: "signed" },
      { ...parallel, status: "signed" },
      next,
    ]);

    await legalService.submitSignature(
      "token-signature-2",
      { signatureText: "Signer 2", agreed: true },
      "127.0.0.1",
      "test-agent",
    );

    await vi.waitFor(() =>
      expect(activateSignatureInvite).toHaveBeenCalledOnce(),
    );
    expect(claimSignatureInvite).toHaveBeenCalledWith(
      "signature-3",
      expect.any(Date),
    );
    expect(activateSignatureInvite).toHaveBeenCalledWith(
      "signature-3",
      expect.any(Date),
    );
    expect(sendInvite).toHaveBeenCalledWith(
      expect.objectContaining({ to: "next@manut.example" }),
    );
    expect(findSignaturesByDocument).toHaveBeenCalledWith(
      "doc-1",
      parallel.batchId,
    );
  });

  it("does not duplicate the next invite when another request claimed it", async () => {
    const first = signature("signature-1", "first@manut.example", 1);
    const next = {
      ...signature("signature-2", "next@manut.example", 2),
      status: "pending",
      sentAt: null,
    };
    findSignatureByToken.mockResolvedValue({ ...first, status: "viewed" });
    transitionSignature.mockResolvedValue({ ...first, status: "signed" });
    findSignaturesByDocument.mockResolvedValue([
      { ...first, status: "signed" },
      next,
    ]);
    claimSignatureInvite.mockResolvedValue(false);

    await legalService.submitSignature(
      "token-signature-1",
      { signatureText: "Signer 1", agreed: true },
      "127.0.0.1",
      "test-agent",
    );
    await vi.waitFor(() =>
      expect(claimSignatureInvite).toHaveBeenCalledWith(
        "signature-2",
        expect.any(Date),
      ),
    );

    expect(sendInvite).not.toHaveBeenCalled();
  });

  it("rejects a later signing order that has not been invited", async () => {
    findSignatureByToken.mockResolvedValue({
      ...signature("signature-2", "next@manut.example", 2),
      status: "pending",
      sentAt: null,
    });

    await expect(
      legalService.submitSignature(
        "pending-token",
        { signatureText: "Signer 2", agreed: true },
        "127.0.0.1",
        "test-agent",
      ),
    ).rejects.toThrow("This signing request is not active yet");
    expect(transitionSignature).not.toHaveBeenCalled();
  });

  it("does not mark the document signed when a required signer declined", async () => {
    const signed = signature("signature-1", "signed@manut.example", 1);
    const declined = {
      ...signature("signature-2", "declined@manut.example", 1),
      status: "declined",
    };
    findSignatureByToken.mockResolvedValue({ ...signed, status: "viewed" });
    transitionSignature.mockResolvedValue({ ...signed, status: "signed" });
    findSignaturesByDocument.mockResolvedValue([
      { ...signed, status: "signed" },
      declined,
    ]);

    await legalService.submitSignature(
      "token-signature-1",
      { signatureText: "Signer 1", agreed: true },
      "127.0.0.1",
      "test-agent",
    );
    await vi.waitFor(() =>
      expect(findSignaturesByDocument).toHaveBeenCalledTimes(2),
    );

    expect(markDocumentSignedIfSignable).not.toHaveBeenCalled();
  });

  it("marks the document signed when every required signer completed", async () => {
    const active = signature("signature-1", "signer@manut.example", 1);
    findSignatureByToken.mockResolvedValue({ ...active, status: "viewed" });
    transitionSignature.mockResolvedValue({ ...active, status: "signed" });
    findSignaturesByDocument.mockResolvedValue([
      { ...active, status: "signed" },
    ]);
    markDocumentSignedIfSignable.mockResolvedValue(true);

    const result = await legalService.submitSignature(
      "token-signature-1",
      { signatureText: "Signer 1", agreed: true },
      "127.0.0.1",
      "test-agent",
    );

    expect(markDocumentSignedIfSignable).toHaveBeenCalledWith(
      "doc-1",
      active.batchId,
    );
    expect(result.data).not.toHaveProperty("signatureText");
    expect(result.data).not.toHaveProperty("signedPdfUrl");
    expect(result.data).not.toHaveProperty("sentAt");
  });

  it("fails when cancellation wins the signature transition race", async () => {
    const active = signature("signature-1", "signer@manut.example", 1);
    findSignatureByToken.mockResolvedValue(active);
    transitionSignature.mockResolvedValue(null);

    await expect(
      legalService.submitSignature(
        "racing-token",
        { signatureText: "Signer 1", agreed: true },
        "127.0.0.1",
        "test-agent",
      ),
    ).rejects.toThrow("This signing request is no longer active");
    expect(findSignaturesByDocument).not.toHaveBeenCalled();
  });
});

describe("legalService.declineSignature", () => {
  it("returns only the public signature contract", async () => {
    const active = signature("signature-1", "signer@manut.example", 1);
    findSignatureByToken.mockResolvedValue(active);
    transitionSignature.mockResolvedValue({
      ...active,
      status: "declined",
      declinedAt: new Date("2026-07-17T00:00:00.000Z"),
      declineReason: "Terms changed",
    });

    const result = await legalService.declineSignature(
      "active-token",
      { reason: "Terms changed" },
      "127.0.0.1",
      "test-agent",
    );

    expect(result.data.status).toBe("declined");
    expect(result.data).not.toHaveProperty("signatureText");
    expect(result.data).not.toHaveProperty("signedPdfUrl");
    expect(result.data).not.toHaveProperty("sentAt");
  });

  it("does not mutate an expired signing request", async () => {
    findSignatureByToken.mockResolvedValue({
      ...signature("signature-1", "signer@manut.example", 1),
      expiresAt: new Date(0),
    });

    await expect(
      legalService.declineSignature(
        "expired-token",
        { reason: "No longer applicable" },
        "127.0.0.1",
        "test-agent",
      ),
    ).rejects.toThrow("This signing link has expired");
    expect(transitionSignature).not.toHaveBeenCalled();
  });
});
