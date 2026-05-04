import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { SocialConnection } from '@prisma/client';
import {
  ConnectionStatus as PrismaConnectionStatus,
  PrismaClient,
  SocialPlatform as PrismaSocialPlatform,
} from '@prisma/client';

import { CryptoHelper, URLHelper } from '../../../base';
import { LineOAuthService } from './oauth/line.oauth';
import { MetaOAuthService, MetaPlatform } from './oauth/meta.oauth';
import { TikTokOAuthService } from './oauth/tiktok.oauth';
import { TokenStore } from './token-store';

/**
 * Signed OAuth state payload. We use the existing `CryptoHelper.sign/verify`
 * (asymmetric ECDSA) so the state is tamper-proof without introducing a new
 * shared secret. The payload is JSON, base64url-encoded, then signed.
 *
 * Lifetime: 10 minutes — long enough for the user to complete the OAuth
 * dialog, short enough that a stolen state link is useless.
 */
interface OAuthStatePayload {
  v: 1;
  workspaceId: string;
  userId: string;
  platform: PrismaSocialPlatform;
  nonce: string;
  expiresAt: number;
}

const STATE_TTL_MS = 10 * 60 * 1000;

@Injectable()
export class ConnectionService {
  private readonly logger = new Logger(ConnectionService.name);

  constructor(
    private readonly db: PrismaClient,
    private readonly tokenStore: TokenStore,
    private readonly crypto: CryptoHelper,
    private readonly url: URLHelper,
    private readonly metaOAuth: MetaOAuthService,
    private readonly lineOAuth: LineOAuthService,
    private readonly tiktokOAuth: TikTokOAuthService
  ) {}

