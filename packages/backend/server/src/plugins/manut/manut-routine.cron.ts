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
    // Keyset paginate by id so every active routine gets evaluated per
    // tick — a fixed `take:` with `orderBy: createdAt` would starve any
    // routine whose creation order is past the cap (Codex P1 on PR #73).
    // Each `tickOne` is O(ms) when the routine isn't due, so walking
    // even ~10k rows per minute stays well under the cron interval.
    let cursor: string | undefined;
    for (;;) {
      const batch = await this.db.mnRoutine.findMany({
        where: {
          status: MnRoutineStatus.ACTIVE,
          cronSchedule: { not: null },
          ...(cursor ? { id: { gt: cursor } } : {}),
        },
        orderBy: { id: 'asc' },
        take: ROUTINE_SCAN_BATCH_SIZE,
      });
      if (batch.length === 0) break;

      for (const routine of batch) {
        await this.tickOne(routine, now).catch(err => {
          // Per-routine errors must not poison the rest of the batch.
          this.logger.error(
            `routine ${routine.id} tick failed: ${err instanceof Error ? err.message : String(err)}`
          );
        });
      }

      if (batch.length < ROUTINE_SCAN_BATCH_SIZE) break;
      cursor = batch[batch.length - 1].id;
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

    // Atomic claim + run-row create inside one transaction (Codex P2
    // on PR #73). Race-safe across replicas: only the first
    // updateMany to commit will see lastRunAt equal to the threshold
    // value; subsequent ones see the new value and the predicate
    // returns count=0, so the run row never gets created twice.
    //
    // Why a transaction: if we advanced lastRunAt first and the run
    // row create then failed (transient DB outage), the next tick
    // would treat the fire as completed and silently skip it. Bundling
    // both writes means either both happen or neither does — no
    // "phantom-completed" routine.
    //
    // Enqueue to BullMQ happens AFTER the transaction. If enqueue
    // fails (Redis hiccup), the QUEUED MnRoutineRun row already
    // exists and serves as a recovery breadcrumb: an operator can
    // re-enqueue it manually, and PR 4 will add a startup sweep for
    // orphaned QUEUED rows. The alternative — rolling back the
    // transaction on enqueue failure — risks a tight retry loop if
    // Redis is flapping.
    const run = await this.db.$transaction(async tx => {
      const claim = await tx.mnRoutine.updateMany({
        where: {
          id: routine.id,
          status: MnRoutineStatus.ACTIVE,
          // Match either side of the null / non-null cleavage
          // explicitly — Prisma `updateMany` with an `OR` over null
          // is the canonical way to express "lastRunAt is what we
          // observed".
          OR: [
            { lastRunAt: routine.lastRunAt },
            ...(routine.lastRunAt === null
              ? []
              : [{ lastRunAt: { lt: prevExpected } }]),
          ],
        },
        data: { lastRunAt: prevExpected },
      });
      if (claim.count !== 1) return null;
      return tx.mnRoutineRun.create({
        data: {
          routineId: routine.id,
          triggeredBy: null, // null = system scheduler, not a human
          triggerType: MnRoutineRunTrigger.SCHEDULED,
          status: MnRoutineRunStatus.QUEUED,
        },
      });
    });
    if (!run) return;

    // Enqueue the executor. Deterministic jobId (run.id) so BullMQ
    // retries from the consumer side won't double-fire. If this call
    // throws (Redis transient), the run row stays QUEUED and is
    // visible to operators / the PR 4 sweep — we surface the error
    // to the per-routine catch in runOnce rather than swallowing.
    await this.queue.add(
      'superflow.executeRoutine',
      { routineId: routine.id, runId: run.id },
      { jobId: `manut-execute-routine-${run.id}` }
    );
  }
}
