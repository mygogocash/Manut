import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { SocialConnection } from '@prisma/client';
import {
  ConnectionStatus as PrismaConnectionStatus,
  PrismaClient,
  SocialPlatform as PrismaSocialPlatform,
} from '@prisma/client';

import { Cache, CryptoHelper, URLHelper } from '../../../base';
import { LineOAuthService } from './oauth/line.oauth';
import {
  type MetaAccount,
  MetaOAuthService,
  MetaPlatform,
} from './oauth/meta.oauth';
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

// Cache TTL for the pending Meta account-picker payload. Same window as the
// signed state so the whole interactive flow has one consistent budget.
const PENDING_TTL_MS = 10 * 60 * 1000;
const PENDING_CACHE_PREFIX = 'analytics:oauth:pending:';

/**
 * Cached payload for a Meta OAuth flow that has exchanged the code but is
 * waiting on the user to pick which page / IG biz account / Threads profile
 * to bind. Tokens are stored AS THE KMS-ENCRYPTED CIPHERTEXT — `TokenStore`
 * is invoked before we put anything in Redis so plaintext never sits in
 * cache. PRD §6 forbids plaintext token storage anywhere outside the brief
 * memory window during exchange.
 */
interface PendingOAuthPayload {
  v: 1;
  workspaceId: string;
  userId: string;
  platform: PrismaSocialPlatform;
  accounts: MetaAccount[];
  accessTokenEnc: string;
  refreshTokenEnc: string | null;
  scopes: string[];
  // ISO string — Date doesn't survive JSON round-trips through Redis.
  expiresAt: string | null;
}

/**
 * Discriminated union returned by `completeOAuth`. Single-account /
 * LINE / TikTok land directly on `completed`. Meta with ≥2 accessible
 * accounts lands on `pending` so the OAuth callback controller can post a
 * `choose-account` message back to the opener.
 */
export type OAuthCompletionResult =
  | { kind: 'completed'; connection: SocialConnection }
  | { kind: 'pending'; pendingId: string; accounts: MetaAccount[] };

@Injectable()
export class ConnectionService {
  private readonly logger = new Logger(ConnectionService.name);

