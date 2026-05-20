import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import { SessionCache } from '../../base';
import { Models } from '../../models';
import {
  isTiktokOAuthConfigured,
  readTiktokOAuthEnv,
} from './manut-pro-config';
import {
  TIKTOK_OAUTH_SCOPES,
  TIKTOK_PROVIDER_NAME,
  type TiktokConnectionStatus,
  type TiktokOAuthStartState,
  type TiktokOAuthTokenResponse,
  type TiktokScope,
  type TiktokUserInfoResponse,
} from './types';

const STATE_KEY_PREFIX = 'TIKTOK_OAUTH_STATE';
const STATE_TTL_MS = 10 * 60 * 1000;

// TikTok v2 endpoints — note the distinct host (`open.tiktokapis.com`)
// for the token + user-info APIs, and `www.tiktok.com` for the consent
// screen.
const TIKTOK_AUTH_URL = 'https://www.tiktok.com/v2/auth/authorize';
const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token';
const TIKTOK_USER_INFO_URL = 'https://open.tiktokapis.com/v2/user/info/';

export class TiktokOAuthNotConfiguredError extends Error {
  constructor() {
    super(
      'TikTok OAuth client is not configured. Set TIKTOK_OAUTH_CLIENT_ID (mapped to TikTok client_key) and TIKTOK_OAUTH_CLIENT_SECRET.'
    );
    this.name = 'TiktokOAuthNotConfiguredError';
  }
}

export class TiktokOAuthNotConnectedError extends Error {
  constructor() {
    super('TikTok is not connected for this workspace');
    this.name = 'TiktokOAuthNotConnectedError';
  }
}

export class TiktokOAuthTokenInvalidError extends Error {
  constructor(detail: string) {
    super(`TikTok access token rejected: ${detail}`);
    this.name = 'TiktokOAuthTokenInvalidError';
  }
}

/**
 * TikTok OAuth scaffold.
 *
 * Connect/disconnect plumbing only — mirrors the v1.13.x Slack OAuth
 * scaffold pattern. AI-callable tools deferred.
 *
 * QUIRK: TikTok uses `client_key` on the authorize URL where every
 * other OAuth provider uses `client_id`. We normalise the env var to
 * `TIKTOK_OAUTH_CLIENT_ID` and map at the URL/body construction site
 * — see `initiateOAuth` and `exchangeCode` below.
 *
 * Token model: TikTok issues refresh tokens. Access tokens expire in
 * ~24h, refresh tokens in ~365d. The scaffold persists both; when AI
 * tools ship they should mirror the Google `getValidAccessToken`
 * 5-minute leeway refresh pattern.
 */
@Injectable()
export class TiktokOAuthService {
  private readonly logger = new Logger(TiktokOAuthService.name);

  constructor(
    private readonly models: Models,
    private readonly cache: SessionCache
  ) {}

  isConfigured(): boolean {
    return isTiktokOAuthConfigured();
  }

  resolveRedirectUri(serverOrigin: string): string {
    const explicit = readTiktokOAuthEnv().redirectUriOverride;
    if (explicit) return explicit;
    const origin = serverOrigin.replace(/\/$/, '');
    return `${origin}/oauth/tiktok/callback`;
  }

  /**
   * Build the OAuth consent URL.
   *
   * Notable parameters:
   *  - `client_key` — TikTok's name for what the rest of the world
   *    calls `client_id`. We pull from `env.clientId` and rename at
   *    the URL construction site here.
   *  - `scope` — comma-delimited (matches our constant).
   *  - `response_type=code` — standard authorization-code flow.
   */
  async initiateOAuth(
    userId: string,
    workspaceId: string,
    redirectUri: string
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new TiktokOAuthNotConfiguredError();
    }

    const env = readTiktokOAuthEnv();
    const stateToken = randomUUID();
    const state: TiktokOAuthStartState = {
      userId,
      workspaceId,
      redirectUri,
    };
    await this.cache.set(`${STATE_KEY_PREFIX}:${stateToken}`, state, {
      ttl: STATE_TTL_MS,
    });

