import { BadRequestException } from "@/common/exceptions/http-exception";
import { logger } from "@/common/utils/logger";
import {
  isSupabaseConfigured,
  supabaseAdmin,
} from "@/infrastructure/supabase/admin";

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;

export const STORAGE_BUCKETS = {
  ARTICLE: "article",
  AVATARS: "avatars",
  BLOG: "blog",
  RECEIPTS: "receipts",
  DOCUMENTS: "documents",
  UPLOADS: "uploads",
} as const;

export type BucketName = (typeof STORAGE_BUCKETS)[keyof typeof STORAGE_BUCKETS];

const MAX_FILE_SIZES: Record<BucketName, number> = {
  article: 10 * 1024 * 1024, // 10 MB
  avatars: 2 * 1024 * 1024, // 2 MB
  blog: 10 * 1024 * 1024, // 10 MB
  receipts: 10 * 1024 * 1024, // 10 MB
  documents: 50 * 1024 * 1024, // 50 MB
  // Must not exceed the project's global Storage file cap (50 MB on
  // Supabase Free). Higher values make createBucket/updateBucket fail.
  uploads: 50 * 1024 * 1024, // 50 MB — short clips; raise in Dashboard + here on Pro
};

/** Buffered multipart ceiling — keep in sync with the largest bucket cap. */
export const MULTIPART_UPLOAD_MAX_BYTES = Math.max(
  ...Object.values(MAX_FILE_SIZES),
);

const ALLOWED_MIME_TYPES: Record<BucketName, string[]> = {
  article: ["image/jpeg", "image/png", "image/webp"],
  avatars: ["image/jpeg", "image/png", "image/webp"],
  blog: ["image/jpeg", "image/png", "image/webp"],
  // `image/jpg` is non-standard but some Windows/legacy Safari clients
  // still report it for `.jpg` files. Accept both so the upload doesn't
  // 415 on perfectly-valid JPEGs.
  receipts: [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
    "application/pdf",
  ],
  documents: [
    "application/pdf",
    "image/jpeg",
    "image/png",
    "image/heic",
    "image/heif",
    "image/webp",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-excel",
    "text/csv",
    "text/plain",
    "text/markdown",
    "text/x-markdown",
    // HTML + ZIP are allowed only here, in the *private* `documents`
    // bucket. Downloads are served via short-lived signed URLs on the
    // Supabase storage origin (not the app origin), so an uploaded HTML
    // page can't reach app cookies/localStorage for stored XSS. Do NOT
    // copy these into the public `uploads` bucket — there an HTML/SVG
    // file served from the public CDN path *would* be a stored-XSS
    // vector against teammates (same reasoning that excludes SVG below).
    "text/html",
    "application/zip",
    // Windows Chrome/Edge frequently report `.zip` as this non-standard
    // type. Accept it so valid archives don't 415. (Archives that arrive
    // as `application/octet-stream` are still rejected on purpose — that
    // type is too broad to allowlist without defeating the filter.)
    "application/x-zip-compressed",
  ],
  uploads: [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
    "image/heic",
    "image/heif",
    // `image/svg+xml` is deliberately excluded — the `uploads` bucket
    // is public (see `PUBLIC_BUCKETS` below), and SVGs served from a
    // public CDN path can execute embedded scripts when rendered in
    // an HTML context. That gives an authenticated employee a stored
    // XSS vector against teammates. (#520 issue.)
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/csv",
    "text/plain",
    "text/markdown",
    "video/mp4",
    "video/quicktime",
    "video/webm",
    "video/x-matroska",
    "audio/mpeg",
    "audio/mp4",
    "audio/wav",
    "application/zip",
  ],
};

/**
 * Human-readable names for the MIME types we accept, so error messages
 * read "You can upload PDF, Word, Excel…" instead of dumping a wall of
 * `application/vnd.openxmlformats-…` strings at the user.
 */
