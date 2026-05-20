/**
 * Typed environment-variable accessors for the Threads OAuth scaffold.
 *
 * Required:
 *   - THREADS_OAUTH_CLIENT_ID
 *   - THREADS_OAUTH_CLIENT_SECRET
 *
 * Optional:
 *   - THREADS_OAUTH_REDIRECT_URI — overrides the default
 *     `${serverOrigin}/oauth/threads/callback`.
 *
 * Threads has its own App in Meta for Developers — separate from
 * Facebook and Instagram even though all three are Meta products.
 * Don't conflate `IG_*` and `THREADS_*` env vars.
 */

export interface ThreadsOAuthEnv {
  clientId?: string;
  clientSecret?: string;
  redirectUriOverride?: string;
}

export function readThreadsOAuthEnv(): ThreadsOAuthEnv {
  return {
    clientId: process.env.THREADS_OAUTH_CLIENT_ID,
    clientSecret: process.env.THREADS_OAUTH_CLIENT_SECRET,
    redirectUriOverride: process.env.THREADS_OAUTH_REDIRECT_URI,
  };
}

export function isThreadsOAuthConfigured(): boolean {
  const env = readThreadsOAuthEnv();
  return Boolean(env.clientId && env.clientSecret);
}
