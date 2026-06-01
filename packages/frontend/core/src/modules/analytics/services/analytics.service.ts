import { DebugLogger } from '@affine/debug';
import {
  acknowledgeInsightMutation,
  getAnalyticsOverviewQuery,
  type InsightType as GqlInsightType,
  listInsightsQuery,
  runContentRecommendationMutation,
  type SocialPlatform as GqlSocialPlatform,
} from '@affine/graphql';
import { Service } from '@toeverything/infra';
import { filter, firstValueFrom } from 'rxjs';

import type { EventSourceService, WorkspaceServerService } from '../../cloud';
import type { Server } from '../../cloud/entities/server';
import { GraphQLService } from '../../cloud/services/graphql';
import { AnalyticsDataEntity } from '../entities/analytics-data.entity';
import {
  type Insight,
  InsightEntity,
  type InsightSeverity,
  type InsightType,
} from '../entities/insight.entity';
import { isAnalyticsFeatureUnavailableError } from './connection.service';
import { subscribeInsightStream } from './insight-stream';

const logger = new DebugLogger('analytics');

// SocialInsight on the wire (from `SocialInsightObjectType` in the backend
// DTO) does NOT include `workspaceId`. The entity-level `Insight` type does
// — the UI uses it for routing/copy-link. We inject the workspaceId from
// the call context when mapping wire shape → entity shape.
type WireSocialInsight = {
  id: string;
  insightType: GqlInsightType;
  platforms: GqlSocialPlatform[];
  title: string;
  body: string;
  severity: string;
  modelUsed: string;
  createdAt: string;
  acknowledgedAt: string | null;
};

function toEntityInsight(
  wire: WireSocialInsight,
  workspaceId: string
): Insight {
  return {
    id: wire.id,
    workspaceId,
    insightType: wire.insightType as InsightType,
    severity: wire.severity as InsightSeverity,
    title: wire.title,
    body: wire.body,
    platforms: wire.platforms,
    modelUsed: wire.modelUsed,
    createdAt: wire.createdAt,
    acknowledgedAt: wire.acknowledgedAt,
  };
}

// Subscription document — kept inline because no graphql-ws transport is
// wired on the GraphQLService yet. Once codegen learns subscriptions, swap
// this for a generated doc and route via the new transport.
const INSIGHT_CREATED_SUBSCRIPTION = /* GraphQL */ `
  subscription insightCreated($workspaceId: String!) {
    insightCreated(workspaceId: $workspaceId) {
      id
      insightType
      platforms
      title
      body
      severity
      modelUsed
      createdAt
      acknowledgedAt
    }
  }
`;

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
export function applyOverviewLoadError(
  data: Pick<
    AnalyticsDataEntity,
    'setOverview' | 'setError' | 'setUnavailable'
  >,
  err: unknown
): void {
  // Always clear the cached overview so a stale render doesn't survive a
  // failure. The frontend treats null overview as "not loaded yet".
  data.setOverview(null);
  if (isAnalyticsFeatureUnavailableError(err)) {
    data.setUnavailable(true);
    data.setError(null);
    logger.error('overview schema not available on this server', err);
    return;
  }
  const message = err instanceof Error ? err.message : 'Unknown error';
  data.setError(message);
}

/**
 * AnalyticsService is the public read-side API for the Analytics module.
 *
 * Round-C operations:
 *   loadOverview, loadInsights, runContentRecommendation, acknowledgeInsight
 *   subscribeToInsights (best-effort; see TODO).
 */
export class AnalyticsService extends Service {
  readonly data = this.framework.createEntity(AnalyticsDataEntity);
  readonly insights = this.framework.createEntity(InsightEntity);

  constructor(
    private readonly serverService: WorkspaceServerService,
    private readonly eventSourceService: EventSourceService
  ) {
    super();
  }

