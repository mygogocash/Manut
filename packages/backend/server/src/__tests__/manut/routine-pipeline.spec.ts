import {
  MnRoutineRunStatus,
  MnRoutineRunTrigger,
  MnRoutineStatus,
} from '@prisma/client';
import test from 'ava';

import { MnRoutineCron } from '../../plugins/manut/manut-routine.cron';
import { MnRoutineJob } from '../../plugins/manut/manut-routine.job';

// Mirrors `reminder-pipeline.spec.ts` — plain ava + hand-rolled mocks.
// No NestJS TestingModule, no real Prisma, no real BullMQ. Each test
// instantiates the class under test directly and asserts on captured
// mock interactions.

function makeRoutine(overrides: Record<string, unknown> = {}) {
  return {
    id: 'routine-1',
    workspaceId: 'workspace-1',
    ownerId: 'owner-1',
    cronSchedule: '*/2 * * * *', // every 2 minutes
    timezone: null,
    lastRunAt: null as Date | null,
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
    status: MnRoutineStatus.ACTIVE,
    ...overrides,
  };
}

/**
 * Build a Prisma-shaped mock with cursor-aware `findMany` and an
 * identity `$transaction` (callback runs against the same mock,
 * synchronously enough that tests can assert on intermediate state).
 *
 * `findManyImpl` receives the raw `findMany` args (so tests can
 * inspect the cursor + filter) and returns the rows for that page.
 * To simulate "all routines fit in one page" pass a function that
 * returns the rows on first call, `[]` on subsequent calls.
 */
function makeDb(parts: {
  findManyImpl: (args: any) => unknown[];
  updateManyImpl?: (args: any) => { count: number };
  runCreateImpl?: (args: any) => any;
}) {
  const mnRoutine = {
    findMany: async (args: any) => parts.findManyImpl(args),
    updateMany: async (args: any) =>
      parts.updateManyImpl ? parts.updateManyImpl(args) : { count: 1 },
  };
  const mnRoutineRun = {
    create: async (args: any) =>
      parts.runCreateImpl
        ? parts.runCreateImpl(args)
        : { id: 'run-default', ...args.data },
  };
  return {
    mnRoutine,
    mnRoutineRun,
    $transaction: async (cb: (tx: any) => Promise<any>) =>
      cb({ mnRoutine, mnRoutineRun }),
  };
}

/** One-page findMany helper: returns the given rows on first call, [] after. */
function singlePage(rows: unknown[]) {
  let served = false;
  return (_args: any) => {
    if (served) return [];
    served = true;
    return rows;
  };
}

test('cron fires routine whose previous expected time is after lastRunAt', async t => {
  const routine = makeRoutine({
    cronSchedule: '*/2 * * * *',
    lastRunAt: new Date('2026-05-09T00:00:00.000Z'),
  });
  // now = 00:04:30, prev = 00:04:00 (2-minute cron). Threshold is
  // lastRunAt=00:00:00 → claim should succeed.
  const now = new Date('2026-05-09T00:04:30.000Z');

  const queued: unknown[][] = [];
  const created: any[] = [];

  const db = makeDb({
    findManyImpl: singlePage([routine]),
    updateManyImpl: (args: any) => {
      t.is(args.data.lastRunAt.toISOString(), '2026-05-09T00:04:00.000Z');
      return { count: 1 };
    },
    runCreateImpl: (args: any) => {
      created.push(args);
      return { id: 'run-1', ...args.data };
    },
  });
  const queue = {
    add: async (...args: unknown[]) => {
      queued.push(args);
    },
  };

  const cron = new MnRoutineCron(db as any, queue as any);
  await cron.runOnce(now);

  t.is(created.length, 1, 'one run row created');
  t.like(created[0].data, {
    routineId: routine.id,
    triggeredBy: null,
    triggerType: MnRoutineRunTrigger.SCHEDULED,
    status: MnRoutineRunStatus.QUEUED,
  });
  t.deepEqual(queued, [
    [
      'superflow.executeRoutine',
      { routineId: routine.id, runId: 'run-1' },
      { jobId: 'manut-execute-routine-run-1' },
    ],
  ]);
});

