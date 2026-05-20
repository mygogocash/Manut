/**
 * Instagram OAuth scaffold — Basic Display API (Meta).
 *
 * Single scope set: `user_profile,user_media`. Read-only. Sufficient
 * for the AI to read the connected user's profile + media. One row
 * keyed by `provider = 'instagram'` in IntegrationConnection.
 *
 * Token model: `/oauth/access_token` returns a short-lived token
 * (~1h). Long-lived (60-day) tokens come from a separate exchange
 * against `https://graph.instagram.com/access_token?grant_type=ig_exchange_token`.
 * The scaffold persists the short-lived token; live-import flows
 * should perform the exchange before storing if 60-day persistence is
 * needed. NOTE: Instagram Basic Display API is the consumer path;
 * Business / Creator accounts integrate via Facebook Graph (use the
 * facebook-oauth scaffold for those).
 */

export type InstagramScope = 'instagram';

export const INSTAGRAM_OAUTH_SCOPES = 'user_profile,user_media';

export const INSTAGRAM_PROVIDER_NAME = 'instagram';

export interface InstagramConnectionStatus {
  connected: boolean;
  username?: string;
}

export interface InstagramOAuthStartState {
  userId: string;
  workspaceId: string;
  redirectUri: string;
}

/**
 * Shape returned by https://api.instagram.com/oauth/access_token.
 * Note the response uses snake_case `user_id` (numeric) — distinct
 * from Facebook Graph API's response shape even though both are Meta.
 */
export interface InstagramOAuthTokenResponse {
  access_token: string;
  user_id: number;
}

/**
 * Shape returned by https://graph.instagram.com/me?fields=id,username
 * — the authoritative profile probe for Basic Display API. We persist
 * the alphanumeric `id` as `externalId` and `username` for the UI
 * label.
 */
export interface InstagramUserInfoResponse {
  id: string;
  username: string;
  account_type?: 'PERSONAL' | 'BUSINESS' | 'CREATOR';
  media_count?: number;
}
