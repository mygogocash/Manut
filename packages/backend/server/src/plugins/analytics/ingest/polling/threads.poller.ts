import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { SocialConnection } from '@prisma/client';
import { PrismaClient } from '@prisma/client';

import { TokenStore } from '../../connections/token-store';

/**
 * Threads poller — webhook coverage on Threads is thin per PRD §8, so polling
 * is the primary path. Runs every 15 minutes for every ACTIVE THREADS
 * connection and writes a `social_metrics` (HOUR) snapshot per metric.
 *
 * Error handling mirrors MetaPoller:
 *  - 401 → connection marked EXPIRED.
 *  - other 4xx → lastError recorded, status preserved.
 *  - 5xx → retry next tick.
 */

const THREADS_API_URL = 'https://graph.threads.net/v1.0';

const THREADS_METRICS = ['views', 'likes', 'replies', 'reposts'] as const;

interface ThreadsInsightResponse {
  data?: Array<{
    name: string;
    period?: string;
    total_value?: { value: number };
    values?: Array<{ value: number; end_time?: string }>;
  }>;
}

@Injectable()
export class ThreadsPoller {
  private readonly logger = new Logger(ThreadsPoller.name);

  constructor(
    private readonly db: PrismaClient,
    private readonly tokenStore: TokenStore
  ) {}

  @Cron('*/15 * * * *')
  async poll(): Promise<void> {
    try {
      await this.pollOnce();
    } catch (err) {
      this.logger.error(
        'ThreadsPoller.poll failed',
        err instanceof Error ? err.stack : String(err)
      );
    }
  }

  async pollOnce(now: Date = new Date()): Promise<void> {
    const connections = await this.db.socialConnection.findMany({
      where: { platform: 'THREADS', status: 'ACTIVE' },
    });

    for (const conn of connections) {
      try {
        await this.pollConnection(conn, now);
      } catch (err) {
        this.logger.warn(
          `ThreadsPoller: connection ${conn.id} failed: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }
  }

  // -------------------------------------------------------------------------

  private async pollConnection(
    conn: SocialConnection,
    now: Date
  ): Promise<void> {
    const token = await this.tokenStore.decryptWithAudit(conn.accessTokenEnc, {
      workspaceId: conn.workspaceId,
      platform: conn.platform,
      reason: 'ThreadsPoller',
    });

    // The user-level insights endpoint is `/me/threads_insights`. We use the
    // 28-day period because Threads aggregates and the brief asks for it.
    const url =
      `${THREADS_API_URL}/me/threads_insights` +
      `?metric=${THREADS_METRICS.join(',')}&period=days_28` +
      `&access_token=${encodeURIComponent(token)}`;

    let res: Response;
    try {
      res = await fetch(url, { method: 'GET' });
    } catch (err) {
      this.logger.warn(
        `ThreadsPoller: network error on ${conn.id}: ${err instanceof Error ? err.message : String(err)}`
      );
      return;
    }

    if (res.status === 401) {
      await this.db.socialConnection.update({
        where: { id: conn.id },
        data: {
          status: 'EXPIRED',
          lastError: 'Threads API 401 (token expired or revoked)',
          lastErrorAt: new Date(),
        },
      });
      return;
    }

    if (res.status >= 400 && res.status < 500) {
      const body = (await res.text()).slice(0, 256);
      await this.db.socialConnection.update({
        where: { id: conn.id },
        data: {
          lastError: `Threads API ${res.status}: ${body}`,
          lastErrorAt: new Date(),
        },
      });
      return;
    }

    if (res.status >= 500) {
      this.logger.warn(
        `ThreadsPoller: ${conn.id} got ${res.status} — will retry next tick`
      );
      return;
    }

    const json = (await res.json()) as ThreadsInsightResponse;
    const bucketStart = floorToHour(now);

    for (const item of json.data ?? []) {
      const value = extractValue(item);
      if (value === null) continue;
      await this.upsertMetric(
        conn.workspaceId,
        item.name,
        value,
        bucketStart
      );
    }

    await this.db.socialConnection.update({
      where: { id: conn.id },
      data: { lastSyncAt: now, lastError: null, lastErrorAt: null },
    });
  }

  private async upsertMetric(
    workspaceId: string,
    metricKey: string,
    value: number,
    bucketStart: Date
  ): Promise<void> {
    await this.db.socialMetric.upsert({
      where: {
        workspaceId_platform_metricKey_bucket_bucketStart: {
          workspaceId,
          platform: 'THREADS',
          metricKey,
          bucket: 'HOUR',
          bucketStart,
        },
      },
      update: { value },
      create: {
        workspaceId,
        platform: 'THREADS',
        metricKey,
        bucket: 'HOUR',
        bucketStart,
        value,
      },
    });
  }
}

function extractValue(item: {
  total_value?: { value: number };
  values?: Array<{ value: number }>;
}): number | null {
  if (typeof item.total_value?.value === 'number') {
    return item.total_value.value;
  }
  if (Array.isArray(item.values) && item.values.length > 0) {
    const last = item.values[item.values.length - 1];
    if (typeof last?.value === 'number') return last.value;
  }
  return null;
}

function floorToHour(d: Date): Date {
  const out = new Date(d.getTime());
  out.setUTCMinutes(0, 0, 0);
  return out;
}
