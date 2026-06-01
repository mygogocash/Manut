/**
 * Threads OAuth scaffold — Threads API (Meta).
 *
 * Scope set: `threads_basic,threads_content_publish`. `threads_basic`
 * grants read access to the user's profile + posts; the
 * `threads_content_publish` scope is INCLUDED in this scaffold per
 * the spec (this is a forward-looking write capability) even though
 * the AI tools that exercise it haven't shipped — write tools would
 * need a separate consent prompt when added so users see the
 * publish-capable nature of the grant.
 *
 * Token model: Threads API returns a short-lived token (~1h). Long-
 * lived (60-day) tokens come from a separate `ig_exchange_token`-style
 * exchange against `https://graph.threads.net/access_token` with
 * `grant_type=th_exchange_token`. Deferred to the live-import follow-up.
 *
 * Note: Threads API is newer than IG/Facebook (rolled out 2024) — the
 * publisher slug + endpoints follow Meta's pattern but the response
 * shapes are NOT identical to Instagram. Test against the live API
 * before assuming field names.
 */

export type ThreadsScope = 'threads';

export const THREADS_OAUTH_SCOPES = 'threads_basic,threads_content_publish';

export const THREADS_PROVIDER_NAME = 'threads';

export interface ThreadsConnectionStatus {
  connected: boolean;
  verified?: boolean;
  healthStatus?: 'saved' | 'verified' | 'expired' | 'error';
  username?: string;
}

export interface ThreadsOAuthStartState {
  userId: string;
  workspaceId: string;
  redirectUri: string;
}

/**
 * Shape returned by https://graph.threads.net/oauth/access_token.
 * Same shape as Instagram Basic Display — a single `access_token` +
 * numeric `user_id`. The Threads API endpoint deliberately mirrors
 * Instagram for SDK reuse.
 */
export interface ThreadsOAuthTokenResponse {
  access_token: string;
  user_id: number;
}

/**
 * Shape returned by https://graph.threads.net/me?fields=id,username,...
 */
export interface ThreadsUserInfoResponse {
  id: string;
  username: string;
  threads_profile_picture_url?: string;
  threads_biography?: string;
}
