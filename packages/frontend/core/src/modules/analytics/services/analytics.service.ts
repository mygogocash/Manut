import { Service } from '@toeverything/infra';

import type { GraphQLService } from '../../cloud/services/graphql';
import {
  AnalyticsDataEntity,
  type AnalyticsOverview,
} from '../entities/analytics-data.entity';
import { type Insight, InsightEntity } from '../entities/insight.entity';

// TODO: regenerate codegen types — for now we hand-write the operations and
// inline response shapes. The DTOs live in
// `packages/backend/server/src/plugins/analytics/graphql/*.dto.ts`.
// Keep the inline response shapes in sync until codegen regenerates
// `@affine/graphql`.
const GET_OVERVIEW_QUERY = /* GraphQL */ `
  query getAnalyticsOverview($workspaceId: String!) {
    getOverview(workspaceId: $workspaceId) {
      workspaceId
      generatedAt
      lastSyncAt
      platforms {
        platform
        status
        lastSyncAt
        isConnected
      }
      kpis {
        key
        label
        value
        deltaPct
        sparkline
      }
    }
  }
`;

const LIST_INSIGHTS_QUERY = /* GraphQL */ `
  query listInsights(
    $workspaceId: String!
    $limit: Int
    $types: [InsightType!]
  ) {
    insights(workspaceId: $workspaceId, limit: $limit, types: $types) {
      id
      workspaceId
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

const RUN_CONTENT_RECOMMENDATION_MUTATION = /* GraphQL */ `
  mutation runContentRecommendation($workspaceId: String!, $tone: String) {
    runContentRecommendation(workspaceId: $workspaceId, tone: $tone) {
      id
      workspaceId
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

const ACKNOWLEDGE_INSIGHT_MUTATION = /* GraphQL */ `
  mutation acknowledgeInsight($insightId: String!) {
    acknowledgeInsight(insightId: $insightId)
  }
`;

const INSIGHT_CREATED_SUBSCRIPTION = /* GraphQL */ `
  subscription insightCreated($workspaceId: String!) {
    insightCreated(workspaceId: $workspaceId) {
      id
      workspaceId
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

interface AnalyticsOverviewResponse {
  getOverview: AnalyticsOverview;
}

interface ListInsightsResponse {
  insights: Insight[];
}

interface RunContentRecommendationResponse {
  runContentRecommendation: Insight;
}

interface AcknowledgeInsightResponse {
  acknowledgeInsight: boolean;
}

export interface ListInsightsOptions {
  limit?: number;
  types?: string[];
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
      const result = await this.graphql.gql<{
        id: 'getAnalyticsOverview';
        op: 'query';
        query: typeof GET_OVERVIEW_QUERY;
      }>({
        query: {
          id: 'getAnalyticsOverview',
          op: 'query',
          query: GET_OVERVIEW_QUERY,
        } as any,
        variables: { workspaceId } as any,
      } as any);

      const data = result as unknown as AnalyticsOverviewResponse;
      this.data.setOverview(data.getOverview);
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
      const result = await this.graphql.gql<{
        id: 'listInsights';
        op: 'query';
        query: typeof LIST_INSIGHTS_QUERY;
      }>({
        query: {
          id: 'listInsights',
          op: 'query',
          query: LIST_INSIGHTS_QUERY,
        } as any,
        variables: {
          workspaceId,
          limit: opts?.limit,
          types: opts?.types,
        } as any,
      } as any);

      const data = result as unknown as ListInsightsResponse;
      this.insights.setInsights(data.insights ?? []);
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
   */
  runContentRecommendation = async (
    workspaceId: string,
    tone?: string
  ): Promise<Insight> => {
    const result = await this.graphql.gql<{
      id: 'runContentRecommendation';
      op: 'mutation';
      query: typeof RUN_CONTENT_RECOMMENDATION_MUTATION;
    }>({
      query: {
        id: 'runContentRecommendation',
        op: 'mutation',
        query: RUN_CONTENT_RECOMMENDATION_MUTATION,
      } as any,
      variables: {
        workspaceId,
        tone: tone && tone.trim().length > 0 ? tone : null,
      } as any,
    } as any);

    const data = result as unknown as RunContentRecommendationResponse;
    const insight = data.runContentRecommendation;
    this.insights.addInsightToTop(insight);
    return insight;
  };

  /**
   * Mark an insight as acknowledged. Updates local state optimistically.
   */
  acknowledgeInsight = async (insightId: string): Promise<void> => {
    // Optimistic local update, rollback on error.
    const prevList = this.insights.insights$.value;
    const now = new Date().toISOString();
    this.insights.acknowledgeLocally(insightId, now);
    try {
      const result = await this.graphql.gql<{
        id: 'acknowledgeInsight';
        op: 'mutation';
        query: typeof ACKNOWLEDGE_INSIGHT_MUTATION;
      }>({
        query: {
          id: 'acknowledgeInsight',
          op: 'mutation',
          query: ACKNOWLEDGE_INSIGHT_MUTATION,
        } as any,
        variables: { insightId } as any,
      } as any);
      const data = result as unknown as AcknowledgeInsightResponse;
      if (data.acknowledgeInsight === false) {
        // server rejected — rollback
        this.insights.setInsights(prevList);
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
    const wsClient = (this.graphql as unknown as {
      subscribe?: (opts: {
        query: string;
        variables: Record<string, unknown>;
        next: (value: unknown) => void;
        error?: (err: unknown) => void;
      }) => () => void;
    }).subscribe;

    if (typeof wsClient !== 'function') {
      // eslint-disable-next-line no-console
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
          const data =
            (value as { data?: { insightCreated?: Insight } } | undefined)
              ?.data?.insightCreated ??
            (value as { insightCreated?: Insight } | undefined)?.insightCreated;
          if (data) {
            this.insights.addInsightToTop(data);
            callback(data);
          }
        },
        error: err => {
          // eslint-disable-next-line no-console
          console.warn('[analytics] insight subscription error', err);
        },
      });
      return unsubscribe;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[analytics] insight subscription failed to init', err);
      return () => {};
    }
  };
}
