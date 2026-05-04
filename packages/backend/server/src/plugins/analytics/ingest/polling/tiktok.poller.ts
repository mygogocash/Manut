import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  ConnectionStatus,
  MetricBucket,
  PrismaClient,
  type SocialConnection,
  SocialPlatform,
} from '@prisma/client';

import { TokenStore } from '../../connections/token-store';
import { TikTokMapper } from '../../normalizer/platform-mappers/tiktok.mapper';
import { IngestionService } from '../ingestion.service';

/**
 * TikTok poller — the source of truth for publish detection on the
 * Display-API tier. Per docs/analytics-platform.md risk #12, TikTok does NOT
 * deliver `video.publish` webhooks to non-partner apps, so this 15-min cron
 * is how we discover new posts.
 *
 * Endpoints (Display API v2):
 *   - POST https://open.tiktokapis.com/v2/video/list/   — paginated list of
 *       a creator's own videos. Cursor-based.
 *   - POST https://open.tiktokapis.com/v2/video/query/  — fetch metric fields
 *       (view/like/comment/share counts) for specific video ids.
 */

const VIDEO_LIST_URL = 'https://open.tiktokapis.com/v2/video/list/';
const VIDEO_QUERY_URL = 'https://open.tiktokapis.com/v2/video/query/';

const LIST_FIELDS = [
  'id',
  'create_time',
  'title',
  'video_description',
  'cover_image_url',
  'share_url',
  'duration',
  'height',
  'width',
  'embed_link',
];

const QUERY_FIELDS = [
  'id',
  'view_count',
  'like_count',
  'comment_count',
  'share_count',
];

interface VideoListResponse {
  data?: {
    videos?: Array<Record<string, unknown> & { id?: string | number }>;
    cursor?: number;
    has_more?: boolean;
  };
  error?: { code?: string; message?: string };
}

interface VideoMetrics {
  id?: string | number;
  view_count?: number;
  like_count?: number;
  comment_count?: number;
  share_count?: number;
}

interface VideoQueryResponse {
  data?: {
    videos?: VideoMetrics[];
  };
  error?: { code?: string; message?: string };
}

@Injectable()
export class TikTokPoller {
  private readonly logger = new Logger(TikTokPoller.name);

  constructor(
    private readonly db: PrismaClient,
    private readonly tokenStore: TokenStore,
    private readonly mapper: TikTokMapper,
    private readonly ingestion: IngestionService
  ) {}

