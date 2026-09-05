/**
 * HMAC-signed action tokens for the ARIA "draft-and-confirm" pattern
 * (ARIA improvement #7, 2026-05-25).
 *
 * Write tools (`submit_leave_request`, future siblings) never execute
 * directly — they emit a signed token that the FE renders inside an
 * `aria-confirm` block. The user clicks Approve, the FE POSTs the
 * token to `/api/aria/confirm-action`, and only then do we mutate
 * state. The token carries the payload, so confirm-action does not
 * need server-side draft storage.
 *
 * Token envelope: `v1:<bodyBase64>:<hmacHex>`
 *   - body: JSON of `{ action, userId, params, exp }`, base64-encoded
 *   - hmac: HMAC-SHA256 over the body using `INTEGRATIONS_TOKEN_KEY`
 *
 * `exp` (Unix seconds) gates against replay after long delays. We
 * default to 10 minutes — long enough for a slow human, short enough
 * to make a leaked token mostly inert by the time anyone notices.
 */
import {
  createHash,
  createHmac,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";

const HMAC_KEY_ENV = "INTEGRATIONS_TOKEN_KEY";
const DEFAULT_TTL_SECONDS = 10 * 60;
const HEX_KEY_PATTERN = /^[0-9a-fA-F]+$/;

/**
 * Resolve the HMAC key. We require the same 64-char hex format as
 * `crypto.ts` (the AES envelope) so the two paths can't drift. A
 * mismatch (`raw.length < 32` was the original, lax gate) silently
 * truncated non-hex input via `Buffer.from(_, "hex")` and produced
 * usable HMAC tokens with near-empty key material.
 */
function getHmacKey(): Buffer {
  const raw = process.env[HMAC_KEY_ENV];
  if (!raw || raw.length !== 64 || !HEX_KEY_PATTERN.test(raw)) {
    throw new Error(
      `${HMAC_KEY_ENV} must be exactly 64 hex chars (256-bit). See packages/utils/scripts/generate-integrations-key.ts.`,
    );
  }
  return Buffer.from(raw, "hex");
}

export interface ActionTokenBody<P = Record<string, unknown>> {
  action: string;
  userId: string;
  params: P;
  /** Unique token id — used for one-shot replay protection. */
  jti: string;
  /** Unix seconds when this token stops being accepted. */
  exp: number;
}

export function signActionToken<P>(
  body: Omit<ActionTokenBody<P>, "exp" | "jti"> & { ttlSeconds?: number },
): string {
  const ttl = body.ttlSeconds ?? DEFAULT_TTL_SECONDS;
  const payload: ActionTokenBody<P> = {
    action: body.action,
    userId: body.userId,
    params: body.params,
    jti: randomUUID(),
    exp: Math.floor(Date.now() / 1000) + ttl,
  };
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json, "utf-8").toString("base64");
  const sig = createHmac("sha256", getHmacKey()).update(b64).digest("hex");
  return `v1:${b64}:${sig}`;
}

export function verifyActionToken<P>(token: string): ActionTokenBody<P> | null {
  const parts = token.split(":");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const b64 = parts[1]!;
  const sig = parts[2]!;
  const expected = createHmac("sha256", getHmacKey()).update(b64).digest("hex");
  if (expected.length !== sig.length) return null;
  if (!timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  try {
    const json = Buffer.from(b64, "base64").toString("utf-8");
    const body = JSON.parse(json) as ActionTokenBody<P>;
    if (typeof body.exp !== "number" || body.exp * 1000 < Date.now()) {
      return null;
    }
    if (typeof body.jti !== "string" || body.jti.length === 0) {
      return null;
    }
    return body;
  } catch {
    return null;
  }
}

/**
 * Returns a SHA-256 hex digest of the full token string. Used as the
 * stable key in the consumed-token cache so we never store the raw
 * token bytes alongside the user-id they unlock.
 */
export function tokenFingerprint(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// ── Replay protection ──────────────────────────────────────────────
//
// One-shot guard against re-submitting the same approval token. Pure
// in-memory because the token TTL is 10 minutes — a server restart in
// that window dropping the cache is acceptable (the user re-drafts).
// Stores `{ jti → expiresAtMs }`. Keep size bounded by lazy-evicting
// on every check.

const consumedJtis = new Map<string, number>();
const MAX_CACHE_SIZE = 10_000;

/**
 * Returns `true` if this jti has never been seen before and reserves
 * it for `ttlSeconds`. Returns `false` if the token was already
 * consumed within its lifetime — caller must reject the request.
 */
export function consumeJti(jti: string, expMillis: number): boolean {
  const now = Date.now();
  // Lazy GC of expired entries on every call. O(n) once the map is
  // populated, but the cap keeps n ≤ 10k; acceptable for this code
  // path frequency.
  if (consumedJtis.size > MAX_CACHE_SIZE) {
    for (const [k, exp] of consumedJtis) {
      if (exp < now) consumedJtis.delete(k);
      if (consumedJtis.size <= MAX_CACHE_SIZE / 2) break;
    }
  }
  const existing = consumedJtis.get(jti);
  if (existing !== undefined && existing > now) return false;
  consumedJtis.set(jti, expMillis);
  return true;
}

/** Test-only: drop all consumed-jti state. */
export function _resetConsumedJtisForTests(): void {
  consumedJtis.clear();
}
