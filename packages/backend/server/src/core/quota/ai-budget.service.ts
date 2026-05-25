import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Import `UserFriendlyError` from the leaf module rather than the
// `../../base` barrel — the barrel re-exports `./storage` which loads
// the native binding at module-evaluation time. Hitting the barrel
// from a unit test pulls the binding in and crashes ava with a
// mach-o dlopen error on Macs without a fresh napi build. The leaf
// path keeps the spec at pure-TS latency. Mirrors how `./tiers.ts`
// stays dependency-free for the same reason (see file header there).
import { UserFriendlyError } from '../../base/error/def';
import { FREE_TIER, PRO_TIER, tierFor } from './tiers';

const MANUT_SELFHOST_AI_BUDGET_CENTS = Number.MAX_SAFE_INTEGER;

/**
 * Structured payload thrown alongside `AiBudgetExceeded` so the frontend
 * `AiBudgetModal` can render the "$X.XX of $Y.YY used" copy without an
 * extra round-trip. Mirrors `StorageCapDetail` exactly so consumers can
 * parse the GraphQL `error.message` string into a typed payload.
 */
export interface AiBudgetCapDetail {
  error: 'AI_BUDGET_CAP';
  /** USD cents spent this calendar month UTC. */
  spentCents: number;
  /** USD cents tier cap (500 = $5 Free, 5000 = $50 Pro). */
  capCents: number;
}

export function aiBudgetCapMessage(detail: AiBudgetCapDetail): string {
  return JSON.stringify(detail);
}

/**
 * Manut Wave 6 (E1.12 — T-1.12.1.a) — chat-turn AI budget guard.
 *
 * Maps to the existing `copilot_quota_exceeded` error category so the
 * HTTP status (402, per `BaseTypeToHttpStatusMap`) and the upstream
 * frontend error handlers Just Work. Carrying the structured
 * `{spentCents, capCents}` payload in the message keeps the wire shape
 * identical to `storage_quota_exceeded` (which `StorageCapModal`
 * already parses), so the frontend `AiBudgetModal` parses the same way.
 *
 * Why not a fresh error code: adding a new entry to
 * `USER_FRIENDLY_ERRORS` requires regenerating `errors.gen.ts` (the
 * file header is "AUTO GENERATED FILE"). The two paths are
 * semantically identical to the client — both render an upsell modal
 * with a cap snapshot — so reusing the existing `quota_exceeded` HTTP
 * status + the existing `copilot_quota_exceeded` error name is the
 * lightest-touch fix that lands T-1.12.1.a inside the M5b window. A
 * follow-up (R1) can promote this to its own `ai_budget_exceeded`
 * error name once the gen pipeline is touched anyway.
 */
export class AiBudgetExceeded extends UserFriendlyError {
  /** Structured detail attached as a sibling for typed callers. */
  readonly detail: AiBudgetCapDetail;

  constructor(detail: AiBudgetCapDetail) {
    super(
      'quota_exceeded',
      'copilot_quota_exceeded',
      aiBudgetCapMessage(detail)
    );
    this.detail = detail;
  }
}

/**
 * Compute the inclusive lower bound of the current calendar month in UTC.
 * Returns the same Date for every call within the month so two writes
 * upsert the same row. `formatMonthYear` in `manut-cost.service` keeps a
 * YYYY-MM string for the M4 budgets table — here we keep a `timestamptz`
 * because the migration declared the column that way and the index
 * sorts on it.
 */
export function currentPeriodStart(now: Date = new Date()): Date {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0)
  );
}

/**
 * Manut Wave 6 (E1.12) — per-workspace AI budget service.
 *
 * Three load-bearing entrypoints, each O(1) on the (workspace_id,
 * period_start) primary key:
 *
 *   `getCurrentSpend(workspaceId)`   — read this month's running total
 *   `recordSpend(workspaceId, c)`    — increment / upsert atomically
 *   `assertWithinCap(workspaceId, e)` — throw `AiBudgetExceeded` if
 *                                       current + estimated > tier cap
 *
 * The tier cap is read from `tierFor(plan)` (FREE → $5 = 500 cents,
 * PRO → $50 = 5000 cents). The `workspace.plan` column lands in E3.3;
 * until then `getWorkspacePlan` is a stub returning `undefined` so every
 * workspace grandfathers into FREE_TIER (matches `QuotaService`).
 *
 * Per IMPLEMENTATION_PLAN §0.3 + CLAUDE.md scar #5 (cost emission must
 * never block streaming), `recordSpend` is fire-and-forget at the
 * call-site and tolerates concurrent upserts via the database's
 * uniqueness constraint on the primary key.
 */
