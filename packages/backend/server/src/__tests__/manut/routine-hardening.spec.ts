import { MnRoutineVisibility } from '@prisma/client';
import test from 'ava';

import { ActionForbidden } from '../../base';
import { MnRoutineService } from '../../plugins/manut/manut-routine.service';

// Pentest hardening (post-Routines audit) — R1 prompt-size, R2
// schedule-storm. R3 (throttle on resolver mutations) lives in
// `@Throttle('default', { limit: 10 })` decorator metadata and is
// exercised by the generic nestjs throttler harness — not unit-tested
// here.
//
// The service constructor wants (db, ac). For these guard tests we
// never reach the DB layer: the validators throw before any Prisma
// call. Stub both deps with permissive mocks and assert on the
// thrown ActionForbidden.

function makeService() {
  const db: any = {
    mnRoutine: {
      create: async (args: any) => ({ id: 'r1', ...args.data }),
      update: async () => ({ id: 'r1' }),
      findUnique: async () => null,
      findMany: async () => [],
    },
    mnRoutineRun: {
      create: async () => ({ id: 'run-1' }),
      findMany: async () => [],
    },
    $transaction: async (cb: (tx: any) => Promise<unknown>) => cb(db),
  };
  // AccessController mock: chainable + `assert` resolves true. Personal
  // visibility skips the admin check, so Workspace.Read is the only
  // assertion the create path hits before our guards fire.
  const ac: any = {
    user: () => ({
      workspace: () => ({
        assert: async () => true,
      }),
    }),
  };
  return new MnRoutineService(db, ac);
}

test('create rejects prompt larger than 16 KB', async t => {
  const svc = makeService();
  const oversized = 'a'.repeat(16 * 1024 + 1); // 16385 bytes UTF-8
  await t.throwsAsync(
    () =>
      svc.create('user-1', 'ws-1', {
        name: 'Too big',
        prompt: oversized,
        visibility: MnRoutineVisibility.PERSONAL,
      }),
    { instanceOf: ActionForbidden }
  );
});

test('create accepts prompt at exactly 16 KB', async t => {
  const svc = makeService();
  const exact = 'a'.repeat(16 * 1024); // 16384 bytes UTF-8
  await t.notThrowsAsync(() =>
    svc.create('user-1', 'ws-1', {
      name: 'Just fits',
      prompt: exact,
      visibility: MnRoutineVisibility.PERSONAL,
    })
  );
});

test('create rejects cron firing every minute (interval < 5min)', async t => {
  const svc = makeService();
  await t.throwsAsync(
    () =>
      svc.create('user-1', 'ws-1', {
        name: 'DoS',
        prompt: 'hi',
        cronSchedule: '* * * * *', // every minute = 60s < 5min
        visibility: MnRoutineVisibility.PERSONAL,
      }),
    { instanceOf: ActionForbidden }
  );
});

test('create rejects 6-field cron firing every second', async t => {
  const svc = makeService();
  await t.throwsAsync(
    () =>
      svc.create('user-1', 'ws-1', {
        name: 'Big DoS',
        prompt: 'hi',
        cronSchedule: '* * * * * *', // every second
        visibility: MnRoutineVisibility.PERSONAL,
      }),
    { instanceOf: ActionForbidden }
  );
});

test('create accepts schedule firing exactly every 5 minutes', async t => {
  const svc = makeService();
  await t.notThrowsAsync(() =>
    svc.create('user-1', 'ws-1', {
      name: 'OK',
      prompt: 'hi',
      cronSchedule: '*/5 * * * *', // every 5 minutes — the boundary
      visibility: MnRoutineVisibility.PERSONAL,
    })
  );
});

test('create accepts schedule firing every hour', async t => {
  const svc = makeService();
  await t.notThrowsAsync(() =>
    svc.create('user-1', 'ws-1', {
      name: 'OK',
      prompt: 'hi',
      cronSchedule: '0 * * * *', // every hour
      visibility: MnRoutineVisibility.PERSONAL,
    })
  );
});