const MIME_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "JPG image",
  "image/jpg": "JPG image",
  "image/png": "PNG image",
  "image/webp": "WebP image",
  "image/gif": "GIF image",
  "image/heic": "HEIC image",
  "image/heif": "HEIF image",
  "image/svg+xml": "SVG image",
  "application/msword": "Word document",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    "Word document",
  "application/vnd.ms-excel": "Excel spreadsheet",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    "Excel spreadsheet",
  "application/vnd.ms-powerpoint": "PowerPoint presentation",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "PowerPoint presentation",
  "text/csv": "CSV file",
  "text/plain": "text file",
  "text/markdown": "Markdown file",
  "text/html": "HTML file",
  "application/zip": "ZIP archive",
  "application/x-zip-compressed": "ZIP archive",
  "video/mp4": "MP4 video",
  "video/quicktime": "MOV video",
  "video/webm": "WebM video",
  "video/x-matroska": "MKV video",
  "audio/mpeg": "MP3 audio",
  "audio/mp4": "M4A audio",
  "audio/wav": "WAV audio",
};

/** Join a list as "a, b, and c" (Oxford comma). */
function joinReadable(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "";
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(", ")}, and ${items[items.length - 1]}`;
}

/** Friendly, de-duplicated list of formats a bucket accepts. */
function describeAllowedFormats(allowed: string[]): string {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const mime of allowed) {
    const label = MIME_LABELS[mime] ?? mime;
    if (!seen.has(label)) {
      seen.add(label);
      labels.push(label);
    }
  }
  return joinReadable(labels);
}

function validateFile(
  bucket: BucketName,
  mimeType: string,
  size: number,
): void {
  const maxSize = MAX_FILE_SIZES[bucket];
  if (size > maxSize) {
    const maxMB = Math.round(maxSize / (1024 * 1024));
    throw new BadRequestException(
      `This file is too large. The maximum size is ${maxMB} MB.`,
    );
  }

  const allowed = ALLOWED_MIME_TYPES[bucket];
  if (!allowed.includes(mimeType)) {
    const rejected = MIME_LABELS[mimeType]
      ? `${MIME_LABELS[mimeType]}s`
      : `That file type ("${mimeType}")`;
    throw new BadRequestException(
      `${rejected} can't be uploaded here. You can upload ${describeAllowedFormats(allowed)}.`,
    );
  }
}

function buildStoragePath(
  bucket: BucketName,
  userId: string,
  filename: string,
): string {
  const timestamp = Date.now();
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  return `${userId}/${timestamp}-${sanitized}`;
}

export function getPublicUrl(bucket: string, path: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
}

const SIGNED_UPLOAD_RESPONSE_TTL_SECONDS = 60 * 60 * 24; // 24h

/**
 * Pick the right URL shape for the response to an upload. Public buckets
 * (`article`, `avatars`, `blog`, `uploads`) get the plain public URL.
 * Private buckets (`receipts`, `documents`) get a short-lived signed URL
 * so the immediate preview / iframe in the uploader UI renders instead
 * of showing Supabase's raw `{"statusCode":404,"error":"Bucket not found"}`
 * body (the public path is unreachable for private buckets).
 *
 * The DB still stores the canonical public URL — subsequent reads re-sign
 * on demand (see `signReceiptUrlIfNeeded` in expenses.service).
 */
export async function resolveDisplayUrl(
  bucket: BucketName,
  path: string,
): Promise<string> {
  if (!PUBLIC_BUCKETS.has(bucket)) {
    try {
      return await createSignedUrl(
        bucket,
        path,
        SIGNED_UPLOAD_RESPONSE_TTL_SECONDS,
      );
    } catch {
      // Fall through to the public URL so the caller still gets a string —
      // the UI link will at least copy/paste, even if the inline iframe
      // can't render.
    }
  }
  return getPublicUrl(bucket, path);
}

