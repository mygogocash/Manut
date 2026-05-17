import { MnBudgetScope } from '@prisma/client';
import test from 'ava';

import {
  BudgetExceededError,
  MnBudgetEnforcerService,
} from '../../plugins/manut/manut-budget-enforcer.service';
import { formatMonthYear } from '../../plugins/manut/manut-cost.service';

/**
 * M4 budget enforcer — scope-chain walk + TTL cache.
 *
 * Latency target: p95 ≤ 1 ms on cache hit. The benchmark in this file
 * primes the cache with one DB-backed call, then samples 1000 cache-hit
 * paths and asserts the 95th percentile is at or under the budget.
 */

interface FakeBudget {
  id: string;
  workspaceId: string;
  projectId: string | null;
  scopeType: MnBudgetScope;
  scopeId: string | null;
  monthYear: string;
  capCents: number;
  spentCents: number;
  hardStopEnabled: boolean;
  alertSent: boolean;
  warnThresholdPct: number;
}

function createFakeDb(seedBudgets: FakeBudget[] = []) {
  let findManyCount = 0;
  const db = {
    mnBudget: {
      findMany: async ({
        where,
      }: {
        where: {
          workspaceId: string;
          monthYear: string;
          OR: Array<{ scopeType: MnBudgetScope; scopeId: string | null }>;
        };
      }) => {
        findManyCount++;
        return seedBudgets.filter(
          b =>
            b.workspaceId === where.workspaceId &&
            b.monthYear === where.monthYear &&
            where.OR.some(
              o => o.scopeType === b.scopeType && o.scopeId === b.scopeId
            )
        );
      },
    },
  };
  return {
    db,
    findManyCount: () => findManyCount,
  };
}

test('check returns ALLOW with no budgets configured', async t => {
  const { db } = createFakeDb([]);
  const enforcer = new MnBudgetEnforcerService(
    db as unknown as ConstructorParameters<typeof MnBudgetEnforcerService>[0]
  );

  const decision = await enforcer.check({
    workspaceId: 'w1',
    projectId: 'p1',
    agentId: 'a1',
  });
  t.is(decision.verdict, 'ALLOW');
  t.is(decision.blockedBy, null);
});

test('check returns BLOCK at the closest scope that exceeds cap', async t => {
  const monthYear = formatMonthYear(new Date());
  const { db } = createFakeDb([
    {
      id: 'b-task',
      workspaceId: 'w1',
      projectId: 'p1',
      scopeType: MnBudgetScope.TASK,
      scopeId: 't1',
      monthYear,
      capCents: 100,
      spentCents: 150,
      hardStopEnabled: true,
      alertSent: false,
      warnThresholdPct: 80,
    },
    {
      id: 'b-workspace',
      workspaceId: 'w1',
      projectId: null,
      scopeType: MnBudgetScope.WORKSPACE,
      scopeId: null,
      monthYear,
      capCents: 100_000,
      spentCents: 50,
      hardStopEnabled: true,
      alertSent: false,
      warnThresholdPct: 80,
    },
  ]);
  const enforcer = new MnBudgetEnforcerService(
    db as unknown as ConstructorParameters<typeof MnBudgetEnforcerService>[0]
  );

  const decision = await enforcer.check({
    workspaceId: 'w1',
    projectId: 'p1',
    taskId: 't1',
  });
  t.is(decision.verdict, 'BLOCK');
  t.is(decision.blockedBy?.scopeType, MnBudgetScope.TASK);
});

test('assertAllowed throws BudgetExceededError on BLOCK', async t => {
  const monthYear = formatMonthYear(new Date());
  const { db } = createFakeDb([
    {
      id: 'b-ws',
      workspaceId: 'w1',
      projectId: null,
      scopeType: MnBudgetScope.WORKSPACE,
      scopeId: null,
      monthYear,
      capCents: 100,
      spentCents: 100,
      hardStopEnabled: true,
      alertSent: false,
      warnThresholdPct: 80,
    },
  ]);
  const enforcer = new MnBudgetEnforcerService(
    db as unknown as ConstructorParameters<typeof MnBudgetEnforcerService>[0]
  );

  await t.throwsAsync(enforcer.assertAllowed({ workspaceId: 'w1' }), {
    instanceOf: BudgetExceededError,
  });
});

