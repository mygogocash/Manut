import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import { SessionCache } from '../../base';
import { Models } from '../../models';
import {
  isLinearOAuthConfigured,
  readLinearOAuthEnv,
} from './manut-pro-config';
import {
  LINEAR_OAUTH_SCOPES,
  LINEAR_PROVIDER_NAME,
  type LinearConnectionStatus,
  type LinearOAuthStartState,
  type LinearOAuthTokenResponse,
  type LinearScope,
  type LinearViewerResponse,
} from './types';

const STATE_KEY_PREFIX = 'LINEAR_OAUTH_STATE';
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes — matches Google scaffold

const LINEAR_AUTH_URL = 'https://linear.app/oauth/authorize';
const LINEAR_TOKEN_URL = 'https://api.linear.app/oauth/token';
const LINEAR_GRAPHQL_URL = 'https://api.linear.app/graphql';

/**
 * Thrown when the server is missing `LINEAR_OAUTH_CLIENT_ID` /
 * `LINEAR_OAUTH_CLIENT_SECRET`. Mirrors `GithubOAuthNotConfiguredError`.
 */
export class LinearOAuthNotConfiguredError extends Error {
  constructor() {
    super(
      'Linear OAuth client is not configured. Set LINEAR_OAUTH_CLIENT_ID and LINEAR_OAUTH_CLIENT_SECRET.'
    );
    this.name = 'LinearOAuthNotConfiguredError';
  }
}

/**
 * Thrown when no `IntegrationConnection` row exists for the given
 * user+workspace. Resolver layer translates this into
 * "Connect Linear to use this feature" UI copy.
 */
export class LinearOAuthNotConnectedError extends Error {
  constructor() {
    super('Linear is not connected for this workspace');
    this.name = 'LinearOAuthNotConnectedError';
  }
}

/**
 * Thrown when Linear rejects the access token (401 / 403). Linear's
 * long-lived tokens don't rotate without explicit `prompt=consent`;
 * staleness maps to the "reconnect" UI path.
 */
export class LinearOAuthTokenInvalidError extends Error {
  constructor(detail: string) {
    super(`Linear access token rejected: ${detail}`);
    this.name = 'LinearOAuthTokenInvalidError';
  }
}

/**
 * Linear OAuth scaffold.
 *
 * Connect/disconnect plumbing only — mirrors the v1.13.x GitHub OAuth
 * scaffold. AI-callable tools are deferred to a follow-up release;
 * when they ship, they'll consume `getValidAccessToken` exactly like
 * the GitHub tools.
 *
 * Token model: Linear OAuth issues access tokens with `expires_in =
 * 315360000` (~10 years). Refresh tokens are issued only when
 * `prompt=consent` is on the authorize URL; we omit it because the
 * long-lived token is sufficient for read-only use. Token staleness
 * is surfaced via `LinearOAuthTokenInvalidError` (thrown by AI tools
 * on 401) so the user re-consents.
 */
@Injectable()
export class LinearOAuthService {
  private readonly logger = new Logger(LinearOAuthService.name);

  constructor(
    private readonly models: Models,
    private readonly cache: SessionCache
  ) {}

  /**
   * Returns true when both client id + secret are configured. Used by
   * the resolver to short-circuit `connectLinear` and by the frontend
   * to show a "configure OAuth client" message instead of opening a
   * blank popup.
   */
  isConfigured(): boolean {
    return isLinearOAuthConfigured();
  }

  /**
   * Returns the redirect URI the OAuth callback will land on. Defaults
   * to `${SERVER_URL}/oauth/linear/callback` when
   * `LINEAR_OAUTH_REDIRECT_URI` is not set. Caller passes
   * `serverOrigin` derived from the current request — dev / preview /
   * prod each have different origins.
   */
  resolveRedirectUri(serverOrigin: string): string {
    const explicit = readLinearOAuthEnv().redirectUriOverride;
    if (explicit) return explicit;
    const origin = serverOrigin.replace(/\/$/, '');
    return `${origin}/oauth/linear/callback`;
  }

  /**
   * Build the OAuth consent URL. Linear's authorize endpoint requires
   * `response_type=code` and the scope as a space-separated list (we
   * have only one scope so this is trivial). Omit `prompt=consent` so
   * Linear's long-lived access tokens are issued without refresh
   * tokens — simpler storage and the OAuth Apps-style "reconnect on
   * 401" path.
   */
  async initiateOAuth(
    userId: string,
    workspaceId: string,
    redirectUri: string
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new LinearOAuthNotConfiguredError();
    }

