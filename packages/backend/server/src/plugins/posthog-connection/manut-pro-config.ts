/**
 * Typed environment-variable accessors for the PostHog connection scaffold.
 *
 * Optional:
 *   - POSTHOG_DEFAULT_HOST — overrides the built-in default
 *     (`https://app.posthog.com`) for the frontend host placeholder.
 *     Useful for self-hosted PostHog deployments where the workspace
 *     admin wants users to pre-fill the in-house host.
 *
 * Like MongoDB, there is NO required env var here — the connector
 * activates per-workspace when a user provides an API key.
 */

export interface PostHogConnectionEnv {
  defaultHost?: string;
}

export function readPostHogConnectionEnv(): PostHogConnectionEnv {
  return {
    defaultHost: process.env.POSTHOG_DEFAULT_HOST,
  };
}

export function isPostHogConnectionConfigured(): boolean {
  return true;
}
