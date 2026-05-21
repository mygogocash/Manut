import { Logger } from '@nestjs/common';
import type { PrismaClient } from '@prisma/client';
import test from 'ava';

import type { CurrentUser } from '../../../core/auth';
import type { AccessController } from '../../../core/permission';
import { MongoDbAggregationService } from '../aggregation.service';
import { AnalyticsResolver } from '../analytics.resolver';

// ===========================================================================
// Helpers
//
// The aggregation service talks to Postgres exclusively via Prisma's tagged
// raw-SQL templates ($queryRaw / $executeRaw). We don't want to spin up a
// real Postgres for these unit tests — instead we substitute Prisma with a
// tiny in-memory store that intercepts the tagged-template calls, inspects
// the value bindings to figure out which call was made, and serves results
// from the seeded row set.
//
// We trust the SQL shape (the SQL itself is locked down by the production
// integration test in `__tests__/manut/...-module-init.spec.ts` boot path);
// here we test BEHAVIOR — given seeded raw rows, what does the aggregator
// emit?
// ===========================================================================

interface RawRow {
  workspaceId: string;
  collectionName: string;
  docId: string;
  ingestedAt: Date;
}

interface StatRow {
  workspaceId: string;
  day: Date;
  metric: string;
  value: number;
}

interface FakePrismaState {
  raw: RawRow[];
  stats: Map<string, StatRow>;
  /**
   * Captures every `$executeRaw` call so we can introspect the
   * upsert sequence in idempotency tests.
   */
  executeCalls: number;
}

function statKey(workspaceId: string, day: Date, metric: string): string {
  return `${workspaceId}|${day.toISOString()}|${metric}`;
}

function dayOnly(d: Date): Date {
  const out = new Date(d);
  out.setUTCHours(0, 0, 0, 0);
  return out;
}

function joinTemplate(strings: TemplateStringsArray): string {
  // Concatenate the literal parts (without values) so we can classify
  // the call by keyword matching. This is intentionally fragile —
  // changes to the SQL shape will surface as test failures, which is
  // what we want.
  return strings.join(' ').toLowerCase();
}

/**
 * Build a Prisma stub that backs the aggregation service. The shape
 * is deliberately narrow — we only implement what `MongoDbAggregationService`
 * actually calls.
 */
