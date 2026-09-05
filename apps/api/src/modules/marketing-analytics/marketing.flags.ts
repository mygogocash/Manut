// Fail-closed ship-dark gate for the Marketing Analytics module family:
// marketing-analytics, marketing-campaigns, marketing-recap and
// marketing-reports.
//
// Why a flag rather than an exclusion. Every `dev` → `main` release so far has
// promoted "everything except Marketing", which means these commits never
// leave `dev`. Combined with releases being squashed (see
// docs/RELEASE_PROCESS.md) that is a ratchet: each release re-proposes the
// same excluded work plus everything new, so the conflict count only grows.
// Gating lets the family travel to `main` inert and be switched on when it is
// signed off, which is what the repo already does for the Fixed Asset
// register.
//
// The four modules mounted unconditionally before this. Permission gates do
// NOT substitute for it: Admin bypasses every permission check
// (auth.service.resolvePermissions), so an admin in production would have
// reached the routes regardless.
//
// Fail-closed on `=== "true"`: unset or mistyped keeps the family hidden
// rather than leaking it. The web half mirrors this with the build-time
// NEXT_PUBLIC_MARKETING_ANALYTICS_ENABLED var — inlined at `next build`, so it
// travels via --build-arg, not runtime --set-env-vars.
export function isMarketingAnalyticsEnabled(): boolean {
  return process.env.MARKETING_ANALYTICS_ENABLED === "true";
}
