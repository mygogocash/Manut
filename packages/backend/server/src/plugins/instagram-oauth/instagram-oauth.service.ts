import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { SocialPlatform } from '@prisma/client';

import { SessionCache } from '../../base';
import { Models } from '../../models';
import { SocialConnectionBridgeService } from '../analytics/connections/social-connection-bridge';
import {
  isInstagramOAuthConfigured,
  readInstagramOAuthEnv,
} from './manut-pro-config';
import {
  INSTAGRAM_OAUTH_SCOPES,
  INSTAGRAM_PROVIDER_NAME,
  type InstagramConnectionStatus,
  type InstagramOAuthStartState,
  type InstagramOAuthTokenResponse,
  type InstagramScope,
  type InstagramUserInfoResponse,
} from './types';

const STATE_KEY_PREFIX = 'INSTAGRAM_OAUTH_STATE';
const STATE_TTL_MS = 10 * 60 * 1000;

const INSTAGRAM_AUTH_URL = 'https://api.instagram.com/oauth/authorize';
const INSTAGRAM_TOKEN_URL = 'https://api.instagram.com/oauth/access_token';
const INSTAGRAM_ME_URL = 'https://graph.instagram.com/me';

export class InstagramOAuthNotConfiguredError extends Error {
  constructor() {
    super(
      'Instagram OAuth client is not configured. Set IG_OAUTH_CLIENT_ID and IG_OAUTH_CLIENT_SECRET.'
    );
    this.name = 'InstagramOAuthNotConfiguredError';
  }
}

export class InstagramOAuthNotConnectedError extends Error {
  constructor() {
    super('Instagram is not connected for this workspace');
    this.name = 'InstagramOAuthNotConnectedError';
  }
}

export class InstagramOAuthTokenInvalidError extends Error {
  constructor(detail: string) {
    super(`Instagram access token rejected: ${detail}`);
    this.name = 'InstagramOAuthTokenInvalidError';
  }
}

/**
 * Instagram OAuth scaffold (Basic Display API).
 *
 * Connect/disconnect plumbing only — mirrors the v1.13.x Facebook OAuth
 * scaffold. AI-callable tools deferred.
 *
 * Token model: short-lived (~1h) token by default. Long-lived 60-day
 * exchange via `https://graph.instagram.com/access_token?grant_type=ig_exchange_token`
 * is deferred to the live-import follow-up.
 */
@Injectable()
export class InstagramOAuthService {
  private readonly logger = new Logger(InstagramOAuthService.name);

  constructor(
    private readonly models: Models,
    private readonly cache: SessionCache,
    private readonly socialBridge: SocialConnectionBridgeService
  ) {}

  isConfigured(): boolean {
    return isInstagramOAuthConfigured();
  }

  resolveRedirectUri(serverOrigin: string): string {
    const explicit = readInstagramOAuthEnv().redirectUriOverride;
    if (explicit) return explicit;
    const origin = serverOrigin.replace(/\/$/, '');
    return `${origin}/oauth/instagram/callback`;
  }

  async initiateOAuth(
    userId: string,
    workspaceId: string,
    redirectUri: string
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new InstagramOAuthNotConfiguredError();
    }

