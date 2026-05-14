import test from 'ava';

import { SocialPlatform } from '../../plugins/analytics/connections/connection.entity';
import {
  buildOverview,
  type OverviewPrismaSurface,
} from '../../plugins/analytics/graphql/overview';

/**
 * Pure-unit coverage for `buildOverview`. Verifies the empty-workspace happy
 * path AND that errors from the underlying Prisma surface (e.g. table-missing
 * because the data migration `1746345600000-analytics-platform` never ran)
 * propagate through to the caller — so observability surfaces the
 * deployment-level fix rather than silently fabricating an empty payload.
 *
 * Why this test exists: production bug "Could not load analytics: Unhandled
 * error raised. Please contact us for help." surfaces from the analytics
 * overview view when `getOverview` throws on the backend. The frontend
 * `analytics-overview/index.tsx` (line 82) renders the backend error message
 * verbatim. If buildOverview ever acquires a regression that throws for
 * a fresh workspace (empty rows), this test catches it before it ships,
 * and prod doesn't surface the broken banner.
 */

function withStub(stub: Partial<OverviewPrismaSurface>): OverviewPrismaSurface {
  return {
    socialMetric: stub.socialMetric ?? {
      findMany: async () => [],
    },
    socialConnection: stub.socialConnection ?? {
      findFirst: async () => null,
    },
    socialInsight: stub.socialInsight ?? {
      findMany: async () => [],
    },
  };
}

test('buildOverview returns the empty-workspace shape when no rows exist', async t => {
  const db = withStub({});

  const overview = await buildOverview(db, 'workspace-1');

  // Echoes back the workspaceId so the frontend can correlate the response.
  t.is(overview.workspaceId, 'workspace-1');
  // lastSyncAt is null when there are no metric rows; the frontend renders
  // "Never synced" copy for this case.
  t.is(overview.lastSyncAt, null);
  // generatedAt is the wall-clock now; smoke-test that it's a valid Date.
  t.true(overview.generatedAt instanceof Date);
  // All 5 GOGOCASH KPIs surface as zeroed cards with empty sparklines, so
  // the UI can render placeholders instead of throwing on missing keys.
  t.is(overview.kpis.length, 5);
  t.deepEqual(
    overview.kpis.map(k => k.key),
    ['total_users', 'signups_7d', 'dau', 'mau', 'total_workspaces']
  );
  t.true(overview.kpis.every(k => k.value === 0));
  t.true(overview.kpis.every(k => k.sparkline.length === 0));
  // deltaPct must be null (not 0 or NaN) so the frontend's `formatDelta`
  // helper renders the "—" placeholder instead of "0%".
  t.true(overview.kpis.every(k => k.deltaPct === null));
  // Single platform row, NOT_CONNECTED, isConnected=false — matches the
  // "Connections empty" UX in the overview view.
  t.is(overview.platforms.length, 1);
  t.is(overview.platforms[0].platform, SocialPlatform.GOGOCASH);
  t.is(overview.platforms[0].status, 'NOT_CONNECTED');
  t.false(overview.platforms[0].isConnected);
  t.deepEqual(overview.recentInsights, []);
  t.is(overview.totalConnections, 0);
  t.is(overview.insightsLast7Days, 0);
});

test('buildOverview surfaces ACTIVE GOGOCASH connection status and lastSyncAt', async t => {
  const syncTime = new Date('2026-05-13T10:00:00.000Z');
  const db = withStub({
    socialConnection: {
      findFirst: async () => ({
        status: 'ACTIVE',
        lastSyncAt: syncTime,
      }),
    },
  });

  const overview = await buildOverview(db, 'workspace-2');

  t.is(overview.platforms[0].status, 'ACTIVE');
  t.true(overview.platforms[0].isConnected);
  t.is(overview.platforms[0].lastSyncAt, syncTime);
  t.is(overview.totalConnections, 1);
});

test('buildOverview computes deltaPct across the 24h window when metrics exist', async t => {
  // Fix `now` so the 24h / 48h windows are deterministic relative to the
  // metric `bucketStart` timestamps below.
  const now = new Date('2026-05-13T12:00:00.000Z');
  // Last-24h window: [11:00 today]. Previous-24h window: [11:00 yesterday].
  const last24hBucket = new Date('2026-05-13T11:00:00.000Z');
  const prev24hBucket = new Date('2026-05-12T11:00:00.000Z');

  const db = withStub({
    socialMetric: {
      findMany: async () => [
        // total_users: 100 last 24h, 80 prev 24h → +25%
        { bucketStart: prev24hBucket, metricKey: 'total_users', value: 80 },
        { bucketStart: last24hBucket, metricKey: 'total_users', value: 100 },
        // signups_7d: only prev value → returns the current as 0, but the
        // delta should still be calculable (50/0 is undefined → null).
        { bucketStart: prev24hBucket, metricKey: 'signups_7d', value: 50 },
      ],
    },
  });

  const overview = await buildOverview(db, 'workspace-3', now);

  const totalUsers = overview.kpis.find(k => k.key === 'total_users');
  t.truthy(totalUsers);
  t.is(totalUsers!.value, 100);
  t.is(totalUsers!.deltaPct, 25); // (100-80)/80*100

  const signups = overview.kpis.find(k => k.key === 'signups_7d');
  t.truthy(signups);
  // last24h is empty (only prev24h has rows) → value defaults to 0; deltaPct
  // = ((0 - 50) / 50) * 100 = -100, surfaced verbatim to the frontend so the
  // card renders "-100%" — communicating to the operator that this KPI has
  // gone silent in the last 24 hours.
  t.is(signups!.value, 0);
  t.is(signups!.deltaPct, -100);

  // lastSyncAt reflects the most recent metric timestamp.
  t.is(overview.lastSyncAt?.getTime(), last24hBucket.getTime());
});

test('buildOverview surfaces a Prisma table-missing error to the caller', async t => {
  // Simulates the production scenario where the analytics data migration
  // (1746345600000-analytics-platform) did NOT run, so `social_metrics` is
  // absent. Prisma raises a known-request error on findMany. The resolver
  // MUST NOT swallow it — propagating it means the GraphQL exception filter
  // logs the failure to the observability stack with the request id, and
  // operators get a real signal that the migration must run.
  const tableMissing = new Error(
    `The table "public.social_metrics" does not exist in the current database.`
  );
  const db = withStub({
    socialMetric: {
      findMany: async () => {
        throw tableMissing;
      },
    },
  });

  await t.throwsAsync(buildOverview(db, 'workspace-4'), {
    message: /social_metrics.*does not exist/,
  });
});

test('buildOverview surfaces a socialConnection table-missing error too', async t => {
  // Companion to the previous test — guards against a partial migration
  // where social_metrics exists (e.g. created by a prior deploy) but
  // social_connections does not (the migration was interrupted halfway).
  const tableMissing = new Error(
    `The table "public.social_connections" does not exist in the current database.`
  );
  const db = withStub({
    socialConnection: {
      findFirst: async () => {
        throw tableMissing;
      },
    },
  });

  await t.throwsAsync(buildOverview(db, 'workspace-5'), {
    message: /social_connections.*does not exist/,
  });
});
