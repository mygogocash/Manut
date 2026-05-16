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

  const db = {
    mnRoutine: {
      findMany: async () => [routine],
      updateMany: async (args: any) => {
        t.is(args.data.lastRunAt.toISOString(), '2026-05-09T00:04:00.000Z');
        return { count: 1 };
      },
    },
    mnRoutineRun: {
      create: async (args: any) => {
        created.push(args);
        return { id: 'run-1', ...args.data };
      },
    },
  };
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

  const db = {
    mnRoutine: {
      findMany: async () => [routine],
      updateMany: async () => t.fail('should not claim') as never,
    },
    mnRoutineRun: {
      create: async () => t.fail('should not create run') as never,
    },
  };
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
  const db = {
    mnRoutine: {
      findMany: async () => [routine],
      updateMany: async () => ({ count: 1 }),
    },
    mnRoutineRun: {
      create: async (args: any) => ({ id: 'run-new', ...args.data }),
    },
  };
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

  const db = {
    mnRoutine: {
      findMany: async () => [routine],
      // Simulate another replica beating us — updateMany returns 0.
      updateMany: async () => ({ count: 0 }),
    },
    mnRoutineRun: {
      create: async () =>
        t.fail('should not create run after lost claim') as never,
    },
  };
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
  const db = {
    mnRoutine: {
      findMany: async () => [bad, good],
      updateMany: async (args: any) => {
        t.is(args.where.id, 'good', 'only good routine should be claimed');
        return { count: 1 };
      },
    },
    mnRoutineRun: {
      create: async (args: any) => ({ id: 'run-good', ...args.data }),
    },
  };
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

  const db = {
    mnRoutine: {
      findMany: async () => [routine],
      updateMany: async (args: any) => {
        t.is(
          args.data.lastRunAt.toISOString(),
          '2026-05-11T02:00:00.000Z',
          'prev should be Monday 02:00 UTC = 09:00 ICT'
        );
        return { count: 1 };
      },
    },
    mnRoutineRun: {
      create: async (args: any) => ({ id: 'run-tz', ...args.data }),
    },
  };
  const queue = {
    add: async () => {},
  };

  const cron = new MnRoutineCron(db as any, queue as any);
  await cron.runOnce(now);
  t.pass();
});

test('cron handles empty batch without throwing', async t => {
  const db = {
    mnRoutine: { findMany: async () => [] },
    mnRoutineRun: {
      create: async () => t.fail('should not create') as never,
    },
  };
  const queue = { add: async () => t.fail('should not enqueue') as never };

  const cron = new MnRoutineCron(db as any, queue as any);
  await cron.runOnce(new Date());
  t.pass();
});

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
