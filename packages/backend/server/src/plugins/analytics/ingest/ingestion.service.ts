import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import { AnomalyDetectorService } from '../ai/anomaly-detector.service';
import type {
  SocialEvent,
  SocialPlatformName,
} from '../normalizer/event.schema';

/**
 * Central ingestion entry point — receives a normalized SocialEvent + platform
 * tag from either a webhook controller or a poller, dedups against
 * `social_events.@@unique[connectionId, externalId, eventType]`, persists the
 * normalized event + raw payload, extracts conservative metric updates into
 * `social_metrics`, and best-effort fires the AnomalyDetectorService.
 *
 * Idempotency contract: the (connectionId, externalId, eventType) unique index
 * is what guarantees a duplicate webhook delivery is a no-op. We `findUnique`
 * first; if the row already exists we return early without touching metrics
 * or anomaly detection (the original write already did that work).
 */
@Injectable()
export class IngestionService {
  private readonly logger = new Logger(IngestionService.name);

  constructor(
    private readonly db: PrismaClient,
    private readonly anomalyDetector: AnomalyDetectorService
  ) {}

  /**
   * Persist a normalized SocialEvent. The `_platform` parameter is retained
   * for caller-side typing — the SocialEvent itself already carries the
   * platform tag, so we read from `event.platform` to keep the row
   * consistent with the in-memory shape.
   */
  async normalizeAndStore(
    event: SocialEvent,
    _platform: SocialPlatformName,
    connectionId: string
  ): Promise<SocialEvent> {
    try {
      // 1. Idempotent write to social_events. We probe first instead of
      // upsert because we want to skip the metric extraction + anomaly call
      // entirely on duplicate delivery.
      const existing = await this.db.socialEvent.findUnique({
        where: {
          connectionId_externalId_eventType: {
            connectionId,
            externalId: event.externalId,
            eventType: event.eventType,
          },
        },
        select: { id: true },
      });

      if (existing) {
        this.logger.debug(
          `IngestionService: duplicate event externalId=${event.externalId} eventType=${event.eventType} — skipping`
        );
        return event;
      }

      await this.db.socialEvent.create({
        data: {
          workspaceId: event.workspaceId,
          connectionId,
          platform: event.platform,
          eventType: event.eventType,
          externalId: event.externalId,
          occurredAt: event.occurredAt,
          payload: event.payload as object,
          raw: (event.raw ?? {}) as object,
        },
      });

      // 2. Extract metrics from payload + write to social_metrics. Conservative:
      // only handle (a) `payload.metrics` Record<string, number> (TikTok shape)
      // and (b) follower.gained / follower.lost as a 24h delta counter.
      const metricWrites = this.extractMetricWrites(event);
      for (const m of metricWrites) {
        try {
          await this.upsertMetric(event, m);
          // 3. Anomaly detection — best effort. Failure must not throw.
          try {
            await this.anomalyDetector.checkMetric({
              workspaceId: event.workspaceId,
              platform: event.platform,
              metricKey: m.metricKey,
              value: m.value,
              occurredAt: event.occurredAt,
            });
          } catch (anomalyErr) {
            this.logger.warn(
              `IngestionService: anomaly check failed for externalId=${event.externalId} metric=${m.metricKey}: ${
                anomalyErr instanceof Error
                  ? anomalyErr.message
                  : String(anomalyErr)
              }`
            );
          }
        } catch (metricErr) {
          this.logger.warn(
            `IngestionService: metric write failed for externalId=${event.externalId} metric=${m.metricKey}: ${
              metricErr instanceof Error
                ? metricErr.message
                : String(metricErr)
            }`
          );
        }
      }

      // 4. Touch lastSyncAt on the connection so the connection list shows
      // a fresh "last data received" timestamp.
      try {
        await this.db.socialConnection.update({
          where: { id: connectionId },
          data: { lastSyncAt: new Date() },
        });
      } catch (syncErr) {
        this.logger.warn(
          `IngestionService: lastSyncAt update failed for connection=${connectionId}: ${
            syncErr instanceof Error ? syncErr.message : String(syncErr)
          }`
        );
      }

      return event;
    } catch (error) {
      this.logger.error(
        `IngestionService.normalizeAndStore failed for externalId=${event.externalId} eventType=${event.eventType}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      throw error;
    }
  }

  /**
   * Conservative metric extraction. Returns the (metricKey, value, mode)
   * tuples we want to write for this event.
   *
   * - `payload.metrics` shape (TikTok mapper): each numeric leaf is a metric
   *   `set` write at the current hour bucket.
   * - `follower.gained` / `follower.lost`: increment a `followers_delta_24h`
   *   counter at the current hour bucket.
   */
  private extractMetricWrites(event: SocialEvent): Array<{
    metricKey: string;
    value: number;
    mode: 'set' | 'increment';
  }> {
    const writes: Array<{
      metricKey: string;
      value: number;
      mode: 'set' | 'increment';
    }> = [];

    const metrics = event.payload?.metrics;
    if (metrics && typeof metrics === 'object' && !Array.isArray(metrics)) {
      for (const [key, raw] of Object.entries(metrics)) {
        if (typeof raw === 'number' && Number.isFinite(raw)) {
          writes.push({ metricKey: key, value: raw, mode: 'set' });
        }
      }
    }

    if (event.eventType === 'follower.gained') {
      writes.push({
        metricKey: 'followers_delta_24h',
        value: 1,
        mode: 'increment',
      });
    } else if (event.eventType === 'follower.lost') {
      writes.push({
        metricKey: 'followers_delta_24h',
        value: -1,
        mode: 'increment',
      });
    }

    return writes;
  }

  private async upsertMetric(
    event: SocialEvent,
    m: { metricKey: string; value: number; mode: 'set' | 'increment' }
  ): Promise<void> {
    const bucketStart = floorToHour(event.occurredAt);
    if (m.mode === 'increment') {
      await this.db.socialMetric.upsert({
        where: {
          workspaceId_platform_metricKey_bucket_bucketStart: {
            workspaceId: event.workspaceId,
            platform: event.platform,
            metricKey: m.metricKey,
            bucket: 'HOUR',
            bucketStart,
          },
        },
        create: {
          workspaceId: event.workspaceId,
          platform: event.platform,
          metricKey: m.metricKey,
          bucket: 'HOUR',
          bucketStart,
          value: m.value,
        },
        update: {
          value: { increment: m.value },
        },
      });
    } else {
      await this.db.socialMetric.upsert({
        where: {
          workspaceId_platform_metricKey_bucket_bucketStart: {
            workspaceId: event.workspaceId,
            platform: event.platform,
            metricKey: m.metricKey,
            bucket: 'HOUR',
            bucketStart,
          },
        },
        create: {
          workspaceId: event.workspaceId,
          platform: event.platform,
          metricKey: m.metricKey,
          bucket: 'HOUR',
          bucketStart,
          value: m.value,
        },
        update: {
          value: m.value,
        },
      });
    }
  }
}

function floorToHour(d: Date): Date {
  const out = new Date(d.getTime());
  out.setUTCMinutes(0, 0, 0);
  return out;
}
