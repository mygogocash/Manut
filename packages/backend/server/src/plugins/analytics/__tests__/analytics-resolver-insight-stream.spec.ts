import test from 'ava';
import { firstValueFrom, take } from 'rxjs';
import Sinon from 'sinon';

import { InsightType } from '../graphql/analytics.dto';
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
