/**
 * M7 — Watchdog cron tests.
 *
 * The watchdog scans RUNNING MnExecutionRun rows older than the
 * heartbeat threshold (2 min). For each, if the owning agent has not
 * heartbeat'd in the same window, we mark the run FAILED and clear
 * the task lock. The tests below drive the cron via `runOnce(now)`
 * with an explicit clock fixture.
 *
 * Idempotency is part of the contract — a second tick on unchanged
 * data must leave the world alone.
 */

import { MnExecutionRunStatus } from '@prisma/client';
import test from 'ava';

import { MnTaskCheckoutService } from '../../plugins/manut/manut-task-checkout.service';
import { MnTaskWatchdogCron } from '../../plugins/manut/manut-task-watchdog.cron';

interface FakeTask {
  id: string;
  executionRunId: string | null;
  executionLockedAt: Date | null;
}

interface FakeRun {
  id: string;
  taskId: string;
  agentId: string | null;
  status: MnExecutionRunStatus;
  startedAt: Date;
  finishedAt: Date | null;
  error: string | null;
}

interface FakeHeartbeat {
  id: string;
  agentId: string;
  startedAt: Date;
}

function createFakeDb(args: {
  tasks: FakeTask[];
  runs: FakeRun[];
  heartbeats?: FakeHeartbeat[];
  clock?: { now(): Date };
}) {
  const tasks = new Map<string, FakeTask>(
    args.tasks.map(t => [t.id, { ...t }])
  );
  const runs: FakeRun[] = args.runs.map(r => ({ ...r }));
  const heartbeats: FakeHeartbeat[] = (args.heartbeats ?? []).map(h => ({
    ...h,
  }));
  const activityLog: Array<{
    taskId: string;
    action: string;
    metadata: Record<string, unknown>;
  }> = [];
  const now = () => (args.clock ? args.clock.now() : new Date());

  const db = {
    $queryRaw: async (
      _strings: TemplateStringsArray,
      ...values: unknown[]
    ): Promise<FakeTask[]> => {
      // Only used by tryCheckout, not by the watchdog. But the
      // checkout service is used (via release) so we keep the
      // surface compatible.
      const [, taskId] = values as [string, string];
      const t = tasks.get(taskId);
      return t ? [{ ...t } as FakeTask] : [];
    },
    $executeRaw: async (
      _strings: TemplateStringsArray,
      ...values: unknown[]
    ): Promise<number> => {
      const [taskId, runId] = values as [string, string];
      const t = tasks.get(taskId);
      if (!t || t.executionRunId !== runId) return 0;
      tasks.set(taskId, {
        ...t,
        executionRunId: null,
        executionLockedAt: null,
      });
      return 1;
    },
    mnExecutionRun: {
      create: async ({ data }: { data: FakeRun }) => {
        runs.push({
          ...data,
          startedAt: data.startedAt ?? now(),
          finishedAt: data.finishedAt ?? null,
          error: data.error ?? null,
        });
        return data;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: string };
        data: Partial<FakeRun>;
      }) => {
        const idx = runs.findIndex(r => r.id === where.id);
        if (idx < 0) {
          const err: Error & { code?: string } = new Error('not found');
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
        where: {
          status: MnExecutionRunStatus;
          startedAt: { lt: Date };
        };
        orderBy?: { startedAt?: 'asc' | 'desc' };
        take?: number;
      }) => {
        let rows = runs.filter(
          r =>
            r.status === where.status &&
            r.startedAt.getTime() < where.startedAt.lt.getTime()
        );
        rows.sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
        return rows.slice(0, take ?? rows.length);
      },
    },
    mnHeartbeatRun: {
      findFirst: async ({
        where,
      }: {
        where: { agentId: string; startedAt: { gte: Date } };
      }) => {
        return (
          heartbeats.find(
            h =>
              h.agentId === where.agentId &&
              h.startedAt.getTime() >= where.startedAt.gte.getTime()
          ) ?? null
        );
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
        activityLog.push({ ...data });
        return { id: 'act_' + activityLog.length, ...data };
      },
    },
  };

  return {
    db,
    getTask: (id: string) => tasks.get(id),
    getRuns: () => runs.slice(),
    getActivity: () => activityLog.slice(),
    addHeartbeat: (h: FakeHeartbeat) => heartbeats.push(h),
  };
}

