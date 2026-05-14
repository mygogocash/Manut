import { Entity, LiveData } from '@toeverything/infra';

export type SocialPlatform =
  | 'FACEBOOK'
  | 'INSTAGRAM'
  | 'THREADS'
  | 'TIKTOK'
  | 'LINE_VOOM'
  | 'GOGOCASH';

// keep in sync with backend DTO: AnalyticsKpiObjectType
export interface AnalyticsKpi {
  key: string;
  label: string;
  value: number;
  deltaPct: number | null;
  sparkline: number[];
}

// keep in sync with backend DTO: AnalyticsPlatformStatusObjectType
export interface AnalyticsPlatformStatus {
  platform: SocialPlatform;
  status: string;
  lastSyncAt: string | null; // ISO datetime
  isConnected: boolean;
}

// keep in sync with backend DTO: AnalyticsOverviewObjectType
export interface AnalyticsOverview {
  workspaceId: string;
  generatedAt: string; // ISO datetime
  lastSyncAt: string | null;
  platforms: AnalyticsPlatformStatus[];
  kpis: AnalyticsKpi[];
  recentInsights: unknown[]; // empty for now (no AI yet)
}

// Legacy round-A types — retained so the rest of the (mock-backed) UI keeps
// compiling. The new GoGoCash overview reads from `overview$` instead.
export interface KpiSnapshot {
  platform: SocialPlatform | 'ALL';
  followers: number;
  followersDelta: number;
  impressions: number;
  impressionsDelta: number;
  engagementRate: number;
  engagementRateDelta: number;
}

export interface MetricPoint {
  ts: string;
  value: number;
}

export interface MetricSeries {
  name: string;
  platform: SocialPlatform | 'ALL';
  points: MetricPoint[];
}

const MOCK_KPIS: KpiSnapshot[] = [
  {
    platform: 'ALL',
    followers: 28430,
    followersDelta: 412,
    impressions: 184200,
    impressionsDelta: 12880,
    engagementRate: 0.043,
    engagementRateDelta: 0.006,
  },
  {
    platform: 'FACEBOOK',
    followers: 12100,
    followersDelta: 80,
    impressions: 64200,
    impressionsDelta: 1820,
    engagementRate: 0.027,
    engagementRateDelta: -0.003,
  },
  {
    platform: 'INSTAGRAM',
    followers: 9220,
    followersDelta: 220,
    impressions: 78400,
    impressionsDelta: 6400,
    engagementRate: 0.061,
    engagementRateDelta: 0.011,
  },
  {
    platform: 'TIKTOK',
    followers: 7110,
    followersDelta: 112,
    impressions: 41600,
    impressionsDelta: 4660,
    engagementRate: 0.052,
    engagementRateDelta: 0.009,
  },
];

const buildMockSeries = (name: string, base: number): MetricSeries => ({
  name,
  platform: 'ALL',
  points: Array.from({ length: 14 }).map((_, i) => ({
    ts: new Date(Date.now() - (13 - i) * 24 * 60 * 60 * 1000).toISOString(),
    value: Math.round(base * (0.8 + Math.sin(i / 2) * 0.15 + i * 0.04)),
  })),
});

const MOCK_SERIES: MetricSeries[] = [
  buildMockSeries('Impressions', 12000),
  buildMockSeries('Engagement', 480),
];

/**
 * AnalyticsDataEntity holds the workspace analytics state. The new
 * `overview$` field is the GoGoCash internal-data overview wired to the
 * backend `getOverview` query. The legacy `kpis$` / `series$` fields stay
 * mock-backed for the not-yet-migrated views (platform-page, etc.).
 */
export class AnalyticsDataEntity extends Entity {
  readonly overview$ = new LiveData<AnalyticsOverview | null>(null);
  readonly kpis$ = new LiveData<KpiSnapshot[]>([]);
  readonly series$ = new LiveData<MetricSeries[]>([]);
  readonly loading$ = new LiveData<boolean>(false);
  readonly error$ = new LiveData<string | null>(null);
  /**
   * True when the backend GraphQL schema does not expose `getOverview`.
   * That happens when the analytics module is disabled on the server
   * (e.g. an older image that pre-dates the resolver, or
   * `ENABLE_ANALYTICS_MODULE=false` on a non-selfhosted deployment).
   * The view renders a friendly notice instead of the generic
   * "Unhandled error raised" banner that `UserFriendlyError.fromAny()`
   * falls back to when the GraphQL response has no useful error message.
   *
   * Mirrors `PlatformConnectionEntity.unavailable$` — same pattern, same
   * UX — so operators get the same actionable copy from both panels on a
   * version-skewed deployment.
   */
  readonly unavailable$ = new LiveData<boolean>(false);

  setOverview(overview: AnalyticsOverview | null): void {
    this.overview$.next(overview);
  }

  setLoading(loading: boolean): void {
    this.loading$.next(loading);
  }

  setError(error: string | null): void {
    this.error$.next(error);
  }

  setUnavailable(unavailable: boolean): void {
    this.unavailable$.next(unavailable);
  }

  /**
   * Legacy mock loader retained for the views still on mock data
   * (platform-page, etc.). Do NOT use this for the new GoGoCash overview —
   * that path goes through `setOverview` from the AnalyticsService.
   */
  load = async (): Promise<void> => {
    this.loading$.next(true);
    this.error$.next(null);
    try {
       
      console.warn(
        '[analytics] AnalyticsDataEntity.load (mock) — used only by platform-page until it migrates to the GoGoCash overview path.'
      );
      await new Promise(resolve => setTimeout(resolve, 50));
      this.kpis$.next(MOCK_KPIS);
      this.series$.next(MOCK_SERIES);
    } catch (err) {
      this.error$.next(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      this.loading$.next(false);
    }
  };
}
