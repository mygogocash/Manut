// Analytics config (including `analytics.tiktok.*`) is declared and registered
// in `../../config.ts` — single source of truth.
import '../../config';

import { Injectable, Logger } from '@nestjs/common';

import { Config } from '../../../../base';
import type { OAuthTokenResult } from './meta.oauth';

/**
 * TikTok OAuth — Display API tier.
 *
 * Per docs/analytics-platform.md risk #12: TikTok publish webhooks DO NOT
 * exist for non-partner apps. This service only requests Display-API scopes
 * (`user.info.basic`, `video.list`). Partner-only research scopes (research.*)
 * are intentionally NOT requested — they would be rejected and break the
 * OAuth dialog.
 *
 * Refresh tokens have an expiry (~1 year per TikTok docs); the connection
 * service must surface that expiry so a workspace can re-auth before the
 * refresh token itself dies.
 */

/**
 * Config keys are declared and registered in `plugins/analytics/config.ts`:
 *   - analytics.tiktok.clientKey      — TikTok Login Kit client_key
 *   - analytics.tiktok.clientSecret   — used both for OAuth and for HMAC-SHA256
 *                                       webhook signature verification
 *   - analytics.tiktok.callbackUrl    — registered redirect_uri
 */

const TIKTOK_AUTHORIZE_URL = 'https://www.tiktok.com/v2/auth/authorize/';
const TIKTOK_TOKEN_URL = 'https://open.tiktokapis.com/v2/oauth/token/';

/**
 * Display-API tier scopes only. Do NOT add research.* scopes — they are
 * partner-only and TikTok rejects the authorize call entirely when an
 * unapproved scope is requested, breaking the user's connect flow.
 */
export const TIKTOK_SCOPES = ['user.info.basic', 'video.list'] as const;

interface TikTokTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_expires_in?: number;
  open_id?: string;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

interface TikTokUserInfoResponse {
  data?: {
    user?: {
      open_id?: string;
      display_name?: string;
      union_id?: string;
    };
  };
  error?: {
    code?: string;
    message?: string;
  };
}

@Injectable()
export class TikTokOAuthService {
  private readonly logger = new Logger(TikTokOAuthService.name);

  constructor(private readonly config: Config) {}

  /**
   * Build the TikTok authorize URL. State must be a server-generated nonce
   * the caller persists and verifies on callback.
   */
  getAuthUrl(state: string, redirectUri: string, scopes?: string[]): string {
    const { clientKey } = this.requireCreds();
    if (!state) {
      throw new Error('TikTokOAuthService.getAuthUrl: state is required');
    }
    if (!redirectUri) {
      throw new Error(
        'TikTokOAuthService.getAuthUrl: redirectUri is required'
      );
    }

    const scopeList =
      scopes && scopes.length > 0 ? scopes : [...TIKTOK_SCOPES];

    const params = new URLSearchParams({
      client_key: clientKey,
      response_type: 'code',
      scope: scopeList.join(','),
      redirect_uri: redirectUri,
      state,
    });

    return `${TIKTOK_AUTHORIZE_URL}?${params.toString()}`;
  }

  async exchangeCode(
    code: string,
    redirectUri: string
  ): Promise<OAuthTokenResult> {
    if (!code) {
      throw new Error('TikTokOAuthService.exchangeCode: code is required');
    }
    const { clientKey, clientSecret } = this.requireCreds();

    const body = new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
      redirect_uri: redirectUri,
    });

    const token = await this.postToken(body);
    return this.toResult(token);
  }

  async refreshToken(refreshToken: string): Promise<OAuthTokenResult> {
    if (!refreshToken) {
      throw new Error(
        'TikTokOAuthService.refreshToken: refreshToken is required'
      );
    }
    const { clientKey, clientSecret } = this.requireCreds();

    const body = new URLSearchParams({
      client_key: clientKey,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    });

    const token = await this.postToken(body);
    return this.toResult(token);
  }

  // ---------------------------------------------------------------------------
  // private
  // ---------------------------------------------------------------------------

  private requireCreds(): {
    clientKey: string;
    clientSecret: string;
    callbackUrl: string;
  } {
    const cfg = this.config.analytics?.tiktok;
    const clientKey = cfg?.clientKey ?? '';
    const clientSecret = cfg?.clientSecret ?? '';
    const callbackUrl = cfg?.callbackUrl ?? '';

    if (!clientKey || !clientSecret) {
      throw new Error(
        'analytics.tiktok.clientKey and analytics.tiktok.clientSecret must be configured. See docs/analytics-approvals.md §2.'
      );
    }
    return { clientKey, clientSecret, callbackUrl };
  }

  private async postToken(body: URLSearchParams): Promise<TikTokTokenResponse> {
    const res = await fetch(TIKTOK_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Cache-Control': 'no-cache',
      },
      body: body.toString(),
    });

    const json = (await res.json().catch(() => ({}))) as TikTokTokenResponse;

    if (!res.ok || json.error) {
      // Never log credentials. Log only TikTok's error code/description.
      this.logger.warn(
        `TikTok token endpoint error: ${json.error ?? res.status} ${
          json.error_description ?? ''
        }`
      );
      throw new Error(
        `TikTok OAuth failed: ${json.error ?? `HTTP ${res.status}`}`
      );
    }

    if (!json.access_token) {
      throw new Error('TikTok OAuth: response missing access_token');
    }

    return json;
  }

  private async toResult(
    token: TikTokTokenResponse
  ): Promise<OAuthTokenResult> {
    const expiresAt =
      typeof token.expires_in === 'number'
        ? new Date(Date.now() + token.expires_in * 1000)
        : undefined;

    const scopes = token.scope ? token.scope.split(',').filter(Boolean) : [];

    let externalAccountId = token.open_id ?? '';
    let externalAccountName = '';

    // Best-effort user info lookup. Failure here must NOT break the OAuth
    // exchange itself — we still have a valid token; the connection just
    // shows a placeholder name until the next sync.
    try {
      const info = await this.fetchUserInfo(token.access_token);
      const user = info.data?.user;
      if (user) {
        externalAccountId = user.open_id ?? externalAccountId;
        externalAccountName = user.display_name ?? '';
      }
    } catch (error: unknown) {
      this.logger.warn(
        `TikTok user/info lookup failed (non-fatal): ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }

    if (!externalAccountId) {
      throw new Error(
        'TikTok OAuth: could not resolve open_id from token or user/info'
      );
    }

    return {
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      scopes,
      expiresAt,
      externalAccountId,
      externalAccountName: externalAccountName || externalAccountId,
    };
  }

  private async fetchUserInfo(
    accessToken: string
  ): Promise<TikTokUserInfoResponse> {
    const url = new URL('https://open.tiktokapis.com/v2/user/info/');
    url.searchParams.set('fields', 'open_id,union_id,display_name');
    const res = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });
    return (await res.json().catch(() => ({}))) as TikTokUserInfoResponse;
  }
}
