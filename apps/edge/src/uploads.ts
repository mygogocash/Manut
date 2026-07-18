import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { z } from "zod";

import { HttpError, isRecord, readBoundedJson } from "./http-error";
import type { EdgeJobEnvelope } from "./queue";
import {
  preferWorkerR2Transfer,
  presignR2Download,
  presignR2Upload,
} from "./r2-presign";
import type { EdgeEnv } from "./runtime";
import {
  createDownloadClaims,
  createUploadClaims,
  IntentValidationError,
  isIntentId,
  isTransferIntentClaims,
  parseUploadIntentInput,
  signTransferIntent,
  type TransferIntentClaims,
  verifyTransferIntent,
} from "./upload-intent";

const INTENT_HEADER = "x-manut-transfer-intent";
const intentParamSchema = z.object({
  intentId: z.string().refine(isIntentId),
});
const validateIntentParam = zValidator("param", intentParamSchema, (result) => {
  if (!result.success) {
    throw new HttpError(404, "UPLOAD_NOT_FOUND", "Upload not found.");
  }
});

interface UploadManifest {
  claims: TransferIntentClaims;
  etag: string;
  finalizedAt: string;
  objectVersion: string;
  version: 1;
}

function signingKey(env: EdgeEnv["Bindings"]): string {
  const value = env.EDGE_SIGNING_KEY?.trim();
  if (!value || value.length < 32) {
    throw new HttpError(
      503,
      "EDGE_SIGNING_KEY_NOT_CONFIGURED",
      "Upload service is unavailable.",
    );
  }
  return value;
}

function manifestKey(intentId: string): string {
  return `manifests/${intentId}.json`;
}

function transferToken(request: Request): string {
  const value = request.headers.get(INTENT_HEADER)?.trim();
  if (!value || value.length > 8192) {
    throw new HttpError(
      403,
      "MISSING_TRANSFER_INTENT",
      "Transfer intent is required.",
    );
  }
  return value;
}

async function verifiedClaims(
  request: Request,
  env: EdgeEnv["Bindings"],
  expected: {
    intentId: string;
    kind: "download" | "upload";
    ownerHash: string;
  },
): Promise<TransferIntentClaims> {
  try {
    return await verifyTransferIntent(
      transferToken(request),
      signingKey(env),
      expected,
    );
  } catch (error) {
    if (error instanceof IntentValidationError) {
      throw new HttpError(
        403,
        "INVALID_TRANSFER_INTENT",
        "Transfer intent is invalid or expired.",
      );
    }
    throw error;
  }
}

function parseManifest(value: unknown): UploadManifest | null {
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    typeof value.etag !== "string" ||
    typeof value.objectVersion !== "string" ||
    typeof value.finalizedAt !== "string" ||
    !Number.isFinite(Date.parse(value.finalizedAt)) ||
    !isRecord(value.claims)
  ) {
    return null;
  }
  if (!isTransferIntentClaims(value.claims) || value.claims.kind !== "upload") {
    return null;
  }
  return {
    claims: value.claims,
    etag: value.etag,
    finalizedAt: value.finalizedAt,
    objectVersion: value.objectVersion,
    version: 1,
  };
}

