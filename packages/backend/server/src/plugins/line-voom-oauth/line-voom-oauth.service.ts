import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { SocialPlatform } from '@prisma/client';

import { SessionCache } from '../../base';
import { Models } from '../../models';
import { SocialConnectionBridgeService } from '../analytics/connections/social-connection-bridge';
import {
  isLineVoomOAuthConfigured,
  readLineVoomOAuthEnv,
} from './manut-pro-config';
import {
  LINE_VOOM_OAUTH_SCOPES,
  LINE_VOOM_PROVIDER_NAME,
  type LineVoomConnectionStatus,
  type LineVoomOAuthStartState,
  type LineVoomOAuthTokenResponse,
  type LineVoomProfileResponse,
  type LineVoomScope,
} from './types';

const STATE_KEY_PREFIX = 'LINE_VOOM_OAUTH_STATE';
const STATE_TTL_MS = 10 * 60 * 1000;

const LINE_VOOM_AUTH_URL = 'https://access.line.me/oauth2/v2.1/authorize';
const LINE_VOOM_TOKEN_URL = 'https://api.line.me/oauth2/v2.1/token';
const LINE_VOOM_PROFILE_URL = 'https://api.line.me/v2/profile';

function formatLineVoomHttpFailure(
  operation: 'token exchange' | 'profile fetch',
  response: Response
): string {
  return `LINE VOOM ${operation} failed: ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
}

function sanitizeProviderErrorCode(error: string): string {
  const safe = error.replace(/[^\w.-]/g, '').slice(0, 80);
  return safe || 'provider_error';
}

export class LineVoomOAuthNotConfiguredError extends Error {
  constructor() {
    super(
      'LINE VOOM OAuth client is not configured. Set LINE_OAUTH_CLIENT_ID and LINE_OAUTH_CLIENT_SECRET.'
    );
    this.name = 'LineVoomOAuthNotConfiguredError';
  }
}

export class LineVoomOAuthNotConnectedError extends Error {
  constructor() {
    super('LINE VOOM is not connected for this workspace');
    this.name = 'LineVoomOAuthNotConnectedError';
  }
}

export class LineVoomOAuthTokenInvalidError extends Error {
  constructor(detail: string) {
    super(`LINE VOOM access token rejected: ${detail}`);
    this.name = 'LineVoomOAuthTokenInvalidError';
  }
}

/**
 * LINE VOOM OAuth scaffold (LINE Login v2.1).
 *
 * Connect/disconnect plumbing only — mirrors the v1.13.x Slack OAuth
 * scaffold. Persists both access + refresh tokens (LINE returns
 * both). AI-callable tools deferred.
 */
@Injectable()
export class LineVoomOAuthService {
  private readonly logger = new Logger(LineVoomOAuthService.name);

  constructor(
    private readonly models: Models,
    private readonly cache: SessionCache,
    private readonly socialBridge: SocialConnectionBridgeService
  ) {}

  isConfigured(): boolean {
    return isLineVoomOAuthConfigured();
  }

  resolveRedirectUri(serverOrigin: string): string {
    const explicit = readLineVoomOAuthEnv().redirectUriOverride;
    if (explicit) return explicit;
    const origin = serverOrigin.replace(/\/$/, '');
    return `${origin}/oauth/line-voom/callback`;
  }

  async initiateOAuth(
    userId: string,
    workspaceId: string,
    redirectUri: string
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new LineVoomOAuthNotConfiguredError();
    }

    const env = readLineVoomOAuthEnv();
    const stateToken = randomUUID();
    // LINE OIDC requires a nonce when `openid` is in scope. We
    // generate it server-side, stash it with the state, and would
    // validate against the ID token's `nonce` claim if we decoded
    // the ID token here. Scaffold persists the raw access token; ID
    // token decode is deferred to the live-import follow-up.
    const nonce = randomUUID();
    const state: LineVoomOAuthStartState = {
      userId,
      workspaceId,
      redirectUri,
      nonce,
    };
    await this.cache.set(`${STATE_KEY_PREFIX}:${stateToken}`, state, {
      ttl: STATE_TTL_MS,
    });

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: env.clientId ?? '',
      redirect_uri: redirectUri,
      scope: LINE_VOOM_OAUTH_SCOPES,
      state: stateToken,
      nonce,
      // `bot_prompt=normal` reserved for when we add a Messaging API
      // bot link — not needed for VOOM read scopes.
    });
    return `${LINE_VOOM_AUTH_URL}?${params.toString()}`;
  }

  async handleCallback(
    code: string,
    stateToken: string
  ): Promise<{ displayName: string; workspaceId: string }> {
    const stateKey = `${STATE_KEY_PREFIX}:${stateToken}`;
    const state = await this.cache.get<LineVoomOAuthStartState>(stateKey);
    await this.cache.delete(stateKey);

    if (!state) {
      throw new Error('OAuth state expired or invalid');
    }

    if (!this.isConfigured()) {
      throw new LineVoomOAuthNotConfiguredError();
    }

    const tokens = await this.exchangeCode(code, state.redirectUri);
    const profile = await this.fetchProfile(tokens.access_token);

    const scopes = tokens.scope.split(/\s+/).filter(Boolean);
    const tokenExpiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    await this.models.integrationConnection.upsert({
      userId: state.userId,
      workspaceId: state.workspaceId,
      provider: LINE_VOOM_PROVIDER_NAME,
      externalId: profile.userId,
      displayName: profile.displayName,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      tokenExpiresAt,
      scopes,
      metadata: {
        displayName: profile.displayName,
        avatarUrl: profile.pictureUrl,
        statusMessage: profile.statusMessage,
      },
    });
    await this.socialBridge.upsertFromIntegration({
      userId: state.userId,
      workspaceId: state.workspaceId,
      platform: SocialPlatform.LINE_VOOM,
      externalAccountId: profile.userId,
      externalAccountName: profile.displayName,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresAt: tokenExpiresAt,
      scopes,
    });

    this.logger.log(
      `User ${state.userId} connected LINE VOOM as ${profile.displayName} in workspace ${state.workspaceId}`
    );

    return {
      displayName: profile.displayName,
      workspaceId: state.workspaceId,
    };
  }

  async getStatus(
    userId: string,
    workspaceId: string
  ): Promise<LineVoomConnectionStatus> {
    const conn = await this.models.integrationConnection.getByProvider(
      userId,
      workspaceId,
      LINE_VOOM_PROVIDER_NAME
    );
    if (!conn) {
      return { connected: false };
    }
    const health = await this.socialBridge.getHealthForIntegration({
      userId,
      workspaceId,
      platform: SocialPlatform.LINE_VOOM,
      externalAccountId: conn.externalId,
    });
    return { connected: true, displayName: conn.displayName, ...health };
  }

  async disconnect(userId: string, workspaceId: string): Promise<boolean> {
    try {
      await this.models.integrationConnection.delete(
        userId,
        workspaceId,
        LINE_VOOM_PROVIDER_NAME
      );
      await this.socialBridge.pauseFromIntegration({
        userId,
        workspaceId,
        platform: SocialPlatform.LINE_VOOM,
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
        `Failed to disconnect LINE VOOM for user ${userId}: ${err instanceof Error ? err.message : String(err)}`
      );
      throw err;
    }
  }

  async getValidAccessToken(
    userId: string,
    workspaceId: string,
    _scope: LineVoomScope = 'line-voom'
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new LineVoomOAuthNotConfiguredError();
    }

    const conn = await this.models.integrationConnection.getByProvider(
      userId,
      workspaceId,
      LINE_VOOM_PROVIDER_NAME
    );

    if (!conn) {
      throw new LineVoomOAuthNotConnectedError();
    }

    const decrypted = this.models.integrationConnection.decryptTokens(conn);
    if (!decrypted) {
      throw new LineVoomOAuthNotConnectedError();
    }

    return decrypted.accessToken;
  }

  private async exchangeCode(
    code: string,
    redirectUri: string
  ): Promise<LineVoomOAuthTokenResponse> {
    const env = readLineVoomOAuthEnv();
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: env.clientId ?? '',
      client_secret: env.clientSecret ?? '',
    });

    const response = await fetch(LINE_VOOM_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      body,
    });

    if (!response.ok) {
      throw new Error(formatLineVoomHttpFailure('token exchange', response));
    }

    const parsed = (await response.json()) as
      | LineVoomOAuthTokenResponse
      | { error: string; error_description?: string };

    if ('error' in parsed && parsed.error) {
      throw new Error(
        `LINE VOOM token exchange failed: ${sanitizeProviderErrorCode(parsed.error)}`
      );
    }

    // After the error-branch guard, narrow the union to the success
    // shape via a final cast. TypeScript can't infer this narrowing
    // because the discriminant `error` isn't a required field of the
    // success shape — same pattern used in the Slack scaffold.
    return parsed as LineVoomOAuthTokenResponse;
  }

  private async fetchProfile(
    accessToken: string
  ): Promise<LineVoomProfileResponse> {
    const response = await fetch(LINE_VOOM_PROFILE_URL, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      throw new Error(formatLineVoomHttpFailure('profile fetch', response));
    }
    return (await response.json()) as LineVoomProfileResponse;
  }
}
