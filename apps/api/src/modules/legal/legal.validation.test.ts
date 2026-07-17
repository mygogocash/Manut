import { describe, expect, it } from "vitest";

import { sendForSignatureSchema } from "@/modules/legal/legal.validation";

describe("sendForSignatureSchema", () => {
  const signer = {
    signerEmail: "signer@example.com",
    signerName: "Example Signer",
    signingOrder: 1,
  };

  it("accepts the in-house signing contract without a provider selector", () => {
    expect(sendForSignatureSchema.parse({ signers: [signer] })).toEqual({
      signers: [signer],
    });
  });

  it.each(["inhouse", "docusign"])(
    "rejects the removed provider selector (%s) instead of silently changing flows",
    (provider) => {
      expect(() =>
        sendForSignatureSchema.parse({
          provider,
          signers: [signer],
        }),
      ).toThrow();
    },
  );

  it("rejects a removed provider selector nested inside a signer", () => {
    expect(() =>
      sendForSignatureSchema.parse({
        signers: [{ ...signer, provider: "docusign" }],
      }),
    ).toThrow();
  });

  it("rejects an already-expired signing request", () => {
    expect(() =>
      sendForSignatureSchema.parse({
        signers: [signer],
        expiresAt: "2000-01-01T00:00:00.000Z",
      }),
    ).toThrow("Expiry must be in the future");
  });
});
