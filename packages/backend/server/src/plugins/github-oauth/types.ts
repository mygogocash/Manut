/**
 * M2 E2.1 — GitHub OAuth scaffold (v1.13.x).
 *
 * Mirrors the v1.10.1 Google OAuth scaffold (see CLAUDE.md §6, "Google
 * OAuth (Gmail / Drive integrations) — v1.10.1 is SCAFFOLD ONLY"): the
 * connect/disconnect plumbing is wired end-to-end (GraphQL mutation
 * `connectGithub` returns a consent URL, the callback at
 * `/oauth/github/callback` exchanges the code and persists the token
 * (encrypted) into the existing `IntegrationConnection` table — no
 * Prisma migration needed), and the AI-callable tools that exercise it
 * live in `plugins/copilot/tools/github.ts`. Live "import a GitHub
 * issue as a doc" UX is not shipped; the integration card surfaces a
 * "Live import is rolling out soon" footer.
 *
 * Single scope for v1.13.0 — `read:user repo` — issued as one GitHub
 * Apps consent. We persist it as a single `IntegrationConnection` row
 * keyed by `provider = 'github'`. Separate scopes (e.g. just `read:user`
 * for a future "GitHub identity-only" mode) would be added by mirroring
 * the GoogleScope dual-row pattern.
 */
export type GithubScope = 'repo';

/**
 * OAuth scope string GitHub expects on the authorize URL. `read:user`
 * is required for the user identity probe; `repo` grants both private
 * + public repo read (needed for `search_issues` against private orgs
 * that the user is a member of).
 */
export const GITHUB_OAUTH_SCOPES = 'read:user repo';

/**
 * Provider name persisted in `IntegrationConnection.provider`. A
 * single row covers the combined scope set. If we ever split scopes
 * (e.g. `github_readonly` vs `github_full`) we'd switch to a record
 * keyed by GithubScope — same pattern as `GOOGLE_PROVIDER_NAME`.
 */
export const GITHUB_PROVIDER_NAME = 'github';

export interface GithubConnectionStatus {
  /** True when a stored token row exists for this user+workspace. */
  connected: boolean;
  /**
   * The GitHub login (e.g. `octocat`). Returned for the "Connected as
   * octocat" UI label.
   */
  login?: string;
}

export interface GithubOAuthStartState {
  userId: string;
  workspaceId: string;
  redirectUri: string;
}

/**
 * Shape returned by https://github.com/login/oauth/access_token when
 * `Accept: application/json` is set. GitHub OAuth Apps do NOT issue
 * refresh tokens by default; we get a long-lived `access_token` and
 * rely on re-connect prompts on 401. GitHub Apps (different product)
 * issue 8-hour tokens + refresh tokens, but that path isn't used here
 * — we ship as an OAuth App for the simpler consent UX.
 */
export interface GithubOAuthTokenResponse {
  access_token: string;
  scope: string;
  token_type: 'bearer' | string;
  /** Only present on GitHub Apps installations, not OAuth Apps. */
  expires_in?: number;
  /** Only present on GitHub Apps installations. */
  refresh_token?: string;
  refresh_token_expires_in?: number;
}

/**
 * Subset of the GitHub user payload from `GET /user` that we persist
 * and surface to the UI. The full payload contains 30+ fields; we
 * stash only what's needed for the "Connected as X" label and dedup
 * (`id` as `externalId` on the IntegrationConnection row).
 */
export interface GithubUserInfoResponse {
  id: number;
  login: string;
  name?: string | null;
  email?: string | null;
  avatar_url?: string;
}
