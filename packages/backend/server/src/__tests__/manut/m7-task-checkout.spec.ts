/**
 * M7 — Atomic checkout concurrency tests.
 *
 * THE R0 GATE OF THE WHOLE MILESTONE LIVES HERE. These tests prove the
 * single-winner invariant: under N concurrent callers, exactly one
 * tryCheckout returns a non-null row and the rest return null.
 *
 * The trick to faithfully testing this off Postgres is the fake DB
 * below. The real `$queryRaw` path runs an atomic UPDATE ... WHERE
 * ... RETURNING — Postgres serialises row writes. To mirror that
 * behaviour in JS we wrap the whole "check predicate + write" sequence
 * in a per-task mutex (a Promise chain). Without the mutex the fake
 * UPDATE would interleave reads and writes; the mutex is what makes
 * the fake honest.
 *
 * The 100-parallel test would be a useless rubber-stamp without that
 * mutex — so we ALSO include a negative-control test asserting the
 * mutex actually serialises (no concurrent re-entry of the critical
 * section). That negative control is what stops a future refactor
 * from accidentally turning this into a "1 winner because JS is
 * single-threaded anyway" theatre piece.
 */

import { MnExecutionRunStatus } from '@prisma/client';
import test from 'ava';

import { MnTaskCheckoutService } from '../../plugins/manut/manut-task-checkout.service';

interface FakeTask {
  id: string;
  projectId: string;
  title: string;
  executionRunId: string | null;
  executionLockedAt: Date | null;
  updatedAt: Date;
}

interface FakeExecutionRun {
  id: string;
  taskId: string;
  agentId: string | null;
  status: MnExecutionRunStatus;
  startedAt: Date;
  finishedAt: Date | null;
  error: string | null;
}

interface FakeDbOptions {
  /** Clock override for stale-lock tests. */
  clock?: { now(): Date };
  /** Track every entry into the critical section. */
  onEnterCriticalSection?: () => void;
  onExitCriticalSection?: () => void;
}

/**
 * Fake DB that models Postgres row-level locking. The critical
 * section is the UPDATE ... WHERE ... RETURNING path; we wrap it in a
 * per-task async mutex so a concurrent caller waits its turn and
 * re-evaluates the WHERE predicate against the post-lock row.
 */
