import { describe, expect, test } from 'vitest';

import type { SocialMetric } from '../entities/analytics-data.entity';
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