function buildCron(db: ReturnType<typeof createFakeDb>['db']): {
  cron: MnTaskWatchdogCron;
  checkout: MnTaskCheckoutService;
} {
  const checkout = new MnTaskCheckoutService(db as any);
  const cron = new MnTaskWatchdogCron(db as any, checkout);
  return { cron, checkout };
}

// ---------------------------------------------------------------------------
// Happy path: stale RUNNING run with no heartbeat → cleared
// ---------------------------------------------------------------------------

test('watchdog clears stale-locked run (>2 min, no heartbeat)', async t => {
  const fixedNow = new Date('2026-05-18T10:00:00.000Z');
  const { db, getTask, getRuns, getActivity } = createFakeDb({
    tasks: [
      {
        id: 'task-a',
        executionRunId: 'run-stale',
        executionLockedAt: new Date('2026-05-18T09:55:00.000Z'),
      },
    ],
    runs: [
      {
        id: 'run-stale',
        taskId: 'task-a',
        agentId: 'agent-1',
        status: MnExecutionRunStatus.RUNNING,
        startedAt: new Date('2026-05-18T09:55:00.000Z'), // 5 min ago
        finishedAt: null,
        error: null,
      },
    ],
    clock: { now: () => fixedNow },
  });
  const { cron } = buildCron(db);

  const result = await cron.runOnce(fixedNow);

  t.is(result.inspected, 1);
  t.is(result.cleared, 1);
  t.is(result.errors, 0);

  const run = getRuns().find(r => r.id === 'run-stale')!;
  t.is(run.status, MnExecutionRunStatus.FAILED);
  t.is(run.error, 'watchdog: stale execution');
  t.truthy(run.finishedAt);

  const task = getTask('task-a')!;
  t.is(task.executionRunId, null, 'task lock must be cleared');

  const log = getActivity();
  t.is(log.length, 1);
  t.is(log[0].action, 'recovery_lock_cleared');
  t.is(log[0].taskId, 'task-a');
  t.is(log[0].metadata.runId, 'run-stale');
});

// ---------------------------------------------------------------------------
// Active run with recent heartbeat → NOT cleared
// ---------------------------------------------------------------------------

test('watchdog skips run when owning agent has a recent heartbeat', async t => {
  const fixedNow = new Date('2026-05-18T10:00:00.000Z');
  const { db, getRuns, getActivity } = createFakeDb({
    tasks: [
      {
        id: 'task-live',
        executionRunId: 'run-live',
        executionLockedAt: new Date('2026-05-18T09:55:00.000Z'),
      },
    ],
    runs: [
      {
        id: 'run-live',
        taskId: 'task-live',
        agentId: 'agent-live',
        status: MnExecutionRunStatus.RUNNING,
        startedAt: new Date('2026-05-18T09:55:00.000Z'), // 5 min ago
        finishedAt: null,
        error: null,
      },
    ],
    heartbeats: [
      {
        id: 'hb-1',
        agentId: 'agent-live',
        startedAt: new Date('2026-05-18T09:59:30.000Z'), // 30s ago
      },
    ],
    clock: { now: () => fixedNow },
  });
  const { cron } = buildCron(db);

  const result = await cron.runOnce(fixedNow);

  t.is(result.inspected, 1, 'run was inspected');
  t.is(result.cleared, 0, 'live heartbeat must prevent clearing');

  const run = getRuns().find(r => r.id === 'run-live')!;
  t.is(run.status, MnExecutionRunStatus.RUNNING, 'still RUNNING');
  t.is(run.finishedAt, null);
  t.deepEqual(getActivity(), [], 'no recovery activity row');
});

// ---------------------------------------------------------------------------
// Idempotency: second tick is a no-op
// ---------------------------------------------------------------------------

test('watchdog is idempotent: re-running on unchanged data is a no-op', async t => {
  let nowFixture = new Date('2026-05-18T10:00:00.000Z');
  const { db, getRuns, getActivity } = createFakeDb({
    tasks: [
      {
        id: 'task-id',
        executionRunId: 'run-stale-id',
        executionLockedAt: new Date('2026-05-18T09:55:00.000Z'),
      },
    ],
    runs: [
      {
        id: 'run-stale-id',
        taskId: 'task-id',
        agentId: null, // No agent → no heartbeat lookup, straight to FAIL
        status: MnExecutionRunStatus.RUNNING,
        startedAt: new Date('2026-05-18T09:55:00.000Z'),
        finishedAt: null,
        error: null,
      },
    ],
    clock: { now: () => nowFixture },
  });
  const { cron } = buildCron(db);

  const first = await cron.runOnce(nowFixture);
  t.is(first.cleared, 1);
  t.is(getRuns()[0].status, MnExecutionRunStatus.FAILED);

  // Tick again — the run is now FAILED so it shouldn't be inspected.
  nowFixture = new Date('2026-05-18T10:01:00.000Z');
  const second = await cron.runOnce(nowFixture);
  t.is(second.inspected, 0, 'no RUNNING rows left to inspect');
  t.is(second.cleared, 0);

  // Activity log should still have exactly the one recovery row.
  t.is(getActivity().length, 1);
});

