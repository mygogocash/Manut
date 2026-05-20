import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import { SessionCache } from '../../base';
import { Models } from '../../models';
import {
  isGithubOAuthConfigured,
  readGithubOAuthEnv,
} from './manut-pro-config';
import {
  GITHUB_OAUTH_SCOPES,
  GITHUB_PROVIDER_NAME,
  type GithubConnectionStatus,
  type GithubOAuthStartState,
  type GithubOAuthTokenResponse,
  type GithubUserInfoResponse,
} from './types';

const STATE_KEY_PREFIX = 'GITHUB_OAUTH_STATE';
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes — matches Google scaffold

const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';

/**
 * Thrown when the server is missing `GITHUB_OAUTH_CLIENT_ID` /
 * `GITHUB_OAUTH_CLIENT_SECRET`. Mirrors `GoogleOAuthNotConfiguredError`.
 */
export class GithubOAuthNotConfiguredError extends Error {
  constructor() {
    super(
      'GitHub OAuth client is not configured. Set GITHUB_OAUTH_CLIENT_ID and GITHUB_OAUTH_CLIENT_SECRET.'
    );
    this.name = 'GithubOAuthNotConfiguredError';
  }
}

/**
 * Thrown when no `IntegrationConnection` row exists for the given
 * user+workspace. Resolver layer translates this into
 * "Connect GitHub to use this feature" UI copy.
 */
export class GithubOAuthNotConnectedError extends Error {
  constructor() {
    super('GitHub is not connected for this workspace');
    this.name = 'GithubOAuthNotConnectedError';
  }
}

/**
 * Thrown when GitHub rejects the access token (401 / 403). OAuth Apps
 * don't issue refresh tokens; the only remediation is a fresh consent
 * flow, so this maps to the "reconnect" UI path.
 */
export class GithubOAuthTokenInvalidError extends Error {
  constructor(detail: string) {
    super(`GitHub access token rejected: ${detail}`);
    this.name = 'GithubOAuthTokenInvalidError';
  }
}

/**
 * GitHub OAuth scaffold.
 *
 * Connect/disconnect plumbing only — mirrors the v1.10.1 Google OAuth
 * scaffold (CLAUDE.md §6). The AI-callable tools at
 * `plugins/copilot/tools/github.ts` consume `getValidAccessToken` to
 * exercise the GitHub REST API on the user's behalf.
 *
 * Token model: GitHub OAuth Apps issue long-lived access tokens
 * without refresh-token rotation. We persist the token and detect
 * staleness lazily — the AI tools surface a "reconnect GitHub" toast
 * on 401, the user re-runs the consent flow, and the row gets upserted
 * fresh. There is no proactive 5-minute refresh window like the Google
 * scaffold; the absence of an expiry is by design.
 */
@Injectable()
export class GithubOAuthService {
  private readonly logger = new Logger(GithubOAuthService.name);

  constructor(
    private readonly models: Models,
    private readonly cache: SessionCache
  ) {}

  /**
   * Returns true when both client id + secret are configured. Used by
   * the resolver to short-circuit `connectGithub` and by the frontend
   * to show a "configure OAuth client" message instead of opening a
   * blank popup.
   */
  isConfigured(): boolean {
    return isGithubOAuthConfigured();
  }

  /**
   * Returns the redirect URI the OAuth callback will land on. Defaults
   * to `${SERVER_URL}/oauth/github/callback` when
   * `GITHUB_OAUTH_REDIRECT_URI` is not set. Caller passes
   * `serverOrigin` derived from the current request — we don't pull it
   * from config because dev / preview / prod each have different
   * origins.
   */
  resolveRedirectUri(serverOrigin: string): string {
    const explicit = readGithubOAuthEnv().redirectUriOverride;
    if (explicit) return explicit;
    const origin = serverOrigin.replace(/\/$/, '');
    return `${origin}/oauth/github/callback`;
  }

  /**
   * Build the OAuth consent URL. GitHub's authorize endpoint does not
   * support a `prompt=consent` parameter — the consent screen always
   * appears the first time but is skipped on re-auth. To force a
   * fresh consent on scope upgrades we'd need to revoke the existing
   * grant via the API; for v1.13.0 we accept the existing-grant fast
   * path.
   */
  async initiateOAuth(
    userId: string,
    workspaceId: string,
    redirectUri: string
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new GithubOAuthNotConfiguredError();
    }

    const env = readGithubOAuthEnv();
    const stateToken = randomUUID();
    const state: GithubOAuthStartState = {
      userId,
      workspaceId,
      redirectUri,
    };
    await this.cache.set(`${STATE_KEY_PREFIX}:${stateToken}`, state, {
      ttl: STATE_TTL_MS,
    });

