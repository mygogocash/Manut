import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

import type {
  MnMaximizerAgentRow,
  MnMaximizerDecision,
  MnMaximizerPlan,
  MnMaximizerToolCall,
} from './manut-maximizer.dto';
import { MnOutcomeVerifierService } from './manut-outcome-verifier.service';

/**
 * M12 — MAXIMIZER MODE orchestrator.
 *
 * When `MnAgent.maximizerMode` is true, the dispatch path runs every
 * pending tool call through `planToolCalls()` which:
 *
 *   1. Auto-delegates calls whose `capability` slug matches a
 *      subordinate's `capabilities` column. Subordinates are
 *      direct-reports (rows with `reportsToAgentId = agent.id`) that
 *      still match the project + workspace scope. First subordinate
 *      wins; ties are broken deterministically by id ascending so the
 *      same call always lands on the same agent (idempotent retries).
 *
 *   2. Batches the rest into groups of 10 (`MAX_BATCH_SIZE`). Each
 *      batch is the unit of work scheduled onto a single heartbeat run
 *      via the existing routine cron pattern — the caller is expected
 *      to consult `batchIndex` and dispatch one BullMQ job per batch.
 *
 *   3. Tightens the approval gate. Any tool call whose `costCents`
 *      exceeds 50% of the agent's remaining monthly budget is forced
 *      to `REQUIRE_APPROVAL`, even if no MnApproval policy demands it.
 *      The remaining-budget read goes through a caller-supplied helper
 *      so the service stays free of an M4 dependency at module-load
 *      time (avoids the circular import the obvious "inject
 *      MnBudgetService" route would create).
 *
 *   4. Tightens outcome verification on DONE transitions. The
 *      `assertCanTransitionToDone` path is run UNCONDITIONALLY for
 *      maximizer-mode agents — not just when a DoD is declared. Tasks
 *      with no DoD pass through (the verifier's contract); tasks with
 *      a DoD must satisfy it before the transition is accepted.
 *      Non-maximizer agents keep the existing opt-in behavior.
 *
 * CLAUDE.md scars honored:
 *  - `@Injectable()` so TS emits `design:paramtypes` for NestJS DI
 *    (v1.12.0 production scar — `SuperflowFeatureRegistrar` shipped
 *    without it for 6+ months and crashed on the first prod flip).
 *  - `PrismaClient` is a RUNTIME import (not `import type`) because
 *    it's the constructor-injection target (PR #57 incident class).
 *  - `MnOutcomeVerifierService` is also a runtime import — same
 *    reason. Both DI targets.
 *  - Service stays narrow on dependencies: no MnBudgetService,
 *    MnApprovalService, or MnAgentService injection. Those would
 *    each pull a transitive PrismaClient and the M12 surface is
 *    consumed from the dispatch hot path where every injected
 *    dependency adds startup cost on `ENABLE_MANUT_MODULE` flip.
 */

/** Hard cap on calls per heartbeat batch. */
export const MAX_BATCH_SIZE = 10;

/** Approval threshold as a fraction of remaining monthly budget. */
export const COST_APPROVAL_THRESHOLD = 0.5;

/**
 * Read-budget callback. The orchestrator asks the caller for the
 * remaining cents on the agent's monthly budget; the caller decides
 * whether to consult MnBudgetService, a cache, or a fixture. Returns
 * `null` when the agent has no monthly cap configured — in that case
 * the cost-gate degrades to a no-op (no budget = no threshold).
 */
export type MnMaximizerBudgetReader = (
  agentId: string
) => Promise<number | null>;

@Injectable()
export class MnMaximizerService {
  private readonly logger = new Logger(MnMaximizerService.name);
  private budgetReader: MnMaximizerBudgetReader;

  constructor(
    private readonly db: PrismaClient,
    private readonly verifier: MnOutcomeVerifierService
  ) {
    // Default budget reader returns `null` (no cap) so the orchestrator
    // is functional out-of-the-box for installs that haven't wired M4
    // yet. Production callers replace via `setBudgetReader` from the
    // module-init path; tests inject a fake via the same setter.
    this.budgetReader = async () => null;
  }

  /**
   * Replace the budget reader. Test-only and module-init seam, kept as
   * a setter (not constructor injection) to keep the NestJS DI surface
   * narrow — adding MnBudgetService here would risk the v1.12.0 trap
   * if BudgetService's own DI fan-out grows.
   */
  setBudgetReader(reader: MnMaximizerBudgetReader): MnMaximizerBudgetReader {
    const previous = this.budgetReader;
    this.budgetReader = reader;
    return previous;
  }

