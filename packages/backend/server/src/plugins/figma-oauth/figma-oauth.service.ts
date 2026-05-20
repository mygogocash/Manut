import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import { SessionCache } from '../../base';
import { Models } from '../../models';
import { isFigmaOAuthConfigured, readFigmaOAuthEnv } from './manut-pro-config';
import {
  FIGMA_OAUTH_SCOPES,
  FIGMA_PROVIDER_NAME,
  type FigmaConnectionStatus,
  type FigmaOAuthStartState,
  type FigmaOAuthTokenResponse,
  type FigmaScope,
  type FigmaUserInfoResponse,
} from './types';

const STATE_KEY_PREFIX = 'FIGMA_OAUTH_STATE';
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes — matches Google scaffold

const FIGMA_AUTH_URL = 'https://www.figma.com/oauth';
const FIGMA_TOKEN_URL = 'https://www.figma.com/api/oauth/token';
const FIGMA_ME_URL = 'https://api.figma.com/v1/me';

/**
 * Thrown when the server is missing `FIGMA_OAUTH_CLIENT_ID` /
 * `FIGMA_OAUTH_CLIENT_SECRET`. Mirrors `GithubOAuthNotConfiguredError`.
 */
export class FigmaOAuthNotConfiguredError extends Error {
  constructor() {
    super(
      'Figma OAuth client is not configured. Set FIGMA_OAUTH_CLIENT_ID and FIGMA_OAUTH_CLIENT_SECRET.'
    );
    this.name = 'FigmaOAuthNotConfiguredError';
  }
}

/**
 * Thrown when no `IntegrationConnection` row exists for the given
 * user+workspace. Resolver layer translates this into
 * "Connect Figma to use this feature" UI copy.
 */
export class FigmaOAuthNotConnectedError extends Error {
  constructor() {
    super('Figma is not connected for this workspace');
    this.name = 'FigmaOAuthNotConnectedError';
  }
}

/**
 * Thrown when Figma rejects the access token. Unlike GitHub/Linear,
 * Figma tokens DO expire (90-day default) — when AI tools ship,
 * they should attempt refresh before surfacing this error.
 */
export class FigmaOAuthTokenInvalidError extends Error {
  constructor(detail: string) {
    super(`Figma access token rejected: ${detail}`);
    this.name = 'FigmaOAuthTokenInvalidError';
  }
}

/**
 * Figma OAuth scaffold.
 *
 * Connect/disconnect plumbing only — mirrors the v1.13.x GitHub OAuth
 * scaffold. AI-callable tools are deferred to a follow-up release;
 * when they ship, they'll consume `getValidAccessToken`. UNLIKE the
 * GitHub scaffold, Figma tokens expire in 90 days and require
 * refresh — the follow-up that adds AI tools will need to extend
 * `getValidAccessToken` with the 5-minute proactive-refresh window
 * pattern from the Google scaffold.
 *
 * For this scaffold, `getValidAccessToken` returns the stored access
 * token unmodified; staleness will surface as
 * `FigmaOAuthTokenInvalidError` from any future AI tool layer.
 */
@Injectable()
export class FigmaOAuthService {
  private readonly logger = new Logger(FigmaOAuthService.name);

  constructor(
    private readonly models: Models,
    private readonly cache: SessionCache
  ) {}

  /**
   * Returns true when both client id + secret are configured. Used by
   * the resolver to short-circuit `connectFigma` and by the frontend
   * to show a "configure OAuth client" message instead of opening a
   * blank popup.
   */
  isConfigured(): boolean {
    return isFigmaOAuthConfigured();
  }

  /**
   * Returns the redirect URI the OAuth callback will land on. Defaults
   * to `${SERVER_URL}/oauth/figma/callback` when
   * `FIGMA_OAUTH_REDIRECT_URI` is not set. Caller passes
   * `serverOrigin` derived from the current request.
   */
  resolveRedirectUri(serverOrigin: string): string {
    const explicit = readFigmaOAuthEnv().redirectUriOverride;
    if (explicit) return explicit;
    const origin = serverOrigin.replace(/\/$/, '');
    return `${origin}/oauth/figma/callback`;
  }

  /**
   * Build the OAuth consent URL. Figma's authorize endpoint takes the
   * scope as a space-separated `scope` parameter. The consent screen
   * always appears the first time but is skipped on re-auth — Figma
   * doesn't support `prompt=consent` to force a re-prompt.
   */
  async initiateOAuth(
    userId: string,
    workspaceId: string,
    redirectUri: string
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new FigmaOAuthNotConfiguredError();
    }

