import { DebugLogger } from '@affine/debug';
import { useLiveData, useService } from '@toeverything/infra';
import { useEffect, useMemo, useState } from 'react';

import { WorkspaceService } from '../../../workspace';
import { ConnectionStatusBadge } from '../../components/connection-status-badge';
import { InsightCard } from '../../components/insight-card';
import { MetricCard } from '../../components/metric-card';
import { TrendChart } from '../../components/trend-chart';
import type {
  AnalyticsKpi,
  MetricSeries,
  SocialMetric,
  SocialPlatform,
} from '../../entities/analytics-data.entity';
import type { Insight } from '../../entities/insight.entity';
import type { PlatformConnection } from '../../entities/platform-connection.entity';
import { AnalyticsService } from '../../services/analytics.service';
import { ConnectionService } from '../../services/connection.service';
import * as styles from './index.css';
import { buildMetricKpis, buildMetricSeries } from './metrics';

const logger = new DebugLogger('analytics');

// Stable empty-array references for useMemo deps; see ai-strategist/index.tsx.
const EMPTY_INSIGHTS: readonly Insight[] = Object.freeze([]);
const EMPTY_CONNECTIONS: readonly PlatformConnection[] = Object.freeze([]);

const KNOWN_PLATFORMS = new Set<SocialPlatform>([
  'FACEBOOK',
  'INSTAGRAM',
  'THREADS',
  'TIKTOK',
  'LINE_VOOM',
  'GOGOCASH',
]);

const isKnownPlatform = (slug: string | undefined): slug is SocialPlatform => {
  if (!slug) return false;
  return KNOWN_PLATFORMS.has(slug.toUpperCase() as SocialPlatform);
};

interface PlatformPageProps {
  platform: string;
}

interface RecentEvent {
  id: string;
  ts: string;
  type: string;
  message: string;
}

// TODO(analytics): replace with `loadRecentEvents(workspaceId, platform)`
// query once backend Round C exposes social_events. For now we render
// "No recent events yet" so the section ships without invented data.
const MOCK_RECENT_EVENTS: RecentEvent[] = [];

function pointsFromSparkline(
  sparkline: number[]
): Array<{ ts: string; value: number }> {
  const now = Date.now();
  return sparkline.map((value, i) => ({
    ts: new Date(
      now - (sparkline.length - 1 - i) * 60 * 60 * 1000
    ).toISOString(),
    value,
  }));
}

/**
 * Filter overview KPIs to those that include the platform name in their
 * key/label. The exact filtering rule depends on backend KPI naming —
 * if the backend exposes a per-platform query later, swap this for it.
 */
function filterKpisForPlatform(
  kpis: AnalyticsKpi[],
  platform: SocialPlatform
): AnalyticsKpi[] {
  const slug = platform.toLowerCase();
  return kpis.filter(
    k =>
      k.key.toLowerCase().includes(slug) || k.label.toLowerCase().includes(slug)
  );
}

