/**
 * Typed environment-variable accessors for the GitHub OAuth scaffold.
 *
 * Mirrors the implicit `process.env` reads inside `google-oauth.service.ts`
 * but lifts them into a single typed helper so we can grep for the env
 * surface in one place and add unit-test escape hatches without
 * scattering `process.env` reads through the service.
 *
 * Required:
 *   - GITHUB_OAUTH_CLIENT_ID
 *   - GITHUB_OAUTH_CLIENT_SECRET
 *
 * Optional:
 *   - GITHUB_OAUTH_REDIRECT_URI — overrides the default
 *     `${serverOrigin}/oauth/github/callback`. Useful for dev where
 *     the public origin (ngrok tunnel) differs from the AFFiNE server
 *     base URL.
 *
 * The accessors return `undefined` when the env var is unset rather
 * than throwing — the service layer is responsible for translating
 * "not configured" into the typed `GithubOAuthNotConfiguredError`.
 */

export interface GithubOAuthEnv {
  clientId?: string;
  clientSecret?: string;
  redirectUriOverride?: string;
}

export function readGithubOAuthEnv(): GithubOAuthEnv {
  return {
    clientId: process.env.GITHUB_OAUTH_CLIENT_ID,
    clientSecret: process.env.GITHUB_OAUTH_CLIENT_SECRET,
    redirectUriOverride: process.env.GITHUB_OAUTH_REDIRECT_URI,
  };
}

export function isGithubOAuthConfigured(): boolean {
  const env = readGithubOAuthEnv();
  return Boolean(env.clientId && env.clientSecret);
}
