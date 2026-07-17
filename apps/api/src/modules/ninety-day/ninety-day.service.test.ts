import { beforeEach, describe, expect, it, vi } from "vitest";

import { NinetyDayService } from "@/modules/ninety-day/ninety-day.service";

const mocks = vi.hoisted(() => ({
  createSignedUrl: vi.fn(),
  findById: vi.fn(),
  parseStorageUrl: vi.fn(),
  requireRegisteredStorageUrl: vi.fn(),
}));

vi.mock("@/modules/ninety-day/ninety-day.repository", () => ({
  ninetyDayRepository: { findById: mocks.findById },
}));

vi.mock("@/infrastructure/database/prisma", () => ({ prisma: {} }));
vi.mock("@/infrastructure/email/email.service", () => ({ sendEmail: vi.fn() }));
vi.mock("@/infrastructure/storage/supabase-storage", () => ({
  STORAGE_BUCKETS: { DOCUMENTS: "documents" },
  createSignedUrl: mocks.createSignedUrl,
  parseStorageUrl: mocks.parseStorageUrl,
  requireRegisteredStorageUrl: mocks.requireRegisteredStorageUrl,
}));

describe("NinetyDayService receipt storage provenance", () => {
  const service = new NinetyDayService();
  const receiptUrl =
    "https://manut.supabase.co/storage/v1/object/public/documents/ninety-day/receipt.pdf";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("revalidates ninety-day-receipt purpose before proxy-signing", async () => {
    mocks.findById.mockResolvedValue({
      receiptUrl,
      receiptName: "receipt.pdf",
    });
    mocks.parseStorageUrl.mockReturnValue({
      bucket: "documents",
      path: "ninety-day/receipt.pdf",
    });
    mocks.requireRegisteredStorageUrl.mockResolvedValue({
      bucket: "documents",
      path: "ninety-day/receipt.pdf",
      uploadId: "upload-1",
    });
    mocks.createSignedUrl.mockResolvedValue("https://signed.example/receipt");

    await expect(service.getReceiptDownloadUrl("record-1")).resolves.toEqual({
      url: "https://signed.example/receipt",
      name: "receipt.pdf",
    });

    expect(mocks.requireRegisteredStorageUrl).toHaveBeenCalledWith(receiptUrl, {
      allowedBuckets: ["documents"],
      purpose: "ninety-day-receipt",
    });
  });

  it("leaves a genuinely external receipt URL unsigned", async () => {
    mocks.findById.mockResolvedValue({
      receiptUrl: "https://records.example/receipt.pdf",
      receiptName: "receipt.pdf",
    });
    mocks.parseStorageUrl.mockReturnValue(null);

    await expect(service.getReceiptDownloadUrl("record-1")).resolves.toEqual({
      url: "https://records.example/receipt.pdf",
      name: "receipt.pdf",
    });
    expect(mocks.requireRegisteredStorageUrl).not.toHaveBeenCalled();
    expect(mocks.createSignedUrl).not.toHaveBeenCalled();
  });
});
