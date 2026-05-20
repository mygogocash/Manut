/**
 * Typed environment-variable accessors for the TikTok OAuth scaffold.
 *
 * Required:
 *   - TIKTOK_OAUTH_CLIENT_ID — mapped to TikTok's `client_key` field
 *     in the authorize URL and token exchange. See `types.ts` header.
 *   - TIKTOK_OAUTH_CLIENT_SECRET — TikTok's `client_secret`.
 *
 * Optional:
 *   - TIKTOK_OAUTH_REDIRECT_URI — overrides the default
 *     `${serverOrigin}/oauth/tiktok/callback`.
 *
 * Naming judgment call: we deliberately keep the env var as
 * `TIKTOK_OAUTH_CLIENT_ID` (not `_CLIENT_KEY`) to match the rest of
 * the OAuth scaffolds — operators configuring 5 providers shouldn't
 * have to remember TikTok's one-off naming. The mapping happens at
 * the URL construction site in `tiktok-oauth.service.ts`.
 */

export interface TiktokOAuthEnv {
  /** Stored as TikTok's `client_key`. See types.ts header. */
  clientId?: string;
  clientSecret?: string;
  redirectUriOverride?: string;
}

export function readTiktokOAuthEnv(): TiktokOAuthEnv {
  return {
    clientId: process.env.TIKTOK_OAUTH_CLIENT_ID,
    clientSecret: process.env.TIKTOK_OAUTH_CLIENT_SECRET,
    redirectUriOverride: process.env.TIKTOK_OAUTH_REDIRECT_URI,
  };
}

export function isTiktokOAuthConfigured(): boolean {
  const env = readTiktokOAuthEnv();
  return Boolean(env.clientId && env.clientSecret);
}
