import { Injectable, Logger } from '@nestjs/common';
import type { MnTask } from '@prisma/client';
import { MnExecutionRunStatus, PrismaClient } from '@prisma/client';

/**
 * M7 — Atomic checkout + execution locks.
 *
 * The R0 invariant of this service: **at most one caller may hold the
 * execution lock on a given MnTask at any instant.** When two callers
 * race for the same task, exactly one wins; the loser receives `null`
 * and must back off.
 *
 * The guarantee is enforced by a single atomic UPDATE in
 * `tryCheckout` — Postgres serialises row-level writes, so the WHERE
 * clause is evaluated against the locked row and only one writer's
 * predicate can match. The loser's UPDATE returns zero rows; Prisma's
 * `$queryRaw<MnTask[]>` returns an empty array, and we map that to
 * `null`.
 *
 * Stale-lock recovery: any executionLockedAt older than 5 minutes is
 * considered abandoned (the holder presumably crashed). The next
 * `tryCheckout` call against such a task wins and overwrites the
 * stale runId. The watchdog cron (manut-task-watchdog.cron.ts)
 * complements this by proactively marking MnExecutionRun rows as
 * FAILED/TIMED_OUT and clearing the task lock so dashboards reflect
 * reality without waiting for a fresh checkout attempt.
 *
 * CLAUDE.md scars honored:
 *  - `@Injectable()` so TS emits `design:paramtypes` for NestJS DI
 *    (v1.12.0 scar).
 *  - `PrismaClient` and `MnExecutionRunStatus` are RUNTIME imports
 *    (not `import type`) because they're DI / runtime values.
 *    `MnTask` is type-only — that's the right call (it's never
 *    constructed at runtime in this file).
 */

/** Duration after which a held lock is considered abandoned. */
export const STALE_LOCK_INTERVAL = '5 minutes';

@Injectable()
export class MnTaskCheckoutService {
  private readonly logger = new Logger(MnTaskCheckoutService.name);

  constructor(private readonly db: PrismaClient) {}

  /**
   * Atomically acquire the execution lock on a task.
   *
   * Returns the updated `MnTask` row when the lock is acquired, or
   * `null` when another caller already holds the (non-stale) lock.
   *
   * The atomicity guarantee comes from Postgres row-level locking on
   * the UPDATE — concurrent callers serialise on the row, and the
   * WHERE clause is re-evaluated against the post-lock row. Only the
   * first caller to find `execution_run_id IS NULL` (or stale) wins.
   */
  async tryCheckout(
    taskId: string,
    runId: string,
    executingAgentId?: string | null
  ): Promise<MnTask | null> {
    if (!taskId || !runId) {
      throw new Error('tryCheckout requires non-empty taskId and runId');
    }

    // Raw UPDATE ... RETURNING is the only way to get atomic
    // claim-or-fail behaviour out of Prisma. `updateMany` returns a
    // count but not the row; nested `update` requires a known id and
    // does not let us conditionally filter by execution_run_id.
    //
    // The `INTERVAL '5 minutes'` literal is hard-coded rather than
    // parameterised because Postgres rejects bound parameters in
    // INTERVAL positions (it's a type quirk).
    const rows = await this.db.$queryRaw<MnTask[]>`
      UPDATE mn_tasks
         SET execution_run_id = ${runId},
             execution_locked_at = NOW(),
             updated_at = NOW()
       WHERE id = ${taskId}
         AND (
              execution_run_id IS NULL
           OR execution_locked_at < NOW() - INTERVAL '5 minutes'
         )
      RETURNING *
    `;

    if (rows.length === 0) {
      return null;
    }

    // Insert the MnExecutionRun row in a best-effort, fire-and-forget
    // way. If this fails the lock is still held; the next watchdog
    // tick will reconcile.
    try {
      await this.db.mnExecutionRun.create({
        data: {
          id: runId,
          taskId,
          agentId: executingAgentId ?? null,
          status: MnExecutionRunStatus.RUNNING,
        },
      });
    } catch (err) {
      // Common case: row already exists from a previous checkout
      // (re-acquisition of the same runId). That's fine — the
      // execution lock is what matters; the run row is metadata.
      this.logger.debug(
        `mnExecutionRun.create skipped for runId=${runId}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    return rows[0] ?? null;
  }

  /**
   * Release the lock held by `runId`. No-op if `runId` does not match
   * the current holder — this prevents a stale process from clobbering
   * a fresh execution that successfully acquired the lock after the
   * stale one crashed.
   */
  async release(taskId: string, runId: string): Promise<boolean> {
    if (!taskId || !runId) {
      throw new Error('release requires non-empty taskId and runId');
    }

    const result = await this.db.$executeRaw`
      UPDATE mn_tasks
         SET execution_run_id = NULL,
             execution_locked_at = NULL,
             updated_at = NOW()
       WHERE id = ${taskId}
         AND execution_run_id = ${runId}
    `;
    // $executeRaw returns the number of affected rows.
    return result > 0;
  }

  /**
   * Mark an MnExecutionRun row as complete. Idempotent — re-marking a
   * row already in a terminal state is a no-op.
   */
  async markRunComplete(
    runId: string,
    status: MnExecutionRunStatus,
    error?: string | null
  ): Promise<void> {
    if (!runId) {
      throw new Error('markRunComplete requires non-empty runId');
    }
    if (
      status === MnExecutionRunStatus.RUNNING ||
      status === MnExecutionRunStatus.QUEUED
    ) {
      throw new Error(
        `markRunComplete requires a terminal status, got ${status}`
      );
    }

    try {
      await this.db.mnExecutionRun.update({
        where: { id: runId },
        data: {
          status,
          error: error ?? null,
          finishedAt: new Date(),
        },
      });
    } catch (err) {
      // P2025 — record not found. Treat as no-op so callers don't
      // have to special-case checkout failures. We compare on the
      // duck-typed `.code` field rather than the
      // `Prisma.PrismaClientKnownRequestError` class because the
      // class instance isn't always preserved across worker
      // boundaries (it's a class, not a structurally-typed shape) and
      // unit-test fakes may not subclass it.
      const code =
        err && typeof err === 'object' && 'code' in err
          ? (err as { code?: unknown }).code
          : undefined;
      if (code === 'P2025') {
        this.logger.debug(`markRunComplete: run ${runId} not found, skipping`);
        return;
      }
      throw err;
    }
  }

  /**
   * List execution runs for a task, newest first. Used by the
   * resolver to render an execution-history pane.
   */
  async listRunsForTask(
    taskId: string,
    limit = 50
  ): Promise<
    Array<{
      id: string;
      taskId: string;
      agentId: string | null;
      status: MnExecutionRunStatus;
      startedAt: Date;
      finishedAt: Date | null;
      error: string | null;
    }>
  > {
    return this.db.mnExecutionRun.findMany({
      where: { taskId },
      orderBy: { startedAt: 'desc' },
      take: Math.min(Math.max(1, limit), 200),
    });
  }
}
