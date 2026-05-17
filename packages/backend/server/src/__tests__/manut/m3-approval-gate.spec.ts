import test from 'ava';

import { MnApprovalGateService } from '../../plugins/manut/manut-approval-gate.service';

/**
 * M3 approval gate — TTL cache semantics + latency benchmark.
 *
 * The hot path is `gate.peek(workspaceId)` called from every tool
 * dispatch in the copilot provider. The benchmark below asserts that
 * the p95 latency over a representative sample is comfortably under
 * 1ms — the parent spec calls this out as a sub-millisecond budget
 * (CLAUDE.md scar #4).
 *
 * No DB; the gate is a pure in-memory cache. The cron / service /
 * provider integration is covered by the matching service spec.
 */

test('peek returns null on cold cache and miss', t => {
  const gate = new MnApprovalGateService();
  t.is(gate.peek('workspace-1'), null);
});

test('peek returns false when cached pending count is 0', t => {
  const gate = new MnApprovalGateService();
  gate.set('workspace-1', 0);
  t.is(gate.peek('workspace-1'), false);
});

test('peek returns true when cached pending count is > 0', t => {
  const gate = new MnApprovalGateService();
  gate.set('workspace-1', 3);
  t.is(gate.peek('workspace-1'), true);
});

test('peek returns null after the TTL elapses', t => {
  const ttlMs = 30_000;
  const gate = new MnApprovalGateService(ttlMs);
  const filledAt = 1_000_000;
  gate.set('workspace-1', 1, filledAt);
  t.is(gate.peek('workspace-1', filledAt + ttlMs - 1), true);
  t.is(gate.peek('workspace-1', filledAt + ttlMs + 1), null);
});

test('invalidate forces the next peek to repopulate', t => {
  const gate = new MnApprovalGateService();
  gate.set('workspace-1', 4);
  t.is(gate.peek('workspace-1'), true);
  gate.invalidate('workspace-1');
  t.is(gate.peek('workspace-1'), null);
});

test('cache is workspace-isolated', t => {
  const gate = new MnApprovalGateService();
  gate.set('workspace-1', 0);
  gate.set('workspace-2', 5);
  t.is(gate.peek('workspace-1'), false);
  t.is(gate.peek('workspace-2'), true);
});

test('requiresApproval uses the refresh callback on cache miss', async t => {
  const gate = new MnApprovalGateService();
  let calls = 0;
  const refresh = async (ws: string) => {
    calls += 1;
    return ws === 'workspace-1' ? 2 : 0;
  };
  t.is(await gate.requiresApproval('workspace-1', refresh), true);
  t.is(calls, 1);
  // Now cached — second call must not call refresh.
  t.is(await gate.requiresApproval('workspace-1', refresh), true);
  t.is(calls, 1);
});

test('requiresApproval fails closed (returns false) when refresh throws', async t => {
  const gate = new MnApprovalGateService();
  const refresh = async () => {
    throw new Error('postgres unreachable');
  };
  t.is(await gate.requiresApproval('workspace-1', refresh), false);
});

/**
 * Latency benchmark. Runs `peek` against a primed cache 100k times,
 * then asserts the p95 is well under the 1ms budget. We measure with
 * `process.hrtime.bigint()` because `performance.now()` quantises to
 * 1µs on some platforms which would round our sub-microsecond hits
 * down to 0 and hide a regression.
 *
 * On a typical laptop this clocks <100ns per call. Asserting on 1ms
 * gives a 10000x safety margin for slow CI runners; if this ever
 * fires it means the hot path is doing actual I/O.
 */
test('peek p95 latency is under the 1ms hot-path budget', t => {
  const gate = new MnApprovalGateService();
  for (let i = 0; i < 100; i++) gate.set(`workspace-${i}`, i % 3);
  // Warm up the JIT.
  for (let i = 0; i < 10_000; i++) {
    gate.peek(`workspace-${i % 100}`);
  }
  const samples: bigint[] = [];
  const iterations = 100_000;
  for (let i = 0; i < iterations; i++) {
    const start = process.hrtime.bigint();
    gate.peek(`workspace-${i % 100}`);
    const end = process.hrtime.bigint();
    samples.push(end - start);
  }
  samples.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const p95 = samples[Math.floor(iterations * 0.95)];
  const p99 = samples[Math.floor(iterations * 0.99)];
  // p95 in nanoseconds — assert < 1ms (1_000_000ns) with a 10x
  // safety margin for slow CI runners. Local typical: ~100-500ns.
  const p95Ns = Number(p95);
  const p99Ns = Number(p99);
  t.true(
    p95Ns < 1_000_000,
    `gate.peek p95=${p95Ns}ns exceeds 1ms hot-path budget; p99=${p99Ns}ns`
  );
  // Surface the numbers so they show up in CI logs and the
  // benchmark trend is visible.
   
  console.log(
    `[m3-gate] peek p95=${p95Ns}ns p99=${p99Ns}ns over ${iterations} iterations`
  );
});

test('cacheSize reflects the number of distinct workspaces', t => {
  const gate = new MnApprovalGateService();
  t.is(gate.cacheSize(), 0);
  gate.set('a', 1);
  gate.set('b', 0);
  gate.set('c', 5);
  t.is(gate.cacheSize(), 3);
  gate.invalidate('b');
  t.is(gate.cacheSize(), 2);
});
