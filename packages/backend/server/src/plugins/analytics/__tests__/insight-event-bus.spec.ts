/**
 * Analytics insight stream contract.
 *
 * Locks the workspace-scoped pub/sub behavior used by the Analytics SSE
 * endpoint. The UI depends on isolation, short replay for fresh subscribers,
 * and cleanup when the last client disconnects.
 */
import { setTimeout as wait } from 'node:timers/promises';

import test from 'ava';
import { firstValueFrom, take, toArray } from 'rxjs';

import { SocialPlatform } from '../connections/connection.entity';
import { InsightSeverity, InsightType } from '../graphql/analytics.dto';
import {
  type AnalyticsInsightEvent,
  AnalyticsInsightEventBus,
} from '../insight-event-bus.service';

const makeInsight = (id: string): AnalyticsInsightEvent['insight'] => ({
  id,
  insightType: InsightType.TREND,
  platforms: [SocialPlatform.GOGOCASH],
  title: `Insight ${id}`,
  body: 'Body',
  severity: InsightSeverity.INFO,
  modelUsed: 'gemini-2.5-flash',
  costUsd: 0.001,
  createdAt: new Date('2026-06-01T00:00:00Z'),
  acknowledgedAt: null,
});

test('subscribe receives insight events emitted to its workspace', async t => {
  const bus = new AnalyticsInsightEventBus();
  const received: AnalyticsInsightEvent[] = [];

  const sub = bus.subscribe('ws-1').subscribe(event => received.push(event));

  bus.emit('ws-1', makeInsight('insight-a'));
  bus.emit('ws-1', makeInsight('insight-b'));
  await wait(0);

  sub.unsubscribe();

  t.deepEqual(
    received.map(event => event.insight.id),
    ['insight-a', 'insight-b']
  );
});

test('workspace isolation: insight events do not leak across workspaces', async t => {
  const bus = new AnalyticsInsightEventBus();
  const receivedA: AnalyticsInsightEvent[] = [];
  const receivedB: AnalyticsInsightEvent[] = [];

  const subA = bus.subscribe('ws-A').subscribe(event => receivedA.push(event));
  const subB = bus.subscribe('ws-B').subscribe(event => receivedB.push(event));

  bus.emit('ws-A', makeInsight('a1'));
  bus.emit('ws-B', makeInsight('b1'));
  bus.emit('ws-A', makeInsight('a2'));
  await wait(0);

  subA.unsubscribe();
  subB.unsubscribe();

  t.deepEqual(
    receivedA.map(event => event.insight.id),
    ['a1', 'a2']
  );
  t.deepEqual(
    receivedB.map(event => event.insight.id),
    ['b1']
  );
});

test('replay buffer: a late subscriber sees recent insight events', async t => {
  const bus = new AnalyticsInsightEventBus();

  bus.emit('ws-2', makeInsight('old-a'));
  bus.emit('ws-2', makeInsight('old-b'));

  const received = await firstValueFrom(
    bus.subscribe('ws-2').pipe(take(2), toArray())
  );

  t.deepEqual(
    received.map(event => event.insight.id),
    ['old-a', 'old-b']
  );
});

test('cleanup: zero subscribers releases the workspace stream', async t => {
  const bus = new AnalyticsInsightEventBus();
  const first: AnalyticsInsightEvent[] = [];

  const sub1 = bus.subscribe('ws-3').subscribe(event => first.push(event));
  bus.emit('ws-3', makeInsight('first'));
  await wait(0);
  sub1.unsubscribe();

  t.is(bus.activeWorkspaceCount(), 0);

  const second: AnalyticsInsightEvent[] = [];
  const sub2 = bus.subscribe('ws-3').subscribe(event => second.push(event));
  await wait(0);

  t.deepEqual(second, []);

  bus.emit('ws-3', makeInsight('second'));
  await wait(0);
  sub2.unsubscribe();

  t.deepEqual(
    second.map(event => event.insight.id),
    ['second']
  );
  t.is(bus.activeWorkspaceCount(), 0);
});
