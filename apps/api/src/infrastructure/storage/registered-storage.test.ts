import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findFirst: vi.fn() }));

vi.mock("@/infrastructure/database/prisma", () => ({
  prisma: { fileUpload: { findFirst: mocks.findFirst } },
}));

vi.mock("@/infrastructure/supabase/admin", () => ({
  isSupabaseConfigured: true,
  supabaseAdmin: { storage: {} },
}));

describe("requireRegisteredStorageUrl", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubEnv("SUPABASE_URL", "https://manut.supabase.co");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns only an upload matching origin, bucket, purpose, owner, and link", async () => {
    mocks.findFirst.mockResolvedValue({ id: "upload-1" });
    const { requireRegisteredStorageUrl, STORAGE_BUCKETS } =
      await import("@/infrastructure/storage/supabase-storage");
    const url =
      "https://manut.supabase.co/storage/v1/object/public/documents/tasks/file.pdf";

    await expect(
      requireRegisteredStorageUrl(url, {
        allowedBuckets: [STORAGE_BUCKETS.DOCUMENTS],
        purpose: "project_resource",
        uploadedBy: "user-1",
        linkedTo: "task",
        linkedId: "task-1",
      }),
    ).resolves.toEqual({
      bucket: "documents",
      path: "tasks/file.pdf",
      uploadId: "upload-1",
    });

    expect(mocks.findFirst).toHaveBeenCalledWith({
      where: {
        bucket: "documents",
        path: "tasks/file.pdf",
        purpose: "project_resource",
        uploadedBy: "user-1",
        linkedTo: "task",
        linkedId: "task-1",
      },
      select: { id: true },
    });
  });

  it("rejects an attacker origin before querying upload metadata", async () => {
    const { requireRegisteredStorageUrl, STORAGE_BUCKETS } =
      await import("@/infrastructure/storage/supabase-storage");

    await expect(
      requireRegisteredStorageUrl(
        "https://attacker.example/storage/v1/object/public/documents/legal/evidence.pdf",
        {
          allowedBuckets: [STORAGE_BUCKETS.DOCUMENTS],
          purpose: "company-policy",
        },
      ),
    ).rejects.toThrow("expected trusted storage bucket");
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("rejects a trusted path registered to another module", async () => {
    mocks.findFirst.mockResolvedValue(null);
    const { requireRegisteredStorageUrl, STORAGE_BUCKETS } =
      await import("@/infrastructure/storage/supabase-storage");

    await expect(
      requireRegisteredStorageUrl(
        "https://manut.supabase.co/storage/v1/object/public/documents/legal/evidence.pdf",
        {
          allowedBuckets: [STORAGE_BUCKETS.DOCUMENTS],
          purpose: "company-policy",
        },
      ),
    ).rejects.toThrow("not registered for this application record");
  });
});