function fakePrisma(seed: RawRow[]): {
  db: PrismaClient;
  state: FakePrismaState;
} {
  const state: FakePrismaState = {
    raw: seed.slice(),
    stats: new Map(),
    executeCalls: 0,
  };

  function classify(sql: string): string {
    if (sql.includes('select distinct workspace_id')) return 'listWorkspaces';
    if (
      sql.includes('select distinct collection_name') ||
      (sql.includes('distinct collection_name') &&
        sql.includes('from mn_mongo_raw_data'))
    )
      return 'listCollections';
    if (sql.includes('with first_seen')) return 'newDocs';
    if (
      sql.includes('count(*)') &&
      sql.includes('from mn_mongo_raw_data') &&
      sql.includes("date_trunc('day', ingested_at)")
    )
      return 'countByDay';
    if (
      sql.includes('select day, metric, value') &&
      sql.includes('from mn_analytics_daily_stats')
    )
      return 'readStats';
    if (
      sql.includes('insert into mn_analytics_daily_stats') ||
      sql.includes('on conflict')
    )
      return 'upsertStat';
    return 'unknown';
  }

  const queryRaw = (strings: TemplateStringsArray, ...values: unknown[]) => {
    const sql = joinTemplate(strings);
    const op = classify(sql);
    if (op === 'listWorkspaces') {
      const set = new Set(state.raw.map(r => r.workspaceId));
      return Promise.resolve(
        Array.from(set).map(workspace_id => ({ workspace_id }))
      );
    }
    if (op === 'listCollections') {
      const workspaceId = String(values[0]);
      const set = new Set(
        state.raw
          .filter(r => r.workspaceId === workspaceId)
          .map(r => r.collectionName)
      );
      return Promise.resolve(
        Array.from(set)
          .sort()
          .map(collection_name => ({ collection_name }))
      );
    }
    if (op === 'countByDay') {
      const workspaceId = String(values[0]);
      const collectionName = String(values[1]);
      const lookbackStart = values[2] as Date;
      const buckets = new Map<string, number>();
      for (const r of state.raw) {
        if (r.workspaceId !== workspaceId) continue;
        if (r.collectionName !== collectionName) continue;
        if (r.ingestedAt < lookbackStart) continue;
        const day = dayOnly(r.ingestedAt).toISOString();
        buckets.set(day, (buckets.get(day) ?? 0) + 1);
      }
      const rows = Array.from(buckets.entries()).map(([dayIso, count]) => ({
        day: new Date(dayIso),
        count: BigInt(count),
      }));
      return Promise.resolve(rows);
    }
    if (op === 'newDocs') {
      const workspaceId = String(values[0]);
      const collectionName = String(values[1]);
      const lookbackStart = values[2] as Date;
      // first_seen per doc_id across all history (no lookback in CTE).
      const firstSeen = new Map<string, Date>();
      for (const r of state.raw) {
        if (r.workspaceId !== workspaceId) continue;
        if (r.collectionName !== collectionName) continue;
        const prev = firstSeen.get(r.docId);
        if (!prev || r.ingestedAt < prev) {
          firstSeen.set(r.docId, r.ingestedAt);
        }
      }
      const buckets = new Map<string, number>();
      for (const at of firstSeen.values()) {
        if (at < lookbackStart) continue;
        const day = dayOnly(at).toISOString();
        buckets.set(day, (buckets.get(day) ?? 0) + 1);
      }
      const rows = Array.from(buckets.entries()).map(([dayIso, count]) => ({
        day: new Date(dayIso),
        count: BigInt(count),
      }));
      return Promise.resolve(rows);
    }
    if (op === 'readStats') {
      // Values can be either:
      //   filtered: [workspaceId, from, to, metrics[]]
      //   unfiltered: [workspaceId, from, to]
      const workspaceId = String(values[0]);
      const from = values[1] as Date;
      const to = values[2] as Date;
      const metricsFilter = (values[3] as string[] | undefined) ?? null;
      const matched: StatRow[] = [];
      for (const row of state.stats.values()) {
        if (row.workspaceId !== workspaceId) continue;
        if (row.day < from || row.day > to) continue;
        if (metricsFilter && !metricsFilter.includes(row.metric)) continue;
        matched.push(row);
      }
      matched.sort((a, b) => {
        const dayCmp = a.day.getTime() - b.day.getTime();
        if (dayCmp !== 0) return dayCmp;
        return a.metric.localeCompare(b.metric);
      });
      return Promise.resolve(matched);
    }
    return Promise.resolve([]);
  };

  const executeRaw = (strings: TemplateStringsArray, ...values: unknown[]) => {
    state.executeCalls += 1;
    const sql = joinTemplate(strings);
    if (classify(sql) !== 'upsertStat') {
      return Promise.resolve(0);
    }
    const workspaceId = String(values[0]);
    const day = dayOnly(values[1] as Date);
    const metric = String(values[2]);
    const value = Number(values[3]);
    const key = statKey(workspaceId, day, metric);
    state.stats.set(key, { workspaceId, day, metric, value });
    return Promise.resolve(1);
  };

  const db = {
    $queryRaw: queryRaw,
    $executeRaw: executeRaw,
  } as unknown as PrismaClient;

  return { db, state };
}

function utcDay(y: number, m: number, d: number): Date {
  return new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
}

const NOW = new Date('2026-05-20T12:00:00.000Z');

test.before(() => {
  // Silence the structured-log telemetry — the tests assert on returned
  // values, not log output.
  Logger.overrideLogger(false);
});

test.after(() => {
  Logger.overrideLogger(['log', 'warn', 'error']);
});

// ===========================================================================
// Aggregation behaviour
// ===========================================================================

test.serial(
  'aggregation produces a `<collection>_count` row per day with the right count',
  async t => {
    const yesterday = new Date(NOW);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const dayBefore = new Date(NOW);
    dayBefore.setUTCDate(dayBefore.getUTCDate() - 2);
    const { db, state } = fakePrisma([
      // Today: 3 rows for `orders`
      {
        workspaceId: 'ws-1',
        collectionName: 'orders',
        docId: 'o-1',
        ingestedAt: NOW,
      },
      {
        workspaceId: 'ws-1',
        collectionName: 'orders',
        docId: 'o-2',
        ingestedAt: NOW,
      },
      {
        workspaceId: 'ws-1',
        collectionName: 'orders',
        docId: 'o-3',
        ingestedAt: NOW,
      },
      // Yesterday: 2 rows for `orders`
      {
        workspaceId: 'ws-1',
        collectionName: 'orders',
        docId: 'o-4',
        ingestedAt: yesterday,
      },
      {
        workspaceId: 'ws-1',
        collectionName: 'orders',
        docId: 'o-5',
        ingestedAt: yesterday,
      },
      // Day before: 1 row for `orders`
      {
        workspaceId: 'ws-1',
        collectionName: 'orders',
        docId: 'o-6',
        ingestedAt: dayBefore,
      },
    ]);
    const svc = new MongoDbAggregationService(db);

    const result = await svc.runForWorkspace('ws-1', 7);

    t.is(result.errors.length, 0, 'no errors');
    t.is(result.metricsComputed, 2, 'count + new metrics both fire');

    const todayRow = Array.from(state.stats.values()).find(
      r =>
        r.metric === 'orders_count' &&
        dayOnly(r.day).getTime() === dayOnly(NOW).getTime()
    );
    t.truthy(todayRow);
    t.is(todayRow?.value, 3, 'three orders today');
  }
);