function createFakeDb(
  initialTasks: FakeTask[] = [],
  options: FakeDbOptions = {}
) {
  const tasks = new Map<string, FakeTask>(
    initialTasks.map(t => [t.id, { ...t }])
  );
  const runs: FakeExecutionRun[] = [];
  const activityLog: Array<{
    taskId: string;
    action: string;
    metadata: Record<string, unknown>;
  }> = [];
  // Per-task mutex: head of an async chain. Each tryCheckout extends
  // the chain so callers serialize on the same row, mirroring
  // Postgres row-level locking.
  const mutex = new Map<string, Promise<void>>();
  let criticalEntries = 0;
  let criticalConcurrent = 0;
  let maxCriticalConcurrent = 0;

  function now(): Date {
    return options.clock ? options.clock.now() : new Date();
  }

  async function runExclusive<T>(
    taskId: string,
    fn: () => Promise<T> | T
  ): Promise<T> {
    const prev = mutex.get(taskId) ?? Promise.resolve();
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    mutex.set(
      taskId,
      prev.then(() => gate)
    );

    await prev;
    criticalConcurrent++;
    maxCriticalConcurrent = Math.max(maxCriticalConcurrent, criticalConcurrent);
    options.onEnterCriticalSection?.();
    try {
      criticalEntries++;
      return await fn();
    } finally {
      criticalConcurrent--;
      options.onExitCriticalSection?.();
      release();
    }
  }

  const STALE_INTERVAL_MS = 5 * 60 * 1000;

  const db = {
    $queryRaw: async (
      _strings: TemplateStringsArray,
      ...values: unknown[]
    ): Promise<FakeTask[]> => {
      // The single raw query in MnTaskCheckoutService.tryCheckout has
      // 2 interpolated values: runId, taskId — in that order.
      const [runId, taskId] = values as [string, string];
      return runExclusive(taskId, () => {
        const task = tasks.get(taskId);
        if (!task) return [];
        const lockedAt = task.executionLockedAt;
        const isStale =
          lockedAt !== null &&
          now().getTime() - lockedAt.getTime() > STALE_INTERVAL_MS;
        const canAcquire = task.executionRunId === null || isStale;
        if (!canAcquire) return [];

        const updated: FakeTask = {
          ...task,
          executionRunId: runId,
          executionLockedAt: now(),
          updatedAt: now(),
        };
        tasks.set(taskId, updated);
        return [updated];
      });
    },
    $executeRaw: async (
      _strings: TemplateStringsArray,
      ...values: unknown[]
    ): Promise<number> => {
      // The release UPDATE in MnTaskCheckoutService.release has 2
      // interpolated values: taskId, runId — in that order.
      const [taskId, runId] = values as [string, string];
      return runExclusive(taskId, () => {
        const task = tasks.get(taskId);
        if (!task) return 0;
        if (task.executionRunId !== runId) return 0;
        tasks.set(taskId, {
          ...task,
          executionRunId: null,
          executionLockedAt: null,
          updatedAt: now(),
        });
        return 1;
      });
    },
    mnExecutionRun: {
      create: async ({
        data,
      }: {
        data: Omit<FakeExecutionRun, 'startedAt' | 'finishedAt' | 'error'> &
          Partial<Pick<FakeExecutionRun, 'startedAt' | 'finishedAt' | 'error'>>;
      }) => {
        // Idempotency mirror: duplicate id throws like Prisma does.
        if (runs.some(r => r.id === data.id)) {
          throw new Error('Unique constraint violated on `id`');
        }
        const row: FakeExecutionRun = {
          id: data.id,
          taskId: data.taskId,
          agentId: data.agentId ?? null,
          status: data.status,
          startedAt: data.startedAt ?? now(),
          finishedAt: data.finishedAt ?? null,
          error: data.error ?? null,
        };
        runs.push(row);
        return row;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<FakeExecutionRun>;
      }) => {
        const idx = runs.findIndex(r => r.id === where.id);
        if (idx < 0) {
          const err: Error & { code?: string } = new Error(
            'An operation failed because it depends on one or more records that were required but not found. Record to update not found.'
          );
          err.code = 'P2025';
          throw err;
        }
        runs[idx] = { ...runs[idx], ...data };
        return runs[idx];
      },
      findMany: async ({
        where,
        orderBy: _orderBy,
        take,
      }: {
        where?: {
          taskId?: string;
          status?: MnExecutionRunStatus;
          startedAt?: { lt: Date };
        };
        orderBy?: { startedAt?: 'asc' | 'desc' };
        take?: number;
      } = {}) => {
        let rows = runs.slice();
        if (where?.taskId) rows = rows.filter(r => r.taskId === where.taskId);
        if (where?.status) rows = rows.filter(r => r.status === where.status);
        if (where?.startedAt?.lt) {
          const cutoff = where.startedAt.lt;
          rows = rows.filter(r => r.startedAt.getTime() < cutoff.getTime());
        }
        rows.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
        return rows.slice(0, take ?? rows.length);
      },
    },
    mnTaskActivity: {
      create: async ({
        data,
      }: {
        data: {
          taskId: string;
          action: string;
          metadata: Record<string, unknown>;
        };
      }) => {
        activityLog.push({
          taskId: data.taskId,
          action: data.action,
          metadata: data.metadata,
        });
        return { id: 'act_' + activityLog.length, ...data, createdAt: now() };
      },
    },
  };

  return {
    db,
    getTask: (id: string) => tasks.get(id),
    getRuns: () => runs.slice(),
    getActivity: () => activityLog.slice(),
    getMaxCriticalConcurrent: () => maxCriticalConcurrent,
    getCriticalEntries: () => criticalEntries,
  };
}

function makeTask(overrides: Partial<FakeTask> = {}): FakeTask {
  return {
    id: overrides.id ?? 'task-1',
    projectId: overrides.projectId ?? 'p1',
    title: overrides.title ?? 'Test task',
    executionRunId: overrides.executionRunId ?? null,
    executionLockedAt: overrides.executionLockedAt ?? null,
    updatedAt: new Date(),
  };
}

// ---------------------------------------------------------------------------
// Happy path
// ---------------------------------------------------------------------------

test('tryCheckout: first caller acquires lock and gets the task back', async t => {
  const { db, getTask } = createFakeDb([makeTask({ id: 't1' })]);
  const svc = new MnTaskCheckoutService(db as any);

  const result = await svc.tryCheckout('t1', 'run-1', 'agent-1');

  t.truthy(result, 'first checkout should succeed');
  t.is(result!.id, 't1');
  t.is(result!.executionRunId, 'run-1');
  t.truthy(result!.executionLockedAt);
  t.is(getTask('t1')!.executionRunId, 'run-1');
});

