import type { GetDocPageAnalyticsQuery } from '@affine/graphql';
export declare const ANALYTICS_WINDOW_OPTIONS: readonly [7, 14, 28, 60, 90];
export declare const DEFAULT_ANALYTICS_WINDOW_DAYS = 28;
export declare const NON_TEAM_ANALYTICS_WINDOW_DAYS = 7;
export declare const INITIAL_MEMBERS_PAGE_SIZE = 5;
export declare const MAX_MEMBERS_PAGE_SIZE = 50;
export type AnalyticsSeriesPoint = GetDocPageAnalyticsQuery['workspace']['doc']['analytics']['series'][number];
export type AnalyticsChartPoint = {
    x: number;
    date: string;
    totalViews: number;
    uniqueViews: number;
    guestViews: number;
};
export declare function getAvailableAnalyticsWindowOptions(): (7 | 28 | 14 | 60 | 90)[];
export declare function isLockedAnalyticsWindowOption(value: number, isTeamWorkspace: boolean): boolean;
export declare function clampAnalyticsWindowDays(value: number, isTeamWorkspace: boolean): number;
export declare function buildAnalyticsChartPoints(series: AnalyticsSeriesPoint[]): {
    x: number;
    date: string;
    totalViews: number;
    uniqueViews: number;
    guestViews: number;
}[];
export declare function ensureMinimumChartPoints(points: AnalyticsChartPoint[]): ({
    x: number;
    date?: string | undefined;
    totalViews?: number | undefined;
    uniqueViews?: number | undefined;
    guestViews?: number | undefined;
} | undefined)[];
//# sourceMappingURL=analytics.utils.d.ts.map