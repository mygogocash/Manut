import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';
import { SocialPlatform } from '@prisma/client';

import { SessionCache } from '../../base';
import { Models } from '../../models';
import { SocialConnectionBridgeService } from '../analytics/connections/social-connection-bridge';
import {
  isFacebookOAuthConfigured,
  readFacebookOAuthEnv,
} from './manut-pro-config';
import {
  FACEBOOK_OAUTH_SCOPES,
  FACEBOOK_PROVIDER_NAME,
  type FacebookConnectionStatus,
  type FacebookOAuthStartState,
  type FacebookOAuthTokenResponse,
  type FacebookScope,
  type FacebookUserInfoResponse,
} from './types';

const STATE_KEY_PREFIX = 'FACEBOOK_OAUTH_STATE';
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes — matches Google scaffold

const FACEBOOK_AUTH_URL = 'https://www.facebook.com/v18.0/dialog/oauth';
const FACEBOOK_TOKEN_URL =
  'https://graph.facebook.com/v18.0/oauth/access_token';
const FACEBOOK_ME_URL = 'https://graph.facebook.com/v18.0/me';

/**
 * Thrown when the server is missing `FB_OAUTH_CLIENT_ID` /
 * `FB_OAUTH_CLIENT_SECRET`. Mirrors `SlackOAuthNotConfiguredError`.
 */
export class FacebookOAuthNotConfiguredError extends Error {
  constructor() {
    super(
      'Facebook OAuth client is not configured. Set FB_OAUTH_CLIENT_ID and FB_OAUTH_CLIENT_SECRET.'
    );
    this.name = 'FacebookOAuthNotConfiguredError';
  }
}

/**
 * Thrown when no `IntegrationConnection` row exists for the given
 * user+workspace. Resolver layer translates this into
 * "Connect Facebook to use this feature" UI copy.
 */
export class FacebookOAuthNotConnectedError extends Error {
  constructor() {
    super('Facebook is not connected for this workspace');
    this.name = 'FacebookOAuthNotConnectedError';
  }
}

/**
 * Thrown when Facebook rejects the access token (Graph API error
 * codes 190 / 102 / 463). Tokens expire — see the long-lived exchange
 * note in `types.ts`. For the v1.13.x scaffold we surface 401-class
 * Graph errors via this typed error so the AI tool layer (when it
 * ships) can re-prompt for consent.
 */
export class FacebookOAuthTokenInvalidError extends Error {
  constructor(detail: string) {
    super(`Facebook access token rejected: ${detail}`);
    this.name = 'FacebookOAuthTokenInvalidError';
  }
}

/**
 * Facebook OAuth scaffold.
 *
 * Connect/disconnect plumbing only — mirrors the v1.13.x GitHub OAuth
 * scaffold. AI-callable tools are deferred to a follow-up release.
 *
 * Token model: Graph API returns a short-lived (~1h) user token by
 * default. Long-lived (60-day) exchange via
 * `grant_type=fb_exchange_token` is deferred — when live-import lands
 * the service should call the exchange before storing. Refresh tokens
 * do NOT exist on Graph API; staleness after expiry maps to a
 * `FacebookOAuthTokenInvalidError` and triggers the reconnect path.
 */
@Injectable()
export class FacebookOAuthService {
  private readonly logger = new Logger(FacebookOAuthService.name);

  constructor(
    private readonly models: Models,
    private readonly cache: SessionCache,
    private readonly socialBridge: SocialConnectionBridgeService
  ) {}

  /**
   * Returns true when both client id + secret are configured. Used by
   * the resolver to short-circuit `connectFacebook` and by the frontend
   * to show a "configure OAuth client" message instead of opening a
   * blank popup.
   */
  isConfigured(): boolean {
    return isFacebookOAuthConfigured();
  }

  /**
   * Returns the redirect URI the OAuth callback will land on. Defaults
   * to `${SERVER_URL}/oauth/facebook/callback` when
   * `FB_OAUTH_REDIRECT_URI` is not set.
   */
  resolveRedirectUri(serverOrigin: string): string {
    const explicit = readFacebookOAuthEnv().redirectUriOverride;
    if (explicit) return explicit;
    const origin = serverOrigin.replace(/\/$/, '');
    return `${origin}/oauth/facebook/callback`;
  }

  /**
   * Build the OAuth consent URL. Facebook's authorize endpoint expects
   * `client_id`, `redirect_uri`, `scope`, and `state`. We also set
   * `response_type=code` explicitly (the default, but be explicit) and
   * `auth_type=rerequest` so previously-declined permissions are
   * re-surfaced on re-consent.
   */
  async initiateOAuth(
    userId: string,
    workspaceId: string,
    redirectUri: string
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new FacebookOAuthNotConfiguredError();
    }

