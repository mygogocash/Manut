/**
 * Typed environment-variable accessors for the Figma OAuth scaffold.
 *
 * Mirrors `github-oauth/manut-pro-config.ts`. The accessors return
 * `undefined` when an env var is unset rather than throwing — the
 * service layer translates "not configured" into the typed
 * `FigmaOAuthNotConfiguredError`.
 *
 * Required:
 *   - FIGMA_OAUTH_CLIENT_ID
 *   - FIGMA_OAUTH_CLIENT_SECRET
 *
 * Optional:
 *   - FIGMA_OAUTH_REDIRECT_URI — overrides the default
 *     `${serverOrigin}/oauth/figma/callback`. Useful for dev where
 *     the public origin (ngrok tunnel) differs from the AFFiNE server
 *     base URL.
 */

export interface FigmaOAuthEnv {
  clientId?: string;
  clientSecret?: string;
  redirectUriOverride?: string;
}

export function readFigmaOAuthEnv(): FigmaOAuthEnv {
  return {
    clientId: process.env.FIGMA_OAUTH_CLIENT_ID,
    clientSecret: process.env.FIGMA_OAUTH_CLIENT_SECRET,
    redirectUriOverride: process.env.FIGMA_OAUTH_REDIRECT_URI,
  };
}

export function isFigmaOAuthConfigured(): boolean {
  const env = readFigmaOAuthEnv();
  return Boolean(env.clientId && env.clientSecret);
}
