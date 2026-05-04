import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type { SocialConnection } from '@prisma/client';
import { PrismaClient } from '@prisma/client';

import { TokenStore } from '../../connections/token-store';

/**
 * Meta poller — polls Facebook Page Insights and Instagram User Insights every
 * 10 minutes for every ACTIVE FACEBOOK / INSTAGRAM connection. Webhooks deliver
 * events as they happen; this poller is the metric-snapshot path that fills
 * `social_metrics` (HOUR bucket).
 *
 * Error handling:
 *  - 401 → mark connection EXPIRED (token revoked or expired).
 *  - other 4xx → record `lastError`/`lastErrorAt` but keep status (operator
 *    can investigate; some 4xx are platform-side flakes).
 *  - 5xx → log, retry next tick.
 *
 * IngestionService is not used here — these are aggregate metric snapshots,
 * not events, so we write to `social_metrics` directly.
 */

const GRAPH_API_VERSION = 'v19.0';
const FB_GRAPH_URL = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

const FB_METRICS = [
  'page_impressions',
  'page_post_engagements',
  'page_views_total',
] as const;

const IG_METRICS = ['impressions', 'reach', 'follower_count'] as const;

interface InsightResponse {
  data?: Array<{
    name: string;
    period?: string;
    values?: Array<{ value: number | Record<string, number>; end_time?: string }>;
  }>;
}

@Injectable()
export class MetaPoller {
  private readonly logger = new Logger(MetaPoller.name);

  constructor(
    private readonly db: PrismaClient,
    private readonly tokenStore: TokenStore
  ) {}

  // Every 10 minutes — matches the cadence in the brief.
  @Cron('*/10 * * * *')
  async poll(): Promise<void> {
    try {
      await this.pollOnce();
    } catch (err) {
      this.logger.error(
        'MetaPoller.poll failed',
        err instanceof Error ? err.stack : String(err)
      );
    }
  }

  /** Test entry-point. */
  async pollOnce(now: Date = new Date()): Promise<void> {
    const connections = await this.db.socialConnection.findMany({
      where: {
        platform: { in: ['FACEBOOK', 'INSTAGRAM'] },
        status: 'ACTIVE',
      },
    });

    for (const conn of connections) {
      try {
        await this.pollConnection(conn, now);
      } catch (err) {
        this.logger.warn(
          `MetaPoller: connection ${conn.id} (${conn.platform}) failed: ${err instanceof Error ? err.message : String(err)}`
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
      reason: 'MetaPoller',
    });

    const metricNames =
      conn.platform === 'FACEBOOK' ? FB_METRICS : IG_METRICS;

    const url =
      `${FB_GRAPH_URL}/${conn.externalAccountId}/insights` +
      `?metric=${metricNames.join(',')}&period=day&access_token=${encodeURIComponent(token)}`;

    let res: Response;
    try {
      res = await fetch(url, { method: 'GET' });
    } catch (err) {
      // Network-level — treat as 5xx-equivalent (transient).
      this.logger.warn(
        `MetaPoller: network error polling ${conn.id}: ${err instanceof Error ? err.message : String(err)}`
      );
      return;
    }

    if (res.status === 401) {
      await this.markExpired(conn.id, 'Meta API returned 401 (token expired or revoked)');
      return;
    }

    if (res.status >= 400 && res.status < 500) {
      const body = (await res.text()).slice(0, 256);
      await this.markError(
        conn.id,
        `Meta API ${res.status}: ${body}`
      );
      return;
    }

    if (res.status >= 500) {
      // Retry next tick.
      this.logger.warn(
        `MetaPoller: ${conn.id} got ${res.status} — will retry next tick`
      );
      return;
    }

    const json = (await res.json()) as InsightResponse;
    const bucketStart = floorToHour(now);

    for (const item of json.data ?? []) {
      const value = extractLatestValue(item.values);
      if (value === null) continue;

      await this.upsertMetric(
        conn.workspaceId,
        conn.platform,
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

  private async markExpired(id: string, error: string): Promise<void> {
    await this.db.socialConnection.update({
      where: { id },
      data: {
        status: 'EXPIRED',
        lastError: error,
        lastErrorAt: new Date(),
      },
    });
  }

  private async markError(id: string, error: string): Promise<void> {
    await this.db.socialConnection.update({
      where: { id },
      data: {
        lastError: error,
        lastErrorAt: new Date(),
      },
    });
  }

  private async upsertMetric(
    workspaceId: string,
    platform: SocialConnection['platform'],
    metricKey: string,
    value: number,
    bucketStart: Date
  ): Promise<void> {
    await this.db.socialMetric.upsert({
      where: {
        workspaceId_platform_metricKey_bucket_bucketStart: {
          workspaceId,
          platform,
          metricKey,
          bucket: 'HOUR',
          bucketStart,
        },
      },
      update: { value },
      create: {
        workspaceId,
        platform,
        metricKey,
        bucket: 'HOUR',
        bucketStart,
        value,
      },
    });
  }
}

function extractLatestValue(
  values:
    | Array<{ value: number | Record<string, number>; end_time?: string }>
    | undefined
): number | null {
  if (!values || values.length === 0) return null;
  const last = values[values.length - 1];
  if (typeof last.value === 'number') return last.value;
  // Some metrics return breakdowns — sum them as a coarse rollup.
  if (last.value && typeof last.value === 'object') {
    const sum = Object.values(last.value).reduce(
      (acc, v) => acc + (typeof v === 'number' ? v : 0),
      0
    );
    return sum;
  }
  return null;
}

function floorToHour(d: Date): Date {
  const out = new Date(d.getTime());
  out.setUTCMinutes(0, 0, 0);
  return out;
}
