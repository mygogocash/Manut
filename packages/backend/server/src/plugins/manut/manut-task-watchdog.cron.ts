import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { MnExecutionRunStatus, PrismaClient } from '@prisma/client';

import { MnTaskCheckoutService } from './manut-task-checkout.service';

/**
 * Local copy of the env-gate from `manut.module.ts` to avoid pulling
 * the entire ManutModule import graph into the cron's test scope.
 * Canonical flag: `ENABLE_MANUT_MODULE`; legacy alias:
 * `ENABLE_SUPERFLOW_MODULE`.
 */
function isManutModuleEnabled(): boolean {
  const value =
    process.env.ENABLE_MANUT_MODULE ?? process.env.ENABLE_SUPERFLOW_MODULE;
  return value === 'true';
}

/**
 * Stale-execution threshold: a RUNNING MnExecutionRun whose backing
 * MnHeartbeatRun hasn't fired in this window is presumed dead.
 *
 * 2 minutes matches the heartbeat cadence we expect from chat-turn
 * level keepalives in M1 (one heartbeat per turn, expected within ~30s
 * of run start). The first true gap is at ~1m; we leave a 1-minute
 * grace window before declaring the run dead.
 */
const STALE_HEARTBEAT_THRESHOLD_MS = 2 * 60 * 1000;

/** Hard cap on rows processed per tick, to bound DB load. */
const MAX_RUNS_PER_TICK = 500;

export interface MnTaskWatchdogResult {
  inspected: number;
  cleared: number;
  errors: number;
}

/**
 * M7 — Stale-lock watchdog. Runs every minute. For each MnExecutionRun
 * row in RUNNING state whose `startedAt` is older than 2 minutes AND
 * whose owning agent has NOT emitted an MnHeartbeatRun in the same
 * window, mark the run FAILED and clear the task's execution lock.
 *
 * This complements the lazy stale-lock recovery in
 * `MnTaskCheckoutService.tryCheckout` (which only clears stale locks
 * on the next checkout attempt) — the watchdog updates the visible
 * state proactively so dashboards reflect reality.
 *
 * Idempotent by design: a second tick on the same data does nothing
 * because the runs that survived the first tick have either had a
 * fresh heartbeat or have already been marked FAILED.
 *
 * CLAUDE.md scars honored:
 *  - `@Injectable()` (v1.12.0 DI scar).
 *  - `PrismaClient` and `MnExecutionRunStatus` are RUNTIME imports.
 *  - The cron handler is public `runOnce(now)` so unit tests can drive
 *    it deterministically without `@nestjs/schedule` instantiation.
 */
@Injectable()
export class MnTaskWatchdogCron {
  private readonly logger = new Logger(MnTaskWatchdogCron.name);

  constructor(
    private readonly db: PrismaClient,
    private readonly checkout: MnTaskCheckoutService
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async sweepStaleRuns(): Promise<void> {
    if (!isManutModuleEnabled()) {
      return;
    }
    await this.runOnce();
  }

  /**
   * Public for tests + manual recovery. Returns counters so callers
   * can assert against the result.
   */
  async runOnce(now: Date = new Date()): Promise<MnTaskWatchdogResult> {
    const cutoff = new Date(now.getTime() - STALE_HEARTBEAT_THRESHOLD_MS);

    // Step 1: find RUNNING runs older than the heartbeat threshold.
    // Note: we don't filter by `lastHeartbeatAt` here because not
    // every agent has a heartbeat record (e.g. external batch runners).
    // Instead, we check the heartbeat per-row below.
    const staleRuns = await this.db.mnExecutionRun.findMany({
      where: {
        status: MnExecutionRunStatus.RUNNING,
        startedAt: { lt: cutoff },
      },
      orderBy: { startedAt: 'asc' },
      take: MAX_RUNS_PER_TICK,
    });

    let cleared = 0;
    let errors = 0;
    for (const run of staleRuns) {
      try {
        // If this run has an agentId, check for a recent heartbeat.
        // If the agent has heartbeat'd within the cutoff window the
        // run is alive; skip.
        if (run.agentId) {
          const recentHeartbeat = await this.db.mnHeartbeatRun.findFirst({
            where: {
              agentId: run.agentId,
              startedAt: { gte: cutoff },
            },
            select: { id: true },
          });
          if (recentHeartbeat) {
            continue;
          }
        }

        // Mark the run FAILED.
        await this.checkout.markRunComplete(
          run.id,
          MnExecutionRunStatus.FAILED,
          'watchdog: stale execution'
        );

        // Clear the task lock if the stale runId still holds it.
        // Use the service so we get the runId-match guard.
        await this.checkout.release(run.taskId, run.id);

        // Best-effort activity log — fire-and-forget. Failure to log
        // shouldn't block the recovery.
        try {
          await this.db.mnTaskActivity.create({
            data: {
              taskId: run.taskId,
              action: 'recovery_lock_cleared',
              metadata: {
                runId: run.id,
                agentId: run.agentId,
                staleSince: run.startedAt.toISOString(),
              },
            },
          });
        } catch (logErr) {
          this.logger.debug(
            `watchdog activity log skipped for task ${run.taskId}: ${
              logErr instanceof Error ? logErr.message : String(logErr)
            }`
          );
        }

        cleared++;
      } catch (err) {
        errors++;
        this.logger.error(
          `watchdog: failed to clear run ${run.id} on task ${run.taskId}`,
          err
        );
      }
    }

    if (cleared > 0) {
      this.logger.log(
        `watchdog: cleared ${cleared} stale execution run(s) (inspected ${staleRuns.length}, errors ${errors})`
      );
    }

    return {
      inspected: staleRuns.length,
      cleared,
      errors,
    };
  }
}