  constructor(
    private readonly db: PrismaClient,
    private readonly tokenStore: TokenStore,
    private readonly crypto: CryptoHelper,
    private readonly url: URLHelper,
    private readonly cache: Cache,
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
  /**
   * Resolve a connection's workspaceId, used by the resolver for ACL checks
   * BEFORE invoking destructive mutations like `disconnect`. Throws if the
   * connection does not exist (don't leak existence vs permission distinction
   * — both surface the same `BadRequestException` to the caller).
   */
  async getConnectionWorkspaceId(connectionId: string): Promise<string> {
    const row = await this.db.socialConnection.findUnique({
      where: { id: connectionId },
      select: { workspaceId: true },
    });
    if (!row) {
      throw new BadRequestException('Connection not found');
    }
    return row.workspaceId;
  }

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
      throw new BadRequestException('GoGoCash is internal — no OAuth needed');
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
   * Returns a discriminated union:
   *   - `completed` — single-account / LINE / TikTok land here. The
   *     SocialConnection row is upserted in the same call.
   *   - `pending` — Meta with ≥2 accessible accounts. Tokens are
   *     KMS-encrypted and stashed in Redis under a UUID; the caller must
   *     post `pendingId` + `accounts` to the opener so the user can pick.
   *     Finalize via `finalizeConnection` to actually upsert the row.
   *
   * Throws `BadRequestException` if Meta returns zero accessible accounts —
   * this surfaces in the OAuth callback as a user-visible error so they
   * know to fix their Meta admin permissions.
   */
  async completeOAuth(
    state: string,
    code: string
  ): Promise<OAuthCompletionResult> {
    const payload = this.verifyState(state);
    const callbackUrl = this.callbackUrl(payload.platform);

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

      // Encrypt the long-lived token NOW so plaintext lives only in this
      // call's local scope. Both the auto-finalize and the cache paths
      // consume the ciphertext.
      const accessTokenEnc = await this.tokenStore.encrypt(
        longLived.accessToken
      );
      const refreshTokenEnc = longLived.refreshToken
        ? await this.tokenStore.encrypt(longLived.refreshToken)
        : null;

      // Single-account → upsert immediately. The picker is unhelpful when
      // there's only one option; matches the UX requirement that the
      // frontend never opens a modal with a single radio button.
      if (accounts.length === 1) {
        const account = accounts[0];
        const connection = await this.upsertConnection({
          workspaceId: payload.workspaceId,
          userId: payload.userId,
          platform: payload.platform,
          accessTokenEnc,
          refreshTokenEnc,
          scopes: longLived.scopes,
          externalAccountId: account.id,
          externalAccountName: account.name,
          expiresAt: longLived.expiresAt ?? null,
        });
        return { kind: 'completed', connection };
      }

      // Multi-account → cache the encrypted tokens + account list, return
      // the pending id. TTL is the same 10-minute window as the OAuth state.
      const pendingId = this.crypto.randomBytes(16).toString('hex');
      const cached: PendingOAuthPayload = {
        v: 1,
        workspaceId: payload.workspaceId,
        userId: payload.userId,
        platform: payload.platform,
        accounts,
        accessTokenEnc,
        refreshTokenEnc,
        scopes: longLived.scopes,
        expiresAt: longLived.expiresAt
          ? longLived.expiresAt.toISOString()
          : null,
      };
      const ok = await this.cache.set(this.pendingKey(pendingId), cached, {
        ttl: PENDING_TTL_MS,
      });
      if (!ok) {
        throw new BadRequestException(
          'Failed to persist pending OAuth state — Redis unavailable.'
        );
      }
      return { kind: 'pending', pendingId, accounts };
    }

    // Single-account platforms (LINE / TikTok) keep the original direct path.
    let token: string;
    let scopes: string[];
    let externalAccountId: string;
    let externalAccountName: string;
    let expiresAt: Date | null;
    let refreshTokenPlain: string | undefined;

    if (payload.platform === PrismaSocialPlatform.LINE_VOOM) {
      // Validate the OAuth code/user flow, then bind the workspace to the
      // configured Messaging API channel. The analytics poller/webhook path
      // needs the channel token, not a LINE Login user token.
      await this.lineOAuth.exchangeCode(code, callbackUrl);
      const result = this.lineOAuth.getMessagingChannelConnection();
      token = result.accessToken;
      refreshTokenPlain = undefined;
      scopes = result.scopes;
      externalAccountId = result.externalAccountId;
      externalAccountName = result.externalAccountName;
      expiresAt = null;
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

    const connection = await this.upsertConnection({
      workspaceId: payload.workspaceId,
      userId: payload.userId,
      platform: payload.platform,
      accessTokenEnc,
      refreshTokenEnc,
      scopes,
      externalAccountId,
      externalAccountName,
      expiresAt,
    });
    return { kind: 'completed', connection };
  }

  /**
   * Resolve the workspaceId bound to a pending Meta picker payload, used by
   * the resolver to assert ACL BEFORE consuming the cache row. Returns null
   * if the row is missing or expired — the resolver should treat that as a
   * user-visible error ("session expired, please reconnect").
   */
  async getPendingWorkspaceId(pendingId: string): Promise<string | null> {
    const cached = await this.readPending(pendingId);
    return cached?.workspaceId ?? null;
  }

  /**
   * Finalize a multi-account Meta OAuth flow. Reads the cached encrypted
   * tokens, validates the chosen externalAccountId is in the original list,
   * upserts the SocialConnection, deletes the cache row, and writes an
   * audit row.
   *
   * Idempotent only insofar as the first call wins — once the cache row is
   * deleted, subsequent calls throw "session expired". The cache delete
   * runs AFTER the upsert succeeds so a failed upsert can be retried by
   * the user clicking Confirm again before TTL expiry.
   */
  async finalizeConnection(
    pendingId: string,
    externalAccountId: string,
    requestingUserId: string
  ): Promise<SocialConnection> {
    const cached = await this.readPending(pendingId);
    if (!cached) {
      throw new BadRequestException(
        'OAuth session expired or not found — please reconnect.'
      );
    }

    const account = cached.accounts.find(a => a.id === externalAccountId);
    if (!account) {
      throw new BadRequestException(
        'Selected account is not in the list of accounts that were available when this OAuth flow started.'
      );
    }

    // Connection metadata uses the cached `userId` from the OAuth state,
    // not the requesting user. The two are usually the same but the
    // resolver passes both in case a different admin lands the picker.
    void requestingUserId;

    const connection = await this.upsertConnection({
      workspaceId: cached.workspaceId,
      userId: cached.userId,
      platform: cached.platform,
      accessTokenEnc: cached.accessTokenEnc,
      refreshTokenEnc: cached.refreshTokenEnc,
      scopes: cached.scopes,
      externalAccountId: account.id,
      externalAccountName: account.name,
      expiresAt: cached.expiresAt ? new Date(cached.expiresAt) : null,
    });

    // Best-effort cache cleanup + audit. Failures here don't undo the
    // upsert — at worst the row sits in Redis until TTL.
    await this.cache.delete(this.pendingKey(pendingId)).catch(err => {
      this.logger.warn(
        `finalizeConnection: cache delete failed for ${pendingId}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    });
    await this.writePendingAudit(
      cached,
      requestingUserId,
      'OAUTH_PENDING_FINALIZED'
    );

    return connection;
  }

  /**
   * Cancel a pending Meta picker — the user dismissed the modal. Deletes
   * the cache row and writes an audit log row. Idempotent: missing row is
   * treated as success (the audit log is skipped because we have no
   * platform / workspace context to record).
   */
  async cancelPendingOAuth(
    pendingId: string,
    requestingUserId: string
  ): Promise<void> {
    const cached = await this.readPending(pendingId);
    if (!cached) {
      return;
    }
    await this.cache.delete(this.pendingKey(pendingId));
    await this.writePendingAudit(
      cached,
      requestingUserId,
      'OAUTH_PENDING_ABANDONED'
    );
  }

  /**
   * Soft-delete a connection: status=PAUSED, leave the row intact for event
   * history and so the user's audit trail is preserved. Best-effort revoke
   * against the upstream provider — a revoke failure does not block the
   * disconnect.
   */
  async disconnect(connectionId: string, userId: string): Promise<void> {
    // ACL is enforced by the resolver via `getConnectionWorkspaceId` +
    // `AccessController.assert('Workspace.Settings.Update')` BEFORE this
    // method is called. We re-fetch the row here so the operation is atomic
    // against the row's current state.
    const conn = await this.db.socialConnection.findUnique({
      where: { id: connectionId },
    });
    if (!conn) {
      throw new BadRequestException('Connection not found');
    }
    void userId; // Reserved for future audit logging.

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

  private async upsertConnection(args: {
    workspaceId: string;
    userId: string;
    platform: PrismaSocialPlatform;
    accessTokenEnc: string;
    refreshTokenEnc: string | null;
    scopes: string[];
    externalAccountId: string;
    externalAccountName: string;
    expiresAt: Date | null;
  }): Promise<SocialConnection> {
    return await this.db.socialConnection.upsert({
      where: {
        workspaceId_platform_externalAccountId: {
          workspaceId: args.workspaceId,
          platform: args.platform,
          externalAccountId: args.externalAccountId,
        },
      },
      create: {
        workspaceId: args.workspaceId,
        platform: args.platform,
        status: PrismaConnectionStatus.ACTIVE,
        accessTokenEnc: args.accessTokenEnc,
        refreshTokenEnc: args.refreshTokenEnc,
        scopes: args.scopes,
        externalAccountId: args.externalAccountId,
        externalAccountName: args.externalAccountName,
        connectedByUserId: args.userId,
        expiresAt: args.expiresAt,
        lastErrorAt: null,
        lastError: null,
      },
      update: {
        status: PrismaConnectionStatus.ACTIVE,
        accessTokenEnc: args.accessTokenEnc,
        refreshTokenEnc: args.refreshTokenEnc,
        scopes: args.scopes,
        externalAccountName: args.externalAccountName,
        connectedByUserId: args.userId,
        expiresAt: args.expiresAt,
        lastErrorAt: null,
        lastError: null,
      },
    });
  }

  private pendingKey(pendingId: string): string {
    return `${PENDING_CACHE_PREFIX}${pendingId}`;
  }

  private async readPending(
    pendingId: string
  ): Promise<PendingOAuthPayload | null> {
    if (!pendingId || typeof pendingId !== 'string') {
      return null;
    }
    const raw = await this.cache.get<PendingOAuthPayload | undefined>(
      this.pendingKey(pendingId)
    );
    if (!raw || raw.v !== 1) return null;
    if (
      typeof raw.workspaceId !== 'string' ||
      typeof raw.userId !== 'string' ||
      typeof raw.platform !== 'string' ||
      !Array.isArray(raw.accounts)
    ) {
      return null;
    }
    return raw;
  }

  private async writePendingAudit(
    cached: PendingOAuthPayload,
    requestingUserId: string,
    action: 'OAUTH_PENDING_FINALIZED' | 'OAUTH_PENDING_ABANDONED'
  ): Promise<void> {
    await this.db.socialAuditLog
      .create({
        data: {
          workspaceId: cached.workspaceId,
          userId: requestingUserId || cached.userId,
          platform: cached.platform,
          action,
          metadata: { accountCount: cached.accounts.length },
        },
      })
      .catch(err => {
        // Audit failures must not block the user-visible action.
        this.logger.warn(
          `writePendingAudit(${action}) failed: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      });
  }

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
