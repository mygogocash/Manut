/**
 * LINE VOOM OAuth scaffold — LINE Login v2.1.
 *
 * Scope set: `profile openid`. The `profile` scope returns the user's
 * LINE display name + picture; `openid` returns the LINE user ID
 * (`sub` claim in the ID token) which we persist as `externalId`. Both
 * scopes are read-only; future VOOM-specific analytics scopes (when
 * LINE publishes them) would be added here.
 *
 * Token model: LINE Login v2.1 returns access token, ID token, and
 * refresh token. Access tokens last 30 days; refresh tokens last 90
 * days. The scaffold persists both — refresh-on-use will be added in
 * the AI-tools follow-up.
 *
 * NOTE: LINE VOOM analytics (impression / reaction metrics) currently
 * require a separate LINE Official Account (OA) Manager API key, NOT
 * a user OAuth grant. This scaffold implements the user-consent path
 * because (a) it's the discoverable analog of the other 5 OAuth
 * scaffolds, and (b) personal LINE accounts can already pull their
 * own profile + posts. When VOOM analytics graduate to a user-grant
 * scope, this scaffold extends naturally; otherwise the OA Manager
 * path would be a separate plugin (api-key, not OAuth — model on the
 * gogocash-connection scaffold).
 */

export type LineVoomScope = 'line-voom';

export const LINE_VOOM_OAUTH_SCOPES = 'profile openid';

export const LINE_VOOM_PROVIDER_NAME = 'line-voom';

export interface LineVoomConnectionStatus {
  connected: boolean;
  displayName?: string;
}

export interface LineVoomOAuthStartState {
  userId: string;
  workspaceId: string;
  redirectUri: string;
  nonce: string;
}

/**
 * Shape returned by https://api.line.me/oauth2/v2.1/token.
 */
export interface LineVoomOAuthTokenResponse {
  access_token: string;
  expires_in: number;
  refresh_token: string;
  id_token?: string;
  scope: string;
  token_type: 'Bearer' | string;
}

/**
 * Shape returned by https://api.line.me/v2/profile.
 */
export interface LineVoomProfileResponse {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
}
