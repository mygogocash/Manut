/**
 * Unit tests for DocReadEventBus — the workspace-scoped pub/sub used
 * by the Knowledge Graph activation pulse feature.
 *
 * Covers:
 *  - subscribe/emit round-trip
 *  - workspace isolation (events for ws A never leak to ws B)
 *  - replay buffer: a late subscriber sees recent emits
 *  - cleanup: when refcount drops to zero the Subject is released so
 *    a subsequent subscribe to the same workspace gets a fresh stream
 *    and DOES NOT replay events that happened before the new subscribe
 *    after a full disconnect cycle.
 */
import { setTimeout as wait } from 'node:timers/promises';

import test from 'ava';
import { firstValueFrom, take, toArray } from 'rxjs';

import {
  type DocReadEvent,
  DocReadEventBus,
} from '../../plugins/copilot/doc-read/doc-read-event-bus.service';

const makeEvent = (
  workspaceId: string,
  docId: string,
  overrides: Partial<DocReadEvent> = {}
): DocReadEvent => ({
  workspaceId,
  docId,
  sourceId: `src-${docId}`,
  op: 'docRead',
  ts: Date.now(),
  ...overrides,
});

test('subscribe receives events emitted to its workspace', async t => {
  const bus = new DocReadEventBus();
  const received: DocReadEvent[] = [];

  const sub = bus.subscribe('ws-1').subscribe(e => received.push(e));

  bus.emit('ws-1', makeEvent('ws-1', 'doc-a'));
  bus.emit('ws-1', makeEvent('ws-1', 'doc-b'));
  // micro-tick: ReplaySubject is synchronous, but await to be safe.
  await wait(0);

  sub.unsubscribe();

  t.is(received.length, 2);
  t.is(received[0].docId, 'doc-a');
  t.is(received[1].docId, 'doc-b');
});

test('workspace isolation: events for ws-A do not leak to ws-B', async t => {
  const bus = new DocReadEventBus();
  const receivedA: DocReadEvent[] = [];
  const receivedB: DocReadEvent[] = [];

  const subA = bus.subscribe('ws-A').subscribe(e => receivedA.push(e));
  const subB = bus.subscribe('ws-B').subscribe(e => receivedB.push(e));

  bus.emit('ws-A', makeEvent('ws-A', 'doc-a1'));
  bus.emit('ws-B', makeEvent('ws-B', 'doc-b1'));
  bus.emit('ws-A', makeEvent('ws-A', 'doc-a2'));
  await wait(0);

  subA.unsubscribe();
  subB.unsubscribe();

  t.deepEqual(
    receivedA.map(e => e.docId),
    ['doc-a1', 'doc-a2']
  );
  t.deepEqual(
    receivedB.map(e => e.docId),
    ['doc-b1']
  );
});

test('replay buffer: a late subscriber sees recent emits within the window', async t => {
  const bus = new DocReadEventBus();

  // Emit BEFORE anyone subscribes — should be replayed on subscribe.
  bus.emit('ws-2', makeEvent('ws-2', 'doc-x'));
  bus.emit('ws-2', makeEvent('ws-2', 'doc-y'));

  const latecomer$ = bus.subscribe('ws-2').pipe(take(2), toArray());
  const received = await firstValueFrom(latecomer$);

  t.is(received.length, 2);
  t.deepEqual(
    received.map(e => e.docId),
    ['doc-x', 'doc-y']
  );
});

test('cleanup: zero subscribers releases the subject; new subscribe gets fresh stream', async t => {
  const bus = new DocReadEventBus();

  // First lifecycle: subscribe, emit, unsubscribe.
  const firstReceived: DocReadEvent[] = [];
  const sub1 = bus.subscribe('ws-3').subscribe(e => firstReceived.push(e));
  bus.emit('ws-3', makeEvent('ws-3', 'doc-old'));
  await wait(0);
  sub1.unsubscribe();

  // Internals: there should be no live subject after refcount hits 0.
  // We assert via the public reset hook the service exposes for tests.
  t.is(bus.activeWorkspaceCount(), 0);

  // Second lifecycle: a new subscriber on the same workspace must NOT
  // see the old event (the bus released it on cleanup).
  const secondReceived: DocReadEvent[] = [];
  const sub2 = bus.subscribe('ws-3').subscribe(e => secondReceived.push(e));
  await wait(0);

  t.is(secondReceived.length, 0);

  bus.emit('ws-3', makeEvent('ws-3', 'doc-new'));
  await wait(0);

  t.is(secondReceived.length, 1);
  t.is(secondReceived[0].docId, 'doc-new');

  sub2.unsubscribe();
  t.is(bus.activeWorkspaceCount(), 0);
});

test('multiple subscribers on the same workspace share one subject', async t => {
  const bus = new DocReadEventBus();
  const a: DocReadEvent[] = [];
  const b: DocReadEvent[] = [];

  const subA = bus.subscribe('ws-4').subscribe(e => a.push(e));
  const subB = bus.subscribe('ws-4').subscribe(e => b.push(e));

  t.is(bus.activeWorkspaceCount(), 1);

  bus.emit('ws-4', makeEvent('ws-4', 'doc-multi'));
  await wait(0);

  t.is(a.length, 1);
  t.is(b.length, 1);

  subA.unsubscribe();
  // After A unsubscribes, B still holds a refcount; subject stays alive.
  t.is(bus.activeWorkspaceCount(), 1);

  subB.unsubscribe();
  t.is(bus.activeWorkspaceCount(), 0);
});
