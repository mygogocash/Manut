import { ApiError } from "@/lib/api-client";

/**
 * Turn any thrown value into a single human-readable sentence safe to drop
 * straight into `toast.error(...)`.
 *
 * Most backend errors already arrive friendly (the API throws plain-English
 * exception messages, and `api-client` rewrites its own NETWORK_ERROR /
 * PARSE_ERROR strings). This helper is the last mile for call sites:
 *  - surfaces Zod-style field `details` when the server sent them,
 *  - strips developer debug suffixes like " [422 VALIDATION]",
 *  - falls back to a caller-supplied message for unknown throwables
 *    (so a raw "undefined" or "[object Object]" never reaches the user).
 *
 * Prefer this over `err instanceof ApiError ? err.message : "…"` in new code.
 */
export function getErrorMessage(
  err: unknown,
  fallback = "Something went wrong. Please try again.",
): string {
  if (err instanceof ApiError) {
    if (err.details?.length) {
      const fields = err.details
        .map((d) => (d.field ? `${d.field}: ${d.message}` : d.message))
        .filter(Boolean);
      if (fields.length) return clean(fields.join("; "));
    }
    return clean(err.message) || fallback;
  }

  if (err instanceof Error) return clean(err.message) || fallback;
  if (typeof err === "string") return clean(err) || fallback;

  return fallback;
}

/** Drop trailing " [<status> <CODE>]" debug suffixes and tidy whitespace. */
function clean(message: string): string {
  return message.replace(/\s*\[\d{3}\s+[A-Z_]+\]\s*$/, "").trim();
}
