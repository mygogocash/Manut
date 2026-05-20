/**
 * Linear OAuth scaffold — mirrors the GitHub scaffold pattern (CLAUDE.md §6).
 *
 * Single scope: `read`. One row keyed by `provider = 'linear'` in
 * IntegrationConnection. Scope parameter is present for API symmetry
 * with the Google scaffold even though there's only one value — keeps
 * future scope splits cheap (e.g. an "admin" mode that also reads
 * organization data).
 *
 * Linear token model: Linear OAuth issues access tokens with an
 * `expires_in` of 315360000 seconds (~10 years) by default; refresh
 * tokens are issued ONLY when the authorize URL includes
 * `prompt=consent`. We omit prompt=consent in this scaffold because
 * the long-lived access token is sufficient for read-only access and
 * matches the GitHub OAuth Apps model (long-lived, surface
 * "reconnect" toast on 401).
 */

export type LinearScope = 'linear';

/**
 * OAuth scope string Linear expects on the authorize URL. The `read`
 * scope grants read access to issues, projects, teams, comments, and
 * cycles — sufficient for any future AI tool that surfaces Linear
 * issues to the chat panel. Write scopes (`issues:create`,
 * `comments:create`, `admin`) would require a fresh consent flow.
 */
export const LINEAR_OAUTH_SCOPES = 'read';

/**
 * Provider name persisted in `IntegrationConnection.provider`. Single
 * row covers the combined scope set — same single-row pattern as the
 * GitHub scaffold. Splitting (e.g. `linear_readonly` vs `linear_full`)
 * would switch to a `Record<LinearScope, string>` keyed by scope.
 */
export const LINEAR_PROVIDER_NAME = 'linear';

export interface LinearConnectionStatus {
  /** True when a stored token row exists for this user+workspace. */
  connected: boolean;
  /**
   * The Linear user display name (e.g. "Alice Smith"). Returned for
   * the "Connected as Alice Smith" UI label.
   */
  displayName?: string;
  /**
   * The Linear organization name (e.g. "Acme Inc"). Linear scopes
   * tokens to a single org — surfacing this prevents confusion when
   * a user is in multiple orgs.
   */
  organizationName?: string;
}

export interface LinearOAuthStartState {
  userId: string;
  workspaceId: string;
  redirectUri: string;
}

/**
 * Shape returned by https://api.linear.app/oauth/token. Linear's OAuth
 * v2 implementation follows the standard RFC 6749 token response:
 * `access_token`, `token_type`, `expires_in`, optional `refresh_token`.
 *
 * Refresh tokens are issued only when `prompt=consent` is on the
 * authorize URL. This scaffold omits prompt=consent — Linear's
 * long-lived (~10y) access tokens make refresh unnecessary for the
 * read-only path.
 */
export interface LinearOAuthTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: 'Bearer' | string;
}

/**
 * Subset of the Linear GraphQL `viewer` query response we persist for
 * the "Connected as X" label. The full `User` type contains 40+
 * fields; we stash only what's needed for the integration card and
 * dedup (`user.id` as `externalId`).
 */
export interface LinearViewerResponse {
  data?: {
    viewer: {
      id: string;
      name: string;
      displayName?: string;
      email: string;
      avatarUrl?: string;
      organization: {
        id: string;
        name: string;
        urlKey: string;
      };
    };
  };
  errors?: Array<{ message: string }>;
}
