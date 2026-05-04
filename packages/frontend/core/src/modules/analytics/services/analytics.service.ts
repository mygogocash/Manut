import {
  acknowledgeInsightMutation,
  getAnalyticsOverviewQuery,
  type InsightType as GqlInsightType,
  listInsightsQuery,
  runContentRecommendationMutation,
  type SocialPlatform as GqlSocialPlatform,
} from '@affine/graphql';
import { Service } from '@toeverything/infra';

import type { GraphQLService } from '../../cloud/services/graphql';
import { AnalyticsDataEntity } from '../entities/analytics-data.entity';
import {
  type Insight,
  InsightEntity,
  type InsightSeverity,
  type InsightType,
} from '../entities/insight.entity';

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
 * AnalyticsService is the public read-side API for the Analytics module.
 *
 * Round-C operations:
 *   loadOverview, loadInsights, runContentRecommendation, acknowledgeInsight
 *   subscribeToInsights (best-effort; see TODO).
 */
export class AnalyticsService extends Service {
  readonly data = this.framework.createEntity(AnalyticsDataEntity);
  readonly insights = this.framework.createEntity(InsightEntity);

  constructor(private readonly graphql: GraphQLService) {
    super();
  }

  /**
   * Load the workspace overview (KPIs + platform statuses) from the
   * backend.
   */
  loadOverview = async (workspaceId: string): Promise<void> => {
    this.data.setLoading(true);
    this.data.setError(null);
    try {
      const data = await this.graphql.gql({
        query: getAnalyticsOverviewQuery,
        variables: { workspaceId },
      });
      // The query asks for the GoGoCash overview slice (no recentInsights);
      // the entity-level `AnalyticsOverview` requires `recentInsights`, so
      // we fill it with an empty array. Re-add to the .gql doc if/when the
      // overview tile starts surfacing recentInsights again.
      this.data.setOverview({ ...data.getOverview, recentInsights: [] });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.data.setError(message);
      this.data.setOverview(null);
      throw err;
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
      const data = await this.graphql.gql({
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
    const data = await this.graphql.gql({
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
      const data = await this.graphql.gql({
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
   * Subscribe to InsightCreated events for a workspace. Best-effort: the
   * current GraphQLService only exposes query/mutation transports. If a
   * websocket transport is not available we log a warning and return a
   * no-op unsubscribe. The view falls back to its initial `loadInsights`
   * call until the subscription transport lands.
   *
   * TODO(analytics): once the cloud module exposes a graphql-ws client,
   * wire this through it. The subscription document is already shipped.
   */
  subscribeToInsights = (
    workspaceId: string,
    callback: (insight: Insight) => void
  ): InsightSubscriptionUnsubscribe => {
    const wsClient = (
      this.graphql as unknown as {
        subscribe?: (opts: {
          query: string;
          variables: Record<string, unknown>;
          next: (value: unknown) => void;
          error?: (err: unknown) => void;
        }) => () => void;
      }
    ).subscribe;

    if (typeof wsClient !== 'function') {
       
      console.warn(
        '[analytics] subscribeToInsights — no ws transport available; falling back to poll-on-mount only'
      );
      return () => {};
    }

    try {
      const unsubscribe = wsClient.call(this.graphql, {
        query: INSIGHT_CREATED_SUBSCRIPTION,
        variables: { workspaceId },
        next: (value: unknown) => {
          const wire =
            (
              value as
                | { data?: { insightCreated?: WireSocialInsight } }
                | undefined
            )?.data?.insightCreated ??
            (value as { insightCreated?: WireSocialInsight } | undefined)
              ?.insightCreated;
          if (wire) {
            const insight = toEntityInsight(wire, workspaceId);
            this.insights.addInsightToTop(insight);
            callback(insight);
          }
        },
        error: err => {
           
          console.warn('[analytics] insight subscription error', err);
        },
      });
      return unsubscribe;
    } catch (err) {
       
      console.warn('[analytics] insight subscription failed to init', err);
      return () => {};
    }
  };
}
