import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaClient } from '@prisma/client';

import { MnApprovalService } from './manut-approval.service';

/**
 * Local copy of the env-gate from `manut.module.ts` to avoid pulling
 * the entire ManutModule import graph (which transitively requires
 * the napi-rs native binary) into the cron's test scope. The check is
 * trivial enough to repeat — the canonical flag is
 * `ENABLE_MANUT_MODULE`, with the legacy `ENABLE_SUPERFLOW_MODULE`
 * honored for backward compatibility.
 */
function isManutModuleEnabled(): boolean {
  const value =
    process.env.ENABLE_MANUT_MODULE ?? process.env.ENABLE_SUPERFLOW_MODULE;
  return value === 'true';
}

/**
 * Default per-workspace timeout for stale-pending auto-cancellation, in
 * minutes. Surface in workspace config later (M3.5+); for now this is
 * the global default applied to every workspace.
 */
const DEFAULT_APPROVAL_TIMEOUT_MINUTES = 30;

/**
 * Hard cap on the number of workspaces we'll process per cron tick.
 * The cron is at-most-once-every-five-minutes; even with thousands of
 * workspaces, a single tick covers them all comfortably. The cap is
 * here to prevent a single misbehaving workspace from monopolising
 * the cron.
 */
const MAX_WORKSPACES_PER_TICK = 1000;

/**
 * Scan PENDING approvals every 5 minutes, auto-cancel any older than
 * the workspace's `approvalTimeoutMinutes` (default 30). This is the
 * recovery valve for stuck approvals — the chat agent assumes "no
 * answer in 30 min = treat as REJECTED" so it can react and free the
 * user's flow.
 *
 * CLAUDE.md scars honored:
 *  - `@Injectable()` so TS emits `design:paramtypes` for NestJS DI.
 *  - `PrismaClient` is a RUNTIME import (not `import type`).
 *  - The env-flag check is the SAME as MnReminderCron — read both the
 *    canonical ENABLE_MANUT_MODULE and the legacy ENABLE_SUPERFLOW_MODULE
 *    alias so VM configs that haven't been updated still gate cleanly.
 */
@Injectable()
export class MnApprovalStaleCron {
  private readonly logger = new Logger(MnApprovalStaleCron.name);

  constructor(
    private readonly db: PrismaClient,
    private readonly service: MnApprovalService
  ) {}

  /**
   * `EVERY_5_MINUTES` matches the original M3 spec. The work itself
   * is cheap: one `count` per workspace + one bulk `updateMany` when
   * cancellations are needed.
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async cancelStaleApprovals(): Promise<void> {
    if (!isManutModuleEnabled()) {
      return;
    }
    await this.runOnce();
  }

  /**
   * Public for unit tests so they can drive the cron deterministically
   * via a mocked clock. The cron decorator just calls this with the
   * current Date.
   */
  async runOnce(now: Date = new Date()): Promise<{
    workspacesScanned: number;
    cancelledCount: number;
  }> {
    // List only workspaces that actually have an open MnApproval — we
    // don't want to scan every workspace in the database every five
    // minutes. We deduplicate via a Set rather than `groupBy` because
    // Prisma's `groupBy` requires an `orderBy` when paired with `take`;
    // a plain `findMany` over an indexed scan is cheaper and avoids
    // the type-level pairing requirement.
    const rows = await this.db.mnApproval.findMany({
      where: { status: 'PENDING' },
      select: { workspaceId: true },
      take: MAX_WORKSPACES_PER_TICK,
    });
    const workspaceIds = Array.from(new Set(rows.map(r => r.workspaceId)));

    const timeoutMs = DEFAULT_APPROVAL_TIMEOUT_MINUTES * 60_000;
    const cutoff = new Date(now.getTime() - timeoutMs);

    let cancelledCount = 0;
    for (const workspaceId of workspaceIds) {
      try {
        const count = await this.service.cancelPendingOlderThan(
          workspaceId,
          cutoff
        );
        if (count > 0) {
          cancelledCount += count;
          this.logger.log(
            `auto-cancelled ${count} stale approval(s) in workspace ${workspaceId}`
          );
        }
      } catch (err) {
        // Don't let one workspace's failure stop the rest. The next
        // tick will retry. Log loudly so the operator notices a hot
        // workspace stuck on every scan.
        this.logger.error(
          `stale-approval scan failed for workspace ${workspaceId}`,
          err
        );
      }
    }

    return {
      workspacesScanned: workspaceIds.length,
      cancelledCount,
    };
  }
}
