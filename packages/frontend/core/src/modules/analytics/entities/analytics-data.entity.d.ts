import { Entity, LiveData } from '@toeverything/infra';
export type SocialPlatform = 'FACEBOOK' | 'INSTAGRAM' | 'THREADS' | 'TIKTOK' | 'LINE_VOOM' | 'GOGOCASH';
export interface AnalyticsKpi {
    key: string;
    label: string;
    value: number;
    deltaPct: number | null;
    sparkline: number[];
}
export interface AnalyticsPlatformStatus {
    platform: SocialPlatform;
    status: string;
    lastSyncAt: string | null;
    isConnected: boolean;
}
export interface AnalyticsOverview {
    workspaceId: string;
    generatedAt: string;
    lastSyncAt: string | null;
    platforms: AnalyticsPlatformStatus[];
    kpis: AnalyticsKpi[];
    recentInsights: unknown[];
}
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
/**
 * AnalyticsDataEntity holds the workspace analytics state. The new
 * `overview$` field is the GoGoCash internal-data overview wired to the
 * backend `getOverview` query. The legacy `kpis$` / `series$` fields stay
 * mock-backed for the not-yet-migrated views (platform-page, etc.).
 */
export declare class AnalyticsDataEntity extends Entity {
    readonly overview$: LiveData<AnalyticsOverview | null>;
    readonly kpis$: LiveData<KpiSnapshot[]>;
    readonly series$: LiveData<MetricSeries[]>;
    readonly loading$: LiveData<boolean>;
    readonly error$: LiveData<string | null>;
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
    readonly unavailable$: LiveData<boolean>;
    setOverview(overview: AnalyticsOverview | null): void;
    setLoading(loading: boolean): void;
    setError(error: string | null): void;
    setUnavailable(unavailable: boolean): void;
    /**
     * Legacy mock loader retained for the views still on mock data
     * (platform-page, etc.). Do NOT use this for the new GoGoCash overview —
     * that path goes through `setOverview` from the AnalyticsService.
     */
    load: () => Promise<void>;
}
//# sourceMappingURL=analytics-data.entity.d.ts.map