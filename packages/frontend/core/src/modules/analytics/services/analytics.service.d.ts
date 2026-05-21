import { type SocialPlatform as GqlSocialPlatform } from '@affine/graphql';
import { Service } from '@toeverything/infra';
import type { WorkspaceServerService } from '../../cloud';
import { AnalyticsDataEntity } from '../entities/analytics-data.entity';
import { type Insight, InsightEntity, type InsightType } from '../entities/insight.entity';
export interface ListInsightsOptions {
    limit?: number;
    types?: InsightType[];
}
export type InsightSubscriptionUnsubscribe = () => void;
/**
 * Pure helper for the analytics overview loader's catch-path. Extracted so
 * unit tests (`apply-overview-load-error.spec.ts`) can verify the
 * classification + setter wiring without booting the framework.
 *
 *  - Schema-missing (the deployed backend's GraphQL lacks `getOverview`):
 *      → `unavailable = true`, `error = null`, `overview = null`
 *      → loader does NOT rethrow
 *  - Any other failure (real backend error, table-missing, 5xx, perms):
 *      → `error = err.message`, `unavailable = false`, `overview = null`
 *      → loader rethrows so observability sees it
 *
 * The split mirrors `connection.service.ts`'s `loadConnections` and reuses
 * the same `isAnalyticsFeatureUnavailableError` classifier — keeping both
 * panels in sync about which errors are "feature unavailable" vs "broken".
 */
export declare function applyOverviewLoadError(data: Pick<AnalyticsDataEntity, 'setOverview' | 'setError' | 'setUnavailable'>, err: unknown): void;
/**
 * AnalyticsService is the public read-side API for the Analytics module.
 *
 * Round-C operations:
 *   loadOverview, loadInsights, runContentRecommendation, acknowledgeInsight
 *   subscribeToInsights (best-effort; see TODO).
 */
export declare class AnalyticsService extends Service {
    private readonly serverService;
    readonly data: AnalyticsDataEntity;
    readonly insights: InsightEntity;
    constructor(serverService: WorkspaceServerService);
    private graphql;
    /**
     * Load the workspace overview (KPIs + platform statuses) from the
     * backend.
     *
     * Error handling mirrors the Connections loader: when the GraphQL
     * schema does NOT expose `getOverview` (the analytics module hasn't
     * registered on the deployed server — usually a stale image or env
     * var skew), we surface a typed `unavailable` flag so the view can
     * render a friendly notice. Other errors (real backend failures,
     * timeouts, permission denials) propagate through `error$` as before.
     *
     * We intentionally do NOT classify Prisma-side errors (e.g. the data
     * migration `1746345600000-analytics-platform` not having run yet, so
     * `social_metrics` is absent) as `unavailable` — those should surface
     * as errors so operators investigate the missing migration rather than
     * seeing a "disabled" message that papers over a broken deploy.
     */
    loadOverview: (workspaceId: string) => Promise<void>;
    /**
     * Load the AI-generated insights timeline from the backend.
     * Replaces the mock data path used in Round A.
     */
    loadInsights: (workspaceId: string, opts?: ListInsightsOptions) => Promise<void>;
    /**
     * Trigger the AI content-recommendation prompt on the backend. Returns the
     * newly created insight; also pushes it to the top of the insights list
     * so the UI surfaces it immediately.
     *
     * The backend requires a `platform` — pick the platform you want the
     * recommendation tailored to. `tone` is optional copy-direction hint.
     */
    runContentRecommendation: (workspaceId: string, platform: GqlSocialPlatform, tone?: string) => Promise<Insight>;
    /**
     * Mark an insight as acknowledged. Updates local state optimistically and
     * reconciles with the server's authoritative `acknowledgedAt` on success.
     */
    acknowledgeInsight: (insightId: string) => Promise<void>;
    /**
     * Subscribe to InsightCreated events for a workspace. Best-effort: the
     * current GraphQLService only exposes query/mutation transports. If a
     * websocket transport is not available we log a warning and return a
     * no-op unsubscribe. The view falls back to its initial `loadInsights`
     * call until the subscription transport lands.
     *
     * TODO(analytics): once the cloud module exposes a graphql-ws client,
     * wire this through it. The subscription document is already shipped.
     */
    subscribeToInsights: (_workspaceId: string, _callback: (insight: Insight) => void) => InsightSubscriptionUnsubscribe;
}
//# sourceMappingURL=analytics.service.d.ts.map