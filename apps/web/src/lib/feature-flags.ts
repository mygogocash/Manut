/**
 * Build-time ship-dark flags.
 *
 * `NEXT_PUBLIC_*` is inlined by `next build`, so these travel as
 * `--build-arg` into `docker/Dockerfile.web` — a runtime `--set-env-vars` is
 * too late and would leave the value empty. Every flag fail-closes on
 * `=== "true"`: unset or mistyped hides the feature rather than leaking it.
 */

/**
 * Marketing Analytics family (Analytics, Partner Workspaces, Traffic,
 * DAU/MAU, Campaign CRM, Analytics & Reports).
 *
 * Mirrors the API's `MARKETING_ANALYTICS_ENABLED`. Both halves are required:
 * this one hides the nav and the routes, the API one refuses to mount them.
 * Hiding only the nav would leave the pages reachable by URL.
 *
 * Note this does NOT gate `/partners` — the original Marketing module is
 * already in production and stays visible, which is also what keeps the
 * "Marketing CRM" parent in the sidebar when the family is dark.
 */
export const MARKETING_ANALYTICS_ENABLED =
  process.env.NEXT_PUBLIC_MARKETING_ANALYTICS_ENABLED === "true";