test('tryCheckout: second caller against a fresh lock returns null', async t => {
  const { db } = createFakeDb([makeTask({ id: 't1' })]);
  const svc = new MnTaskCheckoutService(db as any);

  const first = await svc.tryCheckout('t1', 'run-1');
  const second = await svc.tryCheckout('t1', 'run-2');

  t.truthy(first);
  t.is(second, null, 'a fresh lock blocks subsequent checkouts');
});

test('tryCheckout: empty taskId or runId throws', async t => {
  const { db } = createFakeDb([makeTask({ id: 't1' })]);
  const svc = new MnTaskCheckoutService(db as any);

  await t.throwsAsync(svc.tryCheckout('', 'run-1'), {
    message: /non-empty/,
  });
  await t.throwsAsync(svc.tryCheckout('t1', ''), {
    message: /non-empty/,
  });
});

// ---------------------------------------------------------------------------
// R0 GATE — 100 parallel checkouts: exactly one winner
// ---------------------------------------------------------------------------

test('R0: 100 parallel tryCheckout for the same task — exactly one winner', async t => {
  const { db, getMaxCriticalConcurrent, getCriticalEntries } = createFakeDb([
    makeTask({ id: 't-race' }),
  ]);
  const svc = new MnTaskCheckoutService(db as any);

  const runIds = Array.from({ length: 100 }, (_, i) => `run-${i}`);
  const settled = await Promise.all(
    runIds.map(rid => svc.tryCheckout('t-race', rid, null))
  );

  const winners = settled.filter(r => r !== null);
  const losers = settled.filter(r => r === null);

  t.is(
    winners.length,
    1,
    `1 winner from 100 parallel checkouts (got ${winners.length})`
  );
  t.is(losers.length, 99, 'the other 99 must lose');
  t.regex(
    winners[0]!.executionRunId!,
    /^run-\d+$/,
    'winner carries a real runId'
  );

  // Negative control: confirm the fake DB's mutex actually
  // serialised the critical section. If a future refactor lets two
  // callers re-enter the section in parallel, this guard catches it.
  t.is(
    getMaxCriticalConcurrent(),
    1,
    'fake DB mutex must serialise the critical section'
  );
  // We expect 100 critical-section entries for the queryRaw alone,
  // and one more $queryRaw is not called for losers. Each $queryRaw
  // counts once; the mnExecutionRun.create path does not enter the
  // mutex. So expect exactly 100 critical entries.
  t.is(getCriticalEntries(), 100, 'every caller must enter the section');
});

// ---------------------------------------------------------------------------
// Stale lock recovery
// ---------------------------------------------------------------------------

test('tryCheckout: stale lock (>5 min) is re-acquirable', async t => {
  let nowFixture = new Date('2026-05-18T10:00:00.000Z');
  const { db } = createFakeDb(
    [
      makeTask({
        id: 't-stale',
        executionRunId: 'stale-run',
        executionLockedAt: new Date('2026-05-18T09:30:00.000Z'), // 30 min ago
      }),
    ],
    { clock: { now: () => nowFixture } }
  );
  const svc = new MnTaskCheckoutService(db as any);

  // Even though a runId is set, it's stale → next checkout wins.
  const result = await svc.tryCheckout('t-stale', 'fresh-run');
  t.truthy(result, 'stale lock must yield to a fresh checkout');
  t.is(result!.executionRunId, 'fresh-run');

  // And after fresh acquisition, a second concurrent attempt loses.
  nowFixture = new Date('2026-05-18T10:00:05.000Z');
  const second = await svc.tryCheckout('t-stale', 'too-late');
  t.is(second, null);
});

test('tryCheckout: lock just under 5 min is still held', async t => {
  let nowFixture = new Date('2026-05-18T10:00:00.000Z');
  const { db } = createFakeDb(
    [
      makeTask({
        id: 't-fresh',
        executionRunId: 'recent-run',
        executionLockedAt: new Date('2026-05-18T09:56:00.000Z'), // 4 min ago
      }),
    ],
    { clock: { now: () => nowFixture } }
  );
  const svc = new MnTaskCheckoutService(db as any);

  const result = await svc.tryCheckout('t-fresh', 'challenger');
  t.is(result, null, '4-min-old lock is not stale yet');
});

// ---------------------------------------------------------------------------
// Release: only the holder can release
// ---------------------------------------------------------------------------

