// Analytics config (including `analytics.meta.*`) is declared and registered
// in `../../config.ts` — single source of truth.
import '../../config';

import { Injectable, Logger } from '@nestjs/common';

import { Config } from '../../../../base';

/**
 * Single Meta OAuth surface for Facebook, Instagram (Business) and Threads —
 * one Meta app, scope-narrowed per platform (PRD §6 OAuth flow, §8 platform notes).
 *
 * Real implementation. Credentials are configured at runtime via the typed
 * Config under `analytics.meta.{appId,appSecret,callbackUrl}`. The service
 * fails fast (clear error message) if a flow is invoked while credentials
 * are missing — this is intentional so misconfiguration surfaces during
 * the OAuth round-trip, not at server boot (a workspace may never use Meta
 * and we do not want to block startup on unset secrets).
 *
 * The OAuthTokenResult contract is exported from this file because Round A
 * already had `line.oauth.ts` and `tiktok.oauth.ts` re-export the type from
 * here. Keep that contract.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type MetaPlatform = 'FACEBOOK' | 'INSTAGRAM' | 'THREADS';

export interface OAuthTokenResult {
  accessToken: string;
  refreshToken?: string;
  scopes: string[];
  expiresAt?: Date;
  externalAccountId: string;
  externalAccountName: string;
}

export interface MetaAccount {
  id: string;
  name: string;
}

// ---------------------------------------------------------------------------
// Config schema
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Graph API version is pinned. Bumping should be a deliberate change so we
// can re-validate scope/field deprecations.
const GRAPH_API_VERSION = 'v19.0';
const FB_AUTHORIZE_URL = `https://www.facebook.com/${GRAPH_API_VERSION}/dialog/oauth`;
const FB_TOKEN_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}/oauth/access_token`;
const FB_GRAPH_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

// Threads has its own authorize host but uses graph.threads.net for
// the token + API endpoints (Meta docs, accessed at impl time). The
// short-lived token exchange goes through the same FB token endpoint
// when the auth code originated from the Threads dialog (Meta unified
// the v19 token endpoint); the long-lived swap below has its own URL.
const THREADS_AUTHORIZE_URL = 'https://www.threads.net/oauth/authorize';
const THREADS_LONG_LIVED_TOKEN_URL =
  'https://graph.threads.net/access_token';
const THREADS_REFRESH_TOKEN_URL =
  'https://graph.threads.net/refresh_access_token';
const THREADS_API_URL = 'https://graph.threads.net/v1.0';

// Per-platform scope sets. See PRD §8 + §10 risk #14 (pages_manage_metadata).
const SCOPES: Record<MetaPlatform, string[]> = {
  FACEBOOK: [
    'pages_show_list',
    'pages_read_engagement',
    // pages_manage_metadata is required to subscribe a Page to webhooks
    // (POST /{page-id}/subscribed_apps). Read-only Page Insights does not
    // grant webhook subscription rights — Meta App Review accepts this
    // justification when paired with a clear demo video. See PRD §10 risk #14.
    'pages_manage_metadata',
    'read_insights',
  ],
  INSTAGRAM: [
    'instagram_basic',
    'instagram_manage_insights',
    // IG Business attaches to a FB Page; pages_show_list lets us list the
    // Pages whose IG accounts the workspace can connect.
    'pages_show_list',
  ],
  THREADS: ['threads_basic', 'threads_read_replies'],
};

interface FbTokenResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
}

interface FbDebugTokenResponse {
  data: {
    app_id?: string;
    user_id?: string;
    expires_at?: number;
    scopes?: string[];
  };
}

interface FbAccountsResponse {
  data: Array<{ id: string; name: string }>;
}

interface ThreadsTokenResponse {
  access_token: string;
  user_id?: string;
  expires_in?: number;
  token_type?: string;
}

interface ThreadsUserResponse {
  id: string;
  username?: string;
  name?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

@Injectable()
export class MetaOAuthService {
  private readonly logger = new Logger(MetaOAuthService.name);

  constructor(private readonly config: Config) {}

  /**
   * Build the platform-specific authorize URL. We use ONE Meta app but
   * narrow `scope` per platform so we never grant more than the workspace
   * actually uses (least privilege — see PRD §10 risk #14).
   */
  getAuthUrl(
    platform: MetaPlatform,
    state: string,
    redirectUri: string
  ): string {
    const { appId } = this.requireCreds();
    if (!state) {
      throw new Error('MetaOAuthService.getAuthUrl: state is required');
    }
    if (!redirectUri) {
      throw new Error(
        'MetaOAuthService.getAuthUrl: redirectUri is required'
      );
    }

    const scopes = SCOPES[platform];
    if (!scopes) {
      throw new Error(
        `MetaOAuthService.getAuthUrl: unsupported platform ${String(platform)}`
      );
    }

    const params = new URLSearchParams({
      client_id: appId,
      redirect_uri: redirectUri,
      state,
      response_type: 'code',
      scope: scopes.join(','),
    });

    const authorizeBase =
      platform === 'THREADS' ? THREADS_AUTHORIZE_URL : FB_AUTHORIZE_URL;

    return `${authorizeBase}?${params.toString()}`;
  }

  /**
   * Exchange an authorization code for a short-lived access token. Caller
   * is responsible for following up with `exchangeForLongLivedToken` for
   * Facebook/Instagram. Threads short-lived tokens are exchanged via the
   * Threads-specific long-lived endpoint.
   *
   * NOTE: This method does NOT know which platform the code came from —
   * the caller stores `state.platform` and calls the right downstream
   * helper. We return the raw token + guess externalAccountId as best we
   * can; concrete account selection happens in `listAccessibleAccounts`.
   */
  async exchangeCode(
    code: string,
    redirectUri: string
  ): Promise<OAuthTokenResult> {
    const { appId, appSecret } = this.requireCreds();
    if (!code) {
      throw new Error('MetaOAuthService.exchangeCode: code is required');
    }

    // Default path: Facebook/Instagram. The Graph token endpoint accepts
    // codes from the FB authorize dialog and IG-business flows alike.
    const params = new URLSearchParams({
      client_id: appId,
      client_secret: appSecret,
      redirect_uri: redirectUri,
      code,
    });

    const data = await this.fetchJson<FbTokenResponse>(
      `${FB_TOKEN_URL}?${params.toString()}`,
      { method: 'GET' }
    );

    const expiresAt =
      typeof data.expires_in === 'number' && data.expires_in > 0
        ? new Date(Date.now() + data.expires_in * 1000)
        : undefined;

    // We don't know account id/name yet — caller decides via list step.
    return {
      accessToken: data.access_token,
      scopes: [],
      expiresAt,
      externalAccountId: '',
      externalAccountName: '',
    };
  }

  /**
   * Exchange a short-lived FB user-access token for a long-lived one
   * (~60 days). Implements the `grant_type=fb_exchange_token` flow.
   *
   * For Threads, callers should use the Threads-specific path (the API
   * sniffs the token shape and returns 60-day tokens via a different
   * endpoint). We fall through to that endpoint when Graph rejects.
   */
  async exchangeForLongLivedToken(
    shortLivedToken: string
  ): Promise<OAuthTokenResult> {
    const { appId, appSecret } = this.requireCreds();
    if (!shortLivedToken) {
      throw new Error(
        'MetaOAuthService.exchangeForLongLivedToken: token is required'
      );
    }

    const params = new URLSearchParams({
      grant_type: 'fb_exchange_token',
      client_id: appId,
      client_secret: appSecret,
      fb_exchange_token: shortLivedToken,
    });

    try {
      const data = await this.fetchJson<FbTokenResponse>(
        `${FB_TOKEN_URL}?${params.toString()}`,
        { method: 'GET' }
      );

      const expiresAt =
        typeof data.expires_in === 'number' && data.expires_in > 0
          ? new Date(Date.now() + data.expires_in * 1000)
          : undefined;

      return {
        accessToken: data.access_token,
        scopes: [],
        expiresAt,
        externalAccountId: '',
        externalAccountName: '',
      };
    } catch (fbErr) {
      // Threads tokens look superficially the same but exchange via a
      // dedicated endpoint. Fall back before surfacing the FB error.
      try {
        const threadsParams = new URLSearchParams({
          grant_type: 'th_exchange_token',
          client_secret: appSecret,
          access_token: shortLivedToken,
        });
        const data = await this.fetchJson<ThreadsTokenResponse>(
          `${THREADS_LONG_LIVED_TOKEN_URL}?${threadsParams.toString()}`,
          { method: 'GET' }
        );
        const expiresAt =
          typeof data.expires_in === 'number' && data.expires_in > 0
            ? new Date(Date.now() + data.expires_in * 1000)
            : undefined;
        return {
          accessToken: data.access_token,
          scopes: [],
          expiresAt,
          externalAccountId: data.user_id ?? '',
          externalAccountName: '',
        };
      } catch {
        throw fbErr;
      }
    }
  }

  /**
   * Refresh a long-lived token. For Facebook/Instagram a long-lived user
   * token is "refreshed" by re-running the fb_exchange_token flow against
   * itself (Meta accepts a long-lived token as input and returns a fresh
   * one). For Threads the API exposes an explicit refresh endpoint.
   *
   * Cron schedule (weekly per PRD §6) is owned by another module.
   */
  async refreshToken(longLivedToken: string): Promise<OAuthTokenResult> {
    if (!longLivedToken) {
      throw new Error('MetaOAuthService.refreshToken: token is required');
    }

    // Threads first — its endpoint is unambiguous and returns 400 quickly
    // when the token is not a Threads token, so we try it once and fall
    // through to Meta's exchange.
    try {
      const params = new URLSearchParams({
        grant_type: 'th_refresh_token',
        access_token: longLivedToken,
      });
      const data = await this.fetchJson<ThreadsTokenResponse>(
        `${THREADS_REFRESH_TOKEN_URL}?${params.toString()}`,
        { method: 'GET' }
      );
      const expiresAt =
        typeof data.expires_in === 'number' && data.expires_in > 0
          ? new Date(Date.now() + data.expires_in * 1000)
          : undefined;
      return {
        accessToken: data.access_token,
        scopes: [],
        expiresAt,
        externalAccountId: data.user_id ?? '',
        externalAccountName: '',
      };
    } catch {
      // Fall through to FB exchange below.
    }

    return this.exchangeForLongLivedToken(longLivedToken);
  }

  /**
   * After OAuth completes, the user picks WHICH page / IG biz / Threads
   * profile to connect. This method enumerates the choices for the picker
   * UI. Falls back to a single "self" account on Threads (a Threads token
   * is bound to one user).
   */
  async listAccessibleAccounts(
    accessToken: string,
    platform: MetaPlatform
  ): Promise<MetaAccount[]> {
    if (!accessToken) {
      throw new Error(
        'MetaOAuthService.listAccessibleAccounts: accessToken is required'
      );
    }

    if (platform === 'FACEBOOK') {
      const data = await this.fetchJson<FbAccountsResponse>(
        `${FB_GRAPH_URL}/me/accounts?fields=id,name&access_token=${encodeURIComponent(accessToken)}`,
        { method: 'GET' }
      );
      return (data.data ?? []).map(p => ({ id: p.id, name: p.name }));
    }

    if (platform === 'INSTAGRAM') {
      // IG Business accounts hang off Pages — list pages, then expand each
      // page to its connected IG user.
      const pages = await this.fetchJson<{
        data: Array<{
          id: string;
          name: string;
          instagram_business_account?: { id: string; username?: string };
        }>;
      }>(
        `${FB_GRAPH_URL}/me/accounts?fields=id,name,instagram_business_account{id,username}&access_token=${encodeURIComponent(accessToken)}`,
        { method: 'GET' }
      );
      const out: MetaAccount[] = [];
      for (const page of pages.data ?? []) {
        const ig = page.instagram_business_account;
        if (ig?.id) {
          out.push({
            id: ig.id,
            name: ig.username ?? page.name,
          });
        }
      }
      return out;
    }

    // THREADS — one token = one user. Resolve the profile shape.
    const me = await this.fetchJson<ThreadsUserResponse>(
      `${THREADS_API_URL}/me?fields=id,username,name&access_token=${encodeURIComponent(accessToken)}`,
      { method: 'GET' }
    );
    return [
      {
        id: me.id,
        name: me.username ?? me.name ?? me.id,
      },
    ];
  }

  // -------------------------------------------------------------------------
  // private helpers
  // -------------------------------------------------------------------------

  private requireCreds(): {
    appId: string;
    appSecret: string;
    callbackUrl: string;
  } {
    const meta = this.config.analytics?.meta;
    const appId = meta?.appId ?? '';
    const appSecret = meta?.appSecret ?? '';
    const callbackUrl = meta?.callbackUrl ?? '';

    if (!appId || !appSecret) {
      throw new Error(
        'MetaOAuthService: analyticsMeta.appId / appSecret are not configured. Set them via runtime config before initiating an OAuth flow.'
      );
    }
    return { appId, appSecret, callbackUrl };
  }

  private async fetchJson<T>(url: string, init: RequestInit): Promise<T> {
    const res = await fetch(url, init);
    const text = await res.text();
    if (!res.ok) {
      // Truncate to keep token fragments out of logs.
      const snippet = text.slice(0, 256);
      this.logger.warn(
        `Meta API error ${res.status} for ${this.redactUrl(url)}: ${snippet}`
      );
      throw new Error(
        `Meta API request failed: ${res.status} ${res.statusText}`
      );
    }
    try {
      return JSON.parse(text) as T;
    } catch (err) {
      throw new Error(
        `Meta API: failed to parse JSON response (${err instanceof Error ? err.message : String(err)})`
      );
    }
  }

  /** Strip `access_token=…` from a URL for logging. */
  private redactUrl(url: string): string {
    return url.replace(/access_token=[^&]+/g, 'access_token=REDACTED');
  }
}

// -----------------------------------------------------------------------------
// Internal helper exposed for tests / debugging only — verifies a token's
// metadata via the FB debug_token endpoint. Not part of the public surface.
// -----------------------------------------------------------------------------

export async function debugMetaToken(
  config: { appId: string; appSecret: string },
  inputToken: string
): Promise<FbDebugTokenResponse['data']> {
  const appAccessToken = `${config.appId}|${config.appSecret}`;
  const url = `${FB_GRAPH_URL}/debug_token?input_token=${encodeURIComponent(inputToken)}&access_token=${encodeURIComponent(appAccessToken)}`;
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    throw new Error(
      `debugMetaToken: ${res.status} ${res.statusText}`
    );
  }
  const data = (await res.json()) as FbDebugTokenResponse;
  return data.data;
}