@Injectable()
export class AiBudgetService {
  private readonly logger = new Logger(AiBudgetService.name);

  constructor(private readonly db: PrismaClient) {}

  /**
   * Current spend in USD cents for this calendar month (UTC). Returns
   * 0 when no row exists — the row is created lazily on the first
   * `recordSpend` call.
   */
  async getCurrentSpend(
    workspaceId: string,
    now: Date = new Date()
  ): Promise<number> {
    const periodStart = currentPeriodStart(now);
    const row = await this.db.mnAiBudgetUsage.findUnique({
      where: {
        workspaceId_periodStart: {
          workspaceId,
          periodStart,
        },
      },
      select: { spentCents: true },
    });
    return row?.spentCents ?? 0;
  }

  /**
   * Upsert the (workspace, period) row, atomically incrementing
   * `spentCents`. Concurrent callers race through the database's
   * primary-key constraint; the second writer falls through to the
   * `update` branch and increments instead of clobbering.
   *
   * Defensive: a non-finite or negative `costCents` is logged and
   * dropped rather than thrown so cost recording never blocks the
   * streaming response (CLAUDE.md scar #5).
   */
  async recordSpend(
    workspaceId: string,
    costCents: number,
    now: Date = new Date()
  ): Promise<void> {
    if (!Number.isFinite(costCents) || costCents < 0) {
      this.logger.warn(
        `recordSpend: ignoring invalid costCents=${costCents} for workspace=${workspaceId}`
      );
      return;
    }
    if (costCents === 0) return;

    const periodStart = currentPeriodStart(now);
    await this.db.mnAiBudgetUsage.upsert({
      where: {
        workspaceId_periodStart: {
          workspaceId,
          periodStart,
        },
      },
      create: {
        workspaceId,
        periodStart,
        spentCents: Math.floor(costCents),
      },
      update: {
        spentCents: { increment: Math.floor(costCents) },
      },
    });
  }

  /**
   * Throw `AiBudgetExceeded` if `getCurrentSpend + estimatedCostCents`
   * would breach the workspace's tier cap. Called from the copilot
   * controller before LLM invocation so a runaway prompt loop can't
   * burn additional spend on the round-trip.
   *
   * `estimatedCostCents=0` is a legal "just check, no estimate" path —
   * the cap is still enforced against the running total.
   */
  async assertWithinCap(
    workspaceId: string,
    estimatedCostCents: number,
    now: Date = new Date()
  ): Promise<void> {
    if (env.selfhosted) {
      return;
    }

    const capCents = await this.getCapCents(workspaceId);
    const spentCents = await this.getCurrentSpend(workspaceId, now);
    const safeEstimate =
      Number.isFinite(estimatedCostCents) && estimatedCostCents > 0
        ? Math.floor(estimatedCostCents)
        : 0;
    if (spentCents + safeEstimate > capCents) {
      throw new AiBudgetExceeded({
        error: 'AI_BUDGET_CAP',
        spentCents,
        capCents,
      });
    }
  }

  /**
   * Tier cap in USD cents. Stub `getWorkspacePlan` returns `undefined`
   * → `tierFor` grandfathers every workspace into FREE_TIER (matches
   * `QuotaService.getWorkspacePlan`). Once `workspace.plan` ships in
   * E3.3, this routes Pro workspaces to $50 automatically.
   */
  async getCapCents(workspaceId: string): Promise<number> {
    if (env.selfhosted) {
      return MANUT_SELFHOST_AI_BUDGET_CENTS;
    }

    const plan = await this.getWorkspacePlan(workspaceId);
    return tierFor(plan).aiBudgetUsdCents;
  }

  /**
   * Returns the `workspace.plan` value for the given workspace.
   * Currently a stub returning `undefined` — the column ships in E3.3
   * (Month 3, decision #19). Until then, `tierFor(undefined) →
   * FREE_TIER` ($5/mo) grandfathers every workspace into Free.
   *
   * TODO(E3.3): wire to the `workspace.plan` column once it lands.
   * Expected return: `'free' | 'pro' | null`.
   */
  private async getWorkspacePlan(
    _workspaceId: string
  ): Promise<string | null | undefined> {
    return undefined;
  }
}

// Re-export the tier constants so consumers can build their own
// estimates against the same source of truth without two import lines.
export { FREE_TIER, PRO_TIER };