test.serial(
  'idempotency: re-running with the same lookback overwrites the same rows',
  async t => {
    const { db, state } = fakePrisma([
      {
        workspaceId: 'ws-2',
        collectionName: 'events',
        docId: 'e-1',
        ingestedAt: NOW,
      },
      {
        workspaceId: 'ws-2',
        collectionName: 'events',
        docId: 'e-2',
        ingestedAt: NOW,
      },
    ]);
    const svc = new MongoDbAggregationService(db);

    await svc.runForWorkspace('ws-2', 7);
    const firstCount = state.stats.size;
    const firstExecutes = state.executeCalls;

    // Re-run.
    await svc.runForWorkspace('ws-2', 7);

    t.is(
      state.stats.size,
      firstCount,
      're-run does not add new (day,metric) rows'
    );
    t.true(
      state.executeCalls > firstExecutes,
      're-run does perform UPSERTs (proves idempotency via ON CONFLICT)'
    );
    const eventsCount = Array.from(state.stats.values()).find(
      r =>
        r.metric === 'events_count' &&
        dayOnly(r.day).getTime() === dayOnly(NOW).getTime()
    );
    t.is(eventsCount?.value, 2);
  }
);

test.serial(
  'lookback window: rows outside the window are excluded',
  async t => {
    const inWindow = new Date(NOW);
    inWindow.setUTCDate(inWindow.getUTCDate() - 2); // 2 days ago
    const outsideWindow = new Date(NOW);
    outsideWindow.setUTCDate(outsideWindow.getUTCDate() - 30); // 30 days ago
    const { db, state } = fakePrisma([
      {
        workspaceId: 'ws-3',
        collectionName: 'invoices',
        docId: 'i-recent',
        ingestedAt: inWindow,
      },
      {
        workspaceId: 'ws-3',
        collectionName: 'invoices',
        docId: 'i-old',
        ingestedAt: outsideWindow,
      },
    ]);
    const svc = new MongoDbAggregationService(db);

    await svc.runForWorkspace('ws-3', 7); // lookback only 7 days

    // The `_count` metric should have only the in-window row.
    const countRows = Array.from(state.stats.values()).filter(
      r => r.metric === 'invoices_count'
    );
    t.is(countRows.length, 1, 'only the in-window day produced a count row');
    t.is(countRows[0].value, 1);

    // The `_new` metric likewise — the old doc's first-seen falls outside
    // the lookback boundary so it isn't counted.
    const newRows = Array.from(state.stats.values()).filter(
      r => r.metric === 'invoices_new'
    );
    t.is(newRows.length, 1, 'only the in-window first-seen produced a new row');
    t.is(newRows[0].value, 1);
  }
);

test.serial(
  'multi-collection: 2 collections produce 2 metrics each per day',
  async t => {
    const { db, state } = fakePrisma([
      {
        workspaceId: 'ws-4',
        collectionName: 'orders',
        docId: 'o-1',
        ingestedAt: NOW,
      },
      {
        workspaceId: 'ws-4',
        collectionName: 'orders',
        docId: 'o-2',
        ingestedAt: NOW,
      },
      {
        workspaceId: 'ws-4',
        collectionName: 'customers',
        docId: 'c-1',
        ingestedAt: NOW,
      },
    ]);
    const svc = new MongoDbAggregationService(db);

    const result = await svc.runForWorkspace('ws-4', 7);
    t.is(result.errors.length, 0);

    const metricsToday = Array.from(state.stats.values())
      .filter(r => dayOnly(r.day).getTime() === dayOnly(NOW).getTime())
      .map(r => r.metric)
      .sort();
    t.deepEqual(metricsToday, [
      'customers_count',
      'customers_new',
      'orders_count',
      'orders_new',
    ]);
  }
);

