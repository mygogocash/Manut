import { randomUUID } from 'node:crypto';

import { Injectable, Logger } from '@nestjs/common';

import { SessionCache } from '../../base';
import { Models } from '../../models';
import { isSlackOAuthConfigured, readSlackOAuthEnv } from './manut-pro-config';
import {
  SLACK_OAUTH_SCOPES,
  SLACK_PROVIDER_NAME,
  type SlackConnectionStatus,
  type SlackOAuthStartState,
  type SlackOAuthTokenResponse,
  type SlackScope,
  type SlackUserInfoResponse,
} from './types';

const STATE_KEY_PREFIX = 'SLACK_OAUTH_STATE';
const STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes — matches Google scaffold

const SLACK_AUTH_URL = 'https://slack.com/oauth/v2/authorize';
const SLACK_TOKEN_URL = 'https://slack.com/api/oauth.v2.access';
const SLACK_USER_INFO_URL = 'https://slack.com/api/users.info';

/**
 * Thrown when the server is missing `SLACK_OAUTH_CLIENT_ID` /
 * `SLACK_OAUTH_CLIENT_SECRET`. Mirrors `GithubOAuthNotConfiguredError`.
 */
export class SlackOAuthNotConfiguredError extends Error {
  constructor() {
    super(
      'Slack OAuth client is not configured. Set SLACK_OAUTH_CLIENT_ID and SLACK_OAUTH_CLIENT_SECRET.'
    );
    this.name = 'SlackOAuthNotConfiguredError';
  }
}

/**
 * Thrown when no `IntegrationConnection` row exists for the given
 * user+workspace. Resolver layer translates this into
 * "Connect Slack to use this feature" UI copy.
 */
export class SlackOAuthNotConnectedError extends Error {
  constructor() {
    super('Slack is not connected for this workspace');
    this.name = 'SlackOAuthNotConnectedError';
  }
}

/**
 * Thrown when Slack rejects the access token (`invalid_auth` /
 * `token_revoked`). Slack bot tokens don't rotate by default; the
 * only remediation is a fresh consent flow, so this maps to the
 * "reconnect" UI path.
 */
export class SlackOAuthTokenInvalidError extends Error {
  constructor(detail: string) {
    super(`Slack access token rejected: ${detail}`);
    this.name = 'SlackOAuthTokenInvalidError';
  }
}

/**
 * Slack OAuth scaffold.
 *
 * Connect/disconnect plumbing only — mirrors the v1.13.x GitHub OAuth
 * scaffold. AI-callable tools are deferred to a follow-up release;
 * when they ship, they'll consume `getValidAccessToken` exactly like
 * the GitHub tools consume `GithubOAuthService.getValidAccessToken`.
 *
 * Token model: Slack OAuth v2 issues long-lived bot tokens
 * (`xoxb-...`) without refresh rotation unless the app explicitly
 * opts into token rotation (a feature flag on the Slack app side).
 * This scaffold treats tokens as durable. If rotation is enabled
 * later, mirror the Google 5-minute refresh leeway pattern here.
 */
@Injectable()
export class SlackOAuthService {
  private readonly logger = new Logger(SlackOAuthService.name);

  constructor(
    private readonly models: Models,
    private readonly cache: SessionCache
  ) {}

  /**
   * Returns true when both client id + secret are configured. Used by
   * the resolver to short-circuit `connectSlack` and by the frontend
   * to show a "configure OAuth client" message instead of opening a
   * blank popup.
   */
  isConfigured(): boolean {
    return isSlackOAuthConfigured();
  }

  /**
   * Returns the redirect URI the OAuth callback will land on. Defaults
   * to `${SERVER_URL}/oauth/slack/callback` when
   * `SLACK_OAUTH_REDIRECT_URI` is not set. Caller passes
   * `serverOrigin` derived from the current request — dev / preview /
   * prod each have different origins.
   */
  resolveRedirectUri(serverOrigin: string): string {
    const explicit = readSlackOAuthEnv().redirectUriOverride;
    if (explicit) return explicit;
    const origin = serverOrigin.replace(/\/$/, '');
    return `${origin}/oauth/slack/callback`;
  }

  /**
   * Build the OAuth consent URL. Slack's v2 authorize endpoint takes
   * `scope` (bot scopes) and optional `user_scope` (user scopes). We
   * only request bot scopes — the read tools all work on the bot
   * grant, which is simpler to revoke (admin removes the app) and
   * avoids the workspace-admin restriction on user-token install.
   */
  async initiateOAuth(
    userId: string,
    workspaceId: string,
    redirectUri: string
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new SlackOAuthNotConfiguredError();
    }

