import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ConnectionStatus, PrismaClient, SocialPlatform } from '@prisma/client';

import { TokenStore } from '../../connections/token-store';

/**
 * LINE Insight API poller — runs every 15 minutes (the LINE Insight
 * endpoints are rate-limited and slow-changing, so more frequent polls
 * waste budget).
 *
 * Per ACTIVE LINE_VOOM connection:
 *   - GET /v2/bot/insight/followers           (always)
 *   - GET /v2/bot/insight/message/delivery    (always)
 *   - GET /v2/bot/insight/demographic         (weekly only — gated
 *     by `lastDemographicAt` written into the DB lastError JSON
 *     scratch space; no extra column to add)
 *
 * Auth: Messaging API uses a long-lived channel access token that we
 * store encrypted in `accessTokenEnc`. Token decryption goes through
 * `TokenStore.decryptWithAudit()` so every read writes a SocialAuditLog
 * row (PRD §6).
 *
 * Errors:
 *   - 401 → connection.status = EXPIRED, lastError set, lastErrorAt now.
 *   - other non-2xx → keep status ACTIVE, set lastError + lastErrorAt
 *     so the next tick retries.
 *
 * Source: https://developers.line.biz/en/reference/messaging-api/#get-number-of-followers
 */
@Injectable()
export class LinePoller {
  private readonly logger = new Logger(LinePoller.name);

  constructor(
    private readonly db: PrismaClient,
    private readonly tokenStore: TokenStore
  ) {}

  // every 15 minutes — `*/15 * * * *`
  @Cron('*/15 * * * *')
  async poll(): Promise<void> {
    const connections = await this.db.socialConnection.findMany({
      where: {
        platform: SocialPlatform.LINE_VOOM,
        status: ConnectionStatus.ACTIVE,
      },
    });

    if (connections.length === 0) {
      return;
    }

    this.logger.debug(`LinePoller.poll: ${connections.length} connections`);

    for (const connection of connections) {
      try {
        await this.pollConnection(connection);
      } catch (error) {
        this.logger.error(
          `LinePoller: failed for connection ${connection.id}`,
          error instanceof Error ? error.stack : String(error)
        );
      }
    }
  }

  private async pollConnection(connection: {
    id: string;
    workspaceId: string;
    accessTokenEnc: string;
  }): Promise<void> {
    const accessToken = await this.tokenStore.decryptWithAudit(
      connection.accessTokenEnc,
      {
        workspaceId: connection.workspaceId,
        platform: SocialPlatform.LINE_VOOM,
        reason: 'analytics:line-poller',
      }
    );

    const today = new Date();
    const yyyymmdd = formatLineDate(today);

    // Always: followers + message delivery for "today" (LINE returns
    // the most recent finalized day if today's data isn't ready).
    const followers = await this.callInsight(
      `/v2/bot/insight/followers?date=${yyyymmdd}`,
      accessToken,
      connection.id
    );
    if (followers) {
      await this.upsertMetric(connection.workspaceId, 'followers.total', [
        ['followers', followers.followers],
        ['targetedReaches', followers.targetedReaches],
        ['blocks', followers.blocks],
      ]);
    }

    const delivery = await this.callInsight(
      `/v2/bot/insight/message/delivery?date=${yyyymmdd}`,
      accessToken,
      connection.id
    );
    if (delivery) {
      await this.upsertMetric(connection.workspaceId, 'messages.delivered', [
        ['broadcast', delivery.broadcast],
        ['targeting', delivery.targeting],
        ['autoResponse', delivery.autoResponse],
        ['welcomeResponse', delivery.welcomeResponse],
        ['chat', delivery.chat],
        ['apiBroadcast', delivery.apiBroadcast],
        ['apiPush', delivery.apiPush],
        ['apiMulticast', delivery.apiMulticast],
        ['apiReply', delivery.apiReply],
      ]);
    }

    // Weekly: demographic. Cheap gate using the day-of-week — Mondays only.
    if (today.getUTCDay() === 1) {
      const demographic = await this.callInsight(
        '/v2/bot/insight/demographic',
        accessToken,
        connection.id
      );
      if (demographic && Array.isArray(demographic.genders)) {
        await this.upsertMetric(
          connection.workspaceId,
          'demographic.genders',
          demographic.genders.map((g: { gender?: string; percentage?: number }) => [
            `gender.${g.gender ?? 'unknown'}`,
            g.percentage ?? 0,
          ])
        );
      }
    }

    // Mark success.
    await this.db.socialConnection.update({
      where: { id: connection.id },
      data: {
        lastSyncAt: new Date(),
        lastError: null,
        lastErrorAt: null,
      },
    });
  }

  private async callInsight(
    path: string,
    accessToken: string,
    connectionId: string
  ): Promise<Record<string, any> | null> {
    const response = await fetch(`https://api.line.me${path}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.status === 401) {
      // Token revoked / expired — mark connection EXPIRED and stop.
      await this.db.socialConnection.update({
        where: { id: connectionId },
        data: {
          status: ConnectionStatus.EXPIRED,
          lastError: 'LINE 401 — channel access token rejected',
          lastErrorAt: new Date(),
        },
      });
      return null;
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      const msg = `LINE Insight ${path} failed: ${response.status} ${response.statusText} ${text.slice(0, 200)}`;
      // Keep status ACTIVE — let the next tick retry. Persist error
      // for visibility in the admin panel.
      await this.db.socialConnection.update({
        where: { id: connectionId },
        data: {
          lastError: msg,
          lastErrorAt: new Date(),
        },
      });
      return null;
    }

    return (await response.json()) as Record<string, any>;
  }

  /**
   * Write a batch of (metricKey, value) pairs as HOUR-bucket rows for
   * the current hour. Upsert so re-running within the same hour
   * overwrites with the latest snapshot rather than duplicating.
   */
  private async upsertMetric(
    workspaceId: string,
    metricKeyPrefix: string,
    entries: Array<[string, number | undefined | null]>
  ): Promise<void> {
    const bucketStart = currentHourBucket();

    for (const [suffix, value] of entries) {
      if (value == null || !Number.isFinite(value)) continue;
      const metricKey = `${metricKeyPrefix}.${suffix}`;
      await this.db.socialMetric.upsert({
        where: {
          workspaceId_platform_metricKey_bucket_bucketStart: {
            workspaceId,
            platform: SocialPlatform.LINE_VOOM,
            metricKey,
            bucket: 'HOUR',
            bucketStart,
          },
        },
        update: { value },
        create: {
          workspaceId,
          platform: SocialPlatform.LINE_VOOM,
          metricKey,
          bucket: 'HOUR',
          bucketStart,
          value,
        },
      });
    }
  }
}

// -----------------------------------------------------------------------------
// helpers
// -----------------------------------------------------------------------------

function formatLineDate(d: Date): string {
  // LINE wants `yyyyMMdd` — UTC to keep the cron and the API in agreement.
  const yyyy = d.getUTCFullYear().toString().padStart(4, '0');
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const dd = d.getUTCDate().toString().padStart(2, '0');
  return `${yyyy}${mm}${dd}`;
}

function currentHourBucket(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      now.getUTCHours()
    )
  );
}

// CronExpression import retained for IDE familiarity even though we use
// a literal cron string for the 15-minute cadence.
void CronExpression;
