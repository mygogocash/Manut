import test from 'ava';

import {
  buildOverview,
  INSTANCE_WIDE_METRICS_KEY,
  type OverviewPrismaSurface,
} from '../../plugins/analytics/graphql/overview';

/**
 * Bucket-routing coverage for `buildOverview` (finding #14).
 *
 * The GoGoCash KPIs (total_users, dau, mau, ...) are INSTANCE-WIDE: the
 * poller (`ingest/polling/gogocash.poller.ts`) writes them ONCE under
 * `INSTANCE_WIDE_METRICS_KEY` instead of fanning identical numbers out per
 * workspace (the old behaviour, a cross-tenant data-exposure bug). The
 * overview consumer therefore MUST read those metrics from that same
 * reserved bucket — reading per-workspace would zero every KPI card.
 *
 * Lives in its own file (separate AVA worker) rather than alongside the
 * other `buildOverview` unit tests because AVA 6's in-file concurrent
 * error reporter mis-serialises these closure-recording stubs when run in
 * the same file as the error-propagation tests.
 */

interface RecordingStub {
  db: OverviewPrismaSurface;
  metricWorkspaceIds: string[];
  connectionWorkspaceIds: string[];
  insightWorkspaceIds: string[];
}

function recordingStub(
  metricRowsForInstanceBucket: Array<{
    bucketStart: Date;
    metricKey: string;
    value: number;
  }>
): RecordingStub {
  const metricWorkspaceIds: string[] = [];
  const connectionWorkspaceIds: string[] = [];
  const insightWorkspaceIds: string[] = [];

  const db: OverviewPrismaSurface = {
    socialMetric: {
      findMany: async args => {
        metricWorkspaceIds.push(args.where.workspaceId);
        // KPIs exist ONLY under the instance-wide bucket; any other
        // workspaceId returns nothing.
        return args.where.workspaceId === INSTANCE_WIDE_METRICS_KEY
          ? metricRowsForInstanceBucket
          : [];
      },
    },
    socialConnection: {
      findFirst: async args => {
        connectionWorkspaceIds.push(args.where.workspaceId);
        return null;
      },
    },
    socialInsight: {
      findMany: async args => {
        insightWorkspaceIds.push(args.where.workspaceId);
        return [];
      },
    },
  };

  return {
    db,
    metricWorkspaceIds,
    connectionWorkspaceIds,
    insightWorkspaceIds,
  };
}

test('buildOverview reads KPIs from the instance-wide bucket, not the caller workspace', async t => {
  const now = new Date('2026-05-13T12:00:00.000Z');
  const recentBucket = new Date('2026-05-13T11:00:00.000Z');

  const stub = recordingStub([
    { bucketStart: recentBucket, metricKey: 'total_users', value: 4242 },
  ]);

  const overview = await buildOverview(stub.db, 'real-workspace-id', now);

  const totalUsers = overview.kpis.find(k => k.key === 'total_users');
  t.is(totalUsers?.value, 4242);
  t.true(stub.metricWorkspaceIds.includes(INSTANCE_WIDE_METRICS_KEY));
  t.false(stub.metricWorkspaceIds.includes('real-workspace-id'));
});

test('buildOverview keeps connection status and insights scoped to the real workspace', async t => {
  const stub = recordingStub([]);

  await buildOverview(stub.db, 'real-workspace-id');

  // Only the KPI metric read moves to the instance-wide bucket; the
  // per-workspace surfaces must stay on the caller workspace.
  t.deepEqual(stub.connectionWorkspaceIds, ['real-workspace-id']);
  t.deepEqual(stub.insightWorkspaceIds, ['real-workspace-id']);
});
