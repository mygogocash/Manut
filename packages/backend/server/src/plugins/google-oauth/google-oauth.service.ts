import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import { SessionCache } from '../../base';
import { Models } from '../../models';
import {
  GOOGLE_OAUTH_SCOPES,
  GOOGLE_PROVIDER_NAME,
  type GoogleConnectionStatus,
  type GoogleOAuthStartState,
  type GoogleOAuthTokenResponse,
  type GoogleScope,
  type GoogleUserInfoResponse,
} from './types';

const STATE_KEY_PREFIX = 'GOOGLE_OAUTH_STATE';
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes — same as the existing connections plugin
const REFRESH_SKEW_MS = 60 * 1000;

// 5-minute proactive-refresh window. If the stored access token expires
// within 5 minutes we refresh it before issuing API calls — the caller's
// upstream Google request would otherwise race the expiry and 401.
const REFRESH_LEEWAY_MS = 5 * 60 * 1000;

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

/**
 * Thrown when the server is missing `GOOGLE_OAUTH_CLIENT_ID` /
 * `GOOGLE_OAUTH_CLIENT_SECRET`. Surfaced as a typed error so the resolver
 * layer can return a friendly "Configure OAuth client to connect" message
 * instead of a 500.
 */
export class GoogleOAuthNotConfiguredError extends Error {
  constructor() {
    super(
      'Google OAuth client is not configured. Set GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET.'
    );
    this.name = 'GoogleOAuthNotConfiguredError';
  }
}

/**
 * Thrown when no `IntegrationConnection` row exists for the given
 * user+workspace+scope. The Gmail / Drive resolvers translate this into
 * "Connect Gmail to import emails" UI copy rather than a 500.
 */
export class GoogleOAuthNotConnectedError extends Error {
  constructor(scope: GoogleScope) {
    super(`Google ${scope} is not connected for this workspace`);
    this.name = 'GoogleOAuthNotConnectedError';
  }
}

/**
 * Thrown when Google's token endpoint rejects our refresh attempt. Most
 * commonly: the user revoked access from their Google account settings,
 * or the refresh token was never issued (which can happen if `prompt=consent`
 * was missing on the consent URL — but we always set it, so this is rare).
 */
export class GoogleOAuthRefreshFailedError extends Error {
  constructor(detail: string) {
    super(`Failed to refresh Google access token: ${detail}`);
    this.name = 'GoogleOAuthRefreshFailedError';
  }
}

@Injectable()
export class GoogleOAuthService {
  private readonly logger = new Logger(GoogleOAuthService.name);

  constructor(
    private readonly models: Models,
    private readonly cache: SessionCache
  ) {}

  /**
   * Returns true when both client id + secret are configured. Used by the
   * resolver to short-circuit `connectGoogle` and by the frontend to show
   * a "configure OAuth" message instead of a connect button.
   */
  isConfigured(): boolean {
    return Boolean(
      process.env.GOOGLE_OAUTH_CLIENT_ID &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET
    );
  }

  /**
   * Returns the redirect URI the OAuth callback will land on. Defaults to
   * `${SERVER_URL}/oauth/google/callback` when GOOGLE_OAUTH_REDIRECT_URI is
   * not set explicitly. The caller must pass `serverOrigin` derived from
   * the current request — we don't pull it from config because dev /
   * preview / prod each have different origins.
   */
  resolveRedirectUri(serverOrigin: string): string {
    const explicit = process.env.GOOGLE_OAUTH_REDIRECT_URI;
    if (explicit) return explicit;
    // Strip trailing slash so we don't end up with `//` in the URL.
    const origin = serverOrigin.replace(/\/$/, '');
    return `${origin}/oauth/google/callback`;
  }

  /**
   * Build the OAuth consent URL for a given scope. Only the scope the user
   * is connecting is requested — Drive consent isn't pulled in when they
   * connect Gmail. This keeps the consent screen honest and lets users
   * grant access incrementally.
   */
  async initiateOAuth(
    userId: string,
    workspaceId: string,
    scope: GoogleScope,
    redirectUri: string
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new GoogleOAuthNotConfiguredError();
    }

