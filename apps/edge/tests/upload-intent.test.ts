import { describe, expect, it } from "vitest";

import { sha256Base64Url } from "../src/crypto";
import {
  createDownloadClaims,
  createUploadClaims,
  IntentValidationError,
  MAX_UPLOAD_BYTES,
  parseUploadIntentInput,
  signTransferIntent,
  verifyTransferIntent,
} from "../src/upload-intent";

const SECRET = "test-only-edge-signing-key-with-at-least-32-characters";
const INTENT_ID = "85b5b5da-8adc-4bba-9630-079cfe52d497";

describe("R2 transfer intents", () => {
  it("normalizes filenames and admits only bounded safe content", () => {
    expect(
      parseUploadIntentInput({
        contentType: "Application/PDF",
        fileName: "../../Payroll Q3.pdf",
        size: 2048,
      }),
    ).toEqual({
      contentType: "application/pdf",
      fileName: "Payroll-Q3.pdf",
      size: 2048,
    });
    expect(
      parseUploadIntentInput({
        contentType: "application/x-executable",
        fileName: "payload.exe",
        size: 5,
      }),
    ).toBeNull();
    expect(
      parseUploadIntentInput({
        contentType: "text/plain",
        fileName: "payload.exe",
        size: 5,
      }),
    ).toBeNull();
    expect(
      parseUploadIntentInput({
        contentType: "application/pdf",
        fileName: "large.pdf",
        size: MAX_UPLOAD_BYTES + 1,
      }),
    ).toBeNull();
  });

  it("signs short-lived server-owned object claims and verifies the owner", async () => {
    const ownerHash = await sha256Base64Url("employee-123");
    const claims = createUploadClaims(
      { contentType: "text/plain", fileName: "notes.txt", size: 12 },
      ownerHash,
      1_000_000,
      INTENT_ID,
    );
    expect(claims.objectKey).toBe(`uploads/${INTENT_ID}/notes.txt`);
    const token = await signTransferIntent(claims, SECRET);

    await expect(
      verifyTransferIntent(
        token,
        SECRET,
        { intentId: INTENT_ID, kind: "upload", ownerHash },
        1_001_000,
      ),
    ).resolves.toEqual(claims);
    await expect(
      verifyTransferIntent(
        token,
        SECRET,
        {
          intentId: INTENT_ID,
          kind: "upload",
          ownerHash: await sha256Base64Url("another-user"),
        },
        1_001_000,
      ),
    ).rejects.toBeInstanceOf(IntentValidationError);
  });

  it("rejects tampering and expired intents", async () => {
    const ownerHash = await sha256Base64Url("employee-123");
    const claims = createUploadClaims(
      { contentType: "text/plain", fileName: "notes.txt", size: 12 },
      ownerHash,
      1_000_000,
      INTENT_ID,
    );
    const token = await signTransferIntent(claims, SECRET);
    const [version, payload, signature] = token.split(".");
    if (!version || !payload || !signature) {
      throw new Error("Expected a signed intent.");
    }
    const replacement = signature.startsWith("A") ? "B" : "A";
    const tampered = `${version}.${payload}.${replacement}${signature.slice(1)}`;

    await expect(
      verifyTransferIntent(tampered, SECRET, {
        intentId: INTENT_ID,
        kind: "upload",
        ownerHash,
      }),
    ).rejects.toBeInstanceOf(IntentValidationError);
    await expect(
      verifyTransferIntent(
        token,
        SECRET,
        { intentId: INTENT_ID, kind: "upload", ownerHash },
        claims.exp * 1000,
      ),
    ).rejects.toBeInstanceOf(IntentValidationError);

    const download = createDownloadClaims(claims, 1_000_000);
    expect(download.kind).toBe("download");
    expect(download.exp).toBeLessThan(claims.exp);
  });
});
