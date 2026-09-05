/**
 * Public legal signing service.
 *
 * The endpoints under `/api/legal-public/*` are unauthenticated. We
 * deliberately bypass the shared `api` helper (which attaches auth
 * cookies via `credentials: "include"`) and use plain `fetch` with
 * `credentials: "omit"` so the public flow stays unauthenticated even
 * if the visitor happens to have a valid session cookie.
 */

import { ApiError } from "@/lib/api-client";
import type {
  LegalKind,
  LegalSignature,
  LegalStatus,
} from "@/services/legal.service";

const PUBLIC_BASE_URL = "/api/legal-public";

/** Slim document shape exposed to the public signer (NO file contents in payload). */
export interface PublicSigningDocument {
  id: string;
  title: string;
  kind: LegalKind;
  fileUrl: string | null;
  fileName: string | null;
  status: LegalStatus;
}

/** Signature shape returned to the public signer — token is NOT echoed back. */
export type PublicSigningSignature = Omit<LegalSignature, "documentId">;

export interface PublicSigningRequest {
  signature: PublicSigningSignature;
  document: PublicSigningDocument;
}

export interface PublicSubmitSigningInput {
  signatureText: string;
  agreed: true;
}

interface RawErrorBody {
  error?:
    | string
    | {
        code?: string;
        message?: string;
        details?: Array<{ field?: string; message: string }>;
      };
}

async function publicFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const method = init?.method?.toUpperCase() ?? "GET";
  const headers = new Headers(init?.headers);
  if (!headers.has("Content-Type") && !(init?.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }
  if (method !== "GET" && method !== "HEAD") {
    headers.set("X-Requested-With", "XMLHttpRequest");
  }

  let res: Response;
  try {
    res = await fetch(`${PUBLIC_BASE_URL}${path}`, {
      ...init,
      headers,
      credentials: "omit",
    });
  } catch (err) {
    throw new ApiError(
      0,
      "NETWORK_ERROR",
      err instanceof Error ? err.message : "Network request failed",
    );
  }

  if (res.status === 204) return undefined as T;

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    throw new ApiError(
      res.status || 0,
      "PARSE_ERROR",
      `Server returned non-JSON response (${res.status} ${res.statusText})`,
    );
  }

  if (!res.ok) {
    const raw = (body ?? {}) as RawErrorBody;
    const errField = raw.error;
    const code =
      typeof errField === "string"
        ? errField
        : String(errField?.code ?? "UNKNOWN");
    const message =
      typeof errField === "string"
        ? errField
        : String(errField?.message ?? "Unknown error");
    const details =
      typeof errField === "object" && errField !== null
        ? errField.details
        : undefined;
    throw new ApiError(res.status, code, message, details);
  }

  return body as T;
}

interface ApiEnvelope<T> {
  data: T;
}

export async function getSigningRequest(
  token: string,
): Promise<PublicSigningRequest> {
  const res = await publicFetch<ApiEnvelope<PublicSigningRequest>>(
    `/sign/${encodeURIComponent(token)}`,
  );
  return res.data;
}

export async function submitSigning(
  token: string,
  input: PublicSubmitSigningInput,
): Promise<PublicSigningSignature> {
  const res = await publicFetch<ApiEnvelope<PublicSigningSignature>>(
    `/sign/${encodeURIComponent(token)}`,
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  );
  return res.data;
}

export async function declineSigning(
  token: string,
  reason: string,
): Promise<PublicSigningSignature> {
  const res = await publicFetch<ApiEnvelope<PublicSigningSignature>>(
    `/sign/${encodeURIComponent(token)}/decline`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
    },
  );
  return res.data;
}