    const stateToken = randomUUID();
    const state: GoogleOAuthStartState = {
      userId,
      workspaceId,
      scope,
      redirectUri,
    };
    await this.cache.set(`${STATE_KEY_PREFIX}:${stateToken}`, state, {
      ttl: STATE_TTL_MS,
    });

    // Always include `openid email profile` so we can show "connected as
    // user@example.com" — the Google scope itself doesn't return identity.
    const scopes = [
      'openid',
      'email',
      'profile',
      GOOGLE_OAUTH_SCOPES[scope],
    ].join(' ');

    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: scopes,
      state: stateToken,
      access_type: 'offline',
      // `prompt=consent` forces a fresh refresh-token issuance even on
      // re-connect; without it Google returns a refresh token only on
      // first authorization, which makes scope upgrades fail silently.
      prompt: 'consent',
      include_granted_scopes: 'true',
    });
    return `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange the authorization code for tokens and persist the connection.
   *
   * State is single-use: deleted before the upstream exchange to defeat
   * replay even within the TTL window (same pattern as the connections
   * plugin).
   */
  async handleCallback(
    code: string,
    stateToken: string
  ): Promise<{ scope: GoogleScope; email: string; workspaceId: string }> {
    const stateKey = `${STATE_KEY_PREFIX}:${stateToken}`;
    const state = await this.cache.get<GoogleOAuthStartState>(stateKey);
    await this.cache.delete(stateKey);

    if (!state) {
      throw new Error('OAuth state expired or invalid');
    }

    if (!this.isConfigured()) {
      throw new GoogleOAuthNotConfiguredError();
    }

    const tokens = await this.exchangeCode(code, state.redirectUri);
    const userInfo = await this.fetchUserInfo(tokens.access_token);

    await this.models.integrationConnection.upsert({
      userId: state.userId,
      workspaceId: state.workspaceId,
      provider: GOOGLE_PROVIDER_NAME[state.scope],
      externalId: userInfo.id,
      displayName: userInfo.email,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : undefined,
      scopes: tokens.scope.split(' '),
      metadata: { email: userInfo.email, name: userInfo.name },
    });

    this.logger.log(
      `User ${state.userId} connected Google ${state.scope} in workspace ${state.workspaceId}`
    );

    return {
      scope: state.scope,
      email: userInfo.email,
      workspaceId: state.workspaceId,
    };
  }

  async getStatus(
    userId: string,
    workspaceId: string,
    scope: GoogleScope
  ): Promise<GoogleConnectionStatus> {
    const conn = await this.models.integrationConnection.getByProvider(
      userId,
      workspaceId,
      GOOGLE_PROVIDER_NAME[scope]
    );
    if (!conn) {
      return { connected: false };
    }

    const expiresAt = conn.tokenExpiresAt;
    // Treat tokens that can't be refreshed as disconnected, but if there
    // IS a refresh token we still call it connected — refresh happens
    // lazily on first use in v1.10.2+ when the live importer ships.
    const expired =
      expiresAt && expiresAt.getTime() < Date.now() - REFRESH_SKEW_MS;
    if (expired && !conn.refreshToken) {
      return { connected: false };
    }

    const metadata = (conn.metadata ?? {}) as { email?: string };
    return {
      connected: true,
      email: metadata.email ?? conn.displayName,
    };
  }

  async disconnect(
    userId: string,
    workspaceId: string,
    scope: GoogleScope
  ): Promise<boolean> {
    try {
      await this.models.integrationConnection.delete(
        userId,
        workspaceId,
        GOOGLE_PROVIDER_NAME[scope]
      );
      return true;
    } catch (err) {
      // Prisma P2025 = "Record to delete does not exist" → idempotent no-op.
      if (
        err &&
        typeof err === 'object' &&
        'code' in err &&
        (err as { code: string }).code === 'P2025'
      ) {
        return false;
      }
      this.logger.error(
        `Failed to disconnect Google ${scope} for user ${userId}: ${err instanceof Error ? err.message : String(err)}`
      );
      throw err;
    }
  }

  /**
   * Returns a non-expired access token for the given user+scope.
   *
   * If the stored access token is within {@link REFRESH_LEEWAY_MS} (5
   * minutes) of expiry — or already expired — refreshes it via Google's
   * OAuth token endpoint, persists the new tokens, and returns the new
   * access token. The refresh token may or may not rotate; if Google
   * returns a new one we store it, otherwise the existing one is kept.
   *
   * Failure modes (each typed so callers can produce friendly UI copy):
   *  - {@link GoogleOAuthNotConfiguredError} — server lacks client_id/secret
   *  - {@link GoogleOAuthNotConnectedError} — no row in IntegrationConnection
   *  - {@link GoogleOAuthRefreshFailedError} — Google rejected the refresh
   *    or refresh_token is missing on the stored row
   */
  async getValidAccessToken(
    userId: string,
    workspaceId: string,
    scope: GoogleScope
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new GoogleOAuthNotConfiguredError();
    }

    const provider = GOOGLE_PROVIDER_NAME[scope];
    const conn = await this.models.integrationConnection.getByProvider(
      userId,
      workspaceId,
      provider
    );

    if (!conn) {
      throw new GoogleOAuthNotConnectedError(scope);
    }

    const decrypted = this.models.integrationConnection.decryptTokens(conn);
    if (!decrypted) {
      throw new GoogleOAuthNotConnectedError(scope);
    }

    const now = Date.now();
    const expiresAt = decrypted.tokenExpiresAt
      ? decrypted.tokenExpiresAt.getTime()
      : 0;
    const stillFresh = expiresAt > now + REFRESH_LEEWAY_MS;

    if (stillFresh) {
      return decrypted.accessToken;
    }

    const refreshToken = decrypted.refreshToken;
    if (!refreshToken) {
      throw new GoogleOAuthRefreshFailedError(
        'no refresh token on file — please reconnect Google'
      );
    }

    const refreshed = await this.refreshAccessToken(refreshToken);

    const newExpiresAt = refreshed.expires_in
      ? new Date(Date.now() + refreshed.expires_in * 1000)
      : undefined;

    await this.models.integrationConnection.updateTokens(
      userId,
      workspaceId,
      provider,
      {
        accessToken: refreshed.access_token,
        // Only persist a new refresh token if Google rotated one. Most
        // refresh-grant responses omit `refresh_token` and we want to
        // keep the long-lived original on file.
        refreshToken: refreshed.refresh_token,
        tokenExpiresAt: newExpiresAt,
      }
    );

    return refreshed.access_token;
  }

  private async refreshAccessToken(
    refreshToken: string
  ): Promise<GoogleOAuthTokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
    });

    let response: Response;
    try {
      response = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
    } catch (err) {
      throw new GoogleOAuthRefreshFailedError(
        err instanceof Error ? err.message : String(err)
      );
    }

    if (!response.ok) {
      const text = await response.text();
      throw new GoogleOAuthRefreshFailedError(
        `${response.status} ${text.slice(0, 200)}`
      );
    }

    return (await response.json()) as GoogleOAuthTokenResponse;
  }

  private async exchangeCode(
    code: string,
    redirectUri: string
  ): Promise<GoogleOAuthTokenResponse> {
    const body = new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_OAUTH_CLIENT_ID ?? '',
      client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET ?? '',
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Google token exchange failed: ${response.status} ${text}`
      );
    }

    return (await response.json()) as GoogleOAuthTokenResponse;
  }

  private async fetchUserInfo(
    accessToken: string
  ): Promise<GoogleUserInfoResponse> {
    const response = await fetch(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Google userinfo fetch failed: ${response.status} ${text}`
      );
    }
    return (await response.json()) as GoogleUserInfoResponse;
  }
}
