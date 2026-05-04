import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { SocialConnection } from '@prisma/client';
import { PrismaClient, SocialPlatform } from '@prisma/client';

import { LineOAuthService } from './oauth/line.oauth';
import type { OAuthTokenResult } from './oauth/meta.oauth';
import { MetaOAuthService } from './oauth/meta.oauth';
import { TikTokOAuthService } from './oauth/tiktok.oauth';
import { TokenStore } from './token-store';

/**
 * Daily proactive refresh of long-lived OAuth tokens for ACTIVE connections
 * whose `expiresAt` is within REFRESH_WINDOW_MS of now. Without this cron,
 * tokens silently expire and the workspace owner discovers it only when a
 * poller fails with 401 and the row flips to EXPIRED — by which point we
 * have already lost a polling cycle of data.
 *
 * Multi-replica caveat: `@nestjs/schedule` fires on every replica. The deploy
 * is single-process today, so concurrent runs are not possible. Before
 * scaling out, add a coordination layer (sentinel column or distributed
 * lock); a `pg_*_advisory_lock` over the Prisma connection pool is unsafe
 * because session ownership is not stable across queries.
 */

const REFRESH_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class TokenRefreshCron {
  private readonly logger = new Logger(TokenRefreshCron.name);

  constructor(
    private readonly db: PrismaClient,
    private readonly tokenStore: TokenStore,
    private readonly metaOAuth: MetaOAuthService,
    private readonly lineOAuth: LineOAuthService,
    private readonly tiktokOAuth: TikTokOAuthService
  ) {}

  // 03:00 UTC daily. Sits between daily-rollup (02:00) and weekly-rollup
  // (Mon 03:00 — different day, same minute is fine, the jobs are
  // independent).
  @Cron('0 3 * * *')
  async run(): Promise<void> {
    try {
      await this.runOnce();
    } catch (err) {
      this.logger.error(
        'TokenRefreshCron.run failed',
        err instanceof Error ? err.stack : String(err)
      );
    }
  }

  /** Test entry-point. */
  async runOnce(now: Date = new Date()): Promise<void> {
    const horizon = new Date(now.getTime() + REFRESH_WINDOW_MS);

    const due = await this.db.socialConnection.findMany({
      where: {
        status: 'ACTIVE',
        // expiresAt IS NULL is intentionally excluded — without an expiry we
        // cannot tell when to refresh, and re-running every cron tick would
        // burn provider quota. Those rows stay ACTIVE; the poller marks them
        // EXPIRED on the first 401.
        expiresAt: { not: null, lt: horizon },
      },
    });

    this.logger.log(
      `TokenRefreshCron: ${due.length} connection(s) within refresh window`
    );

    for (const conn of due) {
      try {
        await this.refreshOne(conn);
      } catch (err) {
        // refreshOne handles its own errors; this is a belt-and-braces guard
        // so one bad row never aborts the rest of the loop.
        this.logger.warn(
          `TokenRefreshCron: connection ${conn.id} (${conn.platform}) threw outside guard: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
      }
    }
  }

  // -------------------------------------------------------------------------

  private async refreshOne(conn: SocialConnection): Promise<void> {
    let inputToken: string;
    try {
      inputToken = await this.decryptInputToken(conn);
    } catch (err) {
      // KMS not ready, decrypt failed, or refresh token missing. Fail-soft
      // per the brief: log + skip. The next daily run will retry.
      this.logger.warn(
        `TokenRefreshCron: skip ${conn.id} (${conn.platform}) — input token unavailable: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
      return;
    }

    let result: OAuthTokenResult;
    try {
      result = await this.callRefresh(conn.platform, inputToken);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.markRefreshFailed(conn, message);
      return;
    }

    try {
      await this.persistRefreshed(conn, result);
    } catch (err) {
      // Encrypt or update threw after we already received fresh tokens. Don't
      // mark EXPIRED here — the row is still valid until its real expiresAt;
      // log so an operator can investigate KMS health.
      this.logger.error(
        `TokenRefreshCron: persist failed for ${conn.id} after successful refresh`,
        err instanceof Error ? err.stack : String(err)
      );
    }
  }

  private async decryptInputToken(conn: SocialConnection): Promise<string> {
    const audit = {
      workspaceId: conn.workspaceId,
      platform: conn.platform,
      reason: 'TokenRefreshCron',
    };

    // Meta refreshes via fb_exchange_token — the input is the long-lived
    // ACCESS token, not a separate refresh token. LINE and TikTok use the
    // standard refresh_token grant.
    if (
      conn.platform === SocialPlatform.FACEBOOK ||
      conn.platform === SocialPlatform.INSTAGRAM ||
      conn.platform === SocialPlatform.THREADS
    ) {
      return await this.tokenStore.decryptWithAudit(conn.accessTokenEnc, audit);
    }

    if (!conn.refreshTokenEnc) {
      throw new Error(
        `${conn.platform} connection ${conn.id} has no refresh token stored`
      );
    }
    return await this.tokenStore.decryptWithAudit(conn.refreshTokenEnc, audit);
  }

  private async callRefresh(
    platform: SocialPlatform,
    inputToken: string
  ): Promise<OAuthTokenResult> {
    switch (platform) {
      case SocialPlatform.FACEBOOK:
      case SocialPlatform.INSTAGRAM:
      case SocialPlatform.THREADS:
        return await this.metaOAuth.refreshToken(inputToken);
      case SocialPlatform.LINE_VOOM:
        return await this.lineOAuth.refreshToken(inputToken);
      case SocialPlatform.TIKTOK:
        return await this.tiktokOAuth.refreshToken(inputToken);
      default:
        throw new Error(
          `Unsupported platform for refresh: ${String(platform)}`
        );
    }
  }

  private async persistRefreshed(
    conn: SocialConnection,
    result: OAuthTokenResult
  ): Promise<void> {
    const accessTokenEnc = await this.tokenStore.encrypt(result.accessToken);
    // TikTok rotates refresh tokens on each refresh; LINE may re-issue. Keep
    // the existing ciphertext only when the response omits a refresh token.
    const refreshTokenEnc = result.refreshToken
      ? await this.tokenStore.encrypt(result.refreshToken)
      : conn.refreshTokenEnc;

    await this.db.socialConnection.update({
      where: { id: conn.id },
      data: {
        accessTokenEnc,
        refreshTokenEnc,
        expiresAt: result.expiresAt ?? null,
        ...(result.scopes && result.scopes.length > 0
          ? { scopes: result.scopes }
          : {}),
        lastError: null,
        lastErrorAt: null,
      },
    });

    await this.writeAudit(conn, 'TOKEN_REFRESH', null);
  }

  private async markRefreshFailed(
    conn: SocialConnection,
    error: string
  ): Promise<void> {
    await this.db.socialConnection.update({
      where: { id: conn.id },
      data: {
        status: 'EXPIRED',
        lastError: error.slice(0, 500),
        lastErrorAt: new Date(),
      },
    });
    await this.writeAudit(conn, 'TOKEN_REFRESH_FAILED', error);
  }

  private async writeAudit(
    conn: SocialConnection,
    action: 'TOKEN_REFRESH' | 'TOKEN_REFRESH_FAILED',
    error: string | null
  ): Promise<void> {
    try {
      await this.db.socialAuditLog.create({
        data: {
          workspaceId: conn.workspaceId,
          userId: conn.connectedByUserId,
          platform: conn.platform,
          action,
          metadata: error
            ? { connectionId: conn.id, error: error.slice(0, 500) }
            : { connectionId: conn.id },
        },
      });
    } catch (err) {
      this.logger.error(
        `TokenRefreshCron: audit write failed for ${conn.id}`,
        err instanceof Error ? err.stack : String(err)
      );
    }
  }
}