    const env = readFigmaOAuthEnv();
    const stateToken = randomUUID();
    const state: FigmaOAuthStartState = {
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
      scope: FIGMA_OAUTH_SCOPES,
      state: stateToken,
      response_type: 'code',
    });
    return `${FIGMA_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange the authorization code for tokens and persist the
   * connection. State is single-use: deleted before the upstream
   * exchange to defeat replay even within the TTL window.
   */
  async handleCallback(
    code: string,
    stateToken: string
  ): Promise<{ handle: string; workspaceId: string }> {
    const stateKey = `${STATE_KEY_PREFIX}:${stateToken}`;
    const state = await this.cache.get<FigmaOAuthStartState>(stateKey);
    await this.cache.delete(stateKey);

    if (!state) {
      throw new Error('OAuth state expired or invalid');
    }

    if (!this.isConfigured()) {
      throw new FigmaOAuthNotConfiguredError();
    }

    const tokens = await this.exchangeCode(code, state.redirectUri);
    const userInfo = await this.fetchUserInfo(tokens.access_token);

    await this.models.integrationConnection.upsert({
      userId: state.userId,
      workspaceId: state.workspaceId,
      provider: FIGMA_PROVIDER_NAME,
      externalId: userInfo.id,
      displayName: userInfo.handle,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : undefined,
      // Figma sometimes omits `scope` from the token response; fall
      // back to the requested scope set so downstream consumers can
      // still inspect what was granted.
      scopes: (tokens.scope ?? FIGMA_OAUTH_SCOPES)
        .split(/[\s,]+/)
        .filter(Boolean),
      metadata: {
        handle: userInfo.handle,
        email: userInfo.email,
        avatarUrl: userInfo.img_url,
      },
    });

    this.logger.log(
      `User ${state.userId} connected Figma as ${userInfo.handle} in workspace ${state.workspaceId}`
    );

    return { handle: userInfo.handle, workspaceId: state.workspaceId };
  }

  async getStatus(
    userId: string,
    workspaceId: string
  ): Promise<FigmaConnectionStatus> {
    const conn = await this.models.integrationConnection.getByProvider(
      userId,
      workspaceId,
      FIGMA_PROVIDER_NAME
    );
    if (!conn) {
      return { connected: false };
    }
    const metadata = (conn.metadata ?? {}) as {
      handle?: string;
      email?: string;
    };
    return {
      connected: true,
      handle: metadata.handle ?? conn.displayName,
      email: metadata.email,
    };
  }

  async disconnect(userId: string, workspaceId: string): Promise<boolean> {
    try {
      await this.models.integrationConnection.delete(
        userId,
        workspaceId,
        FIGMA_PROVIDER_NAME
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
        `Failed to disconnect Figma for user ${userId}: ${err instanceof Error ? err.message : String(err)}`
      );
      throw err;
    }
  }

  /**
   * Returns the stored Figma access token for AI tools (when they
   * ship) to exercise. Mirrors `GoogleOAuthService.getValidAccessToken`
   * signature with a `scope` parameter for API symmetry.
   *
   * **No proactive refresh in this scaffold.** Figma tokens expire
   * in 90 days — the follow-up release that ships AI tools MUST
   * extend this method with the Google scaffold's 5-minute leeway
   * refresh pattern (`POST https://www.figma.com/api/oauth/refresh`
   * with `client_id`, `client_secret`, `refresh_token` then call
   * `integrationConnection.updateTokens`). For the scaffold-only
   * v1.13.x release, callers should expect `FigmaOAuthTokenInvalidError`
   * when a stored token is past `tokenExpiresAt`.
   *
   * Failure modes:
   *  - {@link FigmaOAuthNotConfiguredError} — server lacks client_id/secret
   *  - {@link FigmaOAuthNotConnectedError} — no row in IntegrationConnection
   */
  async getValidAccessToken(
    userId: string,
    workspaceId: string,
    _scope: FigmaScope = 'figma'
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new FigmaOAuthNotConfiguredError();
    }

    const conn = await this.models.integrationConnection.getByProvider(
      userId,
      workspaceId,
      FIGMA_PROVIDER_NAME
    );

    if (!conn) {
      throw new FigmaOAuthNotConnectedError();
    }

    const decrypted = this.models.integrationConnection.decryptTokens(conn);
    if (!decrypted) {
      throw new FigmaOAuthNotConnectedError();
    }

    return decrypted.accessToken;
  }

  private async exchangeCode(
    code: string,
    redirectUri: string
  ): Promise<FigmaOAuthTokenResponse> {
    const env = readFigmaOAuthEnv();
    // Figma's token endpoint accepts client_id/secret either via
    // request body or HTTP Basic. The body form matches the
    // GitHub/Linear scaffolds.
    const body = new URLSearchParams({
      client_id: env.clientId ?? '',
      client_secret: env.clientSecret ?? '',
      redirect_uri: redirectUri,
      code,
      grant_type: 'authorization_code',
    });

    const response = await fetch(FIGMA_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Figma token exchange failed: ${response.status} ${text}`
      );
    }

    const parsed = (await response.json()) as
      | FigmaOAuthTokenResponse
      | { error: string; message?: string };

    if ('error' in parsed) {
      throw new Error(
        `Figma token exchange failed: ${parsed.error}${parsed.message ? ` — ${parsed.message}` : ''}`
      );
    }

    return parsed;
  }

  private async fetchUserInfo(
    accessToken: string
  ): Promise<FigmaUserInfoResponse> {
    const response = await fetch(FIGMA_ME_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Figma /v1/me fetch failed: ${response.status} ${text}`);
    }
    return (await response.json()) as FigmaUserInfoResponse;
  }
}