test('cron skips routine when prevExpected is not after lastRunAt', async t => {
  // lastRunAt is exactly at the prev expected fire → no work owed.
  const routine = makeRoutine({
    cronSchedule: '*/2 * * * *',
    lastRunAt: new Date('2026-05-09T00:04:00.000Z'),
  });
  const now = new Date('2026-05-09T00:04:30.000Z');

  const db = makeDb({
    findManyImpl: singlePage([routine]),
    updateManyImpl: () => t.fail('should not claim') as never,
    runCreateImpl: () => t.fail('should not create run') as never,
  });
  const queue = {
    add: async () => t.fail('should not enqueue') as never,
  };

  const cron = new MnRoutineCron(db as any, queue as any);
  await cron.runOnce(now);
  t.pass();
});

test('cron uses createdAt as initial threshold when lastRunAt is null', async t => {
  // First-ever fire for a brand-new routine. createdAt is well before
  // the previous expected fire → first tick should claim.
  const routine = makeRoutine({
    cronSchedule: '*/2 * * * *',
    lastRunAt: null,
    createdAt: new Date('2026-05-09T00:00:00.000Z'),
  });
  const now = new Date('2026-05-09T00:03:30.000Z');

  const queued: unknown[][] = [];
  const db = makeDb({
    findManyImpl: singlePage([routine]),
    updateManyImpl: () => ({ count: 1 }),
    runCreateImpl: (args: any) => ({ id: 'run-new', ...args.data }),
  });
  const queue = {
    add: async (...args: unknown[]) => {
      queued.push(args);
    },
  };

  const cron = new MnRoutineCron(db as any, queue as any);
  await cron.runOnce(now);

  t.is(queued.length, 1);
  t.deepEqual(queued[0][1], {
    routineId: routine.id,
    runId: 'run-new',
  });
});

test('cron yields silently when another replica claimed the routine first', async t => {
  const routine = makeRoutine({
    cronSchedule: '*/2 * * * *',
    lastRunAt: new Date('2026-05-09T00:00:00.000Z'),
  });
  const now = new Date('2026-05-09T00:04:30.000Z');

  const db = makeDb({
    findManyImpl: singlePage([routine]),
    // Simulate another replica beating us — updateMany returns 0,
    // transaction returns null, no run row created.
    updateManyImpl: () => ({ count: 0 }),
    runCreateImpl: () =>
      t.fail('should not create run after lost claim') as never,
  });
  const queue = {
    add: async () => t.fail('should not enqueue after lost claim') as never,
  };

  const cron = new MnRoutineCron(db as any, queue as any);
  await cron.runOnce(now);
  t.pass();
});

test('cron logs and skips routines with unparseable cron expressions', async t => {
  // Defense-in-depth: even though isValidCronGrammar gates create/update,
  // a corrupt row mustn't poison the whole batch.
  const bad = makeRoutine({ id: 'bad', cronSchedule: 'this is not cron' });
  const good = makeRoutine({
    id: 'good',
    cronSchedule: '*/2 * * * *',
    lastRunAt: new Date('2026-05-09T00:00:00.000Z'),
  });
  const now = new Date('2026-05-09T00:04:30.000Z');

  const queued: unknown[][] = [];
  const db = makeDb({
    findManyImpl: singlePage([bad, good]),
    updateManyImpl: (args: any) => {
      t.is(args.where.id, 'good', 'only good routine should be claimed');
      return { count: 1 };
    },
    runCreateImpl: (args: any) => ({ id: 'run-good', ...args.data }),
  });
  const queue = {
    add: async (...args: unknown[]) => {
      queued.push(args);
    },
  };

  const cron = new MnRoutineCron(db as any, queue as any);
  await cron.runOnce(now);

  t.is(queued.length, 1, 'good routine still fires when sibling has bad cron');
});

