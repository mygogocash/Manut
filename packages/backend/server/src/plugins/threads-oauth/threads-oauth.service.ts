import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { SocialPlatform } from '@prisma/client';

import { SessionCache } from '../../base';
import { Models } from '../../models';
import { SocialConnectionBridgeService } from '../analytics/connections/social-connection-bridge';
import {
  isThreadsOAuthConfigured,
  readThreadsOAuthEnv,
} from './manut-pro-config';
import {
  THREADS_OAUTH_SCOPES,
  THREADS_PROVIDER_NAME,
  type ThreadsConnectionStatus,
  type ThreadsOAuthStartState,
  type ThreadsOAuthTokenResponse,
  type ThreadsScope,
  type ThreadsUserInfoResponse,
} from './types';

const STATE_KEY_PREFIX = 'THREADS_OAUTH_STATE';
const STATE_TTL_MS = 10 * 60 * 1000;

const THREADS_AUTH_URL = 'https://threads.net/oauth/authorize';
const THREADS_TOKEN_URL = 'https://graph.threads.net/oauth/access_token';
const THREADS_ME_URL = 'https://graph.threads.net/me';

export class ThreadsOAuthNotConfiguredError extends Error {
  constructor() {
    super(
      'Threads OAuth client is not configured. Set THREADS_OAUTH_CLIENT_ID and THREADS_OAUTH_CLIENT_SECRET.'
    );
    this.name = 'ThreadsOAuthNotConfiguredError';
  }
}

export class ThreadsOAuthNotConnectedError extends Error {
  constructor() {
    super('Threads is not connected for this workspace');
    this.name = 'ThreadsOAuthNotConnectedError';
  }
}

export class ThreadsOAuthTokenInvalidError extends Error {
  constructor(detail: string) {
    super(`Threads access token rejected: ${detail}`);
    this.name = 'ThreadsOAuthTokenInvalidError';
  }
}

/**
 * Threads OAuth scaffold.
 *
 * Connect/disconnect plumbing only — mirrors the v1.13.x Instagram
 * scaffold pattern.  Includes the `threads_content_publish` scope per
 * spec; write tools that exercise this grant are deferred.
 */
@Injectable()
export class ThreadsOAuthService {
  private readonly logger = new Logger(ThreadsOAuthService.name);

  constructor(
    private readonly models: Models,
    private readonly cache: SessionCache,
    private readonly socialBridge: SocialConnectionBridgeService
  ) {}

  isConfigured(): boolean {
    return isThreadsOAuthConfigured();
  }

  resolveRedirectUri(serverOrigin: string): string {
    const explicit = readThreadsOAuthEnv().redirectUriOverride;
    if (explicit) return explicit;
    const origin = serverOrigin.replace(/\/$/, '');
    return `${origin}/oauth/threads/callback`;
  }

  async initiateOAuth(
    userId: string,
    workspaceId: string,
    redirectUri: string
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new ThreadsOAuthNotConfiguredError();
    }

