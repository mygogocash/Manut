import { describe, expect, test } from 'vitest';

import type { SocialMetric } from '../entities/analytics-data.entity';
import {
  buildEventMessage,
  type PlatformRecentEvent,
} from '../views/platform-page/events';
import {
  buildMetricKpis,
  buildMetricSeries,
} from '../views/platform-page/metrics';

const rows: SocialMetric[] = [
  {
    id: 'm2',
    platform: 'TIKTOK',
    metricKey: 'views.total',
    bucket: 'HOUR',
    bucketStart: '2026-06-01T02:00:00.000Z',
    value: 150,
  },
  {
    id: 'm1',
    platform: 'TIKTOK',
    metricKey: 'views.total',
    bucket: 'HOUR',
    bucketStart: '2026-06-01T01:00:00.000Z',
    value: 100,
  },
  {
    id: 'm3',
    platform: 'TIKTOK',
    metricKey: 'followers_delta_24h',
    bucket: 'HOUR',
    bucketStart: '2026-06-01T02:00:00.000Z',
    value: 8,
  },
];

describe('platform-page metric helpers', () => {
  test('buildMetricKpis uses latest values and sorted sparkline data', () => {
    const kpis = buildMetricKpis(rows);

    expect(kpis).toEqual([
      {
        key: 'views.total',
        label: 'Views Total',
        value: 150,
        deltaPct: 50,
        sparkline: [100, 150],
      },
      {
        key: 'followers_delta_24h',
        label: 'Followers Delta 24h',
        value: 8,
        deltaPct: null,
        sparkline: [8],
      },
    ]);
  });

  test('buildMetricSeries keeps only metrics with enough points for a trend', () => {
    const series = buildMetricSeries(rows);

    expect(series).toEqual([
      {
        name: 'Views Total',
        platform: 'TIKTOK',
        points: [
          { ts: '2026-06-01T01:00:00.000Z', value: 100 },
          { ts: '2026-06-01T02:00:00.000Z', value: 150 },
        ],
      },
    ]);
  });
});

describe('platform-page recent event helpers', () => {
  test('buildEventMessage prefers readable payload text fields', () => {
    const event: PlatformRecentEvent = {
      id: 'event-1',
      platform: 'LINE_VOOM',
      eventType: 'message.received',
      externalId: 'line-1',
      occurredAt: '2026-06-01T12:00:00.000Z',
      receivedAt: '2026-06-01T12:00:02.000Z',
      payload: {
        text: 'Sawadee from LINE',
      },
    };

    expect(buildEventMessage(event)).toBe('Sawadee from LINE');
  });

  test('buildEventMessage summarizes metrics without exposing raw JSON', () => {
    const event: PlatformRecentEvent = {
      id: 'event-2',
      platform: 'TIKTOK',
      eventType: 'metric.snapshot',
      externalId: 'tt-1',
      occurredAt: '2026-06-01T12:00:00.000Z',
      receivedAt: '2026-06-01T12:00:02.000Z',
      payload: {
        metrics: {
          views: 1200,
          likes: 48,
        },
      },
    };

    expect(buildEventMessage(event)).toBe('Views 1,200 · Likes 48');
  });

  test('buildEventMessage falls back to event type and external id', () => {
    const event: PlatformRecentEvent = {
      id: 'event-3',
      platform: 'FACEBOOK',
      eventType: 'post.created',
      externalId: 'fb-post-1',
      occurredAt: '2026-06-01T12:00:00.000Z',
      receivedAt: '2026-06-01T12:00:02.000Z',
      payload: {},
    };

    expect(buildEventMessage(event)).toBe('Post created · fb-post-1');
  });
});
