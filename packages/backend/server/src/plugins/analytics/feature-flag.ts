/**
 * Feature-flag predicate for the Manut analytics module.
 *
 * Default-on for Manut self-hosted (DEPLOYMENT_TYPE=selfhosted): the
 * Analytics · Connections settings panel is the user-visible feature
 * shipped here, and forcing every selfhosted operator to set an env var
 * would mean every fresh boot surfaces "Unhandled error raised" on the
 * panel because the GraphQL schema is missing `connections` /
 * `beginPlatformConnect`.
 *
 * The predicate honors the same default as the `Env` class — when the
 * DEPLOYMENT_TYPE env var is unset, production deployments default to
 * `selfhosted` (matching what `/info` reports). Reading
 * `process.env.DEPLOYMENT_TYPE` directly here would diverge from that
 * default and silently disable the module on bare compose files, which
 * is what bit `manut.gogocash.co` until this fix.
 *
 * Explicit `ENABLE_ANALYTICS_MODULE=true` / `=false` always wins; only
 * the empty / unset case falls through to the selfhosted default.
 *
 * Kept in a standalone file (no NestJS imports) so the predicate is
 * unit-testable without bringing in the full module's napi-bound graph.
 */
export function isAnalyticsModuleEnabled(): boolean {
  const flag = process.env.ENABLE_ANALYTICS_MODULE;
  if (flag === 'true') return true;
  if (flag === 'false') return false;
  return globalThis.env.selfhosted;
}
