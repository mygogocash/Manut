import test from 'ava';
import { firstValueFrom, take } from 'rxjs';
import Sinon from 'sinon';

import { InsightType, MetricBucket } from '../graphql/analytics.dto';
import { AnalyticsResolver } from '../graphql/analytics.resolver';
import { AnalyticsInsightEventBus } from '../insight-event-bus.service';

test('runContentRecommendation publishes the created insight to the analytics stream', async t => {
  const assert = Sinon.stub().resolves();
  const workspace = Sinon.stub().returns({ assert });
  const user = Sinon.stub().returns({ workspace });
  const strategist = {
    generateContentRecommendation: Sinon.stub().resolves({
      id: 'insight-1',
      workspaceId: 'ws-1',
      insightType: 'RECOMMENDATION',
      platforms: ['GOGOCASH'],
      title: 'Content recommendations',
      body: 'Post the offer in the morning.',
      severity: 'INFO',
      modelUsed: 'gemini-2.5-flash',
      costUsd: 0.002,
      createdAt: new Date('2026-06-01T00:00:00Z'),
      acknowledgedAt: null,
    }),
  };
  const bus = new AnalyticsInsightEventBus();
  const resolver = new AnalyticsResolver(
    {} as never,
    { user } as never,
    strategist as never,
    bus
  );

  const nextEvent = firstValueFrom(bus.subscribe('ws-1').pipe(take(1)));

  const result = await resolver.runContentRecommendation(
    { id: 'user-1' } as never,
    {
      workspaceId: 'ws-1',
      platform: 'GOGOCASH',
      tone: 'practical',
    } as never
  );

  const event = await nextEvent;

  t.is(result.id, 'insight-1');
  t.is(event.workspaceId, 'ws-1');
  t.is(event.insight.id, 'insight-1');
  t.is(event.insight.insightType, InsightType.RECOMMENDATION);
  t.true(assert.calledOnce);
  t.true(
    strategist.generateContentRecommendation.calledOnceWith('ws-1', 'practical')
  );
});

test('listMetrics enforces workspace ACL and returns ordered metric rows', async t => {
  const from = new Date('2026-06-01T00:00:00Z');
  const to = new Date('2026-06-02T00:00:00Z');
  const assert = Sinon.stub().resolves();
  const workspace = Sinon.stub().returns({ assert });
  const user = Sinon.stub().returns({ workspace });
  const findMany = Sinon.stub().resolves([
    {
      id: 'metric-1',
      platform: 'GOGOCASH',
      metricKey: 'dau',
      bucket: 'HOUR',
      bucketStart: from,
      value: 42,
    },
  ]);
  const resolver = new AnalyticsResolver(
    { socialMetric: { findMany } } as never,
    { user } as never,
    {} as never,
    new AnalyticsInsightEventBus()
  );

  const result = await resolver.listMetrics(
    { id: 'user-1' } as never,
    {
      workspaceId: 'ws-1',
      platform: 'GOGOCASH',
      bucket: MetricBucket.HOUR,
      from,
      to,
    } as never
  );

  t.true(user.calledOnceWith('user-1'));
  t.true(workspace.calledOnceWith('ws-1'));
  t.true(assert.calledOnceWith('Workspace.Read'));
  t.deepEqual(findMany.firstCall.firstArg, {
    where: {
      workspaceId: 'ws-1',
      platform: 'GOGOCASH',
      bucket: MetricBucket.HOUR,
      bucketStart: { gte: from, lt: to },
    },
    orderBy: [{ bucketStart: 'asc' }, { metricKey: 'asc' }],
    take: 5000,
  });
  t.deepEqual(result, [
    {
      id: 'metric-1',
      platform: 'GOGOCASH',
      metricKey: 'dau',
      bucket: 'HOUR',
      bucketStart: from,
      value: 42,
    },
  ]);
});

test('listMetrics rejects an empty or reversed time window without querying metrics', async t => {
  const timestamp = new Date('2026-06-01T00:00:00Z');
  const assert = Sinon.stub().resolves();
  const workspace = Sinon.stub().returns({ assert });
  const user = Sinon.stub().returns({ workspace });
  const findMany = Sinon.stub().resolves([]);
  const resolver = new AnalyticsResolver(
    { socialMetric: { findMany } } as never,
    { user } as never,
    {} as never,
    new AnalyticsInsightEventBus()
  );

  const error = await t.throwsAsync(() =>
    resolver.listMetrics(
      { id: 'user-1' } as never,
      {
        workspaceId: 'ws-1',
        bucket: MetricBucket.HOUR,
        from: timestamp,
        to: timestamp,
      } as never
    )
  );

  t.truthy(error);
  t.regex(error!.message, /Metrics range must have from before to/);
  t.true(assert.calledOnceWith('Workspace.Read'));
  t.true(findMany.notCalled);
});
