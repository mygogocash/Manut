/**
 * Typed environment-variable accessors for the Slack OAuth scaffold.
 *
 * Mirrors `github-oauth/manut-pro-config.ts`. The accessors return
 * `undefined` when an env var is unset rather than throwing — the
 * service layer translates "not configured" into the typed
 * `SlackOAuthNotConfiguredError`.
 *
 * Required:
 *   - SLACK_OAUTH_CLIENT_ID
 *   - SLACK_OAUTH_CLIENT_SECRET
 *
 * Optional:
 *   - SLACK_OAUTH_REDIRECT_URI — overrides the default
 *     `${serverOrigin}/oauth/slack/callback`. Useful for dev where
 *     the public origin (ngrok tunnel) differs from the AFFiNE server
 *     base URL.
 */

export interface SlackOAuthEnv {
  clientId?: string;
  clientSecret?: string;
  redirectUriOverride?: string;
}

export function readSlackOAuthEnv(): SlackOAuthEnv {
  return {
    clientId: process.env.SLACK_OAUTH_CLIENT_ID,
    clientSecret: process.env.SLACK_OAUTH_CLIENT_SECRET,
    redirectUriOverride: process.env.SLACK_OAUTH_REDIRECT_URI,
  };
}

export function isSlackOAuthConfigured(): boolean {
  const env = readSlackOAuthEnv();
  return Boolean(env.clientId && env.clientSecret);
}
