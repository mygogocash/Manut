import { Injectable, Logger } from '@nestjs/common';
import type { MnBudget } from '@prisma/client';
import { MnBudgetScope, PrismaClient } from '@prisma/client';

import { formatMonthYear } from './manut-cost.service';

/**
 * Hot-path budget gate (M4).
 *
 * Called from the copilot auto-router BEFORE model selection runs, so a
 * cap-busting workspace can't burn additional spend on the LLM round-trip.
 * Latency target: **p95 ≤ 1 ms on cache hit** — the cache is an
 * in-memory `Map` with a 30-second TTL keyed on the scope chain.
 *
 * Why 30 seconds:
 *  - Frequent enough that an admin raising a cap takes effect in real time
 *    on the operator's perception scale.
 *  - Slow enough that a chat session doing 20 turns/minute hits the DB
 *    only twice per scope per minute, even with the cache cold-start.
 *  - The denormalised `MnBudget.spentCents` updates synchronously in
 *    `MnCostService.emit`, so even within the TTL window the worst-case
 *    drift is one chat-turn worth of spend (which is precisely what the
 *    enforcer is allowed to over-spend by — see scar #5 about not
 *    blocking the response).
 *
 * The cache is NOT a perfect mirror of the DB; it's a hint. The
 * `MnBudgetEnforcerDecision` type carries a `cached` boolean so callers
 * can tell which path was taken in tests + logs.
 */

export type MnBudgetEnforcerVerdict = 'ALLOW' | 'BLOCK';

export interface MnBudgetEnforcerDecision {
  verdict: MnBudgetEnforcerVerdict;
  /** Which budget caused the block, or null when ALLOW. */
  blockedBy: {
    scopeType: MnBudgetScope;
    scopeId: string | null;
    budgetId: string;
    capCents: number;
    spentCents: number;
  } | null;
  /** True if the answer came from the in-memory cache. */
  cached: boolean;
  /** Wall-clock latency in milliseconds (for benchmarks). */
  latencyMs: number;
}

export interface MnBudgetEnforcerScopeChain {
  workspaceId: string;
  projectId?: string | null;
  agentId?: string | null;
  taskId?: string | null;
  goalId?: string | null;
}

interface CacheEntry {
  decision: MnBudgetEnforcerDecision;
  expiresAt: number;
}

const CACHE_TTL_MS = 30_000;

@Injectable()
export class MnBudgetEnforcerService {
  private readonly logger = new Logger(MnBudgetEnforcerService.name);
  private readonly cache = new Map<string, CacheEntry>();

  constructor(private readonly db: PrismaClient) {}

  /**
   * Returns ALLOW or BLOCK for the supplied scope chain. NEVER throws —
   * the structured decision lets the caller pick the right error.
   *
   * `assertAllowed` is the convenience wrapper that throws on BLOCK.
   */
  async check(
    chain: MnBudgetEnforcerScopeChain,
    now: Date = new Date()
  ): Promise<MnBudgetEnforcerDecision> {
    const startNs = process.hrtime.bigint();
    const cacheKey = this.cacheKey(chain, now);

    const cached = this.cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      const latencyMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;
      return { ...cached.decision, cached: true, latencyMs };
    }

