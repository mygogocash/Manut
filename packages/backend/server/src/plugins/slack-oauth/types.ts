/**
 * Slack OAuth scaffold — mirrors the GitHub scaffold pattern (CLAUDE.md §6).
 *
 * Single scope set: `channels:read,chat:read,users:read`. One row keyed
 * by `provider = 'slack'` in IntegrationConnection. Scope parameter is
 * present for API symmetry with the Google scaffold even though there's
 * only one value — keeps future scope splits cheap (e.g. a "write" mode
 * with `chat:write` added).
 *
 * Slack token model: bot tokens (`xoxb-...`) returned from
 * `oauth.v2.access` are long-lived and do NOT issue refresh tokens by
 * default. The token rotation feature is opt-in per Slack app; this
 * scaffold treats tokens as durable like the GitHub OAuth Apps path.
 * If we later flip token rotation on for the production Slack app,
 * mirror the Google refresh window (5-minute leeway) here.
 */

export type SlackScope = 'slack';

/**
 * OAuth scope string Slack expects on the authorize URL. The combined
 * `channels:read chat:read users:read` set is sufficient for the AI to
 * list channels, fetch message history, and resolve user mentions —
 * all read-only. Future write tools (post message, react) would extend
 * this string with `chat:write` and require a fresh consent flow.
 */
export const SLACK_OAUTH_SCOPES = 'channels:read,chat:read,users:read';

/**
 * Provider name persisted in `IntegrationConnection.provider`. Single
 * row covers the combined scope set — same single-row pattern as the
 * GitHub scaffold. Splitting (e.g. `slack_readonly` vs `slack_full`)
 * would switch to a `Record<SlackScope, string>` keyed by scope.
 */
export const SLACK_PROVIDER_NAME = 'slack';

export interface SlackConnectionStatus {
  /** True when a stored token row exists for this user+workspace. */
  connected: boolean;
  /**
   * The Slack team name (e.g. "Acme Inc"). Returned for the
   * "Connected to Acme Inc" UI label.
   */
  teamName?: string;
}

export interface SlackOAuthStartState {
  userId: string;
  workspaceId: string;
  redirectUri: string;
}

/**
 * Shape returned by https://slack.com/api/oauth.v2.access. Slack's
 * OAuth v2 response wraps the token info in an `authed_user` /
 * top-level `access_token` split — top-level is the bot token, the
 * nested `authed_user.access_token` is the user token. We persist the
 * bot token (top-level `access_token`) because the read scopes
 * (`channels:read` etc.) are bot-scope grants under OAuth v2.
 *
 * Slack returns `ok: false` with an `error` field on failure rather
 * than a non-2xx HTTP status — the service exchange layer must check
 * `ok` before treating the response as a success.
 */
export interface SlackOAuthTokenResponse {
  ok: boolean;
  error?: string;
  access_token: string;
  token_type: 'bot' | string;
  scope: string;
  bot_user_id?: string;
  app_id?: string;
  team: {
    id: string;
    name: string;
  };
  enterprise?: {
    id: string;
    name: string;
  } | null;
  authed_user: {
    id: string;
    scope?: string;
    access_token?: string;
    token_type?: string;
  };
}

/**
 * Subset of the Slack `users.info` payload we persist for the
 * "Connected as X" label. The full payload contains 30+ fields; we
 * stash only what's needed for the integration card and dedup
 * (`team.id + authed_user.id` as `externalId`).
 */
export interface SlackUserInfoResponse {
  ok: boolean;
  error?: string;
  user: {
    id: string;
    team_id: string;
    name: string;
    real_name?: string;
    profile?: {
      email?: string;
      display_name?: string;
      image_72?: string;
    };
  };
}
