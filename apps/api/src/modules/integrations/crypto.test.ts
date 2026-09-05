import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { decrypt, encrypt } from "@/modules/integrations/crypto";

const VALID_KEY_HEX = "0".repeat(64);

describe("crypto", () => {
  let originalKey: string | undefined;

  beforeEach(() => {
    originalKey = process.env.INTEGRATIONS_TOKEN_KEY;
    process.env.INTEGRATIONS_TOKEN_KEY = VALID_KEY_HEX;
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env.INTEGRATIONS_TOKEN_KEY;
    else process.env.INTEGRATIONS_TOKEN_KEY = originalKey;
  });

  describe("encrypt", () => {
    it("given valid key + plaintext > returns v1: prefixed string", () => {
      const out = encrypt("hello-world");
      expect(out.startsWith("v1:")).toBe(true);
      expect(out.split(":")).toHaveLength(4);
    });

    it("given missing key > throws INTEGRATIONS_TOKEN_KEY missing or wrong length", () => {
      delete process.env.INTEGRATIONS_TOKEN_KEY;
      expect(() => encrypt("x")).toThrow(
        "INTEGRATIONS_TOKEN_KEY missing or wrong length",
      );
    });
  });

  describe("decrypt", () => {
    it("given encrypt output > returns original plaintext", () => {
      const plain = "ya29.a0AfH6SMC-secret-google-token";
      const enc = encrypt(plain);
      expect(decrypt(enc)).toBe(plain);
    });

    it("given tampered ciphertext > throws (GCM auth tag mismatch)", () => {
      const enc = encrypt("hello");
      const parts = enc.split(":");
      // Flip a bit in cipher segment
      const tamperedCipher = Buffer.from(parts[3], "base64");
      tamperedCipher[0] = tamperedCipher[0] ^ 0x01;
      parts[3] = tamperedCipher.toString("base64");
      const tampered = parts.join(":");
      expect(() => decrypt(tampered)).toThrow();
    });
  });
});
