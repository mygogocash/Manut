import { useLiveData, useService } from '@toeverything/infra';
import { useEffect } from 'react';

import { WorkspaceService } from '../../../workspace';
import { ConnectionStatusBadge } from '../../components/connection-status-badge';
import { MetricCard } from '../../components/metric-card';
import { TrendChart } from '../../components/trend-chart';
import { AnalyticsService } from '../../services/analytics.service';
import { ConnectionService } from '../../services/connection.service';
import * as styles from './index.css';

function formatDelta(deltaPct: number | null): number | undefined {
  if (deltaPct === null || Number.isNaN(deltaPct)) return undefined;
  // MetricCard expects a fractional value when deltaFormat='percent'.
  return deltaPct / 100;
}

function isOverviewEmpty(
  kpis: ReadonlyArray<{ value: number }> | null | undefined
): boolean {
  if (!kpis || kpis.length === 0) return true;
  return kpis.every(k => k.value === 0);
}

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

export function AnalyticsOverview() {
  const analyticsService = useService(AnalyticsService);
  const connectionService = useService(ConnectionService);
  const workspaceService = useService(WorkspaceService);

  const overview = useLiveData(analyticsService.data.overview$);
  const loading = useLiveData(analyticsService.data.loading$) ?? false;
  const error = useLiveData(analyticsService.data.error$);
  const unavailable = useLiveData(analyticsService.data.unavailable$) ?? false;
  const connections = useLiveData(connectionService.entity.connections$) ?? [];

  const workspaceId = workspaceService.workspace.id;

  useEffect(() => {
    analyticsService.loadOverview(workspaceId).catch(err => {
      console.warn('[analytics] loadOverview failed', err);
    });
    connectionService.loadConnections(workspaceId).catch(err => {
      console.warn('[analytics] loadConnections failed', err);
    });
  }, [analyticsService, connectionService, workspaceId]);

  const kpis = overview?.kpis ?? [];
  const empty = !loading && isOverviewEmpty(kpis);

  return (
    <div className={styles.root} data-testid="analytics-overview">
      <div className={styles.headerRow}>
        <div>
          <div className={styles.title}>Analytics</div>
          <div className={styles.subtitle}>
            GoGoCash internal data — users, signups, and active workspaces.
          </div>
        </div>
      </div>

      {loading && !overview ? (
        <div
          className={styles.skeleton}
          data-testid="analytics-overview-loading"
        >
          <div className={styles.skeletonBlock} />
          <div className={styles.skeletonBlock} />
          <div className={styles.skeletonBlock} />
        </div>
      ) : unavailable ? (
        // Schema-missing fallback: the deployed server doesn't expose
        // `getOverview`. Show an actionable notice instead of the generic
        // "Unhandled error raised" banner that surfaced on prod before this
        // path existed (mirrors the connections settings panel).
        <div
          className={styles.empty}
          data-testid="analytics-overview-unavailable"
        >
          Analytics is not enabled on this server. Ask your administrator to
          enable the analytics module (<code>ENABLE_ANALYTICS_MODULE=true</code>
          ) and redeploy.
        </div>
      ) : error ? (
        <div className={styles.empty}>Could not load analytics: {error}</div>
      ) : empty ? (
        <div className={styles.empty} data-testid="analytics-overview-empty">
          {connections.length > 0
            ? 'Connected — awaiting first sync. Metrics appear after the next ingestion (usually within 5 minutes).'
            : 'No data yet — connect a data source under Settings → Data connections, or wait 5 minutes for the next sync.'}
        </div>
      ) : (
        <>
          <div className={styles.sectionLabel}>Workspace KPIs</div>
          <div className={styles.kpiGrid}>
            {kpis.map(kpi => (
              <MetricCard
                key={kpi.key}
                label={kpi.label}
                value={kpi.value}
                delta={formatDelta(kpi.deltaPct)}
                deltaFormat="percent"
              />
            ))}
          </div>

          <div className={styles.sectionLabel}>Trends (last 24h)</div>
          <div className={styles.chartGrid}>
            {kpis
              .filter(k => k.sparkline.length > 1)
              .map(kpi => (
                <TrendChart
                  key={kpi.key}
                  title={kpi.label}
                  subtitle="Last 24 hours"
                  points={pointsFromSparkline(kpi.sparkline)}
                />
              ))}
          </div>
        </>
      )}

      <div className={styles.sectionLabel}>Social platforms</div>
      <div className={styles.insightsList}>
        {connections.length > 0 ? (
          connections.map(conn => (
            <div key={conn.id} className={styles.connectionRow}>
              <span className={styles.connectionLabel}>
                {conn.platform}
                {conn.accountHandle ? (
                  <span className={styles.connectionHandle}>
                    {conn.accountHandle}
                  </span>
                ) : null}
              </span>
              <ConnectionStatusBadge status={conn.status} />
            </div>
          ))
        ) : (
          <div className={styles.empty}>
            No social platforms connected yet. Open Workspace Settings →
            Connections to link accounts like Facebook, Instagram, or TikTok.
            <div className={styles.emptyHint}>
              Data sources such as MongoDB or PostHog are managed separately
              under Settings → Data connections.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