    const env = readSlackOAuthEnv();
    const stateToken = randomUUID();
    const state: SlackOAuthStartState = {
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
      scope: SLACK_OAUTH_SCOPES,
      state: stateToken,
    });
    return `${SLACK_AUTH_URL}?${params.toString()}`;
  }

  /**
   * Exchange the authorization code for tokens and persist the
   * connection. State is single-use: deleted before the upstream
   * exchange to defeat replay even within the TTL window.
   */
  async handleCallback(
    code: string,
    stateToken: string
  ): Promise<{ teamName: string; workspaceId: string }> {
    const stateKey = `${STATE_KEY_PREFIX}:${stateToken}`;
    const state = await this.cache.get<SlackOAuthStartState>(stateKey);
    await this.cache.delete(stateKey);

    if (!state) {
      throw new Error('OAuth state expired or invalid');
    }

    if (!this.isConfigured()) {
      throw new SlackOAuthNotConfiguredError();
    }

    const tokens = await this.exchangeCode(code, state.redirectUri);
    // Slack returns `authed_user.id` — the human who clicked install.
    // Fetch their profile for the connected-as label. If users.info
    // fails (e.g. bot scope hasn't propagated yet), fall back to the
    // authed_user.id so we still persist a useful externalId.
    const userInfo = await this.fetchUserInfo(
      tokens.access_token,
      tokens.authed_user.id
    ).catch(() => null);

    const externalId = `${tokens.team.id}:${tokens.authed_user.id}`;
    const displayName =
      userInfo?.user.profile?.display_name ??
      userInfo?.user.real_name ??
      userInfo?.user.name ??
      tokens.team.name;

    await this.models.integrationConnection.upsert({
      userId: state.userId,
      workspaceId: state.workspaceId,
      provider: SLACK_PROVIDER_NAME,
      externalId,
      displayName,
      accessToken: tokens.access_token,
      // Slack bot tokens don't ship with refresh rotation by default
      // — persist `undefined` so the row reads as "no refresh" rather
      // than empty string. If rotation is later enabled, the response
      // will include `refresh_token` and `expires_in` and this
      // passthrough works unchanged.
      refreshToken: undefined,
      tokenExpiresAt: undefined,
      scopes: tokens.scope.split(/[\s,]+/).filter(Boolean),
      metadata: {
        teamId: tokens.team.id,
        teamName: tokens.team.name,
        botUserId: tokens.bot_user_id,
        appId: tokens.app_id,
        authedUserId: tokens.authed_user.id,
        email: userInfo?.user.profile?.email,
        avatarUrl: userInfo?.user.profile?.image_72,
      },
    });

    this.logger.log(
      `User ${state.userId} connected Slack team ${tokens.team.name} in workspace ${state.workspaceId}`
    );

    return { teamName: tokens.team.name, workspaceId: state.workspaceId };
  }

  async getStatus(
    userId: string,
    workspaceId: string
  ): Promise<SlackConnectionStatus> {
    const conn = await this.models.integrationConnection.getByProvider(
      userId,
      workspaceId,
      SLACK_PROVIDER_NAME
    );
    if (!conn) {
      return { connected: false };
    }
    const metadata = (conn.metadata ?? {}) as { teamName?: string };
    return {
      connected: true,
      teamName: metadata.teamName ?? conn.displayName,
    };
  }

  async disconnect(userId: string, workspaceId: string): Promise<boolean> {
    try {
      await this.models.integrationConnection.delete(
        userId,
        workspaceId,
        SLACK_PROVIDER_NAME
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
        `Failed to disconnect Slack for user ${userId}: ${err instanceof Error ? err.message : String(err)}`
      );
      throw err;
    }
  }

  /**
   * Returns the stored Slack access token for AI tools (when they
   * ship) to exercise. Mirrors `GoogleOAuthService.getValidAccessToken`
   * signature with a `scope` parameter for API symmetry — currently
   * there's only one Slack scope set (`'slack'`) but keeping the
   * parameter avoids a breaking change if we split read/write scopes
   * later.
   *
   * No proactive refresh window: Slack bot tokens are long-lived. If
   * token rotation is opted into on the Slack app side, mirror the
   * Google 5-minute leeway pattern here and call
   * `integrationConnection.updateTokens` after refresh.
   *
   * Failure modes:
   *  - {@link SlackOAuthNotConfiguredError} — server lacks client_id/secret
   *  - {@link SlackOAuthNotConnectedError} — no row in IntegrationConnection
   */
  async getValidAccessToken(
    userId: string,
    workspaceId: string,
    _scope: SlackScope = 'slack'
  ): Promise<string> {
    if (!this.isConfigured()) {
      throw new SlackOAuthNotConfiguredError();
    }

    const conn = await this.models.integrationConnection.getByProvider(
      userId,
      workspaceId,
      SLACK_PROVIDER_NAME
    );

    if (!conn) {
      throw new SlackOAuthNotConnectedError();
    }

    const decrypted = this.models.integrationConnection.decryptTokens(conn);
    if (!decrypted) {
      throw new SlackOAuthNotConnectedError();
    }

    return decrypted.accessToken;
  }

  private async exchangeCode(
    code: string,
    redirectUri: string
  ): Promise<SlackOAuthTokenResponse> {
    const env = readSlackOAuthEnv();
    // Slack's token endpoint accepts client_id/secret either via
    // request body (form-encoded) or HTTP Basic auth. We use the form
    // body to match the GitHub/Google scaffolds.
    const body = new URLSearchParams({
      client_id: env.clientId ?? '',
      client_secret: env.clientSecret ?? '',
      code,
      redirect_uri: redirectUri,
    });

    const response = await fetch(SLACK_TOKEN_URL, {
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
        `Slack token exchange failed: ${response.status} ${text}`
      );
    }

    const parsed = (await response.json()) as SlackOAuthTokenResponse;

    // Slack returns HTTP 200 with `ok: false` on logical failures
    // (invalid_code, invalid_client, etc.). Check `ok` before
    // treating the response as success — GitHub's pattern returns
    // non-2xx, so the GitHub scaffold catches errors via
    // response.ok; Slack requires this extra guard.
    if (!parsed.ok) {
      throw new Error(
        `Slack token exchange failed: ${parsed.error ?? 'unknown_error'}`
      );
    }

    return parsed;
  }

  private async fetchUserInfo(
    accessToken: string,
    userId: string
  ): Promise<SlackUserInfoResponse> {
    const url = `${SLACK_USER_INFO_URL}?user=${encodeURIComponent(userId)}`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Slack users.info fetch failed: ${response.status} ${text}`
      );
    }
    const parsed = (await response.json()) as SlackUserInfoResponse;
    if (!parsed.ok) {
      throw new Error(
        `Slack users.info fetch failed: ${parsed.error ?? 'unknown_error'}`
      );
    }
    return parsed;
  }
}