/**
 * Extract { bucket, path } from a Supabase storage URL.
 *
 * Handles both:
 *   - Public:  …/storage/v1/object/public/{bucket}/{path}
 *   - Signed:  …/storage/v1/object/sign/{bucket}/{path}?token=…
 *
 * Signed URLs are produced by `resolveDisplayUrl` for private buckets
 * (receipts, documents) and may end up persisted as `Expense.receiptUrl`
 * or similar fields.  Without this handling `signReceiptUrlIfNeeded`
 * would fall through and return the (expired) token unchanged.
 *
 * Returns null if the URL doesn't match either pattern.
 */
export function parseStorageUrl(
  url: string | null | undefined,
): { bucket: string; path: string } | null {
  if (!url) return null;
  for (const marker of [
    "/storage/v1/object/public/",
    "/storage/v1/object/sign/",
  ]) {
    const idx = url.indexOf(marker);
    if (idx === -1) continue;
    // Strip query-string (signed URLs carry ?token=… after the path).
    const rest = url.slice(idx + marker.length).split("?")[0];
    const slashIdx = rest.indexOf("/");
    if (slashIdx === -1) continue;
    return { bucket: rest.slice(0, slashIdx), path: rest.slice(slashIdx + 1) };
  }
  return null;
}

/**
 * Lazily create a Supabase bucket using the same options the startup
 * `ensureStorageBuckets()` would have used. Idempotent: if the bucket
 * already exists or the create attempt 409s, we don't surface the
 * error — the next upload retry will catch a genuine failure.
 */
async function ensureBucketExists(bucket: BucketName): Promise<boolean> {
  const isPublic = PUBLIC_BUCKETS.has(bucket);
  const { error } = await supabaseAdmin.storage.createBucket(bucket, {
    public: isPublic,
    fileSizeLimit: MAX_FILE_SIZES[bucket],
    allowedMimeTypes: ALLOWED_MIME_TYPES[bucket],
  });
  if (error) {
    // 409 = already exists, which is fine — we just lost the race with
    // another request. Anything else is logged for visibility.
    if (
      error.message.includes("already exists") ||
      error.message.includes("duplicate")
    ) {
      return true;
    }
    logger.error(
      `Failed to lazily create bucket "${bucket}": ${error.message}. ` +
        `If SUPABASE_SERVICE_ROLE_KEY is correct, create the bucket manually in the Supabase Dashboard.`,
    );
    return false;
  }
  logger.info(`Lazily created storage bucket "${bucket}"`);
  return true;
}

/**
 * Upload a file buffer to Supabase Storage.
 */
export async function uploadFile(
  bucket: BucketName,
  userId: string,
  file: {
    buffer: Buffer;
    originalName: string;
    mimeType: string;
    size: number;
  },
): Promise<{ path: string; url: string; bucket: BucketName }> {
  validateFile(bucket, file.mimeType, file.size);

  const storagePath = buildStoragePath(bucket, userId, file.originalName);

  let { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(storagePath, file.buffer, {
      contentType: file.mimeType,
      upsert: false,
    });

  // Some prod environments missed `ensureStorageBuckets()` at startup
  // (the service_role list call can be RLS-blocked on first deploy), so
  // a freshly added bucket like `receipts` 404s here. Lazily create the
  // bucket with the canonical config and retry once.
  if (error && error.message.toLowerCase().includes("bucket not found")) {
    const created = await ensureBucketExists(bucket);
    if (created) {
      const retry = await supabaseAdmin.storage
        .from(bucket)
        .upload(storagePath, file.buffer, {
          contentType: file.mimeType,
          upsert: false,
        });
      error = retry.error;
    }
  }

  if (error) {
    // The raw Supabase error + the operator hint are developer-facing
    // infra detail — log them for whoever's reading Cloud Run logs, but
    // never surface them in the toast. The end user gets a plain message.
    const hint =
      error.message.includes("row-level security") ||
      error.message.includes("RLS")
        ? " Confirm SUPABASE_SERVICE_ROLE_KEY is the service_role secret (not anon) and run latest DB migrations (storage.objects policy)."
        : error.message.toLowerCase().includes("bucket not found")
          ? ` Create the "${bucket}" bucket in the Supabase Dashboard (Storage → New bucket) or grant service_role permission to manage storage.buckets, then retry.`
          : "";
    logger.error(`Storage upload failed: ${error.message}${hint}`, {
      bucket,
      path: storagePath,
    });
    throw new BadRequestException(
      "We couldn't save your file. Please try again — if it keeps happening, contact support.",
    );
  }

  const url = getPublicUrl(bucket, storagePath);

  return { path: storagePath, url, bucket };
}

/**
 * Upload a base64 encoded file to Supabase Storage.
 */
export async function uploadBase64(
  bucket: BucketName,
  userId: string,
  file: {
    base64: string;
    originalName: string;
    mimeType: string;
  },
): Promise<{ path: string; url: string; bucket: BucketName }> {
  const buffer = Buffer.from(file.base64, "base64");

  return uploadFile(bucket, userId, {
    buffer,
    originalName: file.originalName,
    mimeType: file.mimeType,
    size: buffer.length,
  });
}

/**
 * Delete a file from Supabase Storage.
 */
export async function deleteFile(bucket: string, path: string): Promise<void> {
  const { error } = await supabaseAdmin.storage.from(bucket).remove([path]);

  if (error) {
    logger.error(`Storage delete failed: ${error.message}`, {
      bucket,
      path,
    });
  }
}

/**
 * Create a signed URL for temporary private access.
 */
export async function createSignedUrl(
  bucket: string,
  path: string,
  expiresInSeconds = 3600,
): Promise<string> {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    throw new BadRequestException("Failed to create download URL");
  }

  return data.signedUrl;
}