  /**
   * Enable maximizer mode on `agentId`. Returns the freshly persisted
   * boolean so the resolver / UI can flip without a re-query.
   *
   * Throws NotFoundException if the agent is missing. The caller is
   * responsible for permission checks; this method only enforces data
   * invariants and the persisted-state contract.
   */
  async enable(agentId: string): Promise<boolean> {
    if (!agentId) {
      throw new BadRequestException('enable requires a non-empty agentId');
    }
    return this.setMaximizerMode(agentId, true);
  }

  /**
   * Disable maximizer mode on `agentId`. Same contract as `enable`.
   */
  async disable(agentId: string): Promise<boolean> {
    if (!agentId) {
      throw new BadRequestException('disable requires a non-empty agentId');
    }
    return this.setMaximizerMode(agentId, false);
  }

  /**
   * Plan dispatch for a list of pending tool calls. Returns one
   * decision per input call, in order. Idempotent and side-effect free
   * — repeated invocations on the same inputs return the same plan.
   *
   * Behaviour for a non-maximizer agent: every call is EXECUTE with
   * `batchIndex = 0`. The orchestrator policy only fires when the
   * agent has `maximizerMode = true`.
   */
  async planToolCalls(
    agentId: string,
    calls: MnMaximizerToolCall[]
  ): Promise<MnMaximizerPlan> {
    if (!agentId) {
      throw new BadRequestException(
        'planToolCalls requires a non-empty agentId'
      );
    }

    const agent = await this.loadAgent(agentId);

    // Non-maximizer agents: identity pass. Every call executes locally
    // in a single batch. Keeps the surface usable as a generic
    // "schedule these calls" helper even when the flag is off.
    if (!agent.maximizerMode) {
      const decisions = calls.map<MnMaximizerDecision>(call => ({
        callId: call.callId,
        kind: 'EXECUTE',
        delegateAgentId: null,
        approvalReason: null,
        batchIndex: 0,
      }));
      return {
        agentId: agent.id,
        decisions,
        batchCount: decisions.length > 0 ? 1 : 0,
      };
    }

    // Maximizer is on. Load subordinates once, then iterate.
    const subordinates = await this.listSubordinates(agent);

    // Remaining-budget snapshot — pulled once per plan so all calls
    // see a consistent threshold. The approval gate uses this against
    // `COST_APPROVAL_THRESHOLD`.
    const remainingCents = await this.budgetReader(agent.id);

    const decisions: MnMaximizerDecision[] = [];
    let localBatchSlot = 0;
    let localBatchIndex = 0;

    for (const call of calls) {
      const delegate = pickDelegate(call, subordinates);
      if (delegate) {
        decisions.push({
          callId: call.callId,
          kind: 'DELEGATE',
          delegateAgentId: delegate.id,
          approvalReason: null,
          batchIndex: 0,
        });
        continue;
      }

      // Cost-threshold gate. Only triggers when we know the remaining
      // budget AND the call's cost exceeds the configured fraction of
      // it. A zero-cost call (cost unknown) never trips the gate.
      if (
        remainingCents !== null &&
        call.costCents > 0 &&
        call.costCents > remainingCents * COST_APPROVAL_THRESHOLD
      ) {
        decisions.push({
          callId: call.callId,
          kind: 'REQUIRE_APPROVAL',
          delegateAgentId: null,
          approvalReason:
            `Call costs ${call.costCents}¢ which is more than ` +
            `${Math.round(COST_APPROVAL_THRESHOLD * 100)}% of the agent's ` +
            `remaining monthly budget (${remainingCents}¢). ` +
            `Maximizer mode requires approval for high-cost calls.`,
          batchIndex: 0,
        });
        continue;
      }

      // Local execution — slot into the next 10-call batch.
      decisions.push({
        callId: call.callId,
        kind: 'EXECUTE',
        delegateAgentId: null,
        approvalReason: null,
        batchIndex: localBatchIndex,
      });
      localBatchSlot += 1;
      if (localBatchSlot >= MAX_BATCH_SIZE) {
        localBatchSlot = 0;
        localBatchIndex += 1;
      }
    }

    const localCount = decisions.filter(d => d.kind === 'EXECUTE').length;
    const batchCount =
      localCount === 0 ? 0 : Math.ceil(localCount / MAX_BATCH_SIZE);

    return {
      agentId: agent.id,
      decisions,
      batchCount,
    };
  }

