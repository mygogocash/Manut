import { MetricBucket, SocialPlatform } from '@prisma/client';
import test from 'ava';
import Sinon from 'sinon';

import { MetricRollupService } from '../metric-rollup.service';

function createDbStub(findManyResult: unknown[]) {
  return {
    socialEvent: {
      findMany: Sinon.stub().resolves(findManyResult),
    },
    socialMetric: {
      findMany: Sinon.stub().resolves(findManyResult),
      upsert: Sinon.stub().resolves(undefined),
    },
  };
}

test('rollupPreviousHour extracts event metrics into the previous hour bucket', async t => {
  const db = createDbStub([
    {
      workspaceId: 'ws-1',
      platform: SocialPlatform.TIKTOK,
      eventType: 'post.created',
      payload: { metrics: { views: 10, likes: 2, ignored: 'nope' } },
    },
    {
      workspaceId: 'ws-1',
      platform: SocialPlatform.TIKTOK,
      eventType: 'post.created',
      payload: { metrics: { views: 7 } },
    },
    {
      workspaceId: 'ws-1',
      platform: SocialPlatform.INSTAGRAM,
      eventType: 'follower.gained',
      payload: {},
    },
  ]);
  const service = new MetricRollupService(db as never);

  const count = await service.rollupPreviousHour(
    new Date('2026-06-02T12:17:00Z')
  );

  t.is(count, 3);
  t.deepEqual(db.socialEvent.findMany.firstCall.firstArg, {
    where: {
      occurredAt: {
        gte: new Date('2026-06-02T11:00:00Z'),
        lt: new Date('2026-06-02T12:00:00Z'),
      },
    },
    select: {
      workspaceId: true,
      platform: true,
      eventType: true,
      payload: true,
    },
  });
  t.deepEqual(
    db.socialMetric.upsert.getCalls().map(call => call.firstArg.create),
    [
      {
        workspaceId: 'ws-1',
        platform: SocialPlatform.TIKTOK,
        metricKey: 'views',
        bucket: MetricBucket.HOUR,
        bucketStart: new Date('2026-06-02T11:00:00Z'),
        value: 17,
        metadata: {
          source: 'social_events',
          windowEnd: '2026-06-02T12:00:00.000Z',
          sourceRows: 3,
        },
      },
      {
        workspaceId: 'ws-1',
        platform: SocialPlatform.TIKTOK,
        metricKey: 'likes',
        bucket: MetricBucket.HOUR,
        bucketStart: new Date('2026-06-02T11:00:00Z'),
        value: 2,
        metadata: {
          source: 'social_events',
          windowEnd: '2026-06-02T12:00:00.000Z',
          sourceRows: 3,
        },
      },
      {
        workspaceId: 'ws-1',
        platform: SocialPlatform.INSTAGRAM,
        metricKey: 'followers_delta_24h',
        bucket: MetricBucket.HOUR,
        bucketStart: new Date('2026-06-02T11:00:00Z'),
        value: 1,
        metadata: {
          source: 'social_events',
          windowEnd: '2026-06-02T12:00:00.000Z',
          sourceRows: 3,
        },
      },
    ]
  );
});

test('rollupPreviousDay aggregates hour metrics into the previous UTC day', async t => {
  const db = createDbStub([
    {
      workspaceId: 'ws-1',
      platform: SocialPlatform.GOGOCASH,
      metricKey: 'dau',
      value: 12,
    },
    {
      workspaceId: 'ws-1',
      platform: SocialPlatform.GOGOCASH,
      metricKey: 'dau',
      value: 8,
    },
    {
      workspaceId: 'ws-1',
      platform: SocialPlatform.GOGOCASH,
      metricKey: 'mau',
      value: 50,
    },
  ]);
  const service = new MetricRollupService(db as never);

  const count = await service.rollupPreviousDay(
    new Date('2026-06-02T02:00:00Z')
  );

  t.is(count, 2);
  t.deepEqual(db.socialMetric.findMany.firstCall.firstArg, {
    where: {
      bucket: MetricBucket.HOUR,
      bucketStart: {
        gte: new Date('2026-06-01T00:00:00Z'),
        lt: new Date('2026-06-02T00:00:00Z'),
      },
    },
    select: {
      workspaceId: true,
      platform: true,
      metricKey: true,
      value: true,
    },
  });
  t.deepEqual(
    db.socialMetric.upsert.getCalls().map(call => call.firstArg.create),
    [
      {
        workspaceId: 'ws-1',
        platform: SocialPlatform.GOGOCASH,
        metricKey: 'dau',
        bucket: MetricBucket.DAY,
        bucketStart: new Date('2026-06-01T00:00:00Z'),
        value: 20,
        metadata: {
          source: MetricBucket.HOUR,
          windowEnd: '2026-06-02T00:00:00.000Z',
          sourceRows: 3,
        },
      },
      {
        workspaceId: 'ws-1',
        platform: SocialPlatform.GOGOCASH,
        metricKey: 'mau',
        bucket: MetricBucket.DAY,
        bucketStart: new Date('2026-06-01T00:00:00Z'),
        value: 50,
        metadata: {
          source: MetricBucket.HOUR,
          windowEnd: '2026-06-02T00:00:00.000Z',
          sourceRows: 3,
        },
      },
    ]
  );
});

test('rollupPreviousWeek aggregates day metrics into the previous ISO week', async t => {
  const db = createDbStub([
    {
      workspaceId: 'ws-1',
      platform: SocialPlatform.GOGOCASH,
      metricKey: 'dau',
      value: 100,
    },
    {
      workspaceId: 'ws-1',
      platform: SocialPlatform.GOGOCASH,
      metricKey: 'dau',
      value: 40,
    },
  ]);
  const service = new MetricRollupService(db as never);

  const count = await service.rollupPreviousWeek(
    new Date('2026-06-08T03:00:00Z')
  );

  t.is(count, 1);
  t.deepEqual(db.socialMetric.findMany.firstCall.firstArg.where, {
    bucket: MetricBucket.DAY,
    bucketStart: {
      gte: new Date('2026-06-01T00:00:00Z'),
      lt: new Date('2026-06-08T00:00:00Z'),
    },
  });
  t.deepEqual(db.socialMetric.upsert.firstCall.firstArg.create, {
    workspaceId: 'ws-1',
    platform: SocialPlatform.GOGOCASH,
    metricKey: 'dau',
    bucket: MetricBucket.WEEK,
    bucketStart: new Date('2026-06-01T00:00:00Z'),
    value: 140,
    metadata: {
      source: MetricBucket.DAY,
      windowEnd: '2026-06-08T00:00:00.000Z',
      sourceRows: 2,
    },
  });
});
