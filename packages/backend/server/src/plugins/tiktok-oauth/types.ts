/**
 * TikTok OAuth scaffold — TikTok for Developers v2 API.
 *
 * IMPORTANT TikTok quirk: TikTok's OAuth uses `client_key` on the
 * authorize URL where every other OAuth provider uses `client_id`.
 * The token endpoint also accepts `client_key`. We map our env var
 * `TIKTOK_OAUTH_CLIENT_ID` to TikTok's `client_key` field at the
 * URL/body construction site to keep the env var name consistent with
 * the rest of the scaffolds — see service `initiateOAuth` /
 * `exchangeCode`. Don't rename the env var to `TIKTOK_CLIENT_KEY` —
 * we deliberately normalise on `_CLIENT_ID` so deployment configs
 * have one consistent name shape across all 5 OAuth scaffolds.
 *
 * Scope set: `user.info.basic,video.list`. Both are read-only — basic
 * profile + listing the user's uploaded videos. Future write tools
 * (`video.publish`, `video.upload`) would require additional consent.
 *
 * Token model: TikTok DOES issue refresh tokens, but their lifetime
 * is also bounded (~365 days for refresh, ~24h for access). For the
 * scaffold we persist both; live-import paths should mirror the
 * Google `getValidAccessToken` 5-minute leeway pattern when AI tools
 * ship.
 */

export type TiktokScope = 'tiktok';

/**
 * Scope string TikTok expects on the authorize URL. TikTok uses
 * comma-delimited scopes (matches Instagram/Threads style).
 */
export const TIKTOK_OAUTH_SCOPES = 'user.info.basic,video.list';

export const TIKTOK_PROVIDER_NAME = 'tiktok';

export interface TiktokConnectionStatus {
  connected: boolean;
  verified?: boolean;
  healthStatus?: 'saved' | 'verified' | 'expired' | 'error';
  displayName?: string;
}

export interface TiktokOAuthStartState {
  userId: string;
  workspaceId: string;
  redirectUri: string;
}

/**
 * Shape returned by https://open.tiktokapis.com/v2/oauth/token/.
 *
 * Unlike Facebook/Instagram, TikTok's token endpoint returns a
 * refresh token — the AI tools layer should use it for the 24h
 * access-token rotation pattern (mirrors Google's refresh flow).
 *
 * The `open_id` is TikTok's user-stable identifier; the per-app
 * `open_id` is required for downstream `/v2/user/info/` calls.
 */
export interface TiktokOAuthTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  refresh_expires_in: number;
  /** TikTok's app-scoped user identifier. */
  open_id: string;
  scope: string;
  token_type: 'Bearer' | string;
}

/**
 * Shape returned by https://open.tiktokapis.com/v2/user/info/. Subset
 * of the full payload — TikTok requires explicit `fields=` query.
 */
export interface TiktokUserInfoResponse {
  data: {
    user: {
      open_id: string;
      union_id?: string;
      avatar_url?: string;
      display_name: string;
      bio_description?: string;
      profile_deep_link?: string;
      username?: string;
    };
  };
  error: {
    code: string;
    message?: string;
    log_id?: string;
  };
}
