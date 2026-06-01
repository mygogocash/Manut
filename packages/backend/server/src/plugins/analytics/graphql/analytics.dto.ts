import {
  Field,
  Float,
  GraphQLISODateTime,
  ID,
  InputType,
  Int,
  ObjectType,
  registerEnumType,
} from '@nestjs/graphql';
import { GraphQLJSONObject } from 'graphql-scalars';

import { SocialPlatform } from '../connections/connection.entity';

/**
 * GraphQL DTOs for the analytics dashboard surface (PRD §4 frontend wiring).
 *
 * Enum values mirror the Prisma enums in agent 1's schema additions.
 */

export enum MetricBucket {
  HOUR = 'HOUR',
  DAY = 'DAY',
  WEEK = 'WEEK',
}

registerEnumType(MetricBucket, {
  name: 'MetricBucket',
  description: 'Pre-aggregated rollup window for a SocialMetric row.',
});

export enum InsightType {
  WEEKLY_STRATEGY = 'WEEKLY_STRATEGY',
  TREND = 'TREND',
  ANOMALY = 'ANOMALY',
  RECOMMENDATION = 'RECOMMENDATION',
}

registerEnumType(InsightType, {
  name: 'InsightType',
  description: 'Category of an AI-generated SocialInsight.',
});

export enum InsightSeverity {
  INFO = 'INFO',
  NOTABLE = 'NOTABLE',
  ACTION_REQUIRED = 'ACTION_REQUIRED',
}

registerEnumType(InsightSeverity, {
  name: 'InsightSeverity',
  description: 'How loud the insight should be in the UI.',
});

@ObjectType('SocialMetric')
export class SocialMetricObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => SocialPlatform)
  platform!: SocialPlatform;

  @Field(() => String)
  metricKey!: string;

  @Field(() => MetricBucket)
  bucket!: MetricBucket;

  @Field(() => GraphQLISODateTime)
  bucketStart!: Date;

  @Field(() => Float)
  value!: number;
}

@ObjectType('SocialEvent')
export class SocialEventObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => SocialPlatform)
  platform!: SocialPlatform;

  @Field(() => String)
  eventType!: string;

  @Field(() => String)
  externalId!: string;

  @Field(() => GraphQLISODateTime)
  occurredAt!: Date;

  @Field(() => GraphQLISODateTime)
  receivedAt!: Date;

  @Field(() => GraphQLJSONObject)
  payload!: Record<string, unknown>;
}

@ObjectType('SocialInsight')
export class SocialInsightObjectType {
  @Field(() => ID)
  id!: string;

  @Field(() => InsightType)
  insightType!: InsightType;

  @Field(() => [SocialPlatform])
  platforms!: SocialPlatform[];

  @Field(() => String)
  title!: string;

  @Field(() => String)
  body!: string;

  @Field(() => InsightSeverity)
  severity!: InsightSeverity;

  @Field(() => String)
  modelUsed!: string;

  @Field(() => Float)
  costUsd!: number;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  acknowledgedAt!: Date | null;
}

@ObjectType('AnalyticsPlatformStatus')
export class AnalyticsPlatformStatusObjectType {
  @Field(() => SocialPlatform)
  platform!: SocialPlatform;

  @Field(() => String)
  status!: string;

  @Field(() => GraphQLISODateTime, { nullable: true })
  lastSyncAt!: Date | null;

  @Field(() => Boolean)
  isConnected!: boolean;
}

@ObjectType('AnalyticsKpi')
export class AnalyticsKpiObjectType {
  @Field(() => String)
  key!: string;

  @Field(() => String)
  label!: string;

  @Field(() => Float)
  value!: number;

  @Field(() => Float, { nullable: true })
  deltaPct!: number | null;

  @Field(() => [Float])
  sparkline!: number[];
}

@ObjectType('AnalyticsOverview')
export class AnalyticsOverviewObjectType {
  @Field(() => String)
  workspaceId!: string;

  @Field(() => GraphQLISODateTime)
  generatedAt!: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  lastSyncAt!: Date | null;

  @Field(() => [AnalyticsPlatformStatusObjectType])
  platforms!: AnalyticsPlatformStatusObjectType[];

  @Field(() => [AnalyticsKpiObjectType])
  kpis!: AnalyticsKpiObjectType[];

  @Field(() => [SocialInsightObjectType])
  recentInsights!: SocialInsightObjectType[];

  // Round-A legacy fields kept for compatibility — not yet used by the
  // GoGoCash overview but referenced by other Round-A scaffolding.
  @Field(() => Int)
  totalConnections!: number;

  @Field(() => Int)
  insightsLast7Days!: number;

  @Field(() => Float)
  spendUsdThisMonth!: number;

  @Field(() => Float)
  capUsdThisMonth!: number;
}

@InputType()
export class ListMetricsInput {
  @Field(() => String)
  workspaceId!: string;

  @Field(() => SocialPlatform, { nullable: true })
  platform?: SocialPlatform;

  @Field(() => MetricBucket)
  bucket!: MetricBucket;

  @Field(() => GraphQLISODateTime)
  from!: Date;

  @Field(() => GraphQLISODateTime)
  to!: Date;
}

@InputType()
export class ListEventsInput {
  @Field(() => String)
  workspaceId!: string;

  @Field(() => SocialPlatform, { nullable: true })
  platform?: SocialPlatform;

  @Field(() => GraphQLISODateTime)
  from!: Date;

  @Field(() => GraphQLISODateTime)
  to!: Date;

  @Field(() => Int, { defaultValue: 50 })
  limit!: number;
}

@InputType()
export class ListInsightsInput {
  @Field(() => String)
  workspaceId!: string;

  @Field(() => InsightType, { nullable: true })
  insightType?: InsightType;

  @Field(() => [InsightType], { nullable: true })
  types?: InsightType[];

  @Field(() => Int, { defaultValue: 50 })
  limit!: number;
}

@InputType()
export class RunContentRecommendationInput {
  @Field(() => String)
  workspaceId!: string;

  @Field(() => SocialPlatform)
  platform!: SocialPlatform;

  @Field(() => String, { nullable: true })
  topic?: string;

  @Field(() => String, { nullable: true })
  tone?: string;
}

@InputType()
export class AcknowledgeInsightInput {
  @Field(() => String)
  insightId!: string;
}

@ObjectType('BeginOAuthResult')
export class BeginOAuthResultObjectType {
  @Field(() => String, {
    description: 'Authorization URL the client must navigate to.',
  })
  url!: string;
}

@InputType()
export class FinalizePlatformConnectInput {
  @Field(() => String, {
    description:
      'Pending OAuth id returned from the choose-account postMessage.',
  })
  pendingId!: string;

  @Field(() => String, {
    description: 'Provider account id the user picked from the picker modal.',
  })
  externalAccountId!: string;
}

@InputType()
export class CancelPlatformConnectInput {
  @Field(() => String, {
    description: 'Pending OAuth id to discard.',
  })
  pendingId!: string;
}