    // KEY MAPPING: env.clientId → TikTok's client_key.
    const params = new URLSearchParams({
      client_key: env.clientId ?? '',
      redirect_uri: redirectUri,
      scope: TIKTOK_OAUTH_SCOPES,
      response_type: 'code',
      state: stateToken,
    });
    return `${TIKTOK_AUTH_URL}?${params.toString()}`;
  }

  async handleCallback(
    code: string,
    stateToken: string
  ): Promise<{ displayName: string; workspaceId: string }> {
    const stateKey = `${STATE_KEY_PREFIX}:${stateToken}`;
    const state = await this.cache.get<TiktokOAuthStartState>(stateKey);
    await this.cache.delete(stateKey);

    if (!state) {
      throw new Error('OAuth state expired or invalid');
    }

    if (!this.isConfigured()) {
      throw new TiktokOAuthNotConfiguredError();
    }

    const tokens = await this.exchangeCode(code, state.redirectUri);
    const userInfo = await this.fetchUserInfo(tokens.access_token).catch(
      () => null
    );

    const displayName =
      userInfo?.data.user.display_name ??
      userInfo?.data.user.username ??
      tokens.open_id;

    await this.models.integrationConnection.upsert({
      userId: state.userId,
      workspaceId: state.workspaceId,
      provider: TIKTOK_PROVIDER_NAME,
      externalId: tokens.open_id,
      displayName,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: new Date(Date.now() + tokens.expires_in * 1000),
      scopes: tokens.scope.split(/[\s,]+/).filter(Boolean),
      metadata: {
        openId: tokens.open_id,
        unionId: userInfo?.data.user.union_id,
        displayName,
        username: userInfo?.data.user.username,
        avatarUrl: userInfo?.data.user.avatar_url,
        profileLink: userInfo?.data.user.profile_deep_link,
        refreshExpiresAt: new Date(
          Date.now() + tokens.refresh_expires_in * 1000
        ).toISOString(),
      },
    });

    this.logger.log(
      `User ${state.userId} connected TikTok as ${displayName} in workspace ${state.workspaceId}`
    );

    return { displayName, workspaceId: state.workspaceId };
  }

  async getStatus(
    userId: string,
    workspaceId: string
  ): Promise<TiktokConnectionStatus> {
    const conn = await this.models.integrationConnection.getByProvider(
      userId,
      workspaceId,
      TIKTOK_PROVIDER_NAME
    );
    if (!conn) {
      return { connected: false };
    }
    return { connected: true, displayName: conn.displayName };
  }

  async disconnect(userId: string, workspaceId: string): Promise<boolean> {
    try {
      await this.models.integrationConnection.delete(
        userId,
        workspaceId,
        TIKTOK_PROVIDER_NAME
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
        `Failed to disconnect TikTok for user ${userId}: ${err instanceof Error ? err.message : String(err)}`
      );
      throw err;
    }
  }

  async getValidAccessToken(
    userId: string,
    workspaceId: string,
    _scope: TiktokScope = 'tiktok'
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new TiktokOAuthNotConfiguredError();
    }

    const conn = await this.models.integrationConnection.getByProvider(
      userId,
      workspaceId,
      TIKTOK_PROVIDER_NAME
    );

    if (!conn) {
      throw new TiktokOAuthNotConnectedError();
    }

    const decrypted = this.models.integrationConnection.decryptTokens(conn);
    if (!decrypted) {
      throw new TiktokOAuthNotConnectedError();
    }

    // NOTE for AI tools follow-up: TikTok access tokens expire in
    // ~24h. Mirror the Google scaffold's 5-minute leeway here when
    // tools land — refresh via:
    //   POST https://open.tiktokapis.com/v2/oauth/token/
    //   { client_key, client_secret, grant_type: 'refresh_token',
    //     refresh_token }
    // and call integrationConnection.updateTokens with the new pair.
    return decrypted.accessToken;
  }

  private async exchangeCode(
    code: string,
    redirectUri: string
  ): Promise<TiktokOAuthTokenResponse> {
    const env = readTiktokOAuthEnv();
    // KEY MAPPING: env.clientId → TikTok's client_key.
    const body = new URLSearchParams({
      client_key: env.clientId ?? '',
      client_secret: env.clientSecret ?? '',
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    });

    const response = await fetch(TIKTOK_TOKEN_URL, {
      method: 'POST',
      headers: {
        // TikTok requires explicit `Cache-Control: no-cache`; without
        // it some intermediate proxies serve stale responses.
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache',
        Accept: 'application/json',
      },
      body,
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `TikTok token exchange failed: ${response.status} ${text}`
      );
    }

    const parsed = (await response.json()) as
      | TiktokOAuthTokenResponse
      | { error: string; error_description?: string; log_id?: string };

    // TikTok returns HTTP 200 with an `error` field for logical
    // failures (invalid_grant, invalid_client). Same trap as Slack —
    // guard explicitly.
    if ('error' in parsed && parsed.error) {
      throw new Error(
        `TikTok token exchange failed: ${parsed.error}${parsed.error_description ? ` — ${parsed.error_description}` : ''}`
      );
    }

    // After the error-branch guard, narrow the union to the success
    // shape via a final cast — see note in line-voom-oauth.service.ts.
    return parsed as TiktokOAuthTokenResponse;
  }

  private async fetchUserInfo(
    accessToken: string
  ): Promise<TiktokUserInfoResponse> {
    // TikTok requires explicit field selection — without `fields=`
    // the endpoint returns only `open_id`. We ask for the basic
    // display fields we surface in the UI.
    const fields = [
      'open_id',
      'union_id',
      'avatar_url',
      'display_name',
      'bio_description',
      'profile_deep_link',
      'username',
    ].join(',');
    const url = `${TIKTOK_USER_INFO_URL}?fields=${encodeURIComponent(fields)}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `TikTok user/info fetch failed: ${response.status} ${text}`
      );
    }
    const parsed = (await response.json()) as TiktokUserInfoResponse;
    if (parsed.error && parsed.error.code && parsed.error.code !== 'ok') {
      throw new Error(
        `TikTok user/info fetch failed: ${parsed.error.code}${parsed.error.message ? ` — ${parsed.error.message}` : ''}`
      );
    }
    return parsed;
  }
}
