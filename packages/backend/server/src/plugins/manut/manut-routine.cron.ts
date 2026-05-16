import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  MnRoutineRunStatus,
  MnRoutineRunTrigger,
  MnRoutineStatus,
  PrismaClient,
} from '@prisma/client';
// cron-parser is CJS only; ESM consumers must use the default import
// and reach `parseExpression` through it. A named import (`import {
// parseExpression } from 'cron-parser'`) compiles but throws at
// runtime because Node's ESM<->CJS bridge does not synthesize named
// exports for CommonJS modules in this case.
import cronParser from 'cron-parser';

import { JobQueue } from '../../base';

const ROUTINE_SCAN_BATCH_SIZE = 100;

/**
 * Scheduler for Manut Routines (PR 2 of the Routines feature).
 *
 * Mirrors the `MnReminderCron` pattern exactly: every minute, scan the
 * DB for active routines whose cron schedule wants to fire, atomically
 * claim them via `lastRunAt`, and enqueue a one-off BullMQ job per
 * fire. We do NOT use BullMQ repeatable jobs — the DB row is the
 * source of truth, so pause / resume / delete / cron-edit just become
 * column changes the scanner picks up on the next tick. No external
 * scheduler key to keep in sync.
 *
 * PR 2 stops at enqueueing. The actual Vertex execution lives in the
 * consumer (`MnRoutineJob`) and is intentionally a no-op stub until
 * PR 4 replaces its body with the real runner.
 */
@Injectable()
export class MnRoutineCron {
  private readonly logger = new Logger(MnRoutineCron.name);

  constructor(
    private readonly db: PrismaClient,
    private readonly queue: JobQueue
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async enqueueDueRoutines() {
    // Gated on both the parent module flag (manut) and the routine
    // sub-flag — keeps the scheduler dormant on installs that haven't
    // opted into routines yet.
    const moduleEnabled =
      process.env.ENABLE_MANUT_MODULE ?? process.env.ENABLE_SUPERFLOW_MODULE;
    if (moduleEnabled !== 'true') return;
    if (process.env.ENABLE_MANUT_ROUTINES !== 'true') return;

    await this.runOnce();
  }

  async runOnce(now = new Date()): Promise<void> {
    const routines = await this.db.mnRoutine.findMany({
      where: {
        status: MnRoutineStatus.ACTIVE,
        cronSchedule: { not: null },
      },
      orderBy: { createdAt: 'asc' },
      take: ROUTINE_SCAN_BATCH_SIZE,
    });

    for (const routine of routines) {
      await this.tickOne(routine, now).catch(err => {
        // Per-routine errors must not poison the whole batch.
        this.logger.error(
          `routine ${routine.id} tick failed: ${err instanceof Error ? err.message : String(err)}`
        );
      });
    }
  }

  /**
   * Evaluate a single routine. Visible for unit tests.
   *
   * Algorithm: parse the cron expression, find the most recent
   * expected fire time at or before `now` ("prevExpected"). If
   * `prevExpected` is strictly later than the routine's `lastRunAt`
   * (or `createdAt` if never fired), claim it via an atomic
   * `updateMany` predicated on the old `lastRunAt`. If the claim
   * succeeds, create a SCHEDULED `MnRoutineRun` and enqueue one
   * BullMQ job per claim. If the claim returns count=0, another
   * replica beat us — skip silently.
   */
  async tickOne(
    routine: {
      id: string;
      workspaceId: string;
      ownerId: string;
      cronSchedule: string | null;
      timezone: string | null;
      lastRunAt: Date | null;
      createdAt: Date;
    },
    now: Date
  ): Promise<void> {
    if (!routine.cronSchedule) return;

    // Cron-parser throws on invalid expressions. The grammar is
    // pre-validated at create/update time (manut-routine.service.ts
    // `isValidCronGrammar`), so this is defense-in-depth; if it
    // throws here something else went wrong and we log+skip rather
    // than crash the whole scan loop.
    let prevExpected: Date;
    try {
      const it = cronParser.parseExpression(routine.cronSchedule, {
        currentDate: now,
        tz: routine.timezone ?? undefined,
      });
      prevExpected = it.prev().toDate();
    } catch (err) {
      this.logger.warn(
        `routine ${routine.id} has unparseable cron "${routine.cronSchedule}": ${err instanceof Error ? err.message : String(err)}`
      );
      return;
    }

    // Threshold for "is this fire still owed?": anything strictly
    // after our most recent recorded fire (or creation, if first).
    // This protects against double-firing on missed ticks on restart.
    const threshold = routine.lastRunAt ?? routine.createdAt;
    if (prevExpected <= threshold) return;

    // Atomic claim. Race-safe across replicas: only the first
    // updateMany to commit will see lastRunAt equal to the threshold
    // value; subsequent ones will see the new value and updateMany
    // returns count=0.
    const claim = await this.db.mnRoutine.updateMany({
      where: {
        id: routine.id,
        status: MnRoutineStatus.ACTIVE,
        // Match either side of the null / non-null cleavage explicitly
        // — Prisma `updateMany` with an `OR` over null is the
        // canonical way to express "lastRunAt is what we observed".
        OR: [
          { lastRunAt: routine.lastRunAt },
          ...(routine.lastRunAt === null
            ? []
            : [{ lastRunAt: { lt: prevExpected } }]),
        ],
      },
      data: { lastRunAt: prevExpected },
    });
    if (claim.count !== 1) return;

    // Record the run + enqueue the executor. Deterministic jobId
    // (run.id) so retries from BullMQ won't double-fire even if the
    // consumer crashes.
    const run = await this.db.mnRoutineRun.create({
      data: {
        routineId: routine.id,
        triggeredBy: null, // null = system scheduler, not a human
        triggerType: MnRoutineRunTrigger.SCHEDULED,
        status: MnRoutineRunStatus.QUEUED,
      },
    });

    await this.queue.add(
      'superflow.executeRoutine',
      { routineId: routine.id, runId: run.id },
      { jobId: `manut-execute-routine-${run.id}` }
    );
  }
}