// ---------------------------------------------------------------------------
// Run with no agentId still gets cleared (no heartbeat to check)
// ---------------------------------------------------------------------------

test('watchdog clears stale run with no agentId (no heartbeat to check)', async t => {
  const fixedNow = new Date('2026-05-18T10:00:00.000Z');
  const { db, getRuns } = createFakeDb({
    tasks: [
      {
        id: 'task-orph',
        executionRunId: 'run-orph',
        executionLockedAt: new Date('2026-05-18T09:55:00.000Z'),
      },
    ],
    runs: [
      {
        id: 'run-orph',
        taskId: 'task-orph',
        agentId: null,
        status: MnExecutionRunStatus.RUNNING,
        startedAt: new Date('2026-05-18T09:55:00.000Z'),
        finishedAt: null,
        error: null,
      },
    ],
    clock: { now: () => fixedNow },
  });
  const { cron } = buildCron(db);

  const result = await cron.runOnce(fixedNow);
  t.is(result.cleared, 1);
  t.is(getRuns()[0].status, MnExecutionRunStatus.FAILED);
});

// ---------------------------------------------------------------------------
// Recent RUNNING run (within 2 min) → not inspected
// ---------------------------------------------------------------------------

test('watchdog ignores RUNNING run started <2 min ago', async t => {
  const fixedNow = new Date('2026-05-18T10:00:00.000Z');
  const { db, getRuns } = createFakeDb({
    tasks: [
      {
        id: 'task-recent',
        executionRunId: 'run-recent',
        executionLockedAt: new Date('2026-05-18T09:59:30.000Z'),
      },
    ],
    runs: [
      {
        id: 'run-recent',
        taskId: 'task-recent',
        agentId: 'agent-x',
        status: MnExecutionRunStatus.RUNNING,
        startedAt: new Date('2026-05-18T09:59:30.000Z'), // 30s ago
        finishedAt: null,
        error: null,
      },
    ],
    clock: { now: () => fixedNow },
  });
  const { cron } = buildCron(db);

  const result = await cron.runOnce(fixedNow);
  t.is(result.inspected, 0, 'startedAt is within the threshold');
  t.is(getRuns()[0].status, MnExecutionRunStatus.RUNNING);
});

// ---------------------------------------------------------------------------
// Terminal runs are not touched
// ---------------------------------------------------------------------------

test('watchdog never touches SUCCEEDED or FAILED runs', async t => {
  const fixedNow = new Date('2026-05-18T10:00:00.000Z');
  const { db, getRuns } = createFakeDb({
    tasks: [
      { id: 't-ok', executionRunId: null, executionLockedAt: null },
      { id: 't-bad', executionRunId: null, executionLockedAt: null },
    ],
    runs: [
      {
        id: 'r-ok',
        taskId: 't-ok',
        agentId: 'a',
        status: MnExecutionRunStatus.SUCCEEDED,
        startedAt: new Date('2026-05-18T09:00:00.000Z'),
        finishedAt: new Date('2026-05-18T09:05:00.000Z'),
        error: null,
      },
      {
        id: 'r-bad',
        taskId: 't-bad',
        agentId: 'a',
        status: MnExecutionRunStatus.FAILED,
        startedAt: new Date('2026-05-18T09:10:00.000Z'),
        finishedAt: new Date('2026-05-18T09:11:00.000Z'),
        error: 'old error',
      },
    ],
    clock: { now: () => fixedNow },
  });
  const { cron } = buildCron(db);

  const result = await cron.runOnce(fixedNow);
  t.is(result.inspected, 0);
  t.is(
    getRuns().find(r => r.id === 'r-ok')!.status,
    MnExecutionRunStatus.SUCCEEDED
  );
  t.is(getRuns().find(r => r.id === 'r-bad')!.error, 'old error');
});