    const env = readThreadsOAuthEnv();
    const stateToken = randomUUID();
    const state: ThreadsOAuthStartState = {
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
      // Threads expects scope as space-delimited, NOT comma-delimited
      // (unlike Instagram). The spec says `threads_basic,threads_content_publish`
      // — we normalise to spaces here for the actual auth URL while
      // keeping the constant comma-delimited for parity with the rest
      // of the scaffolds.
      scope: THREADS_OAUTH_SCOPES.split(',').join(' '),
      response_type: 'code',
      state: stateToken,
    });
    return `${THREADS_AUTH_URL}?${params.toString()}`;
  }

  async handleCallback(
    code: string,
    stateToken: string
  ): Promise<{ username: string; workspaceId: string }> {
    const stateKey = `${STATE_KEY_PREFIX}:${stateToken}`;
    const state = await this.cache.get<ThreadsOAuthStartState>(stateKey);
    await this.cache.delete(stateKey);

    if (!state) {
      throw new Error('OAuth state expired or invalid');
    }

    if (!this.isConfigured()) {
      throw new ThreadsOAuthNotConfiguredError();
    }

    const tokens = await this.exchangeCode(code, state.redirectUri);
    const userInfo = await this.fetchUserInfo(tokens.access_token);

    const scopes = THREADS_OAUTH_SCOPES.split(/[\s,]+/).filter(Boolean);

    await this.models.integrationConnection.upsert({
      userId: state.userId,
      workspaceId: state.workspaceId,
      provider: THREADS_PROVIDER_NAME,
      externalId: userInfo.id,
      displayName: userInfo.username,
      accessToken: tokens.access_token,
      refreshToken: undefined,
      tokenExpiresAt: undefined,
      scopes,
      metadata: {
        username: userInfo.username,
        avatarUrl: userInfo.threads_profile_picture_url,
        biography: userInfo.threads_biography,
      },
    });
    await this.socialBridge.upsertFromIntegration({
      userId: state.userId,
      workspaceId: state.workspaceId,
      platform: SocialPlatform.THREADS,
      externalAccountId: userInfo.id,
      externalAccountName: userInfo.username,
      accessToken: tokens.access_token,
      refreshToken: null,
      expiresAt: null,
      scopes,
    });

    this.logger.log(
      `User ${state.userId} connected Threads as @${userInfo.username} in workspace ${state.workspaceId}`
    );

    return { username: userInfo.username, workspaceId: state.workspaceId };
  }

  async getStatus(
    userId: string,
    workspaceId: string
  ): Promise<ThreadsConnectionStatus> {
    const conn = await this.models.integrationConnection.getByProvider(
      userId,
      workspaceId,
      THREADS_PROVIDER_NAME
    );
    if (!conn) {
      return { connected: false };
    }
    const health = await this.socialBridge.getHealthForIntegration({
      userId,
      workspaceId,
      platform: SocialPlatform.THREADS,
      externalAccountId: conn.externalId,
    });
    return { connected: true, username: conn.displayName, ...health };
  }

  async disconnect(userId: string, workspaceId: string): Promise<boolean> {
    try {
      await this.models.integrationConnection.delete(
        userId,
        workspaceId,
        THREADS_PROVIDER_NAME
      );
      await this.socialBridge.pauseFromIntegration({
        userId,
        workspaceId,
        platform: SocialPlatform.THREADS,
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
        `Failed to disconnect Threads for user ${userId}: ${err instanceof Error ? err.message : String(err)}`
      );
      throw err;
    }
  }

  async getValidAccessToken(
    userId: string,
    workspaceId: string,
    _scope: ThreadsScope = 'threads'
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new ThreadsOAuthNotConfiguredError();
    }

    const conn = await this.models.integrationConnection.getByProvider(
      userId,
      workspaceId,
      THREADS_PROVIDER_NAME
    );

    if (!conn) {
      throw new ThreadsOAuthNotConnectedError();
    }

    const decrypted = this.models.integrationConnection.decryptTokens(conn);
    if (!decrypted) {
      throw new ThreadsOAuthNotConnectedError();
    }

    return decrypted.accessToken;
  }

  private async exchangeCode(
    code: string,
    redirectUri: string
  ): Promise<ThreadsOAuthTokenResponse> {
    const env = readThreadsOAuthEnv();
    const body = new URLSearchParams({
      client_id: env.clientId ?? '',
      client_secret: env.clientSecret ?? '',
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    });

    const response = await fetch(THREADS_TOKEN_URL, {
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
        `Threads token exchange failed: ${response.status} ${text}`
      );
    }

    const parsed = (await response.json()) as
      | ThreadsOAuthTokenResponse
      | { error_type: string; error_message: string; code?: number };

    if ('error_type' in parsed) {
      throw new Error(
        `Threads token exchange failed: ${parsed.error_type} — ${parsed.error_message}`
      );
    }

    return parsed;
  }

  private async fetchUserInfo(
    accessToken: string
  ): Promise<ThreadsUserInfoResponse> {
    const url = `${THREADS_ME_URL}?fields=${encodeURIComponent('id,username,threads_profile_picture_url,threads_biography')}&access_token=${encodeURIComponent(accessToken)}`;
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Threads /me fetch failed: ${response.status} ${text}`);
    }
    return (await response.json()) as ThreadsUserInfoResponse;
  }
}