test('hardStopEnabled=false does NOT block even over cap', async t => {
  const monthYear = formatMonthYear(new Date());
  const { db } = createFakeDb([
    {
      id: 'b-soft',
      workspaceId: 'w1',
      projectId: null,
      scopeType: MnBudgetScope.WORKSPACE,
      scopeId: null,
      monthYear,
      capCents: 100,
      spentCents: 1_000,
      hardStopEnabled: false,
      alertSent: false,
      warnThresholdPct: 80,
    },
  ]);
  const enforcer = new MnBudgetEnforcerService(
    db as unknown as ConstructorParameters<typeof MnBudgetEnforcerService>[0]
  );

  const decision = await enforcer.check({ workspaceId: 'w1' });
  t.is(decision.verdict, 'ALLOW');
});

test('check defaults ALLOW when DB throws', async t => {
  const enforcer = new MnBudgetEnforcerService({
    mnBudget: {
      findMany: async () => {
        throw new Error('synthetic DB error');
      },
    },
  } as unknown as ConstructorParameters<typeof MnBudgetEnforcerService>[0]);

  const decision = await enforcer.check({ workspaceId: 'w1' });
  t.is(decision.verdict, 'ALLOW', 'fail-open on transient DB hiccup');
});

test('cache hit: second call hits DB 0 additional times within TTL', async t => {
  const monthYear = formatMonthYear(new Date());
  const { db, findManyCount } = createFakeDb([
    {
      id: 'b1',
      workspaceId: 'w1',
      projectId: null,
      scopeType: MnBudgetScope.WORKSPACE,
      scopeId: null,
      monthYear,
      capCents: 100_000,
      spentCents: 0,
      hardStopEnabled: true,
      alertSent: false,
      warnThresholdPct: 80,
    },
  ]);
  const enforcer = new MnBudgetEnforcerService(
    db as unknown as ConstructorParameters<typeof MnBudgetEnforcerService>[0]
  );

  await enforcer.check({ workspaceId: 'w1' });
  t.is(findManyCount(), 1);
  await enforcer.check({ workspaceId: 'w1' });
  t.is(findManyCount(), 1, 'second call served from cache');
  await enforcer.check({ workspaceId: 'w1' });
  t.is(findManyCount(), 1, 'third call served from cache');
});

test('invalidate clears a single scope entry', async t => {
  const monthYear = formatMonthYear(new Date());
  const { db, findManyCount } = createFakeDb([
    {
      id: 'b1',
      workspaceId: 'w1',
      projectId: null,
      scopeType: MnBudgetScope.WORKSPACE,
      scopeId: null,
      monthYear,
      capCents: 100,
      spentCents: 0,
      hardStopEnabled: true,
      alertSent: false,
      warnThresholdPct: 80,
    },
  ]);
  const enforcer = new MnBudgetEnforcerService(
    db as unknown as ConstructorParameters<typeof MnBudgetEnforcerService>[0]
  );

  await enforcer.check({ workspaceId: 'w1' });
  enforcer.invalidate({ workspaceId: 'w1' });
  await enforcer.check({ workspaceId: 'w1' });
  t.is(findManyCount(), 2, 'cache invalidation forces re-read');
});

/**
 * Latency benchmark: p95 cache-hit ≤ 1 ms.
 *
 * 1000 samples is enough to stabilise the percentile without dragging
 * the test runner. The benchmark is deliberately bounded — if it ever
 * regresses past 1 ms we'd rather catch it in CI than in production.
 */
test('p95 cache-hit latency ≤ 1ms', async t => {
  const monthYear = formatMonthYear(new Date());
  const { db } = createFakeDb([
    {
      id: 'b1',
      workspaceId: 'w1',
      projectId: null,
      scopeType: MnBudgetScope.WORKSPACE,
      scopeId: null,
      monthYear,
      capCents: 100_000,
      spentCents: 0,
      hardStopEnabled: true,
      alertSent: false,
      warnThresholdPct: 80,
    },
  ]);
  const enforcer = new MnBudgetEnforcerService(
    db as unknown as ConstructorParameters<typeof MnBudgetEnforcerService>[0]
  );

  // Prime cache.
  await enforcer.check({ workspaceId: 'w1' });

  const samples: number[] = [];
  for (let i = 0; i < 1_000; i++) {
    const decision = await enforcer.check({ workspaceId: 'w1' });
    t.true(decision.cached, 'served from cache');
    samples.push(decision.latencyMs);
  }

  samples.sort((a, b) => a - b);
  const p95 = samples[Math.floor(samples.length * 0.95)];
  // Latency budget: 1 ms. We log the value so a regression is easy to
  // spot in the test output even when the assertion is loose.
   
  console.log(
    `[m4-budget-enforcer] p95 cache-hit latency: ${p95.toFixed(4)} ms`
  );
  t.true(p95 <= 1, `p95 cache-hit must be ≤ 1ms, got ${p95.toFixed(4)} ms`);
});
