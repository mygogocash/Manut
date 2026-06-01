import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { PrismaClient } from '@prisma/client';

import { BadRequest, InternalServerError, NotFound } from '../../../base';
import { CurrentUser } from '../../../core/auth';
import { AccessController } from '../../../core/permission';
import {
  BudgetExceededError,
  StrategistService,
} from '../ai/strategist.service';
import { AnalyticsInsightEventBus } from '../insight-event-bus.service';
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
    private readonly insightBus: AnalyticsInsightEventBus
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
    // Typed friendly error so the unimplemented path doesn't surface as
    // the generic "Unhandled error raised" (finding #13).
    throw new InternalServerError('Metrics listing is not available yet.');
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
      .assert('Workspace.Settings.Update');

    try {
      const insight = await this.strategist.generateContentRecommendation(
        input.workspaceId,
        input.tone
      );

      // Notify subscribers via the existing SSE transport. We still keep the
      // GraphQL subscription document on the frontend as a future transport
      // target, but SSE is the production path for this release.
      this.publishInsight(insight.workspaceId, insight);

      return toInsightDto(insight);
    } catch (err) {
      if (err instanceof BudgetExceededError) {
        // Friendly typed error (UserFriendlyError) — finding #13.
        throw new BadRequest(
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
      // Friendly typed error (UserFriendlyError) — finding #13.
      throw new NotFound('Insight not found');
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
  // Live transport: insightCreated(workspaceId)
  //
  // The codebase still does not wire GraphQL @Subscription resolvers, so the
  // analytics UI uses the existing authenticated SSE pattern instead.
  // --------------------------------------------------------------------
  private publishInsight(
    workspaceId: string,
    insight: Parameters<AnalyticsInsightEventBus['emit']>[1]
  ): void {
    try {
      this.insightBus.emit(workspaceId, insight);
    } catch {
      // Never let event publishing failures break the mutation.
    }
  }
}
