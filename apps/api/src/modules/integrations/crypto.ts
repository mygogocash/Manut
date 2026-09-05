import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const KEY_HEX_LENGTH = 64; // 32 bytes
const IV_BYTES = 12; // GCM standard

function getKey(): Buffer {
  const raw = process.env.INTEGRATIONS_TOKEN_KEY;
  if (!raw || raw.length !== KEY_HEX_LENGTH) {
    throw new Error("INTEGRATIONS_TOKEN_KEY missing or wrong length");
  }
  if (!/^[0-9a-fA-F]+$/.test(raw)) {
    throw new Error("INTEGRATIONS_TOKEN_KEY missing or wrong length");
  }
  return Buffer.from(raw, "hex");
}

/**
 * Encrypt plaintext with AES-256-GCM.
 * Output format: "v1:<iv_b64>:<tag_b64>:<cipher_b64>".
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [
    "v1",
    iv.toString("base64"),
    tag.toString("base64"),
    enc.toString("base64"),
  ].join(":");
}

/**
 * Decrypt the v1 envelope produced by `encrypt`. Throws on tampering.
 */
export function decrypt(payload: string): string {
  const key = getKey();
  const parts = payload.split(":");
  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Invalid token envelope");
  }
  const iv = Buffer.from(parts[1], "base64");
  const tag = Buffer.from(parts[2], "base64");
  const cipherText = Buffer.from(parts[3], "base64");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(cipherText), decipher.final()]);
  return dec.toString("utf8");
}
