import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  ConflictException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { visaService } from "@/modules/visa/visa.service";

const repositoryMock = vi.hoisted(() => ({
  findById: vi.fn(),
  findByIdIncludingDeleted: vi.fn(),
  permanentDelete: vi.fn(),
}));

const storageMock = vi.hoisted(() => ({
  createSignedUrl: vi.fn(),
  parseStorageUrl: vi.fn(),
  requireRegisteredStorageUrl: vi.fn(),
}));

vi.mock("@/modules/visa/visa.repository", () => ({
  visaRepository: repositoryMock,
}));

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: {},
}));

vi.mock("@/infrastructure/email/email.service", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("@/infrastructure/storage/supabase-storage", () => ({
  STORAGE_BUCKETS: { DOCUMENTS: "documents" },
  createSignedUrl: storageMock.createSignedUrl,
  downloadToBuffer: vi.fn(),
  parseStorageUrl: storageMock.parseStorageUrl,
  requireRegisteredStorageUrl: storageMock.requireRegisteredStorageUrl,
}));

vi.mock("@/lib/events", () => ({
  actorFromId: vi.fn(),
  trackVisaRequestSubmittedServer: vi.fn(),
}));

vi.mock("@/modules/visa-checklist/visa-checklist.service", () => ({
  visaChecklistService: {},
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("visaService.permanentDelete", () => {
  it("purges a soft-deleted visa record", async () => {
    const deletedRecord = { id: "visa-1", deletedAt: new Date() };
    repositoryMock.findByIdIncludingDeleted.mockResolvedValue(deletedRecord);
    repositoryMock.permanentDelete.mockResolvedValue(deletedRecord);

    await expect(visaService.permanentDelete("visa-1")).resolves.toBe(
      deletedRecord,
    );
    expect(repositoryMock.permanentDelete).toHaveBeenCalledWith("visa-1");
  });

  it("rejects an active visa record with conflict", async () => {
    repositoryMock.findByIdIncludingDeleted.mockResolvedValue({
      id: "visa-1",
      deletedAt: null,
    });

    await expect(visaService.permanentDelete("visa-1")).rejects.toThrow(
      ConflictException,
    );
    expect(repositoryMock.permanentDelete).not.toHaveBeenCalled();
  });

  it("returns not found when the visa record does not exist", async () => {
    repositoryMock.findByIdIncludingDeleted.mockResolvedValue(null);

    await expect(visaService.permanentDelete("missing")).rejects.toThrow(
      NotFoundException,
    );
    expect(repositoryMock.permanentDelete).not.toHaveBeenCalled();
  });
});

describe("visaService document storage provenance", () => {
  it("requires a registered visa-document before proxy-signing a stored URL", async () => {
    const fileUrl =
      "https://manut.supabase.co/storage/v1/object/public/documents/visa/passport.pdf";
    repositoryMock.findById.mockResolvedValue({
      id: "visa-1",
      employeeId: "employee-1",
      documentUrl: fileUrl,
      documents: [],
    });
    storageMock.parseStorageUrl.mockReturnValue({
      bucket: "documents",
      path: "visa/passport.pdf",
    });
    storageMock.requireRegisteredStorageUrl.mockResolvedValue({
      bucket: "documents",
      path: "visa/passport.pdf",
      uploadId: "upload-1",
    });
    storageMock.createSignedUrl.mockResolvedValue(
      "https://signed.example/visa",
    );

    await expect(
      visaService.getDocumentDownloadUrl("visa-1", "employee-1", []),
    ).resolves.toEqual({
      url: "https://signed.example/visa",
      name: "document",
    });

    expect(storageMock.requireRegisteredStorageUrl).toHaveBeenCalledWith(
      fileUrl,
      {
        allowedBuckets: ["documents"],
        purpose: "visa-document",
      },
    );
  });
});
