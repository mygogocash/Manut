import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import {
  ForbiddenException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { uploadsRepository } from "@/modules/uploads/uploads.repository";
import { uploadsService } from "@/modules/uploads/uploads.service";

// Storage adapter is mocked so the service tests don't touch the
// network. We only care about the ownership branches here — the
// happy-path signed-URL minting is exercised indirectly via the
// existing integration suite.
vi.mock("@/infrastructure/storage/supabase-storage", () => ({
  createSignedUrl: vi
    .fn()
    .mockResolvedValue("https://signed.example/object?token=abc"),
  deleteFile: vi.fn().mockResolvedValue(undefined),
  // The remaining exports are only used by other service methods that
  // these tests don't exercise; stub as no-ops to keep the mock total.
  resolveDisplayUrl: vi.fn().mockResolvedValue("https://example/"),
  uploadBase64: vi.fn(),
  type: undefined,
}));

vi.mock("@/modules/uploads/uploads.repository", () => ({
  isModuleControlledUploadPurpose: (purpose: string | null | undefined) =>
    ["payslip-document", "cash-advance-disbursement-proof"].includes(
      purpose ?? "",
    ),
  uploadsRepository: {
    findById: vi.fn(),
    findAll: vi.fn(),
    create: vi.fn(),
    removeOwnedIfUnreferenced: vi.fn(),
    linkToMessage: vi.fn(),
  },
}));

describe("uploadsService — ownership enforcement (#517)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (uploadsRepository.removeOwnedIfUnreferenced as Mock).mockResolvedValue({
      status: "deleted",
      bucket: "uploads",
      path: "user-a/file.png",
    });
  });

  describe("getSignedUrl", () => {
    it("returns the signed URL when the caller owns the upload", async () => {
      (uploadsRepository.findById as Mock).mockResolvedValue({
        id: "u1",
        bucket: "uploads",
        path: "user-a/file.png",
        uploadedBy: "user-a",
      });

      const result = await uploadsService.getSignedUrl("u1", "user-a");

      expect(result.url).toMatch(/^https:/);
    });

    it("throws ForbiddenException when the caller is not the uploader", async () => {
      (uploadsRepository.findById as Mock).mockResolvedValue({
        id: "u1",
        bucket: "uploads",
        path: "user-a/file.png",
        uploadedBy: "user-a",
      });

      await expect(
        uploadsService.getSignedUrl("u1", "user-b"),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("throws NotFoundException when the upload does not exist", async () => {
      (uploadsRepository.findById as Mock).mockResolvedValue(null);

      await expect(
        uploadsService.getSignedUrl("missing", "user-a"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it.each(["payslip-document", "cash-advance-disbursement-proof"])(
      "refuses generic signing for module-controlled purpose %s",
      async (purpose) => {
        (uploadsRepository.findById as Mock).mockResolvedValue({
          id: "u1",
          bucket: "documents",
          path: "user-a/private.pdf",
          uploadedBy: "user-a",
          purpose,
        });

        await expect(
          uploadsService.getSignedUrl("u1", "user-a"),
        ).rejects.toBeInstanceOf(ForbiddenException);
      },
    );
  });

  describe("remove", () => {
    it("deletes when the caller owns the upload", async () => {
      await expect(
        uploadsService.remove("u1", "user-a"),
      ).resolves.toBeUndefined();
      expect(uploadsRepository.removeOwnedIfUnreferenced).toHaveBeenCalledWith(
        "u1",
        "user-a",
      );
    });

    it("throws ForbiddenException when the caller is not the uploader", async () => {
      (uploadsRepository.removeOwnedIfUnreferenced as Mock).mockResolvedValue({
        status: "forbidden",
      });

      await expect(
        uploadsService.remove("u1", "user-b"),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it("throws NotFoundException when the upload does not exist", async () => {
      (uploadsRepository.removeOwnedIfUnreferenced as Mock).mockResolvedValue({
        status: "missing",
      });

      await expect(
        uploadsService.remove("missing", "user-a"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it("retains an upload controlled by an application record", async () => {
      (uploadsRepository.removeOwnedIfUnreferenced as Mock).mockResolvedValue({
        status: "protected",
      });

      await expect(uploadsService.remove("u1", "user-a")).rejects.toThrow(
        "retained by an application record",
      );
    });
  });
});