    const params = new URLSearchParams({
      client_id: env.clientId ?? '',
      redirect_uri: redirectUri,
      scope: GITHUB_OAUTH_SCOPES,
      state: stateToken,
      // `allow_signup=false` keeps the consent screen focused on
      // existing GitHub users — the AI tools don't make sense for a
      // brand-new GitHub account anyway.
      allow_signup: 'false',
    });
    return `${GITHUB_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange the authorization code for tokens and persist the
   * connection. State is single-use: deleted before the upstream
   * exchange to defeat replay even within the TTL window.
   */
  async handleCallback(
    code: string,
    stateToken: string
  ): Promise<{ login: string; workspaceId: string }> {
    const stateKey = `${STATE_KEY_PREFIX}:${stateToken}`;
    const state = await this.cache.get<GithubOAuthStartState>(stateKey);
    await this.cache.delete(stateKey);

    if (!state) {
      throw new Error('OAuth state expired or invalid');
    }

    if (!this.isConfigured()) {
      throw new GithubOAuthNotConfiguredError();
    }

    const tokens = await this.exchangeCode(code, state.redirectUri);
    const userInfo = await this.fetchUserInfo(tokens.access_token);

    await this.models.integrationConnection.upsert({
      userId: state.userId,
      workspaceId: state.workspaceId,
      provider: GITHUB_PROVIDER_NAME,
      externalId: String(userInfo.id),
      displayName: userInfo.login,
      accessToken: tokens.access_token,
      // OAuth Apps issue no refresh token; persist `undefined` so
      // the row reads as "no refresh" rather than empty string. If a
      // future GitHub App migration lands here, the `refresh_token`
      // field on `GithubOAuthTokenResponse` will be populated and
      // this passthrough works unchanged.
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : undefined,
      scopes: tokens.scope.split(/[\s,]+/).filter(Boolean),
      metadata: {
        login: userInfo.login,
        name: userInfo.name ?? undefined,
        email: userInfo.email ?? undefined,
        avatarUrl: userInfo.avatar_url,
      },
    });

    this.logger.log(
      `User ${state.userId} connected GitHub as ${userInfo.login} in workspace ${state.workspaceId}`
    );

    return { login: userInfo.login, workspaceId: state.workspaceId };
  }

  async getStatus(
    userId: string,
    workspaceId: string
  ): Promise<GithubConnectionStatus> {
    const conn = await this.models.integrationConnection.getByProvider(
      userId,
      workspaceId,
      GITHUB_PROVIDER_NAME
    );
    if (!conn) {
      return { connected: false };
    }
    const metadata = (conn.metadata ?? {}) as { login?: string };
    return {
      connected: true,
      login: metadata.login ?? conn.displayName,
    };
  }

  async disconnect(userId: string, workspaceId: string): Promise<boolean> {
    try {
      await this.models.integrationConnection.delete(
        userId,
        workspaceId,
        GITHUB_PROVIDER_NAME
      );
      return true;
    } catch (err) {
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === 'P2025'
      ) {
        return false;
      }
      this.logger.error(
        `Failed to disconnect GitHub for user ${userId}: ${err instanceof Error ? err.message : String(err)}`
      );
      throw err;
    }
  }

  /**
   * Returns the stored GitHub access token for the AI tools to
   * exercise. Unlike the Google scaffold, there is NO refresh path —
   * OAuth Apps issue long-lived tokens and we surface staleness via
   * `GithubOAuthTokenInvalidError` (thrown by the AI tool layer on
   * GitHub 401) so the user can re-consent.
   *
   * Failure modes:
   *  - {@link GithubOAuthNotConfiguredError} — server lacks client_id/secret
   *  - {@link GithubOAuthNotConnectedError} — no row in IntegrationConnection
   */
  async getValidAccessToken(
    userId: string,
    workspaceId: string
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new GithubOAuthNotConfiguredError();
    }

    const conn = await this.models.integrationConnection.getByProvider(
      userId,
      workspaceId,
      GITHUB_PROVIDER_NAME
    );

    if (!conn) {
      throw new GithubOAuthNotConnectedError();
    }

    const decrypted = this.models.integrationConnection.decryptTokens(conn);
    if (!decrypted) {
      throw new GithubOAuthNotConnectedError();
    }

    return decrypted.accessToken;
  }

  private async exchangeCode(
    code: string,
    redirectUri: string
  ): Promise<GithubOAuthTokenResponse> {
    const env = readGithubOAuthEnv();
    const body = new URLSearchParams({
      client_id: env.clientId ?? '',
      client_secret: env.clientSecret ?? '',
      code,
      redirect_uri: redirectUri,
    });

    const response = await fetch(GITHUB_TOKEN_URL, {
      method: 'POST',
      // GitHub's token endpoint defaults to `application/x-www-form-urlencoded`
      // response; opt into JSON via the Accept header so the response
      // is shaped {access_token, scope, token_type, ...} rather than
      // a `&`-delimited query string we'd need to parse manually.
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `GitHub token exchange failed: ${response.status} ${text}`
      );
    }

    const parsed = (await response.json()) as
      | GithubOAuthTokenResponse
      | { error: string; error_description?: string };

    if ('error' in parsed) {
      throw new Error(
        `GitHub token exchange failed: ${parsed.error}${parsed.error_description ? ` — ${parsed.error_description}` : ''}`
      );
    }

    return parsed;
  }

  private async fetchUserInfo(
    accessToken: string
  ): Promise<GithubUserInfoResponse> {
    const response = await fetch(GITHUB_USER_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        // GitHub's API recommends pinning the API version via Accept.
        // The `+json` suffix opts into the documented JSON shape; the
        // X-GitHub-Api-Version header pins behavior to a known release.
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `GitHub userinfo fetch failed: ${response.status} ${text}`
      );
    }
    return (await response.json()) as GithubUserInfoResponse;
  }
}