    const env = readInstagramOAuthEnv();
    const stateToken = randomUUID();
    const state: InstagramOAuthStartState = {
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
      scope: INSTAGRAM_OAUTH_SCOPES,
      response_type: 'code',
      state: stateToken,
    });
    return `${INSTAGRAM_AUTH_URL}?${params.toString()}`;
  }

  async handleCallback(
    code: string,
    stateToken: string
  ): Promise<{ username: string; workspaceId: string }> {
    const stateKey = `${STATE_KEY_PREFIX}:${stateToken}`;
    const state = await this.cache.get<InstagramOAuthStartState>(stateKey);
    await this.cache.delete(stateKey);

    if (!state) {
      throw new Error('OAuth state expired or invalid');
    }

    if (!this.isConfigured()) {
      throw new InstagramOAuthNotConfiguredError();
    }

    const tokens = await this.exchangeCode(code, state.redirectUri);
    const userInfo = await this.fetchUserInfo(tokens.access_token);

    const scopes = INSTAGRAM_OAUTH_SCOPES.split(/[\s,]+/).filter(Boolean);

    await this.models.integrationConnection.upsert({
      userId: state.userId,
      workspaceId: state.workspaceId,
      provider: INSTAGRAM_PROVIDER_NAME,
      externalId: userInfo.id,
      displayName: userInfo.username,
      accessToken: tokens.access_token,
      refreshToken: undefined,
      // Short-lived tokens nominally expire in ~1h but Instagram
      // doesn't return `expires_in` on this endpoint; leave undefined
      // so the row reads as "expiry unknown" rather than fabricating a
      // stale timestamp.
      tokenExpiresAt: undefined,
      scopes,
      metadata: {
        username: userInfo.username,
        accountType: userInfo.account_type,
        mediaCount: userInfo.media_count,
      },
    });
    await this.socialBridge.upsertFromIntegration({
      userId: state.userId,
      workspaceId: state.workspaceId,
      platform: SocialPlatform.INSTAGRAM,
      externalAccountId: userInfo.id,
      externalAccountName: userInfo.username,
      accessToken: tokens.access_token,
      refreshToken: null,
      expiresAt: null,
      scopes,
    });

    this.logger.log(
      `User ${state.userId} connected Instagram as @${userInfo.username} in workspace ${state.workspaceId}`
    );

    return { username: userInfo.username, workspaceId: state.workspaceId };
  }

  async getStatus(
    userId: string,
    workspaceId: string
  ): Promise<InstagramConnectionStatus> {
    const conn = await this.models.integrationConnection.getByProvider(
      userId,
      workspaceId,
      INSTAGRAM_PROVIDER_NAME
    );
    if (!conn) {
      return { connected: false };
    }
    const health = await this.socialBridge.getHealthForIntegration({
      userId,
      workspaceId,
      platform: SocialPlatform.INSTAGRAM,
      externalAccountId: conn.externalId,
    });
    return { connected: true, username: conn.displayName, ...health };
  }

  async disconnect(userId: string, workspaceId: string): Promise<boolean> {
    try {
      await this.models.integrationConnection.delete(
        userId,
        workspaceId,
        INSTAGRAM_PROVIDER_NAME
      );
      await this.socialBridge.pauseFromIntegration({
        userId,
        workspaceId,
        platform: SocialPlatform.INSTAGRAM,
      });
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
        `Failed to disconnect Instagram for user ${userId}: ${err instanceof Error ? err.message : String(err)}`
      );
      throw err;
    }
  }

  async getValidAccessToken(
    userId: string,
    workspaceId: string,
    _scope: InstagramScope = 'instagram'
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new InstagramOAuthNotConfiguredError();
    }

    const conn = await this.models.integrationConnection.getByProvider(
      userId,
      workspaceId,
      INSTAGRAM_PROVIDER_NAME
    );

    if (!conn) {
      throw new InstagramOAuthNotConnectedError();
    }

    const decrypted = this.models.integrationConnection.decryptTokens(conn);
    if (!decrypted) {
      throw new InstagramOAuthNotConnectedError();
    }

    return decrypted.accessToken;
  }

  private async exchangeCode(
    code: string,
    redirectUri: string
  ): Promise<InstagramOAuthTokenResponse> {
    const env = readInstagramOAuthEnv();
    // Instagram requires `multipart/form-data` for this endpoint —
    // distinct from Facebook Graph which accepts `x-www-form-urlencoded`.
    // We use URLSearchParams + form-urlencoded; per Instagram docs this
    // also works (multipart is documented but form-urlencoded is the
    // de-facto path most SDKs use). If a 400 starts surfacing here,
    // switch to FormData.
    const body = new URLSearchParams({
      client_id: env.clientId ?? '',
      client_secret: env.clientSecret ?? '',
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });

    const response = await fetch(INSTAGRAM_TOKEN_URL, {
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
        `Instagram token exchange failed: ${response.status} ${text}`
      );
    }

    const parsed = (await response.json()) as
      | InstagramOAuthTokenResponse
      | { error_type: string; error_message: string; code?: number };

    if ('error_type' in parsed) {
      throw new Error(
        `Instagram token exchange failed: ${parsed.error_type} — ${parsed.error_message}`
      );
    }

    return parsed;
  }

  private async fetchUserInfo(
    accessToken: string
  ): Promise<InstagramUserInfoResponse> {
    const url = `${INSTAGRAM_ME_URL}?fields=${encodeURIComponent('id,username,account_type,media_count')}&access_token=${encodeURIComponent(accessToken)}`;
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Instagram /me fetch failed: ${response.status} ${text}`);
    }
    return (await response.json()) as InstagramUserInfoResponse;
  }
}