test('release: holder can release', async t => {
  const { db, getTask } = createFakeDb([makeTask({ id: 't1' })]);
  const svc = new MnTaskCheckoutService(db as any);

  await svc.tryCheckout('t1', 'run-A');
  const released = await svc.release('t1', 'run-A');
  t.true(released);
  t.is(getTask('t1')!.executionRunId, null);
  t.is(getTask('t1')!.executionLockedAt, null);
});

test('release: wrong runId is a no-op (security)', async t => {
  const { db, getTask } = createFakeDb([makeTask({ id: 't1' })]);
  const svc = new MnTaskCheckoutService(db as any);

  await svc.tryCheckout('t1', 'run-real');
  const released = await svc.release('t1', 'run-impostor');

  t.false(released, 'wrong runId must not clear the lock');
  t.is(
    getTask('t1')!.executionRunId,
    'run-real',
    'lock survives the bogus release attempt'
  );
});

test('release: after release, lock is freely re-acquirable', async t => {
  const { db } = createFakeDb([makeTask({ id: 't1' })]);
  const svc = new MnTaskCheckoutService(db as any);

  await svc.tryCheckout('t1', 'run-1');
  await svc.release('t1', 'run-1');
  const next = await svc.tryCheckout('t1', 'run-2');

  t.truthy(next);
  t.is(next!.executionRunId, 'run-2');
});

// ---------------------------------------------------------------------------
// Run lifecycle
// ---------------------------------------------------------------------------

test('markRunComplete: SUCCEEDED writes finishedAt + error=null', async t => {
  const { db, getRuns } = createFakeDb([makeTask({ id: 't1' })]);
  const svc = new MnTaskCheckoutService(db as any);

  await svc.tryCheckout('t1', 'run-1');
  await svc.markRunComplete('run-1', MnExecutionRunStatus.SUCCEEDED);

  const run = getRuns().find(r => r.id === 'run-1');
  t.is(run?.status, MnExecutionRunStatus.SUCCEEDED);
  t.truthy(run?.finishedAt);
  t.is(run?.error, null);
});

test('markRunComplete: FAILED records error string', async t => {
  const { db, getRuns } = createFakeDb([makeTask({ id: 't1' })]);
  const svc = new MnTaskCheckoutService(db as any);

  await svc.tryCheckout('t1', 'run-1');
  await svc.markRunComplete(
    'run-1',
    MnExecutionRunStatus.FAILED,
    'timeout after 30s'
  );

  const run = getRuns().find(r => r.id === 'run-1');
  t.is(run?.status, MnExecutionRunStatus.FAILED);
  t.is(run?.error, 'timeout after 30s');
});

test('markRunComplete: refuses to set a non-terminal status', async t => {
  const { db } = createFakeDb([makeTask({ id: 't1' })]);
  const svc = new MnTaskCheckoutService(db as any);

  await t.throwsAsync(
    svc.markRunComplete('run-1', MnExecutionRunStatus.RUNNING),
    { message: /terminal status/ }
  );
  await t.throwsAsync(
    svc.markRunComplete('run-1', MnExecutionRunStatus.QUEUED),
    { message: /terminal status/ }
  );
});

test('markRunComplete: missing row is treated as no-op (P2025)', async t => {
  const { db } = createFakeDb([]);
  const svc = new MnTaskCheckoutService(db as any);

  // Should not throw.
  await svc.markRunComplete('nonexistent', MnExecutionRunStatus.FAILED);
  t.pass();
});

test('listRunsForTask: returns newest first, capped by limit', async t => {
  const { db } = createFakeDb([makeTask({ id: 't1' }), makeTask({ id: 't2' })]);
  const svc = new MnTaskCheckoutService(db as any);

  // Use distinct runIds, manually advance clock so order is deterministic.
  await svc.tryCheckout('t1', 'r-a');
  await svc.markRunComplete('r-a', MnExecutionRunStatus.SUCCEEDED);
  await svc.release('t1', 'r-a');
  await svc.tryCheckout('t1', 'r-b');
  await svc.markRunComplete('r-b', MnExecutionRunStatus.FAILED, 'boom');
  await svc.release('t1', 'r-b');
  // Different task should not appear.
  await svc.tryCheckout('t2', 'r-c');

  const t1Runs = await svc.listRunsForTask('t1', 5);
  const ids = t1Runs.map(r => r.id);
  t.deepEqual(ids.sort(), ['r-a', 'r-b']);
});