  // GraphQLService lives in ServerScope but this service runs in
  // WorkspaceScope — route through the workspace's bound server. Awaits
  // the first non-null `server$` value so that load-on-mount calls don't
  // race the workspace's server binding (which happens shortly after the
  // service is constructed).
  private async graphql(): Promise<GraphQLService> {
    const server = await firstValueFrom(
      this.serverService.server$.pipe(filter((s): s is Server => s !== null))
    );
    return server.scope.get(GraphQLService);
  }

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
  loadOverview = async (workspaceId: string): Promise<void> => {
    this.data.setLoading(true);
    this.data.setError(null);
    this.data.setUnavailable(false);
    try {
      const data = await (
        await this.graphql()
      ).gql({
        query: getAnalyticsOverviewQuery,
        variables: { workspaceId },
      });
      // The query asks for the GoGoCash overview slice (no recentInsights);
      // the entity-level `AnalyticsOverview` requires `recentInsights`, so
      // we fill it with an empty array. Re-add to the .gql doc if/when the
      // overview tile starts surfacing recentInsights again.
      this.data.setOverview({ ...data.getOverview, recentInsights: [] });
    } catch (err) {
      applyOverviewLoadError(this.data, err);
      // Schema-missing errors are absorbed (loader settles successfully so
      // the view renders the `unavailable` notice); everything else
      // propagates so observability surfaces the real failure.
      if (!isAnalyticsFeatureUnavailableError(err)) {
        throw err;
      }
    } finally {
      this.data.setLoading(false);
    }
  };

  /**
   * Load the AI-generated insights timeline from the backend.
   * Replaces the mock data path used in Round A.
   */
  loadInsights = async (
    workspaceId: string,
    opts?: ListInsightsOptions
  ): Promise<void> => {
    this.insights.setLoading(true);
    this.insights.setError(null);
    try {
      const data = await (
        await this.graphql()
      ).gql({
        query: listInsightsQuery,
        variables: {
          input: {
            workspaceId,
            limit: opts?.limit ?? 50,
            types: opts?.types as GqlInsightType[] | undefined,
          },
        },
      });
      const mapped = (data.listInsights ?? []).map(insight =>
        toEntityInsight(insight, workspaceId)
      );
      this.insights.setInsights(mapped);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.insights.setError(message);
      this.insights.setInsights([]);
      throw err;
    } finally {
      this.insights.setLoading(false);
    }
  };

  /**
   * Trigger the AI content-recommendation prompt on the backend. Returns the
   * newly created insight; also pushes it to the top of the insights list
   * so the UI surfaces it immediately.
   *
   * The backend requires a `platform` — pick the platform you want the
   * recommendation tailored to. `tone` is optional copy-direction hint.
   */
  runContentRecommendation = async (
    workspaceId: string,
    platform: GqlSocialPlatform,
    tone?: string
  ): Promise<Insight> => {
    const data = await (
      await this.graphql()
    ).gql({
      query: runContentRecommendationMutation,
      variables: {
        input: {
          workspaceId,
          platform,
          tone: tone && tone.trim().length > 0 ? tone : null,
        },
      },
    });
    const insight = toEntityInsight(data.runContentRecommendation, workspaceId);
    this.insights.addInsightToTop(insight);
    return insight;
  };

  /**
   * Mark an insight as acknowledged. Updates local state optimistically and
   * reconciles with the server's authoritative `acknowledgedAt` on success.
   */
  acknowledgeInsight = async (insightId: string): Promise<void> => {
    // Optimistic local update, rollback on error.
    const prevList = this.insights.insights$.value;
    const optimisticTimestamp = new Date().toISOString();
    this.insights.acknowledgeLocally(insightId, optimisticTimestamp);
    try {
      const data = await (
        await this.graphql()
      ).gql({
        query: acknowledgeInsightMutation,
        variables: { input: { insightId } },
      });
      // Server returns the updated SocialInsight — reconcile the
      // authoritative `acknowledgedAt` so optimistic timestamps don't
      // diverge from server state.
      const serverTimestamp = data.acknowledgeInsight.acknowledgedAt;
      if (serverTimestamp && serverTimestamp !== optimisticTimestamp) {
        this.insights.acknowledgeLocally(insightId, serverTimestamp);
      }
    } catch (err) {
      this.insights.setInsights(prevList);
      throw err;
    }
  };

  /**
   * Subscribe to live insight events for a workspace. GraphQL
   * subscriptions are still not wired in this app, so production uses the
   * same authenticated SSE transport pattern as doc-read and approvals.
   */
  subscribeToInsights = (
    workspaceId: string,
    callback: (insight: Insight) => void
  ): InsightSubscriptionUnsubscribe => {
    const unsubscribe = subscribeInsightStream(
      this.eventSourceService,
      workspaceId,
      insight => {
        this.insights.addInsightToTop(insight);
        callback(insight);
      }
    );
    void INSIGHT_CREATED_SUBSCRIPTION;
    return unsubscribe;
  };
}
