import { Injectable, Logger } from '@nestjs/common';
import {
  MetricBucket,
  PrismaClient,
  type SocialPlatform,
} from '@prisma/client';

type AggregateRow = {
  workspaceId: string;
  platform: SocialPlatform;
  metricKey: string;
  value: number;
};

@Injectable()
export class MetricRollupService {
  private readonly logger = new Logger(MetricRollupService.name);

  constructor(private readonly db: PrismaClient) {}

  async rollupPreviousHour(now = new Date()): Promise<number> {
    const windowEnd = floorToHour(now);
    const windowStart = addHours(windowEnd, -1);
    const events = await this.db.socialEvent.findMany({
      where: {
        occurredAt: { gte: windowStart, lt: windowEnd },
      },
      select: {
        workspaceId: true,
        platform: true,
        eventType: true,
        payload: true,
      },
    });

    const aggregates = aggregateRows(
      events.flatMap(event => metricRowsFromEvent(event))
    );
    return await this.upsertAggregates(
      aggregates,
      MetricBucket.HOUR,
      windowStart,
      {
        source: 'social_events',
        windowEnd,
        sourceRows: events.length,
      }
    );
  }

  async rollupPreviousDay(now = new Date()): Promise<number> {
    const windowEnd = startOfUtcDay(now);
    const windowStart = addDays(windowEnd, -1);
    return await this.rollupMetricRows(
      MetricBucket.HOUR,
      MetricBucket.DAY,
      windowStart,
      windowEnd
    );
  }

  async rollupPreviousWeek(now = new Date()): Promise<number> {
    const windowEnd = startOfIsoWeek(now);
    const windowStart = addDays(windowEnd, -7);
    return await this.rollupMetricRows(
      MetricBucket.DAY,
      MetricBucket.WEEK,
      windowStart,
      windowEnd
    );
  }

  private async rollupMetricRows(
    sourceBucket: MetricBucket,
    targetBucket: MetricBucket,
    windowStart: Date,
    windowEnd: Date
  ): Promise<number> {
    const rows = await this.db.socialMetric.findMany({
      where: {
        bucket: sourceBucket,
        bucketStart: { gte: windowStart, lt: windowEnd },
      },
      select: {
        workspaceId: true,
        platform: true,
        metricKey: true,
        value: true,
      },
    });

    const aggregates = aggregateRows(rows);
    return await this.upsertAggregates(aggregates, targetBucket, windowStart, {
      source: sourceBucket,
      windowEnd,
      sourceRows: rows.length,
    });
  }

  private async upsertAggregates(
    aggregates: AggregateRow[],
    bucket: MetricBucket,
    bucketStart: Date,
    metadata: {
      source: MetricBucket | 'social_events';
      windowEnd: Date;
      sourceRows: number;
    }
  ): Promise<number> {
    for (const row of aggregates) {
      await this.db.socialMetric.upsert({
        where: {
          workspaceId_platform_metricKey_bucket_bucketStart: {
            workspaceId: row.workspaceId,
            platform: row.platform,
            metricKey: row.metricKey,
            bucket,
            bucketStart,
          },
        },
        create: {
          workspaceId: row.workspaceId,
          platform: row.platform,
          metricKey: row.metricKey,
          bucket,
          bucketStart,
          value: row.value,
          metadata: {
            source: metadata.source,
            windowEnd: metadata.windowEnd.toISOString(),
            sourceRows: metadata.sourceRows,
          },
        },
        update: {
          value: row.value,
          metadata: {
            source: metadata.source,
            windowEnd: metadata.windowEnd.toISOString(),
            sourceRows: metadata.sourceRows,
          },
        },
      });
    }

    if (aggregates.length > 0) {
      this.logger.debug(
        `Rolled up ${aggregates.length} ${bucket} analytics metric rows for ${bucketStart.toISOString()}`
      );
    }
    return aggregates.length;
  }
}

function metricRowsFromEvent(event: {
  workspaceId: string;
  platform: SocialPlatform;
  eventType: string;
  payload: unknown;
}): AggregateRow[] {
  const rows: AggregateRow[] = [];
  const payload = event.payload;
  const metrics =
    payload && typeof payload === 'object' && !Array.isArray(payload)
      ? (payload as { metrics?: unknown }).metrics
      : undefined;

  if (metrics && typeof metrics === 'object' && !Array.isArray(metrics)) {
    for (const [metricKey, value] of Object.entries(metrics)) {
      if (typeof value === 'number' && Number.isFinite(value)) {
        rows.push({
          workspaceId: event.workspaceId,
          platform: event.platform,
          metricKey,
          value,
        });
      }
    }
  }

  if (event.eventType === 'follower.gained') {
    rows.push({
      workspaceId: event.workspaceId,
      platform: event.platform,
      metricKey: 'followers_delta_24h',
      value: 1,
    });
  } else if (event.eventType === 'follower.lost') {
    rows.push({
      workspaceId: event.workspaceId,
      platform: event.platform,
      metricKey: 'followers_delta_24h',
      value: -1,
    });
  }

  return rows;
}

function aggregateRows(rows: AggregateRow[]): AggregateRow[] {
  const byKey = new Map<string, AggregateRow>();
  for (const row of rows) {
    const key = JSON.stringify([row.workspaceId, row.platform, row.metricKey]);
    const existing = byKey.get(key);
    if (existing) {
      existing.value += row.value;
    } else {
      byKey.set(key, { ...row });
    }
  }
  return Array.from(byKey.values());
}

function floorToHour(d: Date): Date {
  const out = new Date(d.getTime());
  out.setUTCMinutes(0, 0, 0);
  return out;
}

function startOfUtcDay(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  );
}

function startOfIsoWeek(d: Date): Date {
  const dayStart = startOfUtcDay(d);
  const day = dayStart.getUTCDay();
  const daysSinceMonday = (day + 6) % 7;
  return addDays(dayStart, -daysSinceMonday);
}

function addHours(d: Date, hours: number): Date {
  return new Date(d.getTime() + hours * 60 * 60 * 1000);
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 24 * 60 * 60 * 1000);
}
