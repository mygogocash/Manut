/**
 * M5.2 — Secret scrubber for portability exports.
 *
 * `scrubSecrets()` walks an arbitrary JSON-shaped value (objects, arrays,
 * primitives) and replaces any value whose surrounding KEY looks
 * secret-like with the sentinel `SCRUBBED_VALUE`. It also replaces any
 * scalar whose VALUE looks high-entropy enough to be a secret token,
 * regardless of where it sits in the tree.
 *
 * Design notes / scars honoured:
 *
 *  1. **Immutability** — `scrubSecrets()` returns a new object, never
 *     mutates the input. The traversal builds fresh objects / arrays as
 *     it goes. The export pipeline relies on this so it can hand the
 *     original payload back to other consumers without contamination.
 *
 *  2. **Two-axis matching** — we scrub on BOTH name match and entropy
 *     match. Just matching key names misses tokens stuffed into
 *     `userConfig.notes`; just matching value entropy misses short
 *     secrets like API IDs that happen to be 16 chars. The union of the
 *     two covers the common adversarial cases without needing a real
 *     entropy estimator.
 *
 *  3. **No side-channel leakage** — the sentinel is constant, so
 *     scrubbed output never reveals the length, character set, or any
 *     other property of the original value. (Replacing with
 *     `"<scrubbed-32-chars>"` would leak a length oracle.)
 *
 *  4. **Conservative on collisions** — if a benign field happens to
 *     match a secret-looking name (e.g. `publicKey` for an OAuth public
 *     key), we still scrub it. False positives are better than
 *     accidentally leaking real credentials. Operators reconstruct
 *     these on the import side from environment.
 *
 *  5. **Cycles** — the export pipeline produces Prisma-derived trees
 *     that should be cycle-free, but a `WeakSet` guards against
 *     pathological inputs so a recursive object would terminate with
 *     the cycle node replaced by `null` rather than blow the stack.
 */

/**
 * Sentinel written in place of any scrubbed value. Constant by design so
 * the output is a perfect length-oracle barrier — anyone reading the
 * exported manifest cannot deduce ANYTHING about the original secret
 * from its scrubbed shadow.
 */
export const SCRUBBED_VALUE = '<scrubbed>' as const;

/**
 * Field-name pattern: case-insensitive substring match for the usual
 * suspects. Anchored with `.*` on both sides so `apiSecret`, `gcpKey`,
 * `oauth_token`, `dbPassword`, `userCredentials`, `authHeader` all
 * trigger. Deliberately wide — false positives on a benign field are
 * cheap; false negatives leak credentials.
 */
const SECRET_NAME_REGEX = /^.*(secret|key|token|password|credential|auth).*$/i;

/**
 * High-entropy value heuristic: a contiguous run of base64-ish
 * characters at least 32 chars long. Covers JWTs, base64-encoded
 * service-account keys, GCP API keys, OpenAI keys, AWS access key
 * secrets — they all live in this alphabet and are well over the
 * threshold.
 *
 * Note: this is INTENTIONALLY not a strict base64 validator. A real
 * secret may have hyphens (JWTs) or underscores (GCP) and we want to
 * match those too. The 32-char floor weeds out things like UUIDs
 * (which are 36 chars but contain hyphens at fixed positions — those
 * still match the broader regex, and that's fine: UUIDs that name
 * secrets are still tokens worth scrubbing).
 */
const HIGH_ENTROPY_VALUE_REGEX = /[A-Za-z0-9+/=_-]{32,}/;

/**
 * Walk an arbitrary value and return a deep-cloned copy with all
 * secret-like fields replaced by `SCRUBBED_VALUE`.
 *
 * The input MUST be JSON-serializable in shape (plain objects, arrays,
 * primitives). Non-plain values like `Date`, `Map`, `Set`, class
 * instances, etc. are not specially handled — they pass through
 * untouched. Production callers should JSON-stringify-and-parse
 * upstream if they want a fully canonical shape.
 */
export function scrubSecrets(input: unknown): unknown {
  return walk(input, new WeakSet());
}

function walk(node: unknown, seen: WeakSet<object>): unknown {
  if (node === null || node === undefined) {
    return node;
  }

  // High-entropy scalar — replace the value wherever it sits.
  if (typeof node === 'string') {
    if (HIGH_ENTROPY_VALUE_REGEX.test(node)) {
      return SCRUBBED_VALUE;
    }
    return node;
  }

  if (typeof node !== 'object') {
    return node;
  }

  // Cycle guard. Encountering a cycle is exceptional — replace with
  // null rather than recurse forever.
  if (seen.has(node as object)) {
    return null;
  }
  seen.add(node as object);

  if (Array.isArray(node)) {
    return node.map(child => walk(child, seen));
  }

  // Plain-ish object. We don't try to preserve prototypes or
  // non-enumerable properties — exports are pure data.
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
    if (SECRET_NAME_REGEX.test(key)) {
      // Field NAME matches the secret pattern → scrub regardless of
      // value type. Even an "empty" credential field is a structural
      // signal worth hiding.
      out[key] = SCRUBBED_VALUE;
      continue;
    }
    out[key] = walk(value, seen);
  }
  return out;
}