/**
 * Download a private-bucket object to a Node Buffer using the service-role
 * key (server-side only). Returns the bytes plus the storage-reported MIME
 * type. Used by server-side processing (e.g. AI document parsing) that needs
 * the raw file rather than a client-facing signed URL.
 */
export async function downloadToBuffer(
  bucket: string,
  path: string,
): Promise<{ buffer: Buffer; contentType: string | null }> {
  const { data, error } = await supabaseAdmin.storage
    .from(bucket)
    .download(path);

  if (error || !data) {
    throw new BadRequestException("Failed to download file from storage");
  }

  const arrayBuffer = await data.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType: data.type || null,
  };
}

/**
 * Ensure storage buckets exist (call on startup).
 */
const PUBLIC_BUCKETS: ReadonlySet<string> = new Set([
  "article",
  "avatars",
  "blog",
  "uploads",
]);

export async function ensureStorageBuckets(): Promise<void> {
  if (!isSupabaseConfigured) {
    return;
  }

  const { data: existingBuckets, error: listError } =
    await supabaseAdmin.storage.listBuckets();

  if (listError) {
    logger.error(
      `Failed to list storage buckets: ${listError.message}. ` +
        `Ensure SUPABASE_SERVICE_ROLE_KEY is correct and RLS on storage.buckets allows service_role access.`,
    );
    return;
  }

  const existingNames = new Set(existingBuckets?.map((b) => b.name) ?? []);
  const buckets = Object.values(STORAGE_BUCKETS);

  for (const bucket of buckets) {
    const isPublic = PUBLIC_BUCKETS.has(bucket);
    const opts = {
      public: isPublic,
      fileSizeLimit: MAX_FILE_SIZES[bucket],
      allowedMimeTypes: ALLOWED_MIME_TYPES[bucket],
    };

    if (existingNames.has(bucket)) {
      const { error: updateErr } = await supabaseAdmin.storage.updateBucket(
        bucket,
        opts,
      );
      if (updateErr) {
        logger.warn(
          `Failed to update bucket "${bucket}": ${updateErr.message}`,
        );
      }
    } else {
      const { error } = await supabaseAdmin.storage.createBucket(bucket, opts);
      if (error) {
        logger.error(
          `Failed to create bucket "${bucket}": ${error.message}. ` +
            `Go to Supabase Dashboard > Storage and create the bucket manually, ` +
            `or disable RLS on the storage.buckets table for service_role.`,
        );
      }
    }
  }
}
