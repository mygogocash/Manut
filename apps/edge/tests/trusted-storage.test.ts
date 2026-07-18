import { describe, expect, it, vi } from "vitest";

import {
  looksManagedStorageUrl,
  parseManagedStorageUrl,
  parseTrustedStorageUrl,
  requireRegisteredStorageUrl,
  resolveTrustedStorageOrigins,
  STORAGE_BUCKETS,
  TrustedStorageError,
  validateReceiptUrl,
} from "../src/trusted-storage";

const TRUSTED = "https://files.manut.example";
const MANAGED_PUBLIC = `${TRUSTED}/storage/v1/object/public/receipts/user-1/r1.pdf`;
const MANAGED_SIGNED = `${TRUSTED}/storage/v1/object/sign/receipts/user-1/r1.pdf?token=abc`;
const R2_STYLE = `${TRUSTED}/receipts/user-1/r1.pdf`;
const EXTERNAL = "https://drive.example/file/abc";

describe("trusted storage URL helper", () => {
  it("resolves comma-separated TRUSTED_STORAGE_ORIGINS and fails closed when empty", () => {
    expect(resolveTrustedStorageOrigins({})).toEqual([]);
    expect(
      resolveTrustedStorageOrigins({ TRUSTED_STORAGE_ORIGINS: "  " }),
    ).toEqual([]);
    expect(
      resolveTrustedStorageOrigins({
        TRUSTED_STORAGE_ORIGINS: `${TRUSTED}, https://backup.example/ `,
      }),
    ).toEqual([TRUSTED, "https://backup.example"]);
  });

  it("parses Supabase-shaped public and signed object URLs", () => {
    expect(parseManagedStorageUrl(MANAGED_PUBLIC)).toEqual({
      bucket: "receipts",
      path: "user-1/r1.pdf",
    });
    expect(parseManagedStorageUrl(MANAGED_SIGNED)).toEqual({
      bucket: "receipts",
      path: "user-1/r1.pdf",
    });
    expect(parseManagedStorageUrl(EXTERNAL)).toBeNull();
  });

  it("parses allowlisted-origin R2-style /{bucket}/{path} URLs", () => {
    expect(parseManagedStorageUrl(R2_STYLE, [TRUSTED])).toEqual({
      bucket: "receipts",
      path: "user-1/r1.pdf",
    });
    expect(parseManagedStorageUrl(R2_STYLE, [])).toBeNull();
    expect(
      parseManagedStorageUrl("https://evil.example/receipts/user-1/r1.pdf", [
        TRUSTED,
      ]),
    ).toBeNull();
  });

  it("detects managed URLs via markers or allowlisted origins", () => {
    expect(looksManagedStorageUrl(MANAGED_PUBLIC, [])).toBe(true);
    expect(looksManagedStorageUrl(EXTERNAL, [TRUSTED])).toBe(false);
    expect(looksManagedStorageUrl(R2_STYLE, [TRUSTED])).toBe(true);
    expect(looksManagedStorageUrl(R2_STYLE, [])).toBe(false);
  });

  it("requires trusted origin + bucket allowlist for managed URLs", () => {
    expect(
      parseTrustedStorageUrl(MANAGED_PUBLIC, [STORAGE_BUCKETS.RECEIPTS], [
        TRUSTED,
      ]),
    ).toEqual({ bucket: "receipts", path: "user-1/r1.pdf" });

    expect(
      parseTrustedStorageUrl(MANAGED_PUBLIC, [STORAGE_BUCKETS.RECEIPTS], []),
    ).toBeNull();

    expect(
      parseTrustedStorageUrl(
        MANAGED_PUBLIC,
        [STORAGE_BUCKETS.DOCUMENTS],
        [TRUSTED],
      ),
    ).toBeNull();

    expect(
      parseTrustedStorageUrl(
        "https://evil.example/storage/v1/object/public/receipts/x.pdf",
        [STORAGE_BUCKETS.RECEIPTS],
        [TRUSTED],
      ),
    ).toBeNull();
  });

  it("requireRegisteredStorageUrl rejects untrusted or unregistered URLs", async () => {
    const findRegistered = vi
      .fn<(
        query: {
          bucket: string;
          path: string;
          purpose: string;
          uploadedBy?: string;
        },
      ) => Promise<{ id: string } | null>>()
      .mockResolvedValue(null);
    const lookup = { findRegistered };

    await expect(
      requireRegisteredStorageUrl(lookup, MANAGED_PUBLIC, {
        allowedBuckets: [STORAGE_BUCKETS.RECEIPTS],
        purpose: "expense-receipt",
        uploadedBy: "user-1",
        trustedOrigins: [TRUSTED],
      }),
    ).rejects.toBeInstanceOf(TrustedStorageError);

    findRegistered.mockResolvedValueOnce({ id: "upload-1" });
    await expect(
      requireRegisteredStorageUrl(lookup, MANAGED_PUBLIC, {
        allowedBuckets: [STORAGE_BUCKETS.RECEIPTS],
        purpose: "expense-receipt",
        uploadedBy: "user-1",
        trustedOrigins: [TRUSTED],
      }),
    ).resolves.toEqual({
      bucket: "receipts",
      path: "user-1/r1.pdf",
      uploadId: "upload-1",
    });
    expect(findRegistered).toHaveBeenCalledWith({
      bucket: "receipts",
      path: "user-1/r1.pdf",
      purpose: "expense-receipt",
      uploadedBy: "user-1",
    });
  });

  it("validateReceiptUrl allows external URLs only in allow-external mode", async () => {
    const lookup = {
      findRegistered: vi.fn(async () => ({ id: "upload-1" })),
    };

    await expect(
      validateReceiptUrl(lookup, EXTERNAL, {
        mode: "allow-external",
        allowedBuckets: [STORAGE_BUCKETS.RECEIPTS],
        purpose: "expense-receipt",
        uploadedBy: "user-1",
        trustedOrigins: [TRUSTED],
      }),
    ).resolves.toEqual({ kind: "external", url: EXTERNAL });

    await expect(
      validateReceiptUrl(lookup, EXTERNAL, {
        mode: "require-registered",
        allowedBuckets: [STORAGE_BUCKETS.RECEIPTS],
        purpose: "cash-advance-receipt",
        uploadedBy: "user-1",
        trustedOrigins: [TRUSTED],
      }),
    ).rejects.toBeInstanceOf(TrustedStorageError);

    await expect(
      validateReceiptUrl(lookup, MANAGED_PUBLIC, {
        mode: "allow-external",
        allowedBuckets: [STORAGE_BUCKETS.RECEIPTS],
        purpose: "expense-receipt",
        uploadedBy: "user-1",
        trustedOrigins: [TRUSTED],
      }),
    ).resolves.toEqual({
      kind: "registered",
      bucket: "receipts",
      path: "user-1/r1.pdf",
      uploadId: "upload-1",
      url: MANAGED_PUBLIC,
    });
  });

  it("fails closed for managed markers when no trusted origins are configured", async () => {
    const lookup = {
      findRegistered: vi.fn(async () => ({ id: "upload-1" })),
    };

    await expect(
      validateReceiptUrl(lookup, MANAGED_PUBLIC, {
        mode: "require-registered",
        allowedBuckets: [STORAGE_BUCKETS.RECEIPTS],
        purpose: "cash-advance-receipt",
        uploadedBy: "user-1",
        trustedOrigins: [],
      }),
    ).rejects.toMatchObject({
      code: "TRUSTED_STORAGE_NOT_CONFIGURED",
    });
  });
});
