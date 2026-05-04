import { Injectable, Logger } from '@nestjs/common';
import type { SocialAiBudget } from '@prisma/client';
import { PrismaClient } from '@prisma/client';

import { NotificationService } from '../../../core/notification';

const DEFAULT_HARD_CAP_USD = 100;
const DEFAULT_SOFT_CAP_USD = 80;
const SOFT_CAP_RATIO = 0.8;

/**
 * Per-workspace monthly AI spend tracker — guardrail for the runaway-prevention
 * caps in PRD §7. Real numbers are well under $10/workspace/month; the caps
 * exist so a buggy prompt loop or pathological retries can't drain a budget.
 *
 * Soft cap (80% = $80) → notify workspace owner.
 * Hard cap (100% = $100) → analytics returns a budget-exceeded error and
 * cron jobs skip until the next calendar month.
 *
 * The monthYear key is "YYYY-MM" in UTC. Rows are created lazily on first
 * call of the month (PRD §7 budget enforcement).
 */
@Injectable()
export class BudgetService {
  private readonly logger = new Logger(BudgetService.name);
  private readonly hardCapUsd: number;
  private readonly softCapUsd: number;

  constructor(
    private readonly db: PrismaClient,
    private readonly notificationService: NotificationService
  ) {
    this.hardCapUsd = DEFAULT_HARD_CAP_USD;
    this.softCapUsd = DEFAULT_SOFT_CAP_USD;
    this.logger.debug(
      `BudgetService initialized: hardCap=$${this.hardCapUsd}, softCap=$${this.softCapUsd}`
    );
  }

