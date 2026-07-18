import { describe, expect, it } from "vitest";

import {
  localR2StreamingAllowed,
  preferWorkerR2Transfer,
  presignR2Download,
  presignR2Upload,
  r2PresigningConfigured,
} from "../src/r2-presign";
import type { RuntimeBindings } from "../src/runtime";
import { createDownloadClaims, createUploadClaims } from "../src/upload-intent";

const NOW = Date.UTC(2026, 6, 17, 0, 0, 0);
const ACCOUNT_ID = "a".repeat(32);
const ACCESS_KEY_ID = "A".repeat(32);
const SECRET_ACCESS_KEY =
  "r2-secret-signing-material-which-must-never-be-serialized";

function signingEnv(overrides: Partial<RuntimeBindings> = {}): RuntimeBindings {
  return {
    R2_ACCESS_KEY_ID: ACCESS_KEY_ID,
    R2_ACCOUNT_ID: ACCOUNT_ID,
    R2_BUCKET_NAME: "manut-intranet-uploads-test",
    R2_SECRET_ACCESS_KEY: SECRET_ACCESS_KEY,
    ...overrides,
  } as RuntimeBindings;
}

function uploadClaims() {
  return createUploadClaims(
    { contentType: "application/pdf", fileName: "proof.pdf", size: 128 },
    "p".repeat(43),
    NOW,
    "00000000-0000-4000-8000-000000000001",
  );
}

describe("R2 query presigning", () => {
  it("bounds and signs upload metadata without serializing the secret key", async () => {
    const result = await presignR2Upload(signingEnv(), uploadClaims(), NOW);
    const url = new URL(result.url);

    expect(url.hostname).toBe(`${ACCOUNT_ID}.r2.cloudflarestorage.com`);
    expect(url.pathname).toContain(
      "/manut-intranet-uploads-test/uploads/00000000-0000-4000-8000-000000000001/",
    );
    expect(url.pathname).not.toContain("p".repeat(24));
    expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toContain(
      "content-type",
    );
    expect(url.searchParams.get("X-Amz-SignedHeaders")).toContain(
      "x-amz-meta-intent-id",
    );
    expect(result.requiredHeaders["content-type"]).toBe("application/pdf");
    expect(JSON.stringify(result)).not.toContain(SECRET_ACCESS_KEY);
    expect(result.url).not.toContain("Authorization");
  });

  it("creates a one-minute attachment download and fails closed without credentials", async () => {
    const claims = createDownloadClaims(uploadClaims(), NOW);
    const result = await presignR2Download(signingEnv(), claims, NOW);
    const url = new URL(result.url);

    expect(url.searchParams.get("X-Amz-Expires")).toBe("60");
    expect(url.searchParams.get("response-content-disposition")).toBe(
      'attachment; filename="proof.pdf"',
    );
    await expect(
      presignR2Download(signingEnv({ R2_SECRET_ACCESS_KEY: "" }), claims, NOW),
    ).rejects.toMatchObject({
      code: "R2_PRESIGNING_NOT_CONFIGURED",
      status: 503,
    });
  });

  it("limits the streaming fallback to an explicitly enabled loopback request", () => {
    const enabled = signingEnv({ ENABLE_LOCAL_R2_STREAMING: "true" });
    expect(
      localR2StreamingAllowed(new Request("http://localhost/upload"), enabled),
    ).toBe(true);
    expect(
      localR2StreamingAllowed(
        new Request("http://127.0.0.1:8787/upload"),
        enabled,
      ),
    ).toBe(true);
    expect(
      localR2StreamingAllowed(
        new Request("https://localhost.attacker.example/upload"),
        enabled,
      ),
    ).toBe(false);
    expect(
      localR2StreamingAllowed(
        new Request("http://localhost/upload"),
        signingEnv({ ENABLE_LOCAL_R2_STREAMING: "false" }),
      ),
    ).toBe(false);
  });

  it("treats missing R2 S3 credentials as not configured for SigV4", () => {
    expect(r2PresigningConfigured(signingEnv())).toBe(true);
    expect(
      r2PresigningConfigured(signingEnv({ R2_ACCESS_KEY_ID: "" })),
    ).toBe(false);
    expect(
      r2PresigningConfigured(signingEnv({ R2_SECRET_ACCESS_KEY: "" })),
    ).toBe(false);
    expect(r2PresigningConfigured(signingEnv({ R2_ACCOUNT_ID: "" }))).toBe(
      false,
    );
  });

  it("prefers Worker + UPLOADS binding when S3 credentials are absent", () => {
    const remote = new Request("https://app.manut.xyz/api/v1/uploads/intents");
    const withoutKeys = signingEnv({
      ENABLE_LOCAL_R2_STREAMING: "false",
      R2_ACCESS_KEY_ID: "",
      R2_SECRET_ACCESS_KEY: "",
    });
    expect(preferWorkerR2Transfer(remote, withoutKeys)).toBe(true);
    expect(preferWorkerR2Transfer(remote, signingEnv())).toBe(false);
    expect(
      preferWorkerR2Transfer(
        new Request("http://localhost/upload"),
        signingEnv({ ENABLE_LOCAL_R2_STREAMING: "true" }),
      ),
    ).toBe(true);
  });
});
