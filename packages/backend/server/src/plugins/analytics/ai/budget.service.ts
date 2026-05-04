import { Injectable, Logger } from '@nestjs/common';
import type { SocialAiBudget } from '@prisma/client';
import { PrismaClient } from '@prisma/client';

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

  constructor(private readonly db: PrismaClient) {
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
   * if `alertSent` is already true (set by a concurrent record() call) we no-op.
   *
   * NOTE: AFFiNE's NotificationService is typed against a Prisma `NotificationType`
   * enum (Mention | Invitation* | Comment*) — there is no generic in-app
   * channel for arbitrary system alerts, and the Mailer requires a typed
   * template name. Adding a `BudgetSoftCap` type would require a Prisma
   * enum migration + mail template, both out of scope for this round.
   *
   * For now we (a) flip alertSent so the same workspace doesn't trigger
   * repeatedly within the month, and (b) emit a structured logger.warn so
   * the alert is visible in server logs and can be picked up by an external
   * log-based alerting pipeline. When the notification surface lands, replace
   * the logger.warn block below with the real call (the intended shape):
   *
   *   await this.notificationService.create({
   *     userId: ownerUserId,
   *     type: NotificationType.BudgetSoftCap,
   *     body: { workspaceId, spentUsd, capUsd, monthYear },
   *   });
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

    // TODO(notification-surface): replace with NotificationService.create({
    //   userId: owner.userId, type: NotificationType.BudgetSoftCap, body: {...}
    // }) once a generic in-app channel exists. See header comment.
    this.logger.warn(
      `BudgetService: ANALYTICS_AI_BUDGET_SOFT_CAP workspace=${row.workspaceId} owner=${owner.userId} month=${row.monthYear} spent=$${row.spentUsd.toFixed(2)} cap=$${row.capUsd.toFixed(2)}`
    );
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