async function loadManifest(
  bucket: R2Bucket,
  intentId: string,
): Promise<UploadManifest | null> {
  const object = await bucket.get(manifestKey(intentId));
  if (!object) return null;
  if (object.size > 16 * 1024) {
    throw new HttpError(
      500,
      "INVALID_UPLOAD_MANIFEST",
      "Upload manifest is invalid.",
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(await object.text()) as unknown;
  } catch {
    throw new HttpError(
      500,
      "INVALID_UPLOAD_MANIFEST",
      "Upload manifest is invalid.",
    );
  }
  const manifest = parseManifest(parsed);
  if (!manifest) {
    throw new HttpError(
      500,
      "INVALID_UPLOAD_MANIFEST",
      "Upload manifest is invalid.",
    );
  }
  return manifest;
}

export const uploadRoutes = new Hono<EdgeEnv>();

uploadRoutes.post("/intents", async (context) => {
  const input = parseUploadIntentInput(await readBoundedJson(context.req.raw));
  if (!input) {
    throw new HttpError(
      422,
      "INVALID_UPLOAD_REQUEST",
      "Upload metadata is invalid.",
    );
  }
  const ownerHash = context.get("principalKey");
  const claims = createUploadClaims(input, ownerHash);
  const token = await signTransferIntent(claims, signingKey(context.env));
  const workerTransfer = preferWorkerR2Transfer(context.req.raw, context.env);
  const transfer = workerTransfer
    ? {
        expiresAt: new Date(claims.exp * 1000).toISOString(),
        requiredHeaders: {
          "content-type": claims.contentType,
          [INTENT_HEADER]: token,
        },
        url: new URL(
          `/api/v1/uploads/${claims.intentId}`,
          context.req.url,
        ).toString(),
      }
    : await presignR2Upload(context.env, claims);

  return context.json(
    {
      expiresAt: transfer.expiresAt,
      intentId: claims.intentId,
      method: "PUT",
      requiredHeaders: transfer.requiredHeaders,
      token,
      transferMode: workerTransfer ? "worker-local" : "r2-presigned",
      uploadUrl: transfer.url,
    },
    201,
  );
});

uploadRoutes.put("/:intentId", validateIntentParam, async (context) => {
  const { intentId } = context.req.valid("param");
  if (!preferWorkerR2Transfer(context.req.raw, context.env)) {
    throw new HttpError(404, "UPLOAD_NOT_FOUND", "Upload not found.");
  }
  const claims = await verifiedClaims(context.req.raw, context.env, {
    intentId,
    kind: "upload",
    ownerHash: context.get("principalKey"),
  });

  const declaredLength = Number(context.req.header("content-length"));
  const contentType = context.req
    .header("content-type")
    ?.split(";", 1)[0]
    ?.trim()
    .toLowerCase();
  if (!Number.isSafeInteger(declaredLength) || declaredLength !== claims.size) {
    throw new HttpError(
      422,
      "UPLOAD_SIZE_MISMATCH",
      "Upload size does not match its intent.",
    );
  }
  if (contentType !== claims.contentType || !context.req.raw.body) {
    throw new HttpError(
      422,
      "UPLOAD_TYPE_MISMATCH",
      "Upload type does not match its intent.",
    );
  }

  const uploaded = await context.env.UPLOADS.put(
    claims.objectKey,
    context.req.raw.body,
    {
      ...(claims.sha256 ? { sha256: claims.sha256 } : {}),
      customMetadata: {
        "intent-id": intentId,
        state: "pending",
      },
      httpMetadata: { contentType: claims.contentType },
      onlyIf: new Headers({ "if-none-match": "*" }),
    },
  );
  if (!uploaded) {
    throw new HttpError(409, "UPLOAD_ALREADY_EXISTS", "Upload already exists.");
  }
  return context.json({ etag: uploaded.etag, intentId, uploaded: true }, 201);
});

uploadRoutes.post(
  "/:intentId/finalize",
  validateIntentParam,
  async (context) => {
    const { intentId } = context.req.valid("param");
    const claims = await verifiedClaims(context.req.raw, context.env, {
      intentId,
      kind: "upload",
      ownerHash: context.get("principalKey"),
    });
    const object = await context.env.UPLOADS.head(claims.objectKey);
    if (!object) {
      throw new HttpError(404, "UPLOAD_NOT_FOUND", "Upload not found.");
    }
    if (
      object.size !== claims.size ||
      object.httpMetadata?.contentType !== claims.contentType ||
      object.customMetadata?.["intent-id"] !== claims.intentId
    ) {
      throw new HttpError(
        409,
        "UPLOAD_METADATA_MISMATCH",
        "Uploaded object does not match its intent.",
      );
    }

    const key = manifestKey(intentId);
    const manifest: UploadManifest = {
      claims,
      etag: object.etag,
      finalizedAt: new Date().toISOString(),
      objectVersion: object.version,
      version: 1,
    };
    const storedManifest = await context.env.UPLOADS.put(
      key,
      JSON.stringify(manifest),
      {
        httpMetadata: { contentType: "application/json" },
        onlyIf: new Headers({ "if-none-match": "*" }),
      },
    );
    if (!storedManifest) {
      const existingManifest = await loadManifest(
        context.env.UPLOADS,
        intentId,
      );
      if (
        !existingManifest ||
        existingManifest.claims.ownerHash !== claims.ownerHash ||
        existingManifest.claims.objectKey !== claims.objectKey ||
        existingManifest.etag !== object.etag
      ) {
        throw new HttpError(
          409,
          "UPLOAD_FINALIZATION_CONFLICT",
          "Upload finalization conflicts with an existing record.",
        );
      }
    }
    const job: EdgeJobEnvelope = {
      idempotencyKey: `upload-finalized:${intentId}:${object.etag}`,
      kind: "upload.finalized",
      occurredAt: new Date().toISOString(),
      payload: { intentId, manifestKey: key },
      version: 1,
    };
    await context.env.JOB_QUEUE.send(job);
    return context.json({ finalized: true, intentId });
  },
);

uploadRoutes.post(
  "/:intentId/download-intent",
  validateIntentParam,
  async (context) => {
    const { intentId } = context.req.valid("param");
    const manifest = await loadManifest(context.env.UPLOADS, intentId);
    if (
      !manifest ||
      manifest.claims.ownerHash !== context.get("principalKey")
    ) {
      throw new HttpError(404, "UPLOAD_NOT_FOUND", "Upload not found.");
    }
    const claims = createDownloadClaims(manifest.claims);
    const object = await context.env.UPLOADS.head(claims.objectKey);
    if (!object || object.etag !== manifest.etag) {
      throw new HttpError(404, "UPLOAD_NOT_FOUND", "Upload not found.");
    }
    if (preferWorkerR2Transfer(context.req.raw, context.env)) {
      const token = await signTransferIntent(claims, signingKey(context.env));
      return context.json({
        downloadUrl: new URL(
          `/api/v1/uploads/${intentId}/download`,
          context.req.url,
        ).toString(),
        expiresAt: new Date(claims.exp * 1000).toISOString(),
        requiredHeaders: { [INTENT_HEADER]: token },
        token,
        transferMode: "worker-local",
      });
    }
    const transfer = await presignR2Download(context.env, claims);
    return context.json({
      downloadUrl: transfer.url,
      expiresAt: transfer.expiresAt,
      requiredHeaders: transfer.requiredHeaders,
      transferMode: "r2-presigned",
    });
  },
);

uploadRoutes.get(
  "/:intentId/download",
  validateIntentParam,
  async (context) => {
    const { intentId } = context.req.valid("param");
    if (!preferWorkerR2Transfer(context.req.raw, context.env)) {
      throw new HttpError(404, "UPLOAD_NOT_FOUND", "Upload not found.");
    }
    const claims = await verifiedClaims(context.req.raw, context.env, {
      intentId,
      kind: "download",
      ownerHash: context.get("principalKey"),
    });
    const manifest = await loadManifest(context.env.UPLOADS, intentId);
    if (
      !manifest ||
      manifest.claims.ownerHash !== claims.ownerHash ||
      manifest.claims.objectKey !== claims.objectKey
    ) {
      throw new HttpError(404, "UPLOAD_NOT_FOUND", "Upload not found.");
    }
    const object = await context.env.UPLOADS.get(claims.objectKey);
    if (!object || object.etag !== manifest.etag) {
      throw new HttpError(404, "UPLOAD_NOT_FOUND", "Upload not found.");
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("cache-control", "private, no-store");
    headers.set(
      "content-disposition",
      `attachment; filename="${claims.fileName}"`,
    );
    headers.set("content-length", String(object.size));
    headers.set("etag", object.httpEtag);
    return new Response(object.body, { headers });
  },
);