    const env = readLinearOAuthEnv();
    const stateToken = randomUUID();
    const state: LinearOAuthStartState = {
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
      response_type: 'code',
      scope: LINEAR_OAUTH_SCOPES,
      state: stateToken,
    });
    return `${LINEAR_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange the authorization code for tokens and persist the
   * connection. State is single-use: deleted before the upstream
   * exchange to defeat replay even within the TTL window.
   */
  async handleCallback(
    code: string,
    stateToken: string
  ): Promise<{
    displayName: string;
    organizationName: string;
    workspaceId: string;
  }> {
    const stateKey = `${STATE_KEY_PREFIX}:${stateToken}`;
    const state = await this.cache.get<LinearOAuthStartState>(stateKey);
    await this.cache.delete(stateKey);

    if (!state) {
      throw new Error('OAuth state expired or invalid');
    }

    if (!this.isConfigured()) {
      throw new LinearOAuthNotConfiguredError();
    }

    const tokens = await this.exchangeCode(code, state.redirectUri);
    const viewer = await this.fetchViewer(tokens.access_token);
    if (!viewer.data) {
      throw new Error(
        `Linear viewer query failed: ${viewer.errors?.[0]?.message ?? 'unknown'}`
      );
    }

    const displayName =
      viewer.data.viewer.displayName ?? viewer.data.viewer.name;

    await this.models.integrationConnection.upsert({
      userId: state.userId,
      workspaceId: state.workspaceId,
      provider: LINEAR_PROVIDER_NAME,
      externalId: viewer.data.viewer.id,
      displayName,
      accessToken: tokens.access_token,
      // Refresh tokens are only issued when prompt=consent is on the
      // authorize URL — we omit it for the OAuth Apps-style flow, so
      // refresh_token is typically undefined. Passthrough handles both
      // cases without branching.
      refreshToken: tokens.refresh_token,
      tokenExpiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : undefined,
      scopes: tokens.scope.split(/[\s,]+/).filter(Boolean),
      metadata: {
        displayName,
        email: viewer.data.viewer.email,
        avatarUrl: viewer.data.viewer.avatarUrl,
        organizationId: viewer.data.viewer.organization.id,
        organizationName: viewer.data.viewer.organization.name,
        organizationUrlKey: viewer.data.viewer.organization.urlKey,
      },
    });

    this.logger.log(
      `User ${state.userId} connected Linear as ${displayName} (${viewer.data.viewer.organization.name}) in workspace ${state.workspaceId}`
    );

    return {
      displayName,
      organizationName: viewer.data.viewer.organization.name,
      workspaceId: state.workspaceId,
    };
  }

  async getStatus(
    userId: string,
    workspaceId: string
  ): Promise<LinearConnectionStatus> {
    const conn = await this.models.integrationConnection.getByProvider(
      userId,
      workspaceId,
      LINEAR_PROVIDER_NAME
    );
    if (!conn) {
      return { connected: false };
    }
    const metadata = (conn.metadata ?? {}) as {
      displayName?: string;
      organizationName?: string;
    };
    return {
      connected: true,
      displayName: metadata.displayName ?? conn.displayName,
      organizationName: metadata.organizationName,
    };
  }

  async disconnect(userId: string, workspaceId: string): Promise<boolean> {
    try {
      await this.models.integrationConnection.delete(
        userId,
        workspaceId,
        LINEAR_PROVIDER_NAME
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
        `Failed to disconnect Linear for user ${userId}: ${err instanceof Error ? err.message : String(err)}`
      );
      throw err;
    }
  }

  /**
   * Returns the stored Linear access token for AI tools (when they
   * ship) to exercise. Mirrors `GoogleOAuthService.getValidAccessToken`
   * signature with a `scope` parameter for API symmetry. Currently
   * there's only one Linear scope set (`'linear'`); the parameter
   * defaults to it but is reserved for future read/write splits.
   *
   * No proactive refresh window: Linear tokens are ~10y-lived. If we
   * later add `prompt=consent` to issue refresh tokens, mirror the
   * Google 5-minute leeway pattern here and call
   * `integrationConnection.updateTokens` after refresh.
   *
   * Failure modes:
   *  - {@link LinearOAuthNotConfiguredError} — server lacks client_id/secret
   *  - {@link LinearOAuthNotConnectedError} — no row in IntegrationConnection
   */
  async getValidAccessToken(
    userId: string,
    workspaceId: string,
    _scope: LinearScope = 'linear'
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new LinearOAuthNotConfiguredError();
    }

    const conn = await this.models.integrationConnection.getByProvider(
      userId,
      workspaceId,
      LINEAR_PROVIDER_NAME
    );

    if (!conn) {
      throw new LinearOAuthNotConnectedError();
    }

    const decrypted = this.models.integrationConnection.decryptTokens(conn);
    if (!decrypted) {
      throw new LinearOAuthNotConnectedError();
    }

    return decrypted.accessToken;
  }

  private async exchangeCode(
    code: string,
    redirectUri: string
  ): Promise<LinearOAuthTokenResponse> {
    const env = readLinearOAuthEnv();
    const body = new URLSearchParams({
      client_id: env.clientId ?? '',
      client_secret: env.clientSecret ?? '',
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    });

    const response = await fetch(LINEAR_TOKEN_URL, {
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
        `Linear token exchange failed: ${response.status} ${text}`
      );
    }

    const parsed = (await response.json()) as
      | LinearOAuthTokenResponse
      | { error: string; error_description?: string };

    if ('error' in parsed) {
      throw new Error(
        `Linear token exchange failed: ${parsed.error}${parsed.error_description ? ` — ${parsed.error_description}` : ''}`
      );
    }

    return parsed;
  }

  /**
   * Linear has no REST `/me` endpoint; identity lookups go through
   * the GraphQL `viewer` query. We fetch just the fields needed for
   * the integration card label.
   */
  private async fetchViewer(
    accessToken: string
  ): Promise<LinearViewerResponse> {
    const query = `query {
      viewer {
        id
        name
        displayName
        email
        avatarUrl
        organization {
          id
          name
          urlKey
        }
      }
    }`;
    const response = await fetch(LINEAR_GRAPHQL_URL, {
      method: 'POST',
      headers: {
        Authorization: accessToken,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ query }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Linear viewer fetch failed: ${response.status} ${text}`);
    }
    return (await response.json()) as LinearViewerResponse;
  }
}
