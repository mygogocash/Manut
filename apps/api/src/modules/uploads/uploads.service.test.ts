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
  uploadsRepository: {
    findById: vi.fn(),
    findAll: vi.fn(),
    create: vi.fn(),
    remove: vi.fn(),
    linkToMessage: vi.fn(),
  },
}));

describe("uploadsService — ownership enforcement (#517)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
  });

  describe("remove", () => {
    it("deletes when the caller owns the upload", async () => {
      (uploadsRepository.findById as Mock).mockResolvedValue({
        id: "u1",
        bucket: "uploads",
        path: "user-a/file.png",
        uploadedBy: "user-a",
      });

      await expect(
        uploadsService.remove("u1", "user-a"),
      ).resolves.toBeUndefined();
      expect(uploadsRepository.remove).toHaveBeenCalledWith("u1");
    });

    it("throws ForbiddenException when the caller is not the uploader", async () => {
      (uploadsRepository.findById as Mock).mockResolvedValue({
        id: "u1",
        bucket: "uploads",
        path: "user-a/file.png",
        uploadedBy: "user-a",
      });

      await expect(
        uploadsService.remove("u1", "user-b"),
      ).rejects.toBeInstanceOf(ForbiddenException);
      // No deletion side-effect when the auth check fails.
      expect(uploadsRepository.remove).not.toHaveBeenCalled();
    });

    it("throws NotFoundException when the upload does not exist", async () => {
      (uploadsRepository.findById as Mock).mockResolvedValue(null);

      await expect(
        uploadsService.remove("missing", "user-a"),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