test.serial(
  '`<collection>_new` counts a doc only on its first-seen day',
  async t => {
    const yesterday = new Date(NOW);
    yesterday.setUTCDate(yesterday.getUTCDate() - 1);
    const { db, state } = fakePrisma([
      // Doc seen yesterday — counts as new yesterday.
      {
        workspaceId: 'ws-5',
        collectionName: 'leads',
        docId: 'l-1',
        ingestedAt: yesterday,
      },
      // SAME docId re-ingested today — does NOT count as new today
      // (it's a re-write of the same doc).
      {
        workspaceId: 'ws-5',
        collectionName: 'leads',
        docId: 'l-1',
        ingestedAt: NOW,
      },
      // Brand new doc today.
      {
        workspaceId: 'ws-5',
        collectionName: 'leads',
        docId: 'l-2',
        ingestedAt: NOW,
      },
    ]);
    const svc = new MongoDbAggregationService(db);

    await svc.runForWorkspace('ws-5', 7);

    const newToday = Array.from(state.stats.values()).find(
      r =>
        r.metric === 'leads_new' &&
        dayOnly(r.day).getTime() === dayOnly(NOW).getTime()
    );
    const newYesterday = Array.from(state.stats.values()).find(
      r =>
        r.metric === 'leads_new' &&
        dayOnly(r.day).getTime() === dayOnly(yesterday).getTime()
    );
    t.is(newToday?.value, 1, 'only the brand-new doc counts as new today');
    t.is(newYesterday?.value, 1, 'the re-ingested doc still counts yesterday');
  }
);

// ===========================================================================
// AnalyticsResolver — read-side
// ===========================================================================

function fakeUser(id = 'user-1'): CurrentUser {
  return {
    id,
    email: 'user@example.com',
    avatarUrl: null,
    name: 'Test User',
    disabled: false,
    hasPassword: true,
    emailVerified: true,
    completedOnboarding: true,
  };
}

function fakeAcAllow(): AccessController {
  return {
    user: () => ({
      workspace: () => ({
        assert: async () => undefined,
      }),
    }),
  } as unknown as AccessController;
}

test.serial('dailyStats filters by metric IN list and day range', async t => {
  const { db, state } = fakePrisma([]);
  const svc = new MongoDbAggregationService(db);
  state.stats.set(statKey('ws-7', utcDay(2026, 5, 18), 'orders_count'), {
    workspaceId: 'ws-7',
    day: utcDay(2026, 5, 18),
    metric: 'orders_count',
    value: 5,
  });
  state.stats.set(statKey('ws-7', utcDay(2026, 5, 19), 'orders_count'), {
    workspaceId: 'ws-7',
    day: utcDay(2026, 5, 19),
    metric: 'orders_count',
    value: 7,
  });
  state.stats.set(statKey('ws-7', utcDay(2026, 5, 19), 'customers_new'), {
    workspaceId: 'ws-7',
    day: utcDay(2026, 5, 19),
    metric: 'customers_new',
    value: 2,
  });
  state.stats.set(statKey('ws-7', utcDay(2026, 5, 25), 'orders_count'), {
    workspaceId: 'ws-7',
    day: utcDay(2026, 5, 25),
    metric: 'orders_count',
    value: 99,
  });

  const resolver = new AnalyticsResolver(svc, fakeAcAllow(), db);

  const filtered = await resolver.dailyStats(fakeUser(), {
    workspaceId: 'ws-7',
    metrics: ['orders_count'],
    from: '2026-05-18',
    to: '2026-05-19',
  });
  t.is(filtered.length, 2, 'two days within range for orders_count');
  t.deepEqual(
    filtered.map(r => `${r.day}|${r.metric}|${r.value}`),
    ['2026-05-18|orders_count|5', '2026-05-19|orders_count|7']
  );

  // No metrics filter → all metrics in window.
  const unfiltered = await resolver.dailyStats(fakeUser(), {
    workspaceId: 'ws-7',
    from: '2026-05-19',
    to: '2026-05-19',
  });
  t.is(unfiltered.length, 2, 'both metrics on 2026-05-19');
  t.deepEqual(unfiltered.map(r => r.metric).sort(), [
    'customers_new',
    'orders_count',
  ]);
});