export function PlatformPage({ platform }: PlatformPageProps) {
  const analyticsService = useService(AnalyticsService);
  const connectionService = useService(ConnectionService);
  const workspaceService = useService(WorkspaceService);
  const workspaceId = workspaceService.workspace.id;

  const overview = useLiveData(analyticsService.data.overview$);
  const overviewLoading = useLiveData(analyticsService.data.loading$) ?? false;
  const insights =
    useLiveData(analyticsService.insights.insights$) ?? EMPTY_INSIGHTS;
  const connections =
    useLiveData(connectionService.entity.connections$) ?? EMPTY_CONNECTIONS;
  const [metricRows, setMetricRows] = useState<SocialMetric[]>([]);
  const [metricsLoading, setMetricsLoading] = useState(false);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  useEffect(() => {
    analyticsService.loadOverview(workspaceId).catch(err => {
      logger.error('loadOverview failed', err);
    });
    analyticsService.loadInsights(workspaceId).catch(err => {
      logger.error('loadInsights failed', err);
    });
    connectionService.loadConnections(workspaceId).catch(err => {
      logger.error('loadConnections failed', err);
    });
  }, [analyticsService, connectionService, workspaceId]);

  const platformKey = useMemo(
    () =>
      isKnownPlatform(platform)
        ? (platform.toUpperCase() as SocialPlatform)
        : null,
    [platform]
  );

  useEffect(() => {
    if (!platformKey) {
      setMetricRows([]);
      return;
    }
    let cancelled = false;
    const to = new Date();
    const from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
    setMetricsLoading(true);
    setMetricsError(null);
    analyticsService
      .loadMetrics(workspaceId, {
        platform: platformKey,
        bucket: 'HOUR',
        from,
        to,
      })
      .then(rows => {
        if (!cancelled) {
          setMetricRows(rows);
        }
      })
      .catch(err => {
        logger.error('loadMetrics failed', err);
        if (!cancelled) {
          setMetricRows([]);
          setMetricsError(
            err instanceof Error ? err.message : 'Could not load metrics'
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setMetricsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [analyticsService, platformKey, workspaceId]);

  const platformKpis = useMemo(
    () =>
      platformKey
        ? filterKpisForPlatform(overview?.kpis ?? [], platformKey)
        : [],
    [overview, platformKey]
  );

  const metricKpis = useMemo(() => buildMetricKpis(metricRows), [metricRows]);

  const displayKpis = platformKpis.length > 0 ? platformKpis : metricKpis;

  const metricSeries = useMemo(
    () => buildMetricSeries(metricRows),
    [metricRows]
  );

  const overviewSeries = useMemo<MetricSeries[]>(
    () =>
      platformKpis
        .filter(k => k.sparkline.length > 1)
        .map(kpi => ({
          name: kpi.label,
          platform: platformKey ?? 'ALL',
          points: pointsFromSparkline(kpi.sparkline),
        })),
    [platformKey, platformKpis]
  );

  const trendSeries = metricSeries.length > 0 ? metricSeries : overviewSeries;

  const platformInsights = useMemo(
    () =>
      platformKey
        ? insights.filter(i => (i.platforms ?? []).includes(platformKey))
        : [],
    [insights, platformKey]
  );

  const connection = platformKey
    ? connections.find(c => c.platform === platformKey)
    : undefined;

  if (!platformKey) {
    return (
      <div className={styles.root}>
        <div className={styles.empty}>
          Unknown platform: <code>{platform}</code>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.root} data-testid={`analytics-platform-${platform}`}>
      <div className={styles.headerRow}>
        <div>
          <div className={styles.title}>{platformKey}</div>
          <div className={styles.subtitle}>
            {connection?.externalAccountName ??
              connection?.accountHandle ??
              'No account linked'}
          </div>
        </div>
        <ConnectionStatusBadge status={connection?.status ?? 'NOT_CONNECTED'} />
      </div>

      <div className={styles.sectionLabel}>Performance</div>
      {(overviewLoading || metricsLoading) && displayKpis.length === 0 ? (
        <div className={styles.kpiGrid}>
          <div className={styles.skeletonBlock} />
          <div className={styles.skeletonBlock} />
          <div className={styles.skeletonBlock} />
        </div>
      ) : metricsError ? (
        <div className={styles.empty}>{metricsError}</div>
      ) : displayKpis.length > 0 ? (
        <div className={styles.kpiGrid}>
          {displayKpis.map(kpi => (
            <MetricCard
              key={kpi.key}
              label={kpi.label}
              value={kpi.value}
              delta={
                kpi.deltaPct === null || Number.isNaN(kpi.deltaPct)
                  ? undefined
                  : kpi.deltaPct / 100
              }
              deltaFormat="percent"
            />
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          No metrics for this platform yet. Once connected and the next sync
          completes, KPIs will appear here.
        </div>
      )}

      <div className={styles.sectionLabel}>Trends</div>
      <div className={styles.chartGrid}>
        {trendSeries.length > 0 ? (
          trendSeries.map(series => (
            <TrendChart
              key={series.name}
              title={series.name}
              subtitle="Last 7 days"
              points={series.points}
            />
          ))
        ) : (
          <div className={styles.empty}>No trend data yet</div>
        )}
      </div>

      <div className={styles.sectionLabel}>Recent events</div>
      <div className={styles.eventsList}>
        {MOCK_RECENT_EVENTS.length === 0 ? (
          <div className={styles.empty}>
            No recent events yet for this platform.
          </div>
        ) : (
          MOCK_RECENT_EVENTS.map(ev => (
            <div key={ev.id} className={styles.eventRow}>
              <span className={styles.eventType}>{ev.type}</span>
              <span className={styles.eventMessage}>{ev.message}</span>
              <span className={styles.eventTime}>
                {new Date(ev.ts).toLocaleString()}
              </span>
            </div>
          ))
        )}
      </div>

      <div className={styles.sectionLabel}>Insights</div>
      <div className={styles.insightsList}>
        {platformInsights.length === 0 ? (
          <div className={styles.empty}>
            No insights specific to this platform yet.
          </div>
        ) : (
          platformInsights.map(insight => (
            <InsightCard key={insight.id} insight={insight} />
          ))
        )}
      </div>
    </div>
  );
}