test('cron respects timezone when computing prev fire time', async t => {
  // Cron "0 9 * * MON-FRI" in Asia/Bangkok (UTC+7). 09:00 ICT = 02:00 UTC.
  // now = 03:00 UTC Monday → prev expected = 02:00 UTC (today's 09:00 ICT).
  const routine = makeRoutine({
    cronSchedule: '0 9 * * MON-FRI',
    timezone: 'Asia/Bangkok',
    lastRunAt: new Date('2026-05-08T02:00:00.000Z'), // Friday's fire
    createdAt: new Date('2026-05-01T00:00:00.000Z'),
  });
  // 2026-05-11 is a Monday.
  const now = new Date('2026-05-11T03:00:00.000Z');

  const db = makeDb({
    findManyImpl: singlePage([routine]),
    updateManyImpl: (args: any) => {
      t.is(
        args.data.lastRunAt.toISOString(),
        '2026-05-11T02:00:00.000Z',
        'prev should be Monday 02:00 UTC = 09:00 ICT'
      );
      return { count: 1 };
    },
    runCreateImpl: (args: any) => ({ id: 'run-tz', ...args.data }),
  });
  const queue = { add: async () => {} };

  const cron = new MnRoutineCron(db as any, queue as any);
  await cron.runOnce(now);
  t.pass();
});

test('cron handles empty batch without throwing', async t => {
  const db = makeDb({
    findManyImpl: () => [],
    runCreateImpl: () => t.fail('should not create') as never,
  });
  const queue = { add: async () => t.fail('should not enqueue') as never };

  const cron = new MnRoutineCron(db as any, queue as any);
  await cron.runOnce(new Date());
  t.pass();
});

// --- Regression coverage for Codex review on PR #73 ---

test('cron paginates across multiple batches (P1: no routine starvation)', async t => {
  // 250 active routines, batch size is 100. Without keyset pagination
  // the scanner would only ever see the first 100; with pagination,
  // all 250 are evaluated per tick.
  const now = new Date('2026-05-09T00:04:30.000Z');
  const routines = Array.from({ length: 250 }, (_, i) =>
    makeRoutine({
      id: `routine-${String(i).padStart(4, '0')}`,
      cronSchedule: '*/2 * * * *',
      lastRunAt: new Date('2026-05-09T00:00:00.000Z'),
    })
  );

  // Track the cursor we receive on each findMany call so we can serve
  // batches in id order. The implementation must pass `id: { gt:
  // <last cursor> }` on subsequent calls.
  const findManyCalls: any[] = [];
  const cursorSeen: (string | undefined)[] = [];
  const seenIds = new Set<string>();
  let runIdCounter = 0;

  const db = makeDb({
    findManyImpl: (args: any) => {
      findManyCalls.push(args);
      const after = args.where?.id?.gt as string | undefined;
      cursorSeen.push(after);
      const start = after ? routines.findIndex(r => r.id > after) : 0;
      if (start < 0) return [];
      return routines.slice(start, start + 100);
    },
    updateManyImpl: (args: any) => {
      // Track which routine ids actually reached the claim step.
      seenIds.add(args.where.id);
      return { count: 1 };
    },
    runCreateImpl: () => ({ id: `run-${runIdCounter++}` }),
  });
  const queue = { add: async () => {} };

  const cron = new MnRoutineCron(db as any, queue as any);
  await cron.runOnce(now);

  t.is(
    findManyCalls.length,
    3,
    'three pages: 100 + 100 + 50 (with one final empty check skipped because <BATCH)'
  );
  t.is(cursorSeen[0], undefined, 'first page has no cursor');
  t.is(cursorSeen[1], 'routine-0099', 'second page cursors past first batch');
  t.is(cursorSeen[2], 'routine-0199', 'third page cursors past second batch');
  t.is(seenIds.size, 250, 'all 250 routines reached the claim step');
});

