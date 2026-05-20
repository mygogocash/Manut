/**
 * Typed environment-variable accessors for the Instagram OAuth scaffold.
 *
 * Required:
 *   - IG_OAUTH_CLIENT_ID
 *   - IG_OAUTH_CLIENT_SECRET
 *
 * Optional:
 *   - IG_OAUTH_REDIRECT_URI — overrides the default
 *     `${serverOrigin}/oauth/instagram/callback`.
 *
 * Note: Instagram OAuth is configured separately from Facebook OAuth
 * even though both are Meta — they use different App IDs in the
 * Meta for Developers console. Don't conflate `FB_*` and `IG_*` env
 * vars even if testing against the same Meta App.
 */

export interface InstagramOAuthEnv {
  clientId?: string;
  clientSecret?: string;
  redirectUriOverride?: string;
}

export function readInstagramOAuthEnv(): InstagramOAuthEnv {
  return {
    clientId: process.env.IG_OAUTH_CLIENT_ID,
    clientSecret: process.env.IG_OAUTH_CLIENT_SECRET,
    redirectUriOverride: process.env.IG_OAUTH_REDIRECT_URI,
  };
}

export function isInstagramOAuthConfigured(): boolean {
  const env = readInstagramOAuthEnv();
  return Boolean(env.clientId && env.clientSecret);
}
