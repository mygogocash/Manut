import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("parseTrustedStorageUrl", () => {
  async function loadParser() {
    vi.resetModules();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://manut.supabase.co");
    vi.stubEnv("SUPABASE_URL", "https://manut.supabase.co");
    return import("@/infrastructure/storage/supabase-storage");
  }

  it("accepts the configured origin and an allowlisted bucket", async () => {
    const { parseTrustedStorageUrl, STORAGE_BUCKETS } = await loadParser();

    expect(
      parseTrustedStorageUrl(
        "https://manut.supabase.co/storage/v1/object/sign/documents/legal/agreement.pdf?token=temporary",
        [STORAGE_BUCKETS.DOCUMENTS],
      ),
    ).toEqual({ bucket: "documents", path: "legal/agreement.pdf" });
  });

  it("rejects an untrusted origin", async () => {
    const { parseTrustedStorageUrl, STORAGE_BUCKETS } = await loadParser();

    expect(
      parseTrustedStorageUrl(
        "https://attacker.example/storage/v1/object/sign/documents/legal/agreement.pdf?token=temporary",
        [STORAGE_BUCKETS.DOCUMENTS],
      ),
    ).toBeNull();
  });

  it("rejects a private bucket outside the allowlist", async () => {
    const { parseTrustedStorageUrl, STORAGE_BUCKETS } = await loadParser();

    expect(
      parseTrustedStorageUrl(
        "https://manut.supabase.co/storage/v1/object/sign/receipts/private-receipt.pdf?token=temporary",
        [STORAGE_BUCKETS.DOCUMENTS],
      ),
    ).toBeNull();
  });
});