    const decision = await this.runCheck(chain, now, startNs);
    this.cache.set(cacheKey, {
      decision: { ...decision, cached: false },
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return decision;
  }

  /**
   * Convenience wrapper: throw on BLOCK so the resolver / auto-router
   * can fail fast without inspecting the verdict.
   */
  async assertAllowed(
    chain: MnBudgetEnforcerScopeChain,
    now: Date = new Date()
  ): Promise<MnBudgetEnforcerDecision> {
    const decision = await this.check(chain, now);
    if (decision.verdict === 'BLOCK' && decision.blockedBy) {
      throw new BudgetExceededError(
        `Budget exceeded: scope=${decision.blockedBy.scopeType} ` +
          `cap=${decision.blockedBy.capCents}c spent=${decision.blockedBy.spentCents}c`,
        decision.blockedBy
      );
    }
    return decision;
  }

  /**
   * Invalidate the cache for a single scope chain. Called by the budget
   * resolver after a mutation so the next check sees the new cap.
   */
  invalidate(chain: MnBudgetEnforcerScopeChain, now: Date = new Date()): void {
    const key = this.cacheKey(chain, now);
    this.cache.delete(key);
  }

  /**
   * Nuke the entire cache. Used by tests + on workspace-wide admin
   * mutations where the per-chain key isn't known.
   */
  invalidateAll(): void {
    this.cache.clear();
  }

  /**
   * Diagnostic — exposed so tests can sample the cache size to assert
   * a hit/miss split.
   */
  cacheSize(): number {
    return this.cache.size;
  }

  private cacheKey(chain: MnBudgetEnforcerScopeChain, now: Date): string {
    return [
      formatMonthYear(now),
      chain.workspaceId,
      chain.projectId ?? '',
      chain.agentId ?? '',
      chain.taskId ?? '',
      chain.goalId ?? '',
    ].join('|');
  }

  private async runCheck(
    chain: MnBudgetEnforcerScopeChain,
    now: Date,
    startNs: bigint
  ): Promise<MnBudgetEnforcerDecision> {
    const monthYear = formatMonthYear(now);
    let blocked: MnBudgetEnforcerDecision['blockedBy'] = null;

    // Walk task → goal → agent → project → workspace. First hard-stop
    // that's already over its cap wins. We pull all relevant budgets in
    // one query rather than one round-trip per scope.
    let budgets: MnBudget[] = [];
    try {
      const where = this.buildScopeFilter(chain, monthYear);
      budgets = await this.db.mnBudget.findMany({
        where,
      });
    } catch (error) {
      // Defensive — if the read fails, log + ALLOW so a transient DB
      // hiccup doesn't gate the entire AI surface. Per scar #5.
      this.logger.warn(
        `MnBudgetEnforcer DB read failed; defaulting ALLOW: ${error instanceof Error ? error.message : String(error)}`
      );
      const latencyMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;
      return {
        verdict: 'ALLOW',
        blockedBy: null,
        cached: false,
        latencyMs,
      };
    }

    // Order: TASK → GOAL → AGENT → PROJECT → WORKSPACE.
    const order: Array<{ scope: MnBudgetScope; scopeId: string | null }> = [
      { scope: MnBudgetScope.TASK, scopeId: chain.taskId ?? null },
      { scope: MnBudgetScope.GOAL, scopeId: chain.goalId ?? null },
      { scope: MnBudgetScope.AGENT, scopeId: chain.agentId ?? null },
      { scope: MnBudgetScope.PROJECT, scopeId: chain.projectId ?? null },
      { scope: MnBudgetScope.WORKSPACE, scopeId: null },
    ];

    for (const step of order) {
      if (step.scope !== MnBudgetScope.WORKSPACE && !step.scopeId) continue;
      const match = budgets.find(
        b => b.scopeType === step.scope && (b.scopeId ?? null) === step.scopeId
      );
      if (!match) continue;
      if (
        match.hardStopEnabled &&
        match.capCents > 0 &&
        match.spentCents >= match.capCents
      ) {
        blocked = {
          scopeType: match.scopeType,
          scopeId: match.scopeId,
          budgetId: match.id,
          capCents: match.capCents,
          spentCents: match.spentCents,
        };
        break;
      }
    }

    const latencyMs = Number(process.hrtime.bigint() - startNs) / 1_000_000;

    return {
      verdict: blocked ? 'BLOCK' : 'ALLOW',
      blockedBy: blocked,
      cached: false,
      latencyMs,
    };
  }

  private buildScopeFilter(
    chain: MnBudgetEnforcerScopeChain,
    monthYear: string
  ): Record<string, unknown> {
    // Build an OR over (scope, scopeId) pairs that are populated. The DB
    // index `(workspaceId, scopeType)` plus the @@unique tuple covers
    // these lookups in one indexed scan per row.
    const or: Array<Record<string, unknown>> = [
      { scopeType: MnBudgetScope.WORKSPACE, scopeId: null },
    ];
    if (chain.projectId) {
      or.push({ scopeType: MnBudgetScope.PROJECT, scopeId: chain.projectId });
    }
    if (chain.agentId) {
      or.push({ scopeType: MnBudgetScope.AGENT, scopeId: chain.agentId });
    }
    if (chain.taskId) {
      or.push({ scopeType: MnBudgetScope.TASK, scopeId: chain.taskId });
    }
    if (chain.goalId) {
      or.push({ scopeType: MnBudgetScope.GOAL, scopeId: chain.goalId });
    }
    return {
      workspaceId: chain.workspaceId,
      monthYear,
      OR: or,
    };
  }
}

/**
 * Structured error so the auto-router can surface a friendly message
 * without leaking the budget id to clients with insufficient permission.
 */
export class BudgetExceededError extends Error {
  readonly blockedBy: NonNullable<MnBudgetEnforcerDecision['blockedBy']>;

  constructor(
    message: string,
    blockedBy: NonNullable<MnBudgetEnforcerDecision['blockedBy']>
  ) {
    super(message);
    this.name = 'BudgetExceededError';
    this.blockedBy = blockedBy;
  }
}
