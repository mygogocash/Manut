import test from 'ava';

import {
  AiBudgetExceeded,
  AiBudgetService,
  currentPeriodStart,
} from '../ai-budget.service';
import { FREE_TIER } from '../tiers';

/**
 * Manut Wave 6 (E1.12 — T-1.12.1.a) — AiBudgetService unit tests.
 *
 * These tests stub `PrismaClient.mnAiBudgetUsage` with an in-memory
 * Map keyed on `${workspaceId}|${periodStart.toISOString()}`. That
 * mirrors the M4 enforcer's `createFakeDb` pattern in
 * `__tests__/manut/m4-budget-enforcer.spec.ts` — keeping the spec at
 * unit-test latency (milliseconds) instead of integration latency
 * (seconds-spinning-up-postgres) per FIRST principles (CLAUDE.md §1.2).
 *
 * The spec covers:
 *  - empty workspace returns spend=0
 *  - recordSpend upserts then increments
 *  - assertWithinCap allows when current+estimate < cap
 *  - assertWithinCap allows when current+estimate == cap (boundary)
 *  - assertWithinCap throws AiBudgetExceeded when exceeded
 *  - month rollover: spend from a prior period does not leak into now
 *
 * Service-under-test consumes `PrismaClient` directly per the
 * `MnBudgetService` pattern (Wave 4 / M4) — `import type` is avoided on
 * the constructor target so NestJS reflection sees the runtime class
 * (CLAUDE.md scar: NestJS DI metadata traps, twice the same day).
 */

interface FakeRow {
  workspaceId: string;
  periodStart: Date;
  spentCents: number;
  updatedAt: Date;
}

interface FakeMnAiBudgetUsageDb {
  findUnique: (args: {
    where: {
      workspaceId_periodStart: { workspaceId: string; periodStart: Date };
    };
    select?: { spentCents?: boolean };
  }) => Promise<FakeRow | null>;
  upsert: (args: {
    where: {
      workspaceId_periodStart: { workspaceId: string; periodStart: Date };
    };
    create: { workspaceId: string; periodStart: Date; spentCents: number };
    update: { spentCents: { increment: number } };
  }) => Promise<FakeRow>;
}

function rowKey(workspaceId: string, periodStart: Date): string {
  return `${workspaceId}|${periodStart.toISOString()}`;
}

function createFakeDb(): {
  client: { mnAiBudgetUsage: FakeMnAiBudgetUsageDb };
  rows: Map<string, FakeRow>;
} {
  const rows = new Map<string, FakeRow>();
  const mnAiBudgetUsage: FakeMnAiBudgetUsageDb = {
    findUnique: async args => {
      const key = rowKey(
        args.where.workspaceId_periodStart.workspaceId,
        args.where.workspaceId_periodStart.periodStart
      );
      return rows.get(key) ?? null;
    },
    upsert: async args => {
      const key = rowKey(
        args.where.workspaceId_periodStart.workspaceId,
        args.where.workspaceId_periodStart.periodStart
      );
      const existing = rows.get(key);
      if (existing) {
        const next: FakeRow = {
          ...existing,
          spentCents: existing.spentCents + args.update.spentCents.increment,
          updatedAt: new Date(),
        };
        rows.set(key, next);
        return next;
      }
      const created: FakeRow = {
        workspaceId: args.create.workspaceId,
        periodStart: args.create.periodStart,
        spentCents: args.create.spentCents,
        updatedAt: new Date(),
      };
      rows.set(key, created);
      return created;
    },
  };
  return { client: { mnAiBudgetUsage }, rows };
}

function makeService(): {
  service: AiBudgetService;
  rows: Map<string, FakeRow>;
} {
  const { client, rows } = createFakeDb();
  // Cast through unknown — the fake satisfies the structural surface
  // AiBudgetService actually touches (`mnAiBudgetUsage.findUnique` +
  // `mnAiBudgetUsage.upsert`). Importing the full PrismaClient type
  // would drag in the native binding here.
  const service = new AiBudgetService(
    client as unknown as ConstructorParameters<typeof AiBudgetService>[0]
  );
  return { service, rows };
}

test('getCurrentSpend > given no row > returns 0 (empty workspace)', async t => {
  const { service } = makeService();
  const spend = await service.getCurrentSpend('ws-empty');
  t.is(spend, 0);
});

