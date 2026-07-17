const encoder = new TextEncoder();

export function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/u, "");
}

export function decodeBase64Url(value: string): Uint8Array<ArrayBuffer> {
  if (!/^[A-Za-z0-9_-]+$/u.test(value)) {
    throw new Error("Invalid base64url value.");
  }
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function sha256Base64Url(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return encodeBase64Url(new Uint8Array(digest));
}

async function importHmacKey(secret: string): Promise<CryptoKey> {
  if (secret.length < 32) {
    throw new Error("Signing key is not configured securely.");
  }
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { hash: "SHA-256", name: "HMAC" },
    false,
    ["sign", "verify"],
  );
}

export async function signHmac(value: string, secret: string): Promise<string> {
  const key = await importHmacKey(secret);
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(value),
  );
  return encodeBase64Url(new Uint8Array(signature));
}

export async function verifyHmac(
  value: string,
  signature: string,
  secret: string,
): Promise<boolean> {
  let signatureBytes: Uint8Array<ArrayBuffer>;
  try {
    signatureBytes = decodeBase64Url(signature);
  } catch {
    return false;
  }

  const key = await importHmacKey(secret);
  return crypto.subtle.verify(
    "HMAC",
    key,
    signatureBytes,
    encoder.encode(value),
  );
}