  // 15-minute cadence per PRD risk #12.
  @Cron('*/15 * * * *')
  async poll(): Promise<void> {
    const connections = await this.db.socialConnection.findMany({
      where: {
        platform: SocialPlatform.TIKTOK,
        status: ConnectionStatus.ACTIVE,
      },
    });

    if (connections.length === 0) {
      this.logger.debug('TikTokPoller.poll: no active TIKTOK connections');
      return;
    }

    for (const connection of connections) {
      try {
        await this.pollOne(connection);
      } catch (error: unknown) {
        // Per-connection failures must not stop the loop.
        this.logger.error(
          `TikTokPoller.pollOne failed for connection ${connection.id}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    }
  }

  // ---------------------------------------------------------------------------
  // private
  // ---------------------------------------------------------------------------

  private async pollOne(connection: SocialConnection): Promise<void> {
    const accessToken = await this.tokenStore.decryptWithAudit(
      connection.accessTokenEnc,
      {
        workspaceId: connection.workspaceId,
        platform: SocialPlatform.TIKTOK,
        reason: 'TikTokPoller.poll',
      }
    );

    // Default first-run window: last 24h. After that, use lastSyncAt.
    const sinceMs = (
      connection.lastSyncAt ?? new Date(Date.now() - 24 * 60 * 60 * 1000)
    ).getTime();

    const newVideos: Array<Record<string, unknown> & { id?: string | number }> =
      [];
    let cursor: number | undefined = undefined;
    let safetyPages = 10; // hard cap to keep one cron tick bounded

    try {
      while (safetyPages-- > 0) {
        const page: VideoListResponse = await this.postJson(
          VIDEO_LIST_URL,
          accessToken,
          { fields: LIST_FIELDS, cursor, max_count: 20 }
        );

        if (page.error?.code) {
          throw new Error(
            `TikTok video/list error: ${page.error.code} ${page.error.message ?? ''}`
          );
        }

        const batch = page.data?.videos ?? [];
        // TikTok returns videos newest-first; stop when we cross sinceMs.
        let crossedSince = false;
        for (const v of batch) {
          const ts =
            typeof v.create_time === 'number' ? v.create_time * 1000 : 0;
          if (ts < sinceMs) {
            crossedSince = true;
            break;
          }
          newVideos.push(v);
        }
        if (crossedSince || !page.data?.has_more) {
          break;
        }
        cursor = page.data?.cursor;
      }
    } catch (error: unknown) {
      await this.handleApiError(connection, error);
      return;
    }

    if (newVideos.length === 0) {
      await this.markSynced(connection.id);
      return;
    }

    // Dedup against social_events: drop ids we've already ingested for this
    // connection + eventType=post.created.
    const candidateIds = newVideos
      .map(v => (v.id == null ? '' : String(v.id)))
      .filter((s): s is string => s.length > 0);

    const existing = await this.db.socialEvent.findMany({
      where: {
        connectionId: connection.id,
        eventType: 'post.created',
        externalId: { in: candidateIds },
      },
      select: { externalId: true },
    });
    const seen = new Set(existing.map(e => e.externalId));

    const fresh = newVideos.filter(
      v => v.id != null && !seen.has(String(v.id))
    );

    if (fresh.length === 0) {
      await this.markSynced(connection.id);
      return;
    }

    // Pull metrics for the fresh videos in one query call.
    const metricsById = await this.fetchMetrics(
      accessToken,
      fresh.map(v => String(v.id))
    ).catch(error => {
      this.logger.warn(
        `TikTok metrics query failed for connection ${connection.id}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      return new Map<string, VideoMetrics>();
    });

    // Build per-connection metric totals at the same time we ingest events.
    let totalViews = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;

    for (const video of fresh) {
      const id = String(video.id);
      const metrics = metricsById.get(id);
      const enriched = { ...video, ...metrics };

      const event = this.mapper.toSocialEvent(enriched, connection);
      try {
        // Round A stub — will throw at runtime.
        await this.ingestion.normalizeAndStore(
          event,
          'TIKTOK',
          connection.id
        );
      } catch (error: unknown) {
        this.logger.error(
          `TikTok ingest failed for video ${id}: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }

      totalViews += metrics?.view_count ?? 0;
      totalLikes += metrics?.like_count ?? 0;
      totalComments += metrics?.comment_count ?? 0;
      totalShares += metrics?.share_count ?? 0;
    }

    // Roll up into social_metrics keyed at the hour bucket containing now.
    await this.upsertMetricTotals(connection, {
      viewCount: totalViews,
      likeCount: totalLikes,
      commentCount: totalComments,
      shareCount: totalShares,
    });

    await this.markSynced(connection.id);
  }

  private async fetchMetrics(
    accessToken: string,
    ids: string[]
  ): Promise<Map<string, VideoMetrics>> {
    const out = new Map<string, VideoMetrics>();
    if (ids.length === 0) return out;

    const res: VideoQueryResponse = await this.postJson(
      VIDEO_QUERY_URL,
      accessToken,
      {
        filters: { video_ids: ids },
        fields: QUERY_FIELDS,
      }
    );

    if (res.error?.code) {
      throw new Error(
        `TikTok video/query error: ${res.error.code} ${res.error.message ?? ''}`
      );
    }

    for (const v of res.data?.videos ?? []) {
      if (v.id != null) {
        out.set(String(v.id), v);
      }
    }
    return out;
  }

  private async postJson<T>(
    url: string,
    accessToken: string,
    body: Record<string, unknown>
  ): Promise<T> {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(body),
    });

    if (res.status === 401) {
      const err = new Error('TikTok 401 unauthorized') as Error & {
        statusCode?: number;
      };
      err.statusCode = 401;
      throw err;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`TikTok HTTP ${res.status}: ${text.slice(0, 200)}`);
    }

    return (await res.json()) as T;
  }

  private async handleApiError(
    connection: SocialConnection,
    error: unknown
  ): Promise<void> {
    const status = (error as { statusCode?: number } | undefined)?.statusCode;
    const message = error instanceof Error ? error.message : String(error);

    if (status === 401) {
      await this.db.socialConnection.update({
        where: { id: connection.id },
        data: {
          status: ConnectionStatus.EXPIRED,
          lastErrorAt: new Date(),
          lastError: 'TikTok token expired (401). Re-auth required.',
        },
      });
      this.logger.warn(
        `TikTok connection ${connection.id} -> EXPIRED (401 from API)`
      );
      return;
    }

    await this.db.socialConnection
      .update({
        where: { id: connection.id },
        data: {
          lastErrorAt: new Date(),
          lastError: message.slice(0, 500),
        },
      })
      .catch(updateErr => {
        this.logger.error(
          `Failed to record poll error on connection ${connection.id}: ${
            updateErr instanceof Error ? updateErr.message : String(updateErr)
          }`
        );
      });

    this.logger.warn(
      `TikTok poller transient error on ${connection.id} (will retry next tick): ${message}`
    );
  }

  private async markSynced(connectionId: string): Promise<void> {
    await this.db.socialConnection.update({
      where: { id: connectionId },
      data: { lastSyncAt: new Date() },
    });
  }

  private async upsertMetricTotals(
    connection: SocialConnection,
    totals: {
      viewCount: number;
      likeCount: number;
      commentCount: number;
      shareCount: number;
    }
  ): Promise<void> {
    const bucketStart = this.startOfHour(new Date());
    const entries: Array<{ key: string; value: number }> = [
      { key: 'view_count', value: totals.viewCount },
      { key: 'like_count', value: totals.likeCount },
      { key: 'comment_count', value: totals.commentCount },
      { key: 'share_count', value: totals.shareCount },
    ];

    for (const entry of entries) {
      if (entry.value === 0) continue;
      await this.db.socialMetric
        .upsert({
          where: {
            workspaceId_platform_metricKey_bucket_bucketStart: {
              workspaceId: connection.workspaceId,
              platform: SocialPlatform.TIKTOK,
              metricKey: entry.key,
              bucket: MetricBucket.HOUR,
              bucketStart,
            },
          },
          create: {
            workspaceId: connection.workspaceId,
            platform: SocialPlatform.TIKTOK,
            metricKey: entry.key,
            bucket: MetricBucket.HOUR,
            bucketStart,
            value: entry.value,
          },
          update: {
            value: { increment: entry.value },
          },
        })
        .catch(err => {
          this.logger.warn(
            `TikTok metric upsert failed (${entry.key}): ${
              err instanceof Error ? err.message : String(err)
            }`
          );
        });
    }
  }

  private startOfHour(d: Date): Date {
    const x = new Date(d);
    x.setMinutes(0, 0, 0);
    return x;
  }
}
