/**
 * Portable FileUpload + trusted-URL helper for the Worker Hyperdrive path.
 *
 * Mirrors Express `requireRegisteredStorageUrl` without hard-coupling to a
 * single Supabase project origin: trusted hosts come from
 * `TRUSTED_STORAGE_ORIGINS` (comma-separated). Managed object URLs must pass
 * origin + bucket allowlist + FileUpload purpose/ownership checks.
 */

export const STORAGE_BUCKETS = {
  ARTICLE: "article",
  AVATARS: "avatars",
  BLOG: "blog",
  RECEIPTS: "receipts",
  DOCUMENTS: "documents",
  UPLOADS: "uploads",
} as const;

export type StorageBucketName =
  (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

const MANAGED_MARKERS = [
  "/storage/v1/object/public/",
  "/storage/v1/object/sign/",
] as const;

export type TrustedStorageStatus = 400 | 503;

export class TrustedStorageError extends Error {
  readonly code: string;
  readonly status: TrustedStorageStatus;

  constructor(status: TrustedStorageStatus, code: string, message: string) {
    super(message);
    this.name = "TrustedStorageError";
    this.status = status;
    this.code = code;
  }
}

export interface FileUploadLookup {
  findRegistered(query: {
    bucket: string;
    path: string;
    purpose: string;
    uploadedBy?: string;
    linkedTo?: string;
    linkedId?: string;
  }): Promise<{ id: string } | null>;
}

export interface RegisteredStorageExpectation {
  allowedBuckets: readonly string[];
  purpose: string;
  uploadedBy?: string;
  linkedTo?: string;
  linkedId?: string;
  trustedOrigins: readonly string[];
}

export type ReceiptValidationResult =
  | { kind: "external"; url: string }
  | {
      kind: "registered";
      url: string;
      bucket: string;
      path: string;
      uploadId: string;
    };

export function resolveTrustedStorageOrigins(env: {
  TRUSTED_STORAGE_ORIGINS?: string;
}): string[] {
  const raw = env.TRUSTED_STORAGE_ORIGINS?.trim() ?? "";
  if (!raw) return [];
  return raw
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      try {
        return new URL(part).origin;
      } catch {
        return part.replace(/\/+$/u, "");
      }
    });
}

function urlOrigin(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

function parseMarkerPath(
  url: string,
): { bucket: string; path: string } | null {
  for (const marker of MANAGED_MARKERS) {
    const idx = url.indexOf(marker);
    if (idx === -1) continue;
    const rest = url.slice(idx + marker.length).split("?")[0];
    if (!rest) continue;
    const slashIdx = rest.indexOf("/");
    if (slashIdx === -1) continue;
    const bucket = rest.slice(0, slashIdx);
    const path = rest.slice(slashIdx + 1);
    if (!bucket || !path) continue;
    return { bucket, path };
  }
  return null;
}

function parseAllowlistedPath(
  url: string,
  trustedOrigins: readonly string[],
): { bucket: string; path: string } | null {
  if (trustedOrigins.length === 0) return null;
  const origin = urlOrigin(url);
  if (!origin || !trustedOrigins.includes(origin)) return null;

  let pathname: string;
  try {
    pathname = new URL(url).pathname;
  } catch {
    return null;
  }
  const trimmed = pathname.replace(/^\/+/u, "");
  const slashIdx = trimmed.indexOf("/");
  if (slashIdx === -1) return null;
  const bucket = trimmed.slice(0, slashIdx);
  const path = trimmed.slice(slashIdx + 1).split("?")[0] ?? "";
  if (!bucket || !path) return null;
  return { bucket, path };
}

/**
 * Extract bucket/path from Supabase-shaped markers, or from
 * `/{bucket}/{path}` on an allowlisted origin (R2 / custom host).
 */
export function parseManagedStorageUrl(
  url: string | null | undefined,
  trustedOrigins: readonly string[] = [],
): { bucket: string; path: string } | null {
  if (!url) return null;
  const fromMarker = parseMarkerPath(url);
  if (fromMarker) return fromMarker;
  return parseAllowlistedPath(url, trustedOrigins);
}

export function looksManagedStorageUrl(
  url: string,
  trustedOrigins: readonly string[],
): boolean {
  if (parseMarkerPath(url)) return true;
  return parseAllowlistedPath(url, trustedOrigins) !== null;
}

export function parseTrustedStorageUrl(
  url: string | null | undefined,
  allowedBuckets: readonly string[],
  trustedOrigins: readonly string[],
): { bucket: string; path: string } | null {
  if (!url || trustedOrigins.length === 0) return null;

  const origin = urlOrigin(url);
  if (!origin || !trustedOrigins.includes(origin)) return null;

  const parsed = parseManagedStorageUrl(url, trustedOrigins);
  if (!parsed || !parsed.path) return null;
  if (!allowedBuckets.includes(parsed.bucket)) return null;
  return parsed;
}

export async function requireRegisteredStorageUrl(
  lookup: FileUploadLookup,
  url: string,
  expectation: RegisteredStorageExpectation,
): Promise<{ bucket: string; path: string; uploadId: string }> {
  if (
    looksManagedStorageUrl(url, expectation.trustedOrigins) &&
    expectation.trustedOrigins.length === 0
  ) {
    throw new TrustedStorageError(
      503,
      "TRUSTED_STORAGE_NOT_CONFIGURED",
      "Trusted storage origins are not configured.",
    );
  }

  const parsed = parseTrustedStorageUrl(
    url,
    expectation.allowedBuckets,
    expectation.trustedOrigins,
  );
  if (!parsed) {
    throw new TrustedStorageError(
      400,
      "UNTRUSTED_STORAGE_URL",
      "File URL is not from the expected trusted storage bucket",
    );
  }

  const upload = await lookup.findRegistered({
    bucket: parsed.bucket,
    path: parsed.path,
    purpose: expectation.purpose,
    ...(expectation.uploadedBy !== undefined && {
      uploadedBy: expectation.uploadedBy,
    }),
    ...(expectation.linkedTo !== undefined && {
      linkedTo: expectation.linkedTo,
    }),
    ...(expectation.linkedId !== undefined && {
      linkedId: expectation.linkedId,
    }),
  });
  if (!upload) {
    throw new TrustedStorageError(
      400,
      "UNREGISTERED_STORAGE_URL",
      "File URL is not registered for this application record",
    );
  }

  return { ...parsed, uploadId: upload.id };
}

/**
 * Expense receipts: non-managed URLs are allowed as external links.
 * Cash-advance receipts: every URL must be registered FileUpload provenance.
 */
export async function validateReceiptUrl(
  lookup: FileUploadLookup,
  url: string | null | undefined,
  options: RegisteredStorageExpectation & {
    mode: "allow-external" | "require-registered";
  },
): Promise<ReceiptValidationResult | null> {
  if (!url) return null;

  const managed = looksManagedStorageUrl(url, options.trustedOrigins);
  if (!managed) {
    if (options.mode === "allow-external") {
      return { kind: "external", url };
    }
    throw new TrustedStorageError(
      400,
      "UNTRUSTED_STORAGE_URL",
      "File URL is not from the expected trusted storage bucket",
    );
  }

  const registered = await requireRegisteredStorageUrl(lookup, url, options);
  return {
    kind: "registered",
    url,
    bucket: registered.bucket,
    path: registered.path,
    uploadId: registered.uploadId,
  };
}
