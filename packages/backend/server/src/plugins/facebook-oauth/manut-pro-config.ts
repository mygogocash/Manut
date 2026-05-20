/**
 * Typed environment-variable accessors for the Facebook OAuth scaffold.
 *
 * Mirrors `slack-oauth/manut-pro-config.ts`. The accessors return
 * `undefined` when an env var is unset rather than throwing — the
 * service layer translates "not configured" into the typed
 * `FacebookOAuthNotConfiguredError`.
 *
 * Required:
 *   - FB_OAUTH_CLIENT_ID
 *   - FB_OAUTH_CLIENT_SECRET
 *
 * Optional:
 *   - FB_OAUTH_REDIRECT_URI — overrides the default
 *     `${serverOrigin}/oauth/facebook/callback`. Useful for dev where
 *     the public origin (ngrok tunnel) differs from the AFFiNE server
 *     base URL.
 *
 * Note: We use `FB_*` prefix (not `FACEBOOK_*`) to match Meta's own
 * SDK conventions and to keep env var names short for deployment
 * config files.
 */

export interface FacebookOAuthEnv {
  clientId?: string;
  clientSecret?: string;
  redirectUriOverride?: string;
}

export function readFacebookOAuthEnv(): FacebookOAuthEnv {
  return {
    clientId: process.env.FB_OAUTH_CLIENT_ID,
    clientSecret: process.env.FB_OAUTH_CLIENT_SECRET,
    redirectUriOverride: process.env.FB_OAUTH_REDIRECT_URI,
  };
}

export function isFacebookOAuthConfigured(): boolean {
  const env = readFacebookOAuthEnv();
  return Boolean(env.clientId && env.clientSecret);
}