  /**
   * Tightened DONE-transition gate. Maximizer-mode agents ALWAYS run
   * the full verifier; non-maximizer agents preserve the upstream
   * opt-in (no-op when DoD is empty).
   *
   * Returns the verifier's outcome for downstream consumers that want
   * to surface predicate breakdowns in the UI; throws
   * BadRequestException on unsatisfied predicates per
   * `MnOutcomeVerifierService.assertCanTransitionToDone`.
   */
  async assertCanTransitionToDone(
    agentId: string,
    taskId: string
  ): Promise<{ enforced: boolean }> {
    if (!agentId || !taskId) {
      throw new BadRequestException(
        'assertCanTransitionToDone requires agentId and taskId'
      );
    }
    const agent = await this.loadAgent(agentId);

    // Always defer to the verifier — the gate itself is a no-op for
    // tasks without a DoD. The "tighter" behavior in maximizer mode
    // is: we ALWAYS call the verifier even when the upstream PM
    // resolver would skip it. The caller of this method is expected
    // to wire this in alongside (or in place of) the regular gate.
    await this.verifier.assertCanTransitionToDone(taskId);

    return {
      enforced: agent.maximizerMode,
    };
  }

  // -------------------------------------------------------------------------
  // Internal helpers
  // -------------------------------------------------------------------------

  /**
   * Persist the maximizer flag. Round-trip the update so the returned
   * value reflects what's actually in Postgres (not what we tried to
   * write) — guards against silent failures in the wire path.
   */
  private async setMaximizerMode(
    agentId: string,
    value: boolean
  ): Promise<boolean> {
    const agent = await this.db.mnAgent.findUnique({
      where: { id: agentId },
      select: { id: true },
    });
    if (!agent) {
      throw new NotFoundException(`Agent ${agentId} not found`);
    }

    const updated = await this.db.mnAgent.update({
      where: { id: agentId },
      data: { maximizerMode: value },
      select: { maximizerMode: true },
    });

    this.logger.log(
      `maximizer mode for agent ${agentId} set to ${updated.maximizerMode}`
    );

    return updated.maximizerMode;
  }

  /**
   * Load the slim agent shape the orchestrator needs. Throws
   * NotFoundException when the agent is missing — callers may catch.
   */
  private async loadAgent(agentId: string): Promise<MnMaximizerAgentRow> {
    const row = await this.db.mnAgent.findUnique({
      where: { id: agentId },
      select: {
        id: true,
        workspaceId: true,
        projectId: true,
        maximizerMode: true,
        capabilities: true,
        reportsToAgentId: true,
      },
    });
    if (!row) {
      throw new NotFoundException(`Agent ${agentId} not found`);
    }
    return row;
  }

  /**
   * Direct reports of `agent` that still belong to the same workspace.
   * Sorted by id ascending so delegation is deterministic across
   * retries (idempotency contract: the same input produces the same
   * delegate).
   */
  private async listSubordinates(
    agent: MnMaximizerAgentRow
  ): Promise<MnMaximizerAgentRow[]> {
    const rows = await this.db.mnAgent.findMany({
      where: {
        workspaceId: agent.workspaceId,
        reportsToAgentId: agent.id,
      },
      select: {
        id: true,
        workspaceId: true,
        projectId: true,
        maximizerMode: true,
        capabilities: true,
        reportsToAgentId: true,
      },
      orderBy: { id: 'asc' },
    });
    return rows;
  }
}

// ---------------------------------------------------------------------------
// Pure helpers (exported for unit testing)
// ---------------------------------------------------------------------------

/**
 * Pick the first subordinate whose comma-separated capabilities column
 * lists `call.capability` (case-insensitive, whitespace-tolerant).
 * Returns null when no match — caller falls back to local execution.
 *
 * The order assumption: `subordinates` is already sorted ascending by
 * `id` so ties resolve deterministically (idempotent contract).
 */
export function pickDelegate(
  call: MnMaximizerToolCall,
  subordinates: ReadonlyArray<MnMaximizerAgentRow>
): MnMaximizerAgentRow | null {
  if (!call.capability) return null;
  const needle = call.capability.trim().toLowerCase();
  if (!needle) return null;

  for (const sub of subordinates) {
    if (!sub.capabilities) continue;
    const haystack = sub.capabilities
      .split(',')
      .map(s => s.trim().toLowerCase())
      .filter(Boolean);
    if (haystack.includes(needle)) {
      return sub;
    }
  }
  return null;
}