test('cron P2: enqueue failure leaves a QUEUED run row visible for recovery', async t => {
  // The transaction has already committed (claim + run create). If
  // queue.add then throws (Redis hiccup), the QUEUED MnRoutineRun row
  // must still exist — the per-routine catch in runOnce should log
  // the error but NOT delete the row. PR 4's startup sweep picks it up.
  const routine = makeRoutine({
    cronSchedule: '*/2 * * * *',
    lastRunAt: new Date('2026-05-09T00:00:00.000Z'),
  });
  const now = new Date('2026-05-09T00:04:30.000Z');

  let lastRunAtAdvanced = false;
  const createdRuns: any[] = [];
  const db = makeDb({
    findManyImpl: singlePage([routine]),
    updateManyImpl: (args: any) => {
      t.is(args.data.lastRunAt.toISOString(), '2026-05-09T00:04:00.000Z');
      lastRunAtAdvanced = true;
      return { count: 1 };
    },
    runCreateImpl: (args: any) => {
      createdRuns.push(args);
      return { id: 'run-orphan', ...args.data };
    },
  });
  const queue = {
    add: async () => {
      throw new Error('redis transient: ECONNRESET');
    },
  };

  const cron = new MnRoutineCron(db as any, queue as any);
  // The per-routine catch in runOnce must absorb the throw — runOnce
  // itself resolves cleanly.
  await cron.runOnce(now);

  t.true(lastRunAtAdvanced, 'lastRunAt was advanced inside the txn');
  t.is(createdRuns.length, 1, 'QUEUED run row was created and persists');
  t.like(createdRuns[0].data, {
    routineId: routine.id,
    status: MnRoutineRunStatus.QUEUED,
    triggerType: MnRoutineRunTrigger.SCHEDULED,
  });
});

// --- Job consumer tests ---

test('job consumer marks queued run as SUCCEEDED with PR 4 stub output', async t => {
  const queuedRun = {
    id: 'run-1',
    routineId: 'routine-1',
    status: MnRoutineRunStatus.QUEUED,
  };
  let updatedWith: any = null;

  const db = {
    mnRoutineRun: {
      findUnique: async (args: any) => {
        t.deepEqual(args, { where: { id: 'run-1' } });
        return queuedRun;
      },
      update: async (args: any) => {
        updatedWith = args;
        return args.data;
      },
    },
  };

  const job = new MnRoutineJob(db as any);
  await job.executeRoutine({ routineId: 'routine-1', runId: 'run-1' });

  t.truthy(updatedWith, 'job must update the run');
  t.is(updatedWith.where.id, 'run-1');
  t.is(updatedWith.where.status, MnRoutineRunStatus.QUEUED, 'optimistic where');
  t.is(updatedWith.data.status, MnRoutineRunStatus.SUCCESS);
  t.is(updatedWith.data.durationMs, 0);
  t.regex(
    updatedWith.data.output as string,
    /PR 4/,
    'output references the next-PR runner'
  );
  t.truthy(updatedWith.data.startedAt);
  t.truthy(updatedWith.data.finishedAt);
});

test('job consumer is idempotent: skips run that is no longer QUEUED', async t => {
  const db = {
    mnRoutineRun: {
      findUnique: async () => ({
        id: 'run-1',
        routineId: 'routine-1',
        status: MnRoutineRunStatus.SUCCESS, // already done
      }),
      update: async () => t.fail('should not update terminal run') as never,
    },
  };

  const job = new MnRoutineJob(db as any);
  await job.executeRoutine({ routineId: 'routine-1', runId: 'run-1' });
  t.pass();
});

test('job consumer logs and exits cleanly when run is missing', async t => {
  const db = {
    mnRoutineRun: {
      findUnique: async () => null,
      update: async () => t.fail('should not update missing run') as never,
    },
  };

  const job = new MnRoutineJob(db as any);
  await job.executeRoutine({ routineId: 'routine-1', runId: 'gone' });
  t.pass();
});
