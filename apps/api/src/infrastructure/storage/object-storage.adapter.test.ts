import { beforeEach, describe, expect, it, vi } from "vitest";

import { createLegacyObjectStorageAdapter } from "./object-storage.adapter";

describe("LegacyObjectStorageAdapter > adapter wiring", () => {
  const upload = vi.fn();
  const getSignedUrl = vi.fn();
  const remove = vi.fn();
  const findById = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createUpload delegates to uploadsService.upload and returns a ready object id", async () => {
    upload.mockResolvedValue({
      id: "file-1",
      path: "uploads/user/a.png",
      bucket: "uploads",
      mimeType: "image/png",
      size: 12,
      originalName: "a.png",
    });

    const port = createLegacyObjectStorageAdapter({
      uploads: { upload, getSignedUrl, remove },
      repository: { findById },
    });

    const pending = await port.createUpload({
      actor: { id: "user-1" },
      originalName: "a.png",
      mimeType: "image/png",
      size: 12,
      base64: Buffer.from("hello").toString("base64"),
      bucket: "uploads",
      purpose: "avatar",
    });

    expect(upload).toHaveBeenCalledWith("user-1", {
      base64: Buffer.from("hello").toString("base64"),
      originalName: "a.png",
      mimeType: "image/png",
      bucket: "uploads",
      purpose: "avatar",
      linkedTo: undefined,
      linkedId: undefined,
    });
    expect(pending).toEqual({ objectId: "file-1", status: "ready" });
  });

  it("finalizeUpload reads the stored file_uploads row for the actor", async () => {
    findById.mockResolvedValue({
      id: "file-1",
      uploadedBy: "user-1",
      bucket: "uploads",
      path: "uploads/user/a.png",
      mimeType: "image/png",
      size: 12,
      originalName: "a.png",
    });

    const port = createLegacyObjectStorageAdapter({
      uploads: { upload, getSignedUrl, remove },
      repository: { findById },
    });

    await expect(
      port.finalizeUpload({ objectId: "file-1", actor: { id: "user-1" } }),
    ).resolves.toEqual({
      objectId: "file-1",
      bucket: "uploads",
      path: "uploads/user/a.png",
      mimeType: "image/png",
      size: 12,
      originalName: "a.png",
    });
  });

  it("createDownloadUrl and deleteObject delegate to uploadsService", async () => {
    getSignedUrl.mockResolvedValue({ url: "https://signed.example/a" });
    remove.mockResolvedValue(undefined);

    const port = createLegacyObjectStorageAdapter({
      uploads: { upload, getSignedUrl, remove },
      repository: { findById },
    });

    await expect(
      port.createDownloadUrl("file-1", { id: "user-1" }),
    ).resolves.toBe("https://signed.example/a");
    expect(getSignedUrl).toHaveBeenCalledWith("file-1", "user-1");

    await port.deleteObject("file-1", { id: "user-1" });
    expect(remove).toHaveBeenCalledWith("file-1", "user-1");
  });
});
