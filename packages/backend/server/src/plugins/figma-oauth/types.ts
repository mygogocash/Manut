/**
 * Figma OAuth scaffold — mirrors the GitHub scaffold pattern (CLAUDE.md §6).
 *
 * Single scope: `file_read` (Figma's documented scope name as of
 * 2024-Q4 — note: Figma historically used `files:read` and some docs
 * still reference it; the production-supported value is `file_read`).
 * One row keyed by `provider = 'figma'` in IntegrationConnection.
 * Scope parameter is present for API symmetry with the Google
 * scaffold even though there's only one value — keeps future scope
 * splits cheap (e.g. a comment-write scope).
 *
 * Figma token model: Figma OAuth issues access tokens with a 90-day
 * `expires_in` AND refresh tokens. Unlike GitHub OAuth Apps, Figma
 * tokens DO expire and require refresh. This scaffold persists the
 * refresh token; when the AI tools ship they'll need to mirror the
 * Google scaffold's 5-minute leeway refresh pattern.
 */

export type FigmaScope = 'figma';

/**
 * OAuth scope string Figma expects on the authorize URL. `file_read`
 * grants read access to files, file metadata, comments, components,
 * and styles for files the user has access to. Write scopes (such as
 * `file_comments:write`) would require a fresh consent flow.
 *
 * Note: Figma docs use both `file_read` (canonical, OAuth2 form) and
 * legacy `files:read` in different places. Use `file_read` —
 * confirmed working as of v3 OAuth.
 */
export const FIGMA_OAUTH_SCOPES = 'file_read';

/**
 * Provider name persisted in `IntegrationConnection.provider`. Single
 * row covers the combined scope set — same single-row pattern as the
 * GitHub scaffold.
 */
export const FIGMA_PROVIDER_NAME = 'figma';

export interface FigmaConnectionStatus {
  /** True when a stored token row exists for this user+workspace. */
  connected: boolean;
  /**
   * The Figma user handle (e.g. "alice"). Returned for the
   * "Connected as alice" UI label.
   */
  handle?: string;
  /**
   * The Figma email. Returned alongside handle for disambiguation
   * since Figma handles aren't always unique across organizations.
   */
  email?: string;
}

export interface FigmaOAuthStartState {
  userId: string;
  workspaceId: string;
  redirectUri: string;
}

/**
 * Shape returned by https://www.figma.com/api/oauth/token. Figma's
 * OAuth implementation follows RFC 6749 with `expires_in` typically
 * set to 90 days (~7776000 seconds) and a refresh_token that doesn't
 * rotate by default.
 *
 * The 90-day expiry is short enough that lazy "reconnect on 401" UX
 * would be visible to users; the AI-tool layer (when shipped) should
 * proactively refresh inside the 5-minute leeway window, mirroring
 * the Google scaffold pattern.
 */
export interface FigmaOAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user_id?: string;
  /**
   * Figma's docs sometimes omit `token_type` from the response —
   * keep optional so the parse doesn't fail if Figma trims it.
   */
  token_type?: 'Bearer' | string;
  scope?: string;
}

/**
 * Subset of the Figma `/v1/me` payload we persist for the
 * "Connected as X" label. The full payload is small (~5 fields) so
 * we capture all of it for forward-compat with future UI.
 */
export interface FigmaUserInfoResponse {
  id: string;
  email: string;
  handle: string;
  img_url?: string;
}
