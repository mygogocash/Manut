/**
 * Typed environment-variable accessors for the LINE VOOM OAuth scaffold.
 *
 * Required:
 *   - LINE_OAUTH_CLIENT_ID — LINE channel's Channel ID
 *   - LINE_OAUTH_CLIENT_SECRET — LINE channel's Channel Secret
 *
 * Optional:
 *   - LINE_OAUTH_REDIRECT_URI — overrides the default
 *     `${serverOrigin}/oauth/line-voom/callback`. Note the path uses
 *     `line-voom` (with hyphen) to avoid collision with any future
 *     LINE Login (auth-only) flow that might land at `/oauth/line/...`.
 */

export interface LineVoomOAuthEnv {
  clientId?: string;
  clientSecret?: string;
  redirectUriOverride?: string;
}

export function readLineVoomOAuthEnv(): LineVoomOAuthEnv {
  return {
    clientId: process.env.LINE_OAUTH_CLIENT_ID,
    clientSecret: process.env.LINE_OAUTH_CLIENT_SECRET,
    redirectUriOverride: process.env.LINE_OAUTH_REDIRECT_URI,
  };
}

export function isLineVoomOAuthConfigured(): boolean {
  const env = readLineVoomOAuthEnv();
  return Boolean(env.clientId && env.clientSecret);
}
