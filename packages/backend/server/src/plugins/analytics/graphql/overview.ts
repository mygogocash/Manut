import { SocialPlatform } from '../connections/connection.entity';
import {
  type AnalyticsKpiObjectType,
  type AnalyticsOverviewObjectType,
  type AnalyticsPlatformStatusObjectType,
  type InsightSeverity,
  type InsightType,
  type SocialInsightObjectType,
} from './analytics.dto';

/**
 * GoGoCash KPI catalogue surfaced by the analytics overview tile.
 *
 * Keep in sync with the seeded metric_key values produced by the GoGoCash
 * poller (`ingest/polling/gogocash.poller.ts`) — adding a KPI here without
 * a corresponding row producer will show up in the UI as an always-zero
 * card.
 */
export const GOGOCASH_KPI_DEFS: ReadonlyArray<{ key: string; label: string }> =
  [
    { key: 'total_users', label: 'Total users' },
    { key: 'signups_7d', label: 'Signups (7d)' },
    { key: 'dau', label: 'DAU' },
    { key: 'mau', label: 'MAU' },
    { key: 'total_workspaces', label: 'Total workspaces' },
  ];

/**
 * Attribution key the GoGoCash poller writes instance-wide KPIs under
 * (`ingest/polling/gogocash.poller.ts` -> `INSTANCE_WIDE_BUCKET`).
 *
 * The KPIs in `GOGOCASH_KPI_DEFS` (total_users, signups_*, dau, mau,
 * total_workspaces, ...) describe the WHOLE deployment, not any single
 * workspace, so the poller persists them exactly ONCE under this reserved
 * id rather than duplicating identical numbers under every connected
 * workspace (finding #14 — that fan-out was a cross-tenant data-exposure
 * bug). The overview consumer MUST therefore read these metrics from the
 * `'__internal__'` bucket, NOT from the caller's workspaceId — keeping the
 * two sides in lockstep. Per-workspace connection status and insights stay
 * scoped to the real workspaceId below.
 */
export const INSTANCE_WIDE_METRICS_KEY = '__internal__';

/**
 * Narrow Prisma surface required by `buildOverview`.
 *
 * Declaring an explicit dependency surface here (instead of taking the full
 * `PrismaClient`) gives us two wins:
 *   1. Resolver logic is unit-testable without booting Postgres / Nest /
 *      the napi-bound `@affine/server-native` graph; tests pass plain
 *      stub objects that return the row shapes the function expects.
 *   2. Reviewers can see, at a glance, every table the overview touches —
 *      adding a new query becomes a visible API change.
 *
 * The row shapes mirror the relevant subset of the Prisma model types in
 * `schema.prisma` — see SocialMetric, SocialConnection, SocialInsight.
 */
export interface OverviewPrismaSurface {
  socialMetric: {
    findMany(args: {
      where: {
        workspaceId: string;
        platform: 'GOGOCASH';
        bucket: 'HOUR';
        bucketStart: { gte: Date };
        metricKey: { in: string[] };
      };
      orderBy: { bucketStart: 'asc' };
    }): Promise<
      Array<{
        bucketStart: Date;
        metricKey: string;
        value: number;
      }>
    >;
  };
  socialConnection: {
    findFirst(args: {
      where: { workspaceId: string; platform: 'GOGOCASH' };
      orderBy: { updatedAt: 'desc' };
    }): Promise<{
      status: string;
      lastSyncAt: Date | null;
    } | null>;
  };
  socialInsight: {
    findMany(args: {
      where: { workspaceId: string };
      orderBy: { createdAt: 'desc' };
      take: number;
    }): Promise<
      Array<{
        id: string;
        insightType: string;
        platforms: string[];
        title: string;
        body: string;
        severity: string;
        modelUsed: string;
        costUsd: number;
        createdAt: Date;
        acknowledgedAt: Date | null;
      }>
    >;
  };
}

/**
 * Build the analytics overview payload for a single workspace.
 *
 * Exported as a free function so the resolver (which carries NestJS
 * decorators that transitively pull in the napi `@affine/server-native`
 * binary) doesn't need to be imported by unit tests. The resolver passes
 * its `PrismaClient` instance straight through.
 *
 * Behavior MUST match what the resolver did inline before this extraction;
 * any change here is observable on `GET /api/graphql -> getOverview`.
 *
 * Reproduces the production failure mode the task brief asks us to surface:
 * if the underlying `social_metrics` / `social_connections` /
 * `social_insights` tables do not exist (data migration `1746345600000-
 * analytics-platform` never ran on this database), Prisma throws here and
 * the resolver lets it propagate. That is *deliberate* — the right answer
 * for a missing migration is to run the migration, not to fabricate an
 * empty payload.
 */
