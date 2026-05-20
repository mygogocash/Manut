/**
 * Typed environment-variable accessors for the Linear OAuth scaffold.
 *
 * Mirrors `github-oauth/manut-pro-config.ts`. The accessors return
 * `undefined` when an env var is unset rather than throwing — the
 * service layer translates "not configured" into the typed
 * `LinearOAuthNotConfiguredError`.
 *
 * Required:
 *   - LINEAR_OAUTH_CLIENT_ID
 *   - LINEAR_OAUTH_CLIENT_SECRET
 *
 * Optional:
 *   - LINEAR_OAUTH_REDIRECT_URI — overrides the default
 *     `${serverOrigin}/oauth/linear/callback`. Useful for dev where
 *     the public origin (ngrok tunnel) differs from the AFFiNE server
 *     base URL.
 */

export interface LinearOAuthEnv {
  clientId?: string;
  clientSecret?: string;
  redirectUriOverride?: string;
}

export function readLinearOAuthEnv(): LinearOAuthEnv {
  return {
    clientId: process.env.LINEAR_OAUTH_CLIENT_ID,
    clientSecret: process.env.LINEAR_OAUTH_CLIENT_SECRET,
    redirectUriOverride: process.env.LINEAR_OAUTH_REDIRECT_URI,
  };
}

export function isLinearOAuthConfigured(): boolean {
  const env = readLinearOAuthEnv();
  return Boolean(env.clientId && env.clientSecret);
}
