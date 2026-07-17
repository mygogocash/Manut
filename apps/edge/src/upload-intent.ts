import {
  decodeBase64Url,
  encodeBase64Url,
  signHmac,
  verifyHmac,
} from "./crypto";
import { isRecord } from "./http-error";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
export const UPLOAD_INTENT_TTL_SECONDS = 5 * 60;
export const DOWNLOAD_INTENT_TTL_SECONDS = 60;

const ALLOWED_CONTENT_TYPES = new Set([
  "application/json",
  "application/msword",
  "application/pdf",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "text/plain",
]);

const FORBIDDEN_FILE_EXTENSIONS = new Set([
  "asp",
  "aspx",
  "bat",
  "cgi",
  "cmd",
  "com",
  "dll",
  "docm",
  "exe",
  "htm",
  "html",
  "jar",
  "js",
  "jsp",
  "msi",
  "php",
  "pl",
  "pptm",
  "ps1",
  "py",
  "rb",
  "sh",
  "so",
  "svg",
  "vbs",
  "xlsm",
]);

const INTENT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const OWNER_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const SHA256_PATTERN = /^[0-9a-f]{64}$/u;

export type TransferIntentKind = "download" | "upload";

export interface TransferIntentClaims {
  contentType: string;
  exp: number;
  fileName: string;
  intentId: string;
  kind: TransferIntentKind;
  objectKey: string;
  ownerHash: string;
  sha256?: string;
  size: number;
  version: 1;
}

export interface UploadIntentInput {
  contentType: string;
  fileName: string;
  sha256?: string;
  size: number;
}

export class IntentValidationError extends Error {
  constructor(message = "Upload intent is invalid or expired.") {
    super(message);
    this.name = "IntentValidationError";
  }
}

function safeFileName(value: string): string | null {
  const normalized = value
    .normalize("NFKC")
    .replaceAll("\\", "/")
    .split("/")
    .at(-1)
    ?.replace(/[^A-Za-z0-9._-]+/gu, "-")
    .replace(/-{2,}/gu, "-")
    .replace(/^[.-]+|[.-]+$/gu, "")
    .slice(0, 120);
  return normalized || null;
}

function hasForbiddenExtension(fileName: string): boolean {
  const extension = fileName.split(".").at(-1)?.toLowerCase();
  return extension !== undefined && FORBIDDEN_FILE_EXTENSIONS.has(extension);
}

export function parseUploadIntentInput(
  value: unknown,
): UploadIntentInput | null {
  if (!isRecord(value)) return null;
  const fileName =
    typeof value.fileName === "string" ? safeFileName(value.fileName) : null;
  const contentType =
    typeof value.contentType === "string"
      ? value.contentType.trim().toLowerCase()
      : "";
  const size = value.size;
  const sha256 =
    typeof value.sha256 === "string" ? value.sha256.toLowerCase() : undefined;

  if (
    !fileName ||
    hasForbiddenExtension(fileName) ||
    !ALLOWED_CONTENT_TYPES.has(contentType) ||
    typeof size !== "number" ||
    !Number.isSafeInteger(size) ||
    size < 1 ||
    size > MAX_UPLOAD_BYTES ||
    (sha256 !== undefined && !SHA256_PATTERN.test(sha256))
  ) {
    return null;
  }

  return { contentType, fileName, ...(sha256 ? { sha256 } : {}), size };
}

export function createUploadClaims(
  input: UploadIntentInput,
  ownerHash: string,
  nowMilliseconds = Date.now(),
  intentId = crypto.randomUUID(),
): TransferIntentClaims {
  if (!OWNER_PATTERN.test(ownerHash) || !INTENT_ID_PATTERN.test(intentId)) {
    throw new IntentValidationError();
  }
  return {
    ...input,
    exp: Math.floor(nowMilliseconds / 1000) + UPLOAD_INTENT_TTL_SECONDS,
    intentId,
    kind: "upload",
    objectKey: `uploads/${intentId}/${input.fileName}`,
    ownerHash,
    version: 1,
  };
}

export function createDownloadClaims(
  source: TransferIntentClaims,
  nowMilliseconds = Date.now(),
): TransferIntentClaims {
  return {
    ...source,
    exp: Math.floor(nowMilliseconds / 1000) + DOWNLOAD_INTENT_TTL_SECONDS,
    kind: "download",
  };
}

export function isTransferIntentClaims(
  value: unknown,
): value is TransferIntentClaims {
  if (!isRecord(value)) return false;
  const common =
    value.version === 1 &&
    (value.kind === "upload" || value.kind === "download") &&
    typeof value.intentId === "string" &&
    INTENT_ID_PATTERN.test(value.intentId) &&
    typeof value.ownerHash === "string" &&
    OWNER_PATTERN.test(value.ownerHash) &&
    typeof value.fileName === "string" &&
    safeFileName(value.fileName) === value.fileName &&
    !hasForbiddenExtension(value.fileName) &&
    typeof value.objectKey === "string" &&
    value.objectKey === `uploads/${value.intentId}/${value.fileName}` &&
    typeof value.contentType === "string" &&
    ALLOWED_CONTENT_TYPES.has(value.contentType) &&
    typeof value.size === "number" &&
    Number.isSafeInteger(value.size) &&
    value.size > 0 &&
    value.size <= MAX_UPLOAD_BYTES &&
    typeof value.exp === "number" &&
    Number.isSafeInteger(value.exp);
  if (!common) return false;
  return (
    value.sha256 === undefined ||
    (typeof value.sha256 === "string" && SHA256_PATTERN.test(value.sha256))
  );
}

export async function signTransferIntent(
  claims: TransferIntentClaims,
  secret: string,
): Promise<string> {
  if (!isTransferIntentClaims(claims)) throw new IntentValidationError();
  const payload = encodeBase64Url(encoder.encode(JSON.stringify(claims)));
  const signedValue = `v1.${payload}`;
  return `${signedValue}.${await signHmac(signedValue, secret)}`;
}

export async function verifyTransferIntent(
  token: string,
  secret: string,
  expected: {
    intentId: string;
    kind: TransferIntentKind;
    ownerHash: string;
  },
  nowMilliseconds = Date.now(),
): Promise<TransferIntentClaims> {
  const [version, payload, signature, ...extra] = token.split(".");
  if (version !== "v1" || !payload || !signature || extra.length > 0) {
    throw new IntentValidationError();
  }
  const signedValue = `${version}.${payload}`;
  if (!(await verifyHmac(signedValue, signature, secret))) {
    throw new IntentValidationError();
  }

  let claims: unknown;
  try {
    claims = JSON.parse(decoder.decode(decodeBase64Url(payload))) as unknown;
  } catch {
    throw new IntentValidationError();
  }

  if (
    !isTransferIntentClaims(claims) ||
    claims.kind !== expected.kind ||
    claims.intentId !== expected.intentId ||
    claims.ownerHash !== expected.ownerHash ||
    claims.exp <= Math.floor(nowMilliseconds / 1000)
  ) {
    throw new IntentValidationError();
  }
  return claims;
}

export function isIntentId(value: string): boolean {
  return INTENT_ID_PATTERN.test(value);
}