export async function buildOverview(
  db: OverviewPrismaSurface,
  workspaceId: string,
  now: Date = new Date()
): Promise<AnalyticsOverviewObjectType> {
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

  // Pull last 24h of hourly metrics for the GoGoCash KPIs we care about.
  // We also fetch the prior 24h window so we can compute deltaPct.
  //
  // These KPIs are INSTANCE-WIDE, so they live under the reserved
  // `INSTANCE_WIDE_METRICS_KEY` bucket the poller writes to — NOT under
  // the caller's workspaceId. Reading them per-workspace would surface
  // zeros for every workspace (the metrics simply aren't keyed there) and
  // re-introduce the cross-tenant confusion finding #14 fixed on the write
  // side. See INSTANCE_WIDE_METRICS_KEY above.
  const recentRows = await db.socialMetric.findMany({
    where: {
      workspaceId: INSTANCE_WIDE_METRICS_KEY,
      platform: 'GOGOCASH',
      bucket: 'HOUR',
      bucketStart: { gte: twoDaysAgo },
      metricKey: { in: GOGOCASH_KPI_DEFS.map(k => k.key) },
    },
    orderBy: { bucketStart: 'asc' },
  });

  // Most recent timestamp across any metric — used for lastSyncAt.
  // The `recentRows[0]` access is intentionally guarded by the
  // `recentRows.length > 0` check (so a fresh workspace surfaces
  // lastSyncAt=null rather than crashing on an out-of-bounds read).
  const lastSyncAt: Date | null =
    recentRows.length > 0
      ? recentRows.reduce<Date>(
          (max, r) => (r.bucketStart > max ? r.bucketStart : max),
          recentRows[0].bucketStart
        )
      : null;

  const kpis: AnalyticsKpiObjectType[] = GOGOCASH_KPI_DEFS.map(def => {
    const rowsForKey = recentRows.filter(r => r.metricKey === def.key);

    // Sparkline = last 24 hourly values (chronological).
    const last24h = rowsForKey
      .filter(r => r.bucketStart >= oneDayAgo)
      .map(r => r.value);

    const prev24h = rowsForKey
      .filter(r => r.bucketStart < oneDayAgo && r.bucketStart >= twoDaysAgo)
      .map(r => r.value);

    const currentValue = last24h.length > 0 ? last24h[last24h.length - 1] : 0;

    const lastAvg = avg(last24h);
    const prevAvg = avg(prev24h);
    const deltaPct = computeDeltaPct(lastAvg, prevAvg);

    return {
      key: def.key,
      label: def.label,
      value: currentValue,
      deltaPct,
      sparkline: last24h,
    };
  });

  // Connections summary (per platform). For now we only surface the
  // GOGOCASH source — other platforms remain Round-A stubs.
  const gogocashConn = await db.socialConnection.findFirst({
    where: { workspaceId, platform: 'GOGOCASH' },
    orderBy: { updatedAt: 'desc' },
  });

  const platforms: AnalyticsPlatformStatusObjectType[] = [
    {
      platform: SocialPlatform.GOGOCASH,
      status: gogocashConn?.status ?? 'NOT_CONNECTED',
      lastSyncAt: gogocashConn?.lastSyncAt ?? lastSyncAt,
      isConnected: !!gogocashConn,
    },
  ];

  // Pull the 5 most recent insights for the overview tile. Cheap — one
  // index hit on (workspaceId, createdAt).
  const recentInsights = await db.socialInsight.findMany({
    where: { workspaceId },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });

  return {
    workspaceId,
    generatedAt: now,
    lastSyncAt,
    platforms,
    kpis,
    recentInsights: recentInsights.map(toInsightDto),
    // Round-A legacy fields. Kept zeroed for now.
    totalConnections: gogocashConn ? 1 : 0,
    insightsLast7Days: 0,
    spendUsdThisMonth: 0,
    capUsdThisMonth: 0,
  };
}

function avg(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function computeDeltaPct(current: number, prior: number): number | null {
  if (prior === 0) return null;
  return ((current - prior) / prior) * 100;
}

export function toInsightDto(row: {
  id: string;
  insightType: string;
  platforms: string[];
  title: string;
  body: string;
  severity: string;
  modelUsed: string;
  costUsd: number;
  createdAt: Date;
  acknowledgedAt: Date | null;
}): SocialInsightObjectType {
  return {
    id: row.id,
    insightType: row.insightType as InsightType,
    platforms: row.platforms as SocialPlatform[],
    title: row.title,
    body: row.body,
    severity: row.severity as InsightSeverity,
    modelUsed: row.modelUsed,
    costUsd: row.costUsd,
    createdAt: row.createdAt,
    acknowledgedAt: row.acknowledgedAt,
  };
}
