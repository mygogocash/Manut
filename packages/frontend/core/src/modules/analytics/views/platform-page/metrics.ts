import type {
  AnalyticsKpi,
  MetricSeries,
  SocialMetric,
} from '../../entities/analytics-data.entity';

export function buildMetricKpis(rows: SocialMetric[]): AnalyticsKpi[] {
  const byKey = groupByMetricKey(rows);
  return Array.from(byKey.entries()).map(([metricKey, items]) => {
    const sorted = sortByBucketStart(items);
    const latest = sorted.at(-1);
    const previous = sorted.at(-2);
    const value = latest?.value ?? 0;
    return {
      key: metricKey,
      label: metricLabel(metricKey),
      value,
      deltaPct:
        previous && previous.value !== 0
          ? ((value - previous.value) / previous.value) * 100
          : null,
      sparkline: sorted.map(row => row.value),
    };
  });
}

export function buildMetricSeries(rows: SocialMetric[]): MetricSeries[] {
  const byKey = groupByMetricKey(rows);
  return Array.from(byKey.entries())
    .map(([metricKey, items]) => {
      const sorted = sortByBucketStart(items);
      return {
        name: metricLabel(metricKey),
        platform: sorted[0]?.platform ?? 'ALL',
        points: sorted.map(row => ({
          ts: row.bucketStart,
          value: row.value,
        })),
      } satisfies MetricSeries;
    })
    .filter(series => series.points.length > 1);
}

function groupByMetricKey(rows: SocialMetric[]): Map<string, SocialMetric[]> {
  const byKey = new Map<string, SocialMetric[]>();
  for (const row of rows) {
    const list = byKey.get(row.metricKey) ?? [];
    list.push(row);
    byKey.set(row.metricKey, list);
  }
  return byKey;
}

function sortByBucketStart(rows: SocialMetric[]): SocialMetric[] {
  return [...rows].sort((a, b) => {
    return (
      new Date(a.bucketStart).getTime() - new Date(b.bucketStart).getTime()
    );
  });
}

function metricLabel(metricKey: string): string {
  return metricKey
    .split(/[._-]+/g)
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}