    const env = readFacebookOAuthEnv();
    const stateToken = randomUUID();
    const state: FacebookOAuthStartState = {
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
      scope: FACEBOOK_OAUTH_SCOPES,
      state: stateToken,
      response_type: 'code',
      auth_type: 'rerequest',
    });
    return `${FACEBOOK_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange the authorization code for tokens and persist the
   * connection. State is single-use: deleted before the upstream
   * exchange to defeat replay even within the TTL window.
   */
  async handleCallback(
    code: string,
    stateToken: string
  ): Promise<{ displayName: string; workspaceId: string }> {
    const stateKey = `${STATE_KEY_PREFIX}:${stateToken}`;
    const state = await this.cache.get<FacebookOAuthStartState>(stateKey);
    await this.cache.delete(stateKey);

    if (!state) {
      throw new Error('OAuth state expired or invalid');
    }

    if (!this.isConfigured()) {
      throw new FacebookOAuthNotConfiguredError();
    }

    const tokens = await this.exchangeCode(code, state.redirectUri);
    const userInfo = await this.fetchUserInfo(tokens.access_token);

    const scopes = FACEBOOK_OAUTH_SCOPES.split(/[\s,]+/).filter(Boolean);
    const tokenExpiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : undefined;

    await this.models.integrationConnection.upsert({
      userId: state.userId,
      workspaceId: state.workspaceId,
      provider: FACEBOOK_PROVIDER_NAME,
      externalId: userInfo.id,
      displayName: userInfo.name,
      accessToken: tokens.access_token,
      // Graph API doesn't ship refresh tokens; persist `undefined` so
      // the row reads as "no refresh" rather than empty string.
      refreshToken: undefined,
      tokenExpiresAt,
      // Graph API doesn't echo scopes in the token response — persist
      // the static request set for audit/UI.
      scopes,
      metadata: {
        name: userInfo.name,
        email: userInfo.email,
        avatarUrl: userInfo.picture?.data.url,
      },
    });
    await this.socialBridge.upsertFromIntegration({
      userId: state.userId,
      workspaceId: state.workspaceId,
      platform: SocialPlatform.FACEBOOK,
      externalAccountId: userInfo.id,
      externalAccountName: userInfo.name,
      accessToken: tokens.access_token,
      refreshToken: null,
      expiresAt: tokenExpiresAt ?? null,
      scopes,
    });

    this.logger.log(
      `User ${state.userId} connected Facebook as ${userInfo.name} in workspace ${state.workspaceId}`
    );

    return { displayName: userInfo.name, workspaceId: state.workspaceId };
  }

  async getStatus(
    userId: string,
    workspaceId: string
  ): Promise<FacebookConnectionStatus> {
    const conn = await this.models.integrationConnection.getByProvider(
      userId,
      workspaceId,
      FACEBOOK_PROVIDER_NAME
    );
    if (!conn) {
      return { connected: false };
    }
    const health = await this.socialBridge.getHealthForIntegration({
      userId,
      workspaceId,
      platform: SocialPlatform.FACEBOOK,
      externalAccountId: conn.externalId,
    });
    return {
      connected: true,
      displayName: conn.displayName,
      ...health,
    };
  }

  async disconnect(userId: string, workspaceId: string): Promise<boolean> {
    try {
      await this.models.integrationConnection.delete(
        userId,
        workspaceId,
        FACEBOOK_PROVIDER_NAME
      );
      await this.socialBridge.pauseFromIntegration({
        userId,
        workspaceId,
        platform: SocialPlatform.FACEBOOK,
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
        `Failed to disconnect Facebook for user ${userId}: ${err instanceof Error ? err.message : String(err)}`
      );
      throw err;
    }
  }

  /**
   * Returns the stored Facebook access token for AI tools (when they
   * ship) to exercise. Mirrors `SlackOAuthService.getValidAccessToken`
   * shape with a `scope` parameter for API symmetry.
   *
   * No proactive refresh — Graph API tokens don't refresh. When the
   * AI-tools follow-up lands and needs the 60-day window, do the
   * `grant_type=fb_exchange_token` exchange at `handleCallback` time
   * and persist that token instead.
   */
  async getValidAccessToken(
    userId: string,
    workspaceId: string,
    _scope: FacebookScope = 'facebook'
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new FacebookOAuthNotConfiguredError();
    }

    const conn = await this.models.integrationConnection.getByProvider(
      userId,
      workspaceId,
      FACEBOOK_PROVIDER_NAME
    );

    if (!conn) {
      throw new FacebookOAuthNotConnectedError();
    }

    const decrypted = this.models.integrationConnection.decryptTokens(conn);
    if (!decrypted) {
      throw new FacebookOAuthNotConnectedError();
    }

    return decrypted.accessToken;
  }

  private async exchangeCode(
    code: string,
    redirectUri: string
  ): Promise<FacebookOAuthTokenResponse> {
    const env = readFacebookOAuthEnv();
    // Graph API accepts the exchange as a GET with query params. We
    // POST with a form body to mirror the GitHub/Slack scaffolds and
    // keep the secret out of URL logs.
    const body = new URLSearchParams({
      client_id: env.clientId ?? '',
      client_secret: env.clientSecret ?? '',
      code,
      redirect_uri: redirectUri,
    });

    const response = await fetch(FACEBOOK_TOKEN_URL, {
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
        `Facebook token exchange failed: ${response.status} ${text}`
      );
    }

    const parsed = (await response.json()) as
      | FacebookOAuthTokenResponse
      | { error: { message: string; type?: string; code?: number } };

    if ('error' in parsed) {
      throw new Error(
        `Facebook token exchange failed: ${parsed.error.message}${parsed.error.code ? ` (code ${parsed.error.code})` : ''}`
      );
    }

    return parsed;
  }

  private async fetchUserInfo(
    accessToken: string
  ): Promise<FacebookUserInfoResponse> {
    const url = `${FACEBOOK_ME_URL}?fields=${encodeURIComponent('id,name,email,picture')}&access_token=${encodeURIComponent(accessToken)}`;
    const response = await fetch(url, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Facebook /me fetch failed: ${response.status} ${text}`);
    }
    return (await response.json()) as FacebookUserInfoResponse;
  }
}
