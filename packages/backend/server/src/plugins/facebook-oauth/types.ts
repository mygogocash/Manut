/**
 * Facebook OAuth scaffold — mirrors the GitHub / Slack scaffolds (CLAUDE.md §6).
 *
 * Single scope set: `pages_read_engagement,pages_show_list`. Sufficient
 * for the AI to enumerate Pages the user manages and read engagement
 * metrics (reach, impressions, reactions). One row keyed by
 * `provider = 'facebook'` in IntegrationConnection.
 *
 * Token model: Facebook Graph API returns a short-lived user access
 * token by default (~1 hour). For a long-lived token (60-day) we'd
 * need a second exchange against `/oauth/access_token?grant_type=fb_exchange_token`.
 * This scaffold persists the short-lived token; live-import paths
 * should call the exchange before storing if 60-day persistence is
 * needed. Refresh-on-use is NOT supported by Graph API — staleness
 * after 60 days requires a fresh consent flow.
 */

export type FacebookScope = 'facebook';

/**
 * OAuth scope string Facebook expects on the authorize URL. The
 * `pages_read_engagement` + `pages_show_list` combination lets the AI
 * list the user's Pages and read engagement metrics — all read-only.
 * Future write tools (publish a post, react) would require additional
 * consent (e.g. `pages_manage_posts`) and a Facebook App Review.
 */
export const FACEBOOK_OAUTH_SCOPES = 'pages_read_engagement,pages_show_list';

/**
 * Provider name persisted in `IntegrationConnection.provider`. Single
 * row covers the combined scope set — same pattern as the GitHub and
 * Slack scaffolds.
 */
export const FACEBOOK_PROVIDER_NAME = 'facebook';

export interface FacebookConnectionStatus {
  /** True when a stored token row exists for this user+workspace. */
  connected: boolean;
  /** True only when the mirrored analytics SocialConnection is ACTIVE. */
  verified?: boolean;
  /** Saved means credentials exist but the analytics mirror is missing/paused. */
  healthStatus?: 'saved' | 'verified' | 'expired' | 'error';
  /**
   * The Facebook account display name (e.g. "Jane Doe" or a Page
   * name). Returned for the "Connected as Jane Doe" UI label.
   */
  displayName?: string;
}

export interface FacebookOAuthStartState {
  userId: string;
  workspaceId: string;
  redirectUri: string;
}

/**
 * Shape returned by https://graph.facebook.com/v18.0/oauth/access_token
 * when exchanging a code. Graph API does NOT issue refresh tokens; the
 * short-lived token is rotated by re-exchanging via
 * `grant_type=fb_exchange_token`, which we defer to the live-import
 * follow-up.
 */
export interface FacebookOAuthTokenResponse {
  access_token: string;
  token_type: 'bearer' | string;
  /**
   * Seconds until expiry. Absent on long-lived tokens that have been
   * exchanged via `grant_type=fb_exchange_token` (those carry a
   * `5183999`-ish window for 60 days).
   */
  expires_in?: number;
}

/**
 * Subset of the Facebook `/me` payload we persist for the
 * "Connected as X" label. The full payload contains 30+ fields; we
 * stash only what's needed for the integration card and dedup
 * (numeric `id` as `externalId`).
 */
export interface FacebookUserInfoResponse {
  id: string;
  name: string;
  email?: string;
  picture?: {
    data: {
      url: string;
    };
  };
}
