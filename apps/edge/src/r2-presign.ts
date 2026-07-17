import { AwsClient } from "aws4fetch";

import { HttpError } from "./http-error";
import type { RuntimeBindings } from "./runtime";
import {
  DOWNLOAD_INTENT_TTL_SECONDS,
  isTransferIntentClaims,
  type TransferIntentClaims,
  UPLOAD_INTENT_TTL_SECONDS,
} from "./upload-intent";

const ACCOUNT_ID_PATTERN = /^[0-9a-f]{32}$/iu;
const ACCESS_KEY_ID_PATTERN = /^[A-Za-z0-9]{16,128}$/u;
const BUCKET_NAME_PATTERN = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/u;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

interface R2SigningConfiguration {
  accessKeyId: string;
  accountId: string;
  bucketName: string;
  secretAccessKey: string;
}

export interface PresignedR2Transfer {
  expiresAt: string;
  requiredHeaders: Record<string, string>;
  url: string;
}

function boundedPrintableAscii(
  value: string,
  minimumLength: number,
  maximumLength: number,
): boolean {
  if (value.length < minimumLength || value.length > maximumLength) {
    return false;
  }
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (codePoint === undefined || codePoint < 33 || codePoint > 126) {
      return false;
    }
  }
  return true;
}

function validBucketName(value: string): boolean {
  return (
    BUCKET_NAME_PATTERN.test(value) &&
    !value.includes("..") &&
    !value.includes(".-") &&
    !value.includes("-.") &&
    !/^\d{1,3}(?:\.\d{1,3}){3}$/u.test(value)
  );
}

function signingConfiguration(env: RuntimeBindings): R2SigningConfiguration {
  const accountId = env.R2_ACCOUNT_ID?.trim() ?? "";
  const accessKeyId = env.R2_ACCESS_KEY_ID?.trim() ?? "";
  const secretAccessKey = env.R2_SECRET_ACCESS_KEY?.trim() ?? "";
  const bucketName = env.R2_BUCKET_NAME?.trim() ?? "";

  if (
    !ACCOUNT_ID_PATTERN.test(accountId) ||
    !ACCESS_KEY_ID_PATTERN.test(accessKeyId) ||
    !boundedPrintableAscii(secretAccessKey, 32, 256) ||
    !validBucketName(bucketName)
  ) {
    throw new HttpError(
      503,
      "R2_PRESIGNING_NOT_CONFIGURED",
      "Direct file transfer is unavailable.",
    );
  }
  return { accessKeyId, accountId, bucketName, secretAccessKey };
}

function remainingLifetime(
  claims: TransferIntentClaims,
  kind: "download" | "upload",
  maximumSeconds: number,
  nowMilliseconds: number,
): number {
  if (
    !Number.isSafeInteger(nowMilliseconds) ||
    !isTransferIntentClaims(claims) ||
    claims.kind !== kind
  ) {
    throw new HttpError(
      403,
      "INVALID_TRANSFER_INTENT",
      "Transfer intent is invalid or expired.",
    );
  }
  const remaining = claims.exp - Math.floor(nowMilliseconds / 1000);
  if (remaining < 1 || remaining > maximumSeconds) {
    throw new HttpError(
      403,
      "INVALID_TRANSFER_INTENT",
      "Transfer intent is invalid or expired.",
    );
  }
  return remaining;
}

function objectUrl(
  configuration: R2SigningConfiguration,
  claims: TransferIntentClaims,
): URL {
  const url = new URL(
    `https://${configuration.accountId}.r2.cloudflarestorage.com`,
  );
  url.pathname = `/${configuration.bucketName}/${claims.objectKey}`;
  return url;
}

function awsClient(configuration: R2SigningConfiguration): AwsClient {
  return new AwsClient({
    accessKeyId: configuration.accessKeyId,
    region: "auto",
    retries: 0,
    secretAccessKey: configuration.secretAccessKey,
    service: "s3",
  });
}

function signingTimestamp(nowMilliseconds: number): string {
  return new Date(nowMilliseconds).toISOString().replace(/[:-]|\.\d{3}/gu, "");
}

async function signQuery(
  configuration: R2SigningConfiguration,
  url: URL,
  method: "GET" | "PUT",
  requiredHeaders: Record<string, string>,
  nowMilliseconds: number,
): Promise<string> {
  try {
    const request = await awsClient(configuration).sign(url, {
      headers: requiredHeaders,
      method,
      aws: {
        allHeaders: true,
        datetime: signingTimestamp(nowMilliseconds),
        region: "auto",
        service: "s3",
        signQuery: true,
      },
    });
    return request.url;
  } catch {
    throw new HttpError(
      503,
      "R2_PRESIGNING_UNAVAILABLE",
      "Direct file transfer is unavailable.",
    );
  }
}

export function localR2StreamingAllowed(
  request: Request,
  env: RuntimeBindings,
): boolean {
  if (env.ENABLE_LOCAL_R2_STREAMING !== "true") return false;
  try {
    return LOOPBACK_HOSTS.has(new URL(request.url).hostname);
  } catch {
    return false;
  }
}

export async function presignR2Upload(
  env: RuntimeBindings,
  claims: TransferIntentClaims,
  nowMilliseconds = Date.now(),
): Promise<PresignedR2Transfer> {
  const expiresIn = remainingLifetime(
    claims,
    "upload",
    UPLOAD_INTENT_TTL_SECONDS,
    nowMilliseconds,
  );
  const configuration = signingConfiguration(env);
  const requiredHeaders = {
    "content-type": claims.contentType,
    "x-amz-meta-intent-id": claims.intentId,
    "x-amz-meta-state": "pending",
  };
  const url = objectUrl(configuration, claims);
  url.searchParams.set("X-Amz-Expires", String(expiresIn));

  return {
    expiresAt: new Date(claims.exp * 1000).toISOString(),
    requiredHeaders,
    url: await signQuery(
      configuration,
      url,
      "PUT",
      requiredHeaders,
      nowMilliseconds,
    ),
  };
}

export async function presignR2Download(
  env: RuntimeBindings,
  claims: TransferIntentClaims,
  nowMilliseconds = Date.now(),
): Promise<PresignedR2Transfer> {
  const expiresIn = remainingLifetime(
    claims,
    "download",
    DOWNLOAD_INTENT_TTL_SECONDS,
    nowMilliseconds,
  );
  const configuration = signingConfiguration(env);
  const url = objectUrl(configuration, claims);
  url.searchParams.set("X-Amz-Expires", String(expiresIn));
  url.searchParams.set(
    "response-content-disposition",
    `attachment; filename="${claims.fileName}"`,
  );

  return {
    expiresAt: new Date(claims.exp * 1000).toISOString(),
    requiredHeaders: {},
    url: await signQuery(configuration, url, "GET", {}, nowMilliseconds),
  };
}