test('recordSpend > given no prior row > upserts a row with the spend', async t => {
  const { service, rows } = makeService();
  await service.recordSpend('ws-1', 42);

  const periodStart = currentPeriodStart();
  const stored = rows.get(`ws-1|${periodStart.toISOString()}`);
  t.truthy(stored);
  t.is(stored!.spentCents, 42);

  // And the read-side returns the same number.
  const spend = await service.getCurrentSpend('ws-1');
  t.is(spend, 42);
});

test('recordSpend > given prior row > increments instead of overwriting', async t => {
  const { service } = makeService();
  await service.recordSpend('ws-2', 100);
  await service.recordSpend('ws-2', 250);
  await service.recordSpend('ws-2', 7);

  const spend = await service.getCurrentSpend('ws-2');
  t.is(spend, 357, 'increments accumulate');
});

test('assertWithinCap > given current+estimate < FREE cap > does not throw', async t => {
  const { service } = makeService();
  // FREE cap is 500 cents. Seed 300, estimate 100 → 400 < 500.
  await service.recordSpend('ws-under', 300);
  await t.notThrowsAsync(() => service.assertWithinCap('ws-under', 100));
});

test('assertWithinCap > given current+estimate == cap > does not throw (boundary)', async t => {
  const { service } = makeService();
  // Boundary: spent + estimate == cap is allowed. The throw is
  // strictly `>` so the cap is inclusive on the allow side.
  await service.recordSpend('ws-boundary', FREE_TIER.aiBudgetUsdCents - 50);
  await t.notThrowsAsync(() => service.assertWithinCap('ws-boundary', 50));
});

test('assertWithinCap > given current+estimate > cap > throws AiBudgetExceeded with structured detail', async t => {
  const { service } = makeService();
  // Seed 450 cents, estimate 100 → 550 > 500 (FREE cap). Should throw.
  await service.recordSpend('ws-over', 450);

  const error = await t.throwsAsync(
    () => service.assertWithinCap('ws-over', 100),
    {
      instanceOf: AiBudgetExceeded,
    }
  );
  t.is(error!.detail.error, 'AI_BUDGET_CAP');
  t.is(error!.detail.spentCents, 450);
  t.is(error!.detail.capCents, FREE_TIER.aiBudgetUsdCents);

  // The wire-shape: JSON in `message`, matching the StorageCapModal
  // precedent so the frontend AiBudgetModal can parse the same way.
  const parsed = JSON.parse(error!.message) as {
    error: string;
    spentCents: number;
    capCents: number;
  };
  t.is(parsed.error, 'AI_BUDGET_CAP');
  t.is(parsed.spentCents, 450);
  t.is(parsed.capCents, FREE_TIER.aiBudgetUsdCents);
});

test('month rollover > spend from prior period does not count against the current month', async t => {
  const { service, rows } = makeService();
  // Seed a row for LAST month at the FREE cap. Then assertWithinCap
  // for THIS month must see spent=0 and not throw on a normal estimate.
  const now = new Date(Date.UTC(2026, 4, 20, 12, 0, 0)); // 2026-05-20
  const lastMonthStart = new Date(Date.UTC(2026, 3, 1, 0, 0, 0)); // 2026-04-01
  const thisMonthStart = currentPeriodStart(now); // 2026-05-01

  // Pre-seed last month at exactly the cap so any leakage would fail
  // the boundary test below.
  rows.set(`ws-rollover|${lastMonthStart.toISOString()}`, {
    workspaceId: 'ws-rollover',
    periodStart: lastMonthStart,
    spentCents: FREE_TIER.aiBudgetUsdCents,
    updatedAt: lastMonthStart,
  });

  // This month must see 0.
  const spend = await service.getCurrentSpend('ws-rollover', now);
  t.is(spend, 0, 'prior month spend does not leak into current month');

  // And the cap check passes cleanly because the running total resets.
  await t.notThrowsAsync(() =>
    service.assertWithinCap('ws-rollover', 100, now)
  );

  // Sanity: the prior row is still there (no destructive month
  // transition), and its periodStart is distinct from this month's.
  t.true(rows.has(`ws-rollover|${lastMonthStart.toISOString()}`));
  t.not(lastMonthStart.toISOString(), thisMonthStart.toISOString());
});
