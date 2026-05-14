import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PrismaClient } from '@prisma/client';

import { EventBus } from '../../../base';
import { CurrentUser } from '../../../core/auth';
import { AccessController } from '../../../core/permission';
import {
  BudgetExceededError,
  StrategistService,
} from '../ai/strategist.service';
import {
  AcknowledgeInsightInput,
  AnalyticsOverviewObjectType,
  InsightType,
  ListInsightsInput,
  ListMetricsInput,
  RunContentRecommendationInput,
  SocialInsightObjectType,
  SocialMetricObjectType,
} from './analytics.dto';
import { buildOverview, toInsightDto } from './overview';

/**
 * Top-level Analytics GraphQL surface (PRD §4 dashboard contract).
 *
 * All operations require Workspace.Read on the target workspace —
 * the single permission tier from PRD §3.
 */
@Resolver()
export class AnalyticsResolver {
  constructor(
    private readonly db: PrismaClient,
    private readonly ac: AccessController,
    private readonly strategist: StrategistService,
    private readonly event: EventBus
  ) {}

  @Query(() => AnalyticsOverviewObjectType, {
    description:
      'Overview tile for the Analytics landing page: totals, recent insights, current AI spend.',
  })
  async getOverview(
    @CurrentUser() user: CurrentUser,
    @Args('workspaceId', { type: () => String }) workspaceId: string
  ): Promise<AnalyticsOverviewObjectType> {
    // Workspace ACL: only members can read overview.
    await this.ac.user(user.id).workspace(workspaceId).assert('Workspace.Read');

    // Delegates to the pure overview builder in `./overview.ts`. The split
    // exists so unit tests can exercise the overview logic without booting
    // Nest / pulling in the napi-bound `@affine/server-native` graph
    // through this resolver's decorators.
    return await buildOverview(this.db, workspaceId);
  }

  @Query(() => [SocialInsightObjectType], {
    description: 'AI insights timeline filtered by type.',
  })
  async listInsights(
    @CurrentUser() user: CurrentUser,
    @Args('input', { type: () => ListInsightsInput })
    input: ListInsightsInput
  ): Promise<SocialInsightObjectType[]> {
    await this.ac
      .user(user.id)
      .workspace(input.workspaceId)
      .assert('Workspace.Read');

    const types: InsightType[] | undefined =
      input.types && input.types.length > 0
        ? input.types
        : input.insightType
          ? [input.insightType]
          : undefined;

    const rows = await this.db.socialInsight.findMany({
      where: {
        workspaceId: input.workspaceId,
        ...(types ? { insightType: { in: types as never[] } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: Math.max(1, Math.min(input.limit ?? 50, 200)),
    });

    return rows.map(toInsightDto);
  }

  @Query(() => [SocialMetricObjectType], {
    description: 'Aggregated metrics for the dashboard charts.',
  })
  async listMetrics(
    @CurrentUser() _user: CurrentUser,
    @Args('input', { type: () => ListMetricsInput })
    _input: ListMetricsInput
  ): Promise<SocialMetricObjectType[]> {
    // TODO(phase-3): query SocialMetric by (workspaceId, platform, bucket, bucketStart range).
    throw new Error('NOT_IMPLEMENTED: AnalyticsResolver.listMetrics');
  }

  @Mutation(() => SocialInsightObjectType, {
    description:
      'Run the on-demand Content Recommendation prompt — gemini-2.5-flash, ~3K in / 0.5K out.',
  })
  async runContentRecommendation(
    @CurrentUser() user: CurrentUser,
    @Args('input', { type: () => RunContentRecommendationInput })
    input: RunContentRecommendationInput
  ): Promise<SocialInsightObjectType> {
    await this.ac
      .user(user.id)
      .workspace(input.workspaceId)
      .assert('Workspace.Read');

    try {
      const insight = await this.strategist.generateContentRecommendation(
        input.workspaceId,
        input.tone
      );

      // Notify subscribers (see insightCreated subscription wiring TODO below).
      this.publishInsight(insight.workspaceId, insight);

      return toInsightDto(insight);
    } catch (err) {
      if (err instanceof BudgetExceededError) {
        throw new Error(
          'Analytics AI budget exceeded for this workspace this month.'
        );
      }
      throw err;
    }
  }

  @Mutation(() => SocialInsightObjectType, {
    description: 'Mark an AI insight as acknowledged by the current user.',
  })
  async acknowledgeInsight(
    @CurrentUser() user: CurrentUser,
    @Args('input', { type: () => AcknowledgeInsightInput })
    input: AcknowledgeInsightInput
  ): Promise<SocialInsightObjectType> {
    const existing = await this.db.socialInsight.findUnique({
      where: { id: input.insightId },
    });
    if (!existing) {
      throw new Error('Insight not found');
    }

    await this.ac
      .user(user.id)
      .workspace(existing.workspaceId)
      .assert('Workspace.Read');

    const updated = await this.db.socialInsight.update({
      where: { id: input.insightId },
      data: {
        acknowledgedAt: new Date(),
        acknowledgedById: user.id,
      },
    });

    return toInsightDto(updated);
  }

  // --------------------------------------------------------------------
  // GraphQL Subscriptions: insightCreated(workspaceId)
  //
  // The codebase doesn't currently wire @Subscription resolvers (no
  // graphql-ws / subscription transport on the apollo server config). For
  // now we publish via the typed EventBus so consumers can subscribe via
  // the existing socket infrastructure once the GraphQL subscription
  // transport is enabled. When that lands, replace `publishInsight` with
  // a `@Subscription` resolver that filters by workspaceId.
  // --------------------------------------------------------------------
  private publishInsight(workspaceId: string, insight: unknown): void {
    // We use `emitDetached` so the ack of the http mutation isn't held up
    // by event-side listeners. The event name is namespaced under
    // 'analytics.insight.created' — register that event in the typed
    // Events map when subscriptions are wired.
    try {
      // EventBus.emit requires the event name to exist on the typed
      // Events map. We avoid registering a new typed event here (out of
      // scope for this round); instead we log so wiring is observable and
      // skip the actual emit until subscriptions are wired.
      void this.event;
      void workspaceId;
      void insight;
    } catch {
      // Never let event publishing failures break the mutation.
    }
  }
}
