import { describe, expect, it, vi } from "vitest";

import type { ApiClient } from "../src/api/api-client";
import {
  createUpload,
  deleteUpload,
  getUploadSignedUrl,
  listUploads,
  uploadSchema,
} from "../src/uploads/uploads";

const upload = {
  id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  filename: "report.pdf",
  originalName: "Report.pdf",
  mimeType: "application/pdf",
  size: 12345,
  path: "user-id/report.pdf",
  bucket: "uploads",
  uploadedBy: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  purpose: null,
  linkedTo: null,
  linkedId: null,
  createdAt: "2026-07-01T00:00:00.000Z",
};

describe("uploads foundation contracts", () => {
  it("keeps display fields and strips storage path", () => {
    const parsed = uploadSchema.parse(upload);
    expect(parsed).toEqual({
      id: upload.id,
      originalName: "Report.pdf",
      mimeType: "application/pdf",
      size: 12345,
      purpose: null,
      createdAt: "2026-07-01T00:00:00.000Z",
      bucket: "uploads",
    });
    expect(parsed).not.toHaveProperty("path");
    expect(parsed).not.toHaveProperty("filename");
    expect(parsed).not.toHaveProperty("uploadedBy");
  });

  it("lists uploads with pagination", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({
      data: [upload],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    const client = { get } as unknown as ApiClient;

    await expect(listUploads(client, { page: 1, limit: 20 }, signal)).resolves.toEqual({
      data: [expect.objectContaining({ originalName: "Report.pdf" })],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
    expect(get).toHaveBeenCalledWith("/uploads?page=1&limit=20", { signal });
  });

  it("fetches a signed download URL", async () => {
    const signal = { aborted: false };
    const get = vi.fn().mockResolvedValue({
      data: { url: "https://signed.example/report.pdf" },
    });
    const client = { get } as unknown as ApiClient;

    await expect(
      getUploadSignedUrl(client, upload.id, signal),
    ).resolves.toEqual({ url: "https://signed.example/report.pdf" });
    expect(get).toHaveBeenCalledWith(`/uploads/${upload.id}/signed-url`, {
      signal,
    });
  });

  it("creates an upload via base64 and strips storage path", async () => {
    const post = vi.fn().mockResolvedValue({
      data: {
        ...upload,
        url: "https://signed.example/report.pdf",
      },
    });
    const client = { post } as unknown as ApiClient;

    const created = await createUpload(client, {
      base64: "JVBERi0=",
      originalName: "Report.pdf",
      mimeType: "application/pdf",
    });
    expect(created).toEqual({
      id: upload.id,
      originalName: "Report.pdf",
      mimeType: "application/pdf",
      size: 12345,
      purpose: null,
      createdAt: "2026-07-01T00:00:00.000Z",
      bucket: "uploads",
    });
    expect(created).not.toHaveProperty("path");
    expect(created).not.toHaveProperty("uploadedBy");
    expect(created).not.toHaveProperty("url");
    expect(post).toHaveBeenCalledWith("/uploads", {
      base64: "JVBERi0=",
      originalName: "Report.pdf",
      mimeType: "application/pdf",
    });
  });

  it("deletes an owned upload by id", async () => {
    const del = vi.fn().mockResolvedValue({ message: "File deleted" });
    const client = { delete: del } as unknown as ApiClient;

    await expect(deleteUpload(client, upload.id)).resolves.toEqual({
      message: "File deleted",
    });
    expect(del).toHaveBeenCalledWith(`/uploads/${upload.id}`);
  });
});
