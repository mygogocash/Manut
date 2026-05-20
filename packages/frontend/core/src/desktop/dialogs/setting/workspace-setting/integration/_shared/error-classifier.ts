/**
 * Shared classifier for "<provider> OAuth client is not configured"
 * failure modes. Hoisted out of the per-provider panels because every
 * connector has the same wrapping problem:
 *
 *   1. The service throws a typed `<Provider>OAuthNotConfiguredError`.
 *   2. The resolver's `rethrowFriendly` rewrites it into a plain
 *      `Error` with a deterministic message body that names the env
 *      vars (e.g. "Set FB_OAUTH_CLIENT_ID and FB_OAUTH_CLIENT_SECRET").
 *   3. NestJS wraps the rethrown `Error` as INTERNAL_SERVER_ERROR
 *      before it reaches the frontend, so the typed `name` is lost.
 *
 * The only signal that survives the wrap is the message body. Matching
 * on substrings of the env var names (or the literal phrase "is not
 * configured") is intentional: it covers both the resolver's friendly
 * rewrite ("FB_OAUTH_CLIENT_ID") and the service-thrown raw message
 * ("Facebook OAuth client is not configured"). If either string moves,
 * this classifier degrades to "generic error" — never a false positive.
 *
 * MANUT v1.13.x: extracted from `integration/github/setting-panel.tsx`
 * so every connector card uses the same gating logic. See CLAUDE.md §6
 * scars (v1.7.0 / v1.10.2 `UndefinedTypeError`) for why the typed
 * `name` is unreliable across the network boundary.
 */
export function looksLikeNotConfigured(
  err: unknown,
  envVars: readonly string[]
): boolean {
  if (!err || typeof err !== 'object') return false;
  const candidate = err as { message?: unknown; name?: unknown };

  // Best-effort typed-name match for callers running inside the same
  // process as the service. Always check the message substring as well
  // because the resolver wraps errors before they leave the server.
  const name = typeof candidate.name === 'string' ? candidate.name : '';
  if (name.endsWith('OAuthNotConfiguredError')) return true;

  const message =
    typeof candidate.message === 'string' ? candidate.message : '';
  if (!message) return false;

  // The friendly resolver message always contains the literal env var
  // names; this is the load-bearing match.
  for (const envVar of envVars) {
    if (message.includes(envVar)) return true;
  }

  // Defensive: catches the raw service-thrown message even if a future
  // refactor accidentally drops the env-var names from the friendly
  // rewrite.
  return message.includes('OAuth client is not configured');
}
