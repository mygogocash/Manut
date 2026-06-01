// Analytics config (including `analytics.line.*`) is declared and registered
// in `../../config.ts` — single source of truth.
import '../../config';

import { Injectable, Logger } from '@nestjs/common';

import { Config } from '../../../../base';
// keep in sync — re-exported from meta.oauth.ts (Round A scaffolding).
import type { OAuthTokenResult } from './meta.oauth';

/**
 * LINE Messaging API channel + LINE Login OAuth.
 *
 * Two surfaces in one app:
 *   1. LINE Login (user identity) — used to validate the connector flow
 *      and bind a workspace owner to the channel.
 *   2. LINE Messaging API channel access token — long-lived (or
 *      stateless-channel) token used by the poller / webhook ingestion
 *      to call /v2/bot/insight/* endpoints.
 *
 * Config is read at construction. If any required key is missing, the
 * service logs a warning and the OAuth methods throw a clear runtime
 * error when actually invoked. We do NOT crash the server at boot —
 * this lets the analytics module ship without LINE creds configured.
 *
 * Source docs:
 *   - LINE Login OAuth: https://developers.line.biz/en/docs/line-login/integrate-line-login/
 *   - Messaging API: https://developers.line.biz/en/docs/messaging-api/
 *   - Webhook signature: https://developers.line.biz/en/docs/messaging-api/verify-webhook-signature/
 */

const LINE_AUTHORIZE_URL = 'https://access.line.me/oauth2/v2.1/authorize';
const LINE_TOKEN_URL = 'https://api.line.me/oauth2/v2.1/token';
const LINE_REVOKE_URL = 'https://api.line.me/oauth2/v2.1/revoke';
const LINE_PROFILE_URL = 'https://api.line.me/v2/profile';

/** LINE Login response shape (subset we use). */
interface LineTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
}

interface LineProfileResponse {
  userId: string;
  displayName: string;
  pictureUrl?: string;
}

function lineHttpFailure(label: string, response: Response): string {
  return `${label} failed: ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
}

@Injectable()
export class LineOAuthService {
  private readonly logger = new Logger(LineOAuthService.name);

  constructor(private readonly config: Config) {
    if (!this.config.analytics?.line?.channelId) {
      this.logger.warn(
        'LINE OAuth not configured: missing analyticsLine.channelId. Calls will throw at runtime until configured.'
      );
    }
    if (!this.config.analytics?.line?.channelSecret) {
      this.logger.warn(
        'LINE OAuth not configured: missing analyticsLine.channelSecret. Calls will throw at runtime until configured.'
      );
    }
  }

  /**
   * Build the LINE Login authorization URL. The default scope set is
   * `profile openid` — Messaging API access is granted by the channel
   * itself and does not require additional OAuth scopes.
   */
  getAuthUrl(state: string, redirectUri: string, scopes?: string[]): string {
    const channelId = this.requireConfig('channelId');
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: channelId,
      redirect_uri: redirectUri,
      state,
      scope: (scopes && scopes.length > 0
        ? scopes
        : ['profile', 'openid']
      ).join(' '),
    });
    return `${LINE_AUTHORIZE_URL}?${params.toString()}`;
  }

  /**
   * Exchange the auth code for an access token + refresh token pair, then
   * fetch the user's profile to get the externalAccountId we'll use as
   * the SocialConnection key.
   */
  async exchangeCode(
    code: string,
    redirectUri: string
  ): Promise<OAuthTokenResult> {
    const channelId = this.requireConfig('channelId');
    const channelSecret = this.requireConfig('channelSecret');

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: channelId,
      client_secret: channelSecret,
    });

    const tokens = await this.postForm<LineTokenResponse>(LINE_TOKEN_URL, body);

    if (!tokens.access_token) {
      throw new Error('LINE OAuth: token exchange returned no access_token');
    }

    const profile = await this.fetchProfile(tokens.access_token);

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      scopes: tokens.scope ? tokens.scope.split(/\s+/).filter(Boolean) : [],
      expiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : undefined,
      externalAccountId: profile.userId,
      externalAccountName: profile.displayName,
    };
  }

  /**
   * Refresh a LINE Login access token. NOTE: the long-lived Messaging
   * API channel access token does NOT use this — it's a separate
   * stateless token configured in `channelAccessToken`. This refresh
   * applies only to the LINE Login flow (user identity).
   */
  async refreshToken(refreshToken: string): Promise<OAuthTokenResult> {
    const channelId = this.requireConfig('channelId');
    const channelSecret = this.requireConfig('channelSecret');

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: channelId,
      client_secret: channelSecret,
    });

    const tokens = await this.postForm<LineTokenResponse>(LINE_TOKEN_URL, body);
    if (!tokens.access_token) {
      throw new Error('LINE OAuth: token refresh returned no access_token');
    }

    const profile = await this.fetchProfile(tokens.access_token);

    return {
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? refreshToken,
      scopes: tokens.scope ? tokens.scope.split(/\s+/).filter(Boolean) : [],
      expiresAt: tokens.expires_in
        ? new Date(Date.now() + tokens.expires_in * 1000)
        : undefined,
      externalAccountId: profile.userId,
      externalAccountName: profile.displayName,
    };
  }

  /**
   * Revoke an access token. LINE returns 200 with empty body on success.
   * Errors are swallowed by the caller's audit / status flow, but we
   * still surface non-2xx responses so callers can log + alert.
   */
  async revoke(accessToken: string): Promise<void> {
    const channelId = this.requireConfig('channelId');
    const channelSecret = this.requireConfig('channelSecret');

    const body = new URLSearchParams({
      access_token: accessToken,
      client_id: channelId,
      client_secret: channelSecret,
    });

    const response = await fetch(LINE_REVOKE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!response.ok) {
      throw new Error(lineHttpFailure('LINE OAuth revoke', response));
    }
  }

  // -------------------------------------------------------------------------
  // private helpers
  // -------------------------------------------------------------------------

  private requireConfig(key: 'channelId' | 'channelSecret'): string {
    const value = this.config.analytics?.line?.[key];
    if (!value) {
      throw new Error(
        `LINE OAuth not configured: missing analyticsLine.${key}`
      );
    }
    return value;
  }

  private async postForm<T>(url: string, body: URLSearchParams): Promise<T> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!response.ok) {
      throw new Error(
        lineHttpFailure(`LINE OAuth request to ${url}`, response)
      );
    }
    return (await response.json()) as T;
  }

  private async fetchProfile(
    accessToken: string
  ): Promise<LineProfileResponse> {
    const response = await fetch(LINE_PROFILE_URL, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!response.ok) {
      throw new Error(lineHttpFailure('LINE profile fetch', response));
    }
    return (await response.json()) as LineProfileResponse;
  }
}