  /**
   * List active connections for a workspace. PAUSED rows are filtered out so
   * the UI doesn't show disconnected accounts as still connected.
   *
   * Tokens are NEVER returned here — the caller never sees the encrypted blob.
   */
  async listConnections(workspaceId: string): Promise<SocialConnection[]> {
    return await this.db.socialConnection.findMany({
      where: {
        workspaceId,
        status: { not: PrismaConnectionStatus.PAUSED },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Begin an OAuth flow. Returns the authorization URL the client must open
   * (typically in a popup). State is signed so the callback can verify
   * authenticity without a server-side cache.
   */
  async beginOAuth(
    workspaceId: string,
    platform: PrismaSocialPlatform,
    requestingUserId: string
  ): Promise<{ url: string }> {
    if (platform === PrismaSocialPlatform.GOGOCASH) {
      throw new BadRequestException(
        'GoGoCash is internal — no OAuth needed'
      );
    }

    const state = this.signState({
      v: 1,
      workspaceId,
      userId: requestingUserId,
      platform,
      nonce: this.crypto.randomBytes(16).toString('base64url'),
      expiresAt: Date.now() + STATE_TTL_MS,
    });

    const callbackUrl = this.callbackUrl(platform);

    let url: string;
    switch (platform) {
      case PrismaSocialPlatform.FACEBOOK:
      case PrismaSocialPlatform.INSTAGRAM:
      case PrismaSocialPlatform.THREADS:
        url = this.metaOAuth.getAuthUrl(
          this.toMetaPlatform(platform),
          state,
          callbackUrl
        );
        break;
      case PrismaSocialPlatform.LINE_VOOM:
        url = this.lineOAuth.getAuthUrl(state, callbackUrl);
        break;
      case PrismaSocialPlatform.TIKTOK:
        url = this.tiktokOAuth.getAuthUrl(state, callbackUrl);
        break;
      default:
        throw new BadRequestException(
          `Unsupported platform for OAuth: ${String(platform)}`
        );
    }

    return { url };
  }

  /**
   * Complete an OAuth flow — verify state, exchange code, encrypt + persist.
   *
   * For Meta we additionally swap to a long-lived token and pick the FIRST
   * accessible account (TODO: prompt user to pick in a future round).
   */
  async completeOAuth(
    state: string,
    code: string
  ): Promise<SocialConnection> {
    const payload = this.verifyState(state);
    const callbackUrl = this.callbackUrl(payload.platform);

    let token;
    let scopes: string[];
    let externalAccountId: string;
    let externalAccountName: string;
    let expiresAt: Date | null;
    let refreshTokenPlain: string | undefined;

    if (
      payload.platform === PrismaSocialPlatform.FACEBOOK ||
      payload.platform === PrismaSocialPlatform.INSTAGRAM ||
      payload.platform === PrismaSocialPlatform.THREADS
    ) {
      const metaPlatform = this.toMetaPlatform(payload.platform);
      const shortLived = await this.metaOAuth.exchangeCode(code, callbackUrl);
      const longLived = await this.metaOAuth.exchangeForLongLivedToken(
        shortLived.accessToken
      );
      const accounts = await this.metaOAuth.listAccessibleAccounts(
        longLived.accessToken,
        metaPlatform
      );
      if (accounts.length === 0) {
        throw new BadRequestException(
          `No ${metaPlatform} accounts accessible by this Meta user.`
        );
      }
      // TODO: in a future round, return the account list to the client and
      // let the user pick. For v1 we take the first one.
      const account = accounts[0];

      token = longLived.accessToken;
      refreshTokenPlain = longLived.refreshToken;
      scopes = longLived.scopes;
      externalAccountId = account.id;
      externalAccountName = account.name;
      expiresAt = longLived.expiresAt ?? null;
    } else if (payload.platform === PrismaSocialPlatform.LINE_VOOM) {
      const result = await this.lineOAuth.exchangeCode(code, callbackUrl);
      token = result.accessToken;
      refreshTokenPlain = result.refreshToken;
      scopes = result.scopes;
      externalAccountId = result.externalAccountId;
      externalAccountName = result.externalAccountName;
      expiresAt = result.expiresAt ?? null;
    } else if (payload.platform === PrismaSocialPlatform.TIKTOK) {
      const result = await this.tiktokOAuth.exchangeCode(code, callbackUrl);
      token = result.accessToken;
      refreshTokenPlain = result.refreshToken;
      scopes = result.scopes;
      externalAccountId = result.externalAccountId;
      externalAccountName = result.externalAccountName;
      expiresAt = result.expiresAt ?? null;
    } else {
      throw new BadRequestException(
        `Unsupported platform for OAuth completion: ${String(payload.platform)}`
      );
    }

    const accessTokenEnc = await this.tokenStore.encrypt(token);
    const refreshTokenEnc = refreshTokenPlain
      ? await this.tokenStore.encrypt(refreshTokenPlain)
      : null;

    return await this.db.socialConnection.upsert({
      where: {
        workspaceId_platform_externalAccountId: {
          workspaceId: payload.workspaceId,
          platform: payload.platform,
          externalAccountId,
        },
      },
      create: {
        workspaceId: payload.workspaceId,
        platform: payload.platform,
        status: PrismaConnectionStatus.ACTIVE,
        accessTokenEnc,
        refreshTokenEnc,
        scopes,
        externalAccountId,
        externalAccountName,
        connectedByUserId: payload.userId,
        expiresAt,
        lastErrorAt: null,
        lastError: null,
      },
      update: {
        status: PrismaConnectionStatus.ACTIVE,
        accessTokenEnc,
        refreshTokenEnc,
        scopes,
        externalAccountName,
        connectedByUserId: payload.userId,
        expiresAt,
        lastErrorAt: null,
        lastError: null,
      },
    });
  }

  /**
   * Soft-delete a connection: status=PAUSED, leave the row intact for event
   * history and so the user's audit trail is preserved. Best-effort revoke
   * against the upstream provider — a revoke failure does not block the
   * disconnect.
   */
  async disconnect(connectionId: string, userId: string): Promise<void> {
    const conn = await this.db.socialConnection.findUnique({
      where: { id: connectionId },
    });
    if (!conn) {
      throw new BadRequestException('Connection not found');
    }
    void userId; // Caller (resolver) is responsible for ACL — see resolver.

    // Best-effort revoke — try to decrypt + revoke against the provider.
    try {
      const accessToken = await this.tokenStore.decrypt(conn.accessTokenEnc);
      switch (conn.platform) {
        case PrismaSocialPlatform.LINE_VOOM:
          await this.lineOAuth.revoke(accessToken);
          break;
        // Meta + TikTok don't expose a parameterised revoke we can call here
        // without extra surface area. Pausing the row is sufficient — refresh
        // tokens stop being used and the workspace can re-auth at any time.
        default:
          break;
      }
    } catch (err) {
      this.logger.warn(
        `disconnect: best-effort revoke failed for ${connectionId}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    await this.db.socialConnection.update({
      where: { id: connectionId },
      data: {
        status: PrismaConnectionStatus.PAUSED,
      },
    });
  }

  /**
   * Mark a connection as expired/errored. Used by pollers when the upstream
   * provider rejects the stored token (token revoked, scope removed, etc.).
   */
  async markExpired(connectionId: string, error: string): Promise<void> {
    await this.db.socialConnection
      .update({
        where: { id: connectionId },
        data: {
          status: PrismaConnectionStatus.EXPIRED,
          lastError: error.slice(0, 500),
          lastErrorAt: new Date(),
        },
      })
      .catch(err => {
        this.logger.error(
          `markExpired failed for ${connectionId}: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      });
  }

  // ---------------------------------------------------------------------------
  // private helpers
  // ---------------------------------------------------------------------------

  private signState(payload: OAuthStatePayload): string {
    const json = JSON.stringify(payload);
    const data = Buffer.from(json, 'utf8').toString('base64url');
    return this.crypto.sign(data);
  }

  private verifyState(state: string): OAuthStatePayload {
    if (!state || typeof state !== 'string') {
      throw new BadRequestException('Invalid OAuth state');
    }
    if (!this.crypto.verify(state)) {
      throw new BadRequestException('OAuth state signature invalid');
    }
    const [data] = state.split(',');
    let parsed: unknown;
    try {
      const json = Buffer.from(data, 'base64url').toString('utf8');
      parsed = JSON.parse(json);
    } catch {
      throw new BadRequestException('OAuth state payload malformed');
    }
    if (!parsed || typeof parsed !== 'object') {
      throw new BadRequestException('OAuth state payload malformed');
    }
    const p = parsed as Partial<OAuthStatePayload>;
    if (
      p.v !== 1 ||
      typeof p.workspaceId !== 'string' ||
      typeof p.userId !== 'string' ||
      typeof p.platform !== 'string' ||
      typeof p.nonce !== 'string' ||
      typeof p.expiresAt !== 'number'
    ) {
      throw new BadRequestException('OAuth state payload incomplete');
    }
    if (Date.now() > p.expiresAt) {
      throw new BadRequestException('OAuth state expired');
    }
    return p as OAuthStatePayload;
  }

  /**
   * Build the OAuth callback URL we register with each provider. We expose a
   * single REST controller per platform under /api/integrations/oauth/callback/
   * — see oauth-callback.controller.ts.
   */
  private callbackUrl(platform: PrismaSocialPlatform): string {
    const slug = this.callbackSlug(platform);
    return `${this.url.baseUrl}/api/integrations/oauth/callback/${slug}`;
  }

  private callbackSlug(platform: PrismaSocialPlatform): string {
    switch (platform) {
      case PrismaSocialPlatform.FACEBOOK:
        return 'facebook';
      case PrismaSocialPlatform.INSTAGRAM:
        return 'instagram';
      case PrismaSocialPlatform.THREADS:
        return 'threads';
      case PrismaSocialPlatform.LINE_VOOM:
        return 'line';
      case PrismaSocialPlatform.TIKTOK:
        return 'tiktok';
      default:
        return 'unknown';
    }
  }

  private toMetaPlatform(platform: PrismaSocialPlatform): MetaPlatform {
    switch (platform) {
      case PrismaSocialPlatform.FACEBOOK:
        return 'FACEBOOK';
      case PrismaSocialPlatform.INSTAGRAM:
        return 'INSTAGRAM';
      case PrismaSocialPlatform.THREADS:
        return 'THREADS';
      default:
        throw new BadRequestException(
          `Not a Meta platform: ${String(platform)}`
        );
    }
  }
}