  /**
   * "YYYY-MM" key for the current UTC month. Public so the AI services and
   * cron jobs can pin all reads/writes to the same key inside a request.
   */
  static currentMonthKey(now: Date = new Date()): string {
    const year = now.getUTCFullYear();
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  /**
   * Returns 0 if no budget row exists yet for this month — the row is created
   * lazily on the first record() call.
   */
  async getCurrentMonthSpend(workspaceId: string): Promise<number> {
    const row = await this.db.socialAiBudget.findUnique({
      where: {
        workspaceId_monthYear: {
          workspaceId,
          monthYear: BudgetService.currentMonthKey(),
        },
      },
    });
    return row?.spentUsd ?? 0;
  }

  /**
   * True iff the projected post-spend total stays under the workspace's hard
   * cap (defaults to $100). Callers should treat false as fail-closed: refuse
   * to invoke the model and surface a budget-exceeded error to the user.
   */
  async canSpend(workspaceId: string, estimatedUsd: number): Promise<boolean> {
    if (!Number.isFinite(estimatedUsd) || estimatedUsd < 0) {
      // Defensive: never let a bad estimate slip through. Treat as not allowed.
      return false;
    }
    const spent = await this.getCurrentMonthSpend(workspaceId);
    const cap = await this.getCap(workspaceId);
    return spent + estimatedUsd <= cap;
  }

  /**
   * Increment monthly spend for `workspaceId`. Idempotent at the row level —
   * upserts an empty row if needed, then atomically increments spentUsd.
   *
   * Intentionally does NOT enforce the hard cap (callers must call canSpend
   * BEFORE invoking the model). Returns the updated row so callers can decide
   * whether to fire the soft-cap alert.
   */
  async record(workspaceId: string, costUsd: number): Promise<SocialAiBudget> {
    if (!Number.isFinite(costUsd) || costUsd < 0) {
      throw new Error(
        `BudgetService.record: invalid costUsd ${costUsd} for workspace ${workspaceId}`
      );
    }
    const monthYear = BudgetService.currentMonthKey();

    const updated = await this.db.socialAiBudget.upsert({
      where: { workspaceId_monthYear: { workspaceId, monthYear } },
      create: {
        workspaceId,
        monthYear,
        spentUsd: costUsd,
        capUsd: this.hardCapUsd,
        alertSent: false,
      },
      update: {
        spentUsd: { increment: costUsd },
      },
    });

    // Soft-cap (80% of capUsd) alert. Only fire on the threshold-crossing
    // record() — i.e. previous spend was below the soft cap and the new
    // total is at or above it — and only once per row (alertSent flag).
    // Failure here MUST NOT throw — recording the spend is load-bearing,
    // notifying about it is best-effort.
    try {
      const softCapUsd = updated.capUsd * SOFT_CAP_RATIO;
      const prevSpent = updated.spentUsd - costUsd;
      const wasUnderSoftCap = prevSpent < softCapUsd;
      const isOverSoftCap = updated.spentUsd >= softCapUsd;

      if (wasUnderSoftCap && isOverSoftCap && !updated.alertSent) {
        await this.fireSoftCapAlert(updated);
      }
    } catch (err) {
      this.logger.warn(
        `BudgetService: soft-cap alert handling failed for workspace ${workspaceId}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }

    return updated;
  }

  /**
   * Notify the workspace owner that monthly AI spend has crossed the soft cap
   * and flip `alertSent` so we don't spam them. Idempotent at the row level —
   * if `alertSent` is already true (set by a concurrent record() call) we
   * no-op without emitting another notification.
   *
   * The notification flows through the regular in-app channel
   * (NotificationService.createBudgetSoftCap → NotificationModel →
   * `notifications` table) and renders alongside mentions and invitations
   * in the user's notification feed. No email is sent: the analytics
   * platform is opt-in and budget alerts shouldn't generate mailbox
   * traffic before the broader analytics UX ships.
   *
   * The structured `ANALYTICS_AI_BUDGET_SOFT_CAP` log line is kept alongside
   * the notification so external log-based alerting (e.g. a Cloud Logging
   * sink piped to PagerDuty) keeps working without depending on the
   * in-app feed. Per the caller-level guard in `record()`, this method
   * MUST NOT throw — wrap the notification call defensively so a backend
   * outage in the notification path doesn't poison the spend-recording
   * write.
   */
  private async fireSoftCapAlert(row: SocialAiBudget): Promise<void> {
    // Find the workspace owner. Schema: workspace_user_permissions.type is
    // an Int that maps to WorkspaceRole (Owner = 99). Status filter ensures
    // we don't notify a pending/under-review owner who hasn't accepted yet.
    const OWNER_ROLE = 99;
    const owner = await this.db.workspaceUserRole.findFirst({
      where: {
        workspaceId: row.workspaceId,
        type: OWNER_ROLE,
        status: 'Accepted',
      },
      orderBy: { createdAt: 'asc' },
      select: { userId: true },
    });

    // Atomic flag flip — guard with the current alertSent=false so a
    // concurrent record() that also crossed the threshold doesn't fire twice.
    const flipped = await this.db.socialAiBudget.updateMany({
      where: { id: row.id, alertSent: false },
      data: { alertSent: true },
    });

    if (flipped.count === 0) {
      // Another caller already flipped it — they own the notification.
      return;
    }

    if (!owner) {
      this.logger.warn(
        `BudgetService: soft-cap reached for workspace ${row.workspaceId} ($${row.spentUsd.toFixed(2)} of $${row.capUsd.toFixed(2)}) but no Accepted Owner found — alert dropped`
      );
      return;
    }

    // Audit-log line (also picked up by external log-based alerting). Kept
    // alongside the in-app notification so observability doesn't depend on
    // the notification feed being healthy.
    this.logger.warn(
      `BudgetService: ANALYTICS_AI_BUDGET_SOFT_CAP workspace=${row.workspaceId} owner=${owner.userId} month=${row.monthYear} spent=$${row.spentUsd.toFixed(2)} cap=$${row.capUsd.toFixed(2)}`
    );

    // In-app notification — best-effort. A failure here must NOT throw or
    // abort the surrounding record() write. The log line above guarantees
    // the alert is at least visible in server logs even if the notification
    // path is degraded.
    try {
      await this.notificationService.createBudgetSoftCap({
        userId: owner.userId,
        body: {
          workspaceId: row.workspaceId,
          spentUsd: row.spentUsd,
          capUsd: row.capUsd,
          monthYear: row.monthYear,
        },
      });
    } catch (err) {
      this.logger.warn(
        `BudgetService: failed to deliver soft-cap notification for workspace ${row.workspaceId} owner ${owner.userId}: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    }
  }

  /**
   * Soft cap — when spend crosses this and `alertSent` is still false, notify
   * the workspace owner once and flip the flag.
   */
  getSoftCapUsd(): number {
    return this.softCapUsd;
  }

  /**
   * Per-workspace cap — defaults to the module-level hard cap. A future phase
   * may allow admin overrides on the row's `capUsd` column.
   */
  async getCap(workspaceId: string): Promise<number> {
    const row = await this.db.socialAiBudget.findUnique({
      where: {
        workspaceId_monthYear: {
          workspaceId,
          monthYear: BudgetService.currentMonthKey(),
        },
      },
    });
    return row?.capUsd ?? this.hardCapUsd;
  }
}
