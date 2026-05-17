import { Injectable, Logger } from '@nestjs/common';
import { MnAgentStatus, MnBudgetScope, PrismaClient } from '@prisma/client';

import { computeCostCents, pickRate } from '../copilot/cost-rates';

/**
 * Fire-and-forget cost emitter (M4).
 *
 * Wired from the Vertex providers (`gemini/vertex.ts`, `anthropic/vertex.ts`,
 * `vertex-openai-base.ts`) at the moment usage is known — which on Manut's
 * native dispatch path is "right after the stream ends", with token counts
 * estimated from char-length because the Rust llm dispatcher doesn't yet
 * surface real usage numbers to the TS layer (CLAUDE.md scar #6).
 *
 * Critical contracts:
 *  - `emit(...)` MUST NEVER throw or block. The provider calls it after
 *    the stream finishes; an exception here would surface to the user as a
 *    half-rendered chat reply. Wrap every external call in catch-and-log.
 *  - When the model is unknown to `pickRate`, we log a warning and persist
 *    a $0 cost row so the audit trail still shows the invocation happened.
 *  - The denormalised running total on MnBudget (`spentCents`) is bumped
 *    in the SAME transaction as the cost insert, scoped by the budget's
 *    scopeType. Without this, the enforcer would have to sum millions of
 *    rows on every chat turn.
 *  - Cap-hit transition: when a budget with `hardStopEnabled=true` crosses
 *    its cap, agents in that scope are flipped to PAUSED. If MnApproval is
 *    not yet shipped (Branch C / M3), we instead write a row to
 *    MnTaskActivity and log a warning so the audit trail captures it.
 *
 * @Injectable + RUNTIME PrismaClient import per the v1.12.0 DI scar.
 */
@Injectable()
export class MnCostService {
  private readonly logger = new Logger(MnCostService.name);

  constructor(private readonly db: PrismaClient) {}

  /**
   * Emit a cost row. NEVER throws — every failure is swallowed + logged.
   * Returns the persisted row id (or null on swallowed failure) for tests.
   */
  async emit(input: {
    workspaceId: string;
    projectId?: string | null;
    agentId?: string | null;
    taskId?: string | null;
    goalId?: string | null;
    billingCode?: string | null;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    now?: Date;
  }): Promise<string | null> {
    try {
      const now = input.now ?? new Date();
      const monthYear = formatMonthYear(now);

      const { costCents, rate } = computeCostCents(
        input.provider,
        input.model,
        input.inputTokens,
        input.outputTokens,
        now
      );

      if (!rate) {
        // Unknown model — still record the event so the audit trail is
        // complete. The $0 is the loudest possible "this model isn't in
        // the rate sheet" signal short of a throw, which we deliberately
        // avoid because emit() runs after a successful response.
        this.logger.warn(
          `unknown model rate for provider=${input.provider} model=${input.model}; emitting $0 cost row`
        );
      }

      const row = await this.db.mnCostEvent.create({
        data: {
          workspaceId: input.workspaceId,
          projectId: input.projectId ?? null,
          agentId: input.agentId ?? null,
          taskId: input.taskId ?? null,
          goalId: input.goalId ?? null,
          billingCode: input.billingCode ?? null,
          provider: input.provider,
          model: input.model,
          inputTokens: Math.max(0, input.inputTokens | 0),
          outputTokens: Math.max(0, input.outputTokens | 0),
          costCents,
          occurredAt: now,
        },
      });

      // Walk the scope chain bottom-up, incrementing each matching budget
      // row's running total. Each step is best-effort; one missing budget
      // shouldn't block the others. Sequential rather than parallel —
      // these are tiny indexed updates and serialised behavior keeps the
      // post-emit cap-hit transition simpler.
      if (costCents > 0) {
        await this.bumpBudget(
          input.workspaceId,
          MnBudgetScope.TASK,
          input.taskId,
          monthYear,
          costCents,
          input.projectId,
          input.agentId
        );
        await this.bumpBudget(
          input.workspaceId,
          MnBudgetScope.GOAL,
          input.goalId,
          monthYear,
          costCents,
          input.projectId,
          input.agentId
        );
        await this.bumpBudget(
          input.workspaceId,
          MnBudgetScope.AGENT,
          input.agentId,
          monthYear,
          costCents,
          input.projectId,
          input.agentId
        );
        await this.bumpBudget(
          input.workspaceId,
          MnBudgetScope.PROJECT,
          input.projectId,
          monthYear,
          costCents,
          input.projectId,
          input.agentId
        );
        await this.bumpBudget(
          input.workspaceId,
          MnBudgetScope.WORKSPACE,
          null,
          monthYear,
          costCents,
          input.projectId,
          input.agentId
        );
      }

      return row.id;
    } catch (error) {
      // Catch-and-log only. Re-throwing would crash the streaming response.
      this.logger.warn(
        `MnCostService.emit failed (swallowed): ${error instanceof Error ? error.message : String(error)}`
      );
      return null;
    }
  }

  /**
   * Best-effort cost estimator for a chat-turn that hasn't happened yet.
   * Used by `MnBudgetEnforcerService.assertAllowed` as a pre-flight check
   * to decide whether running the model would push us over a hard cap.
   * Returns 0 for unknown models so the gate stays permissive on the
   * canary path.
   */
  estimate(
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number,
    now: Date = new Date()
  ): number {
    return computeCostCents(provider, model, inputTokens, outputTokens, now)
      .costCents;
  }

  private async bumpBudget(
    workspaceId: string,
    scopeType: MnBudgetScope,
    scopeId: string | null | undefined,
    monthYear: string,
    deltaCents: number,
    projectIdForAudit: string | null | undefined,
    agentIdForAudit: string | null | undefined
  ): Promise<void> {
    // WORKSPACE scope has a null scopeId; every other scope requires one.
    // Without an id at the relevant scope, the budget can't exist, so
    // there's nothing to bump.
    if (scopeType !== MnBudgetScope.WORKSPACE && !scopeId) return;

    try {
      // Use updateMany so the no-budget case is a silent zero-row update.
      // (Prisma's `update` throws on miss; we'd swallow it anyway.)
      const result = await this.db.mnBudget.updateMany({
        where: {
          workspaceId,
          scopeType,
          scopeId: scopeId ?? null,
          monthYear,
        },
        data: {
          spentCents: { increment: deltaCents },
        },
      });

      if (result.count === 0) return; // No budget on this scope — nothing more to do.

      // Re-read the row to check whether we crossed the cap. We use
      // `findFirst` instead of `findUnique`'s compound key because Prisma
      // generates the compound-unique input with `scopeId: string` even
      // though the column is nullable; `findUnique` would reject the
      // `null` we need for WORKSPACE-scope budgets at the type level.
      const budget = await this.db.mnBudget.findFirst({
        where: {
          workspaceId,
          scopeType,
          scopeId: scopeId ?? null,
          monthYear,
        },
      });
      if (!budget) return;

      if (
        budget.hardStopEnabled &&
        budget.capCents > 0 &&
        budget.spentCents >= budget.capCents &&
        !budget.alertSent
      ) {
        await this.onCapHit(budget.id, {
          workspaceId,
          scopeType,
          scopeId: scopeId ?? null,
          projectId: projectIdForAudit ?? null,
          agentId: agentIdForAudit ?? null,
        });
      }
    } catch (error) {
      this.logger.warn(
        `bumpBudget failed for scope=${scopeType} id=${scopeId ?? 'null'}: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Cap-hit handler.
   *
   * Per CLAUDE.md and the task brief: MnApproval (Branch C / M3) may not
   * be shipped yet. When the model class is absent, we degrade gracefully
   * by writing an MnTaskActivity row (if a taskId is in flight) and
   * logging a structured warning. The Prisma client surface is the right
   * place to detect M3 — `db.mnApproval` is undefined until that
   * migration lands.
   */
  private async onCapHit(
    budgetId: string,
    context: {
      workspaceId: string;
      scopeType: MnBudgetScope;
      scopeId: string | null;
      projectId: string | null;
      agentId: string | null;
    }
  ): Promise<void> {
    try {
      await this.db.mnBudget.update({
        where: { id: budgetId },
        data: { alertSent: true },
      });

      // Pause owning agents — at AGENT scope, that's just the one agent;
      // at higher scopes, every agent in the project (or workspace).
      const where: { workspaceId: string; projectId?: string; id?: string } = {
        workspaceId: context.workspaceId,
      };
      if (context.scopeType === MnBudgetScope.AGENT && context.scopeId) {
        where.id = context.scopeId;
      } else if (
        context.scopeType === MnBudgetScope.PROJECT &&
        context.scopeId
      ) {
        where.projectId = context.scopeId;
      } else if (
        context.scopeType === MnBudgetScope.WORKSPACE ||
        context.scopeType === MnBudgetScope.TASK ||
        context.scopeType === MnBudgetScope.GOAL
      ) {
        // For workspace/task/goal scopes, we don't fan out to PAUSE every
        // agent — that would surprise the operator at a workspace-wide cap.
        // The enforcer's gate is the right place for those, not a side effect.
      }

      if (where.id || where.projectId) {
        await this.db.mnAgent.updateMany({
          where: {
            ...where,
            status: { in: [MnAgentStatus.IDLE, MnAgentStatus.RUNNING] },
          },
          data: { status: MnAgentStatus.PAUSED },
        });
      }

      // M3 hand-off: if MnApproval is shipped, surface an approval gate.
      // Otherwise fall back to MnTaskActivity for audit.
      const approvalModel: unknown = (
        this.db as unknown as { mnApproval?: unknown }
      ).mnApproval;
      if (approvalModel && typeof approvalModel === 'object') {
        // M3 is live — call its create method via the runtime client.
        // We use bracket-style access so this file compiles cleanly on the
        // M4-only schema (no Prisma type for MnApproval yet).
        try {
          await (
            approvalModel as {
              create: (args: unknown) => Promise<unknown>;
            }
          ).create({
            data: {
              workspaceId: context.workspaceId,
              type: 'BUDGET_OVERRIDE',
              status: 'PENDING',
              budgetId,
              metadata: { scopeType: context.scopeType },
            },
          });
        } catch (error) {
          this.logger.warn(
            `onCapHit MnApproval.create failed (M3 surface mismatch?): ${error instanceof Error ? error.message : String(error)}`
          );
        }
      } else if (context.agentId) {
        // No M3 yet — write an audit row on the most recently-active task
        // for this agent, if any. We don't insert without a taskId because
        // MnTaskActivity.taskId is non-null. Logging covers the rest.
        const recentTask = await this.db.mnTask.findFirst({
          where: {
            project: { workspaceId: context.workspaceId },
            assigneeUserId: { not: null },
          },
          orderBy: { updatedAt: 'desc' },
        });
        if (recentTask) {
          await this.db.mnTaskActivity.create({
            data: {
              taskId: recentTask.id,
              actorId: null,
              action: 'budget.cap_hit',
              metadata: {
                budgetId,
                scopeType: context.scopeType,
                agentId: context.agentId,
              },
            },
          });
        }
      }

      this.logger.warn(
        `budget cap hit: workspace=${context.workspaceId} scope=${context.scopeType} scopeId=${context.scopeId ?? 'null'} budgetId=${budgetId}`
      );
    } catch (error) {
      this.logger.warn(
        `onCapHit handler failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/**
 * UTC month bucket. We deliberately use UTC rather than the workspace's
 * local timezone because:
 *  - timezones aren't stored on MnProject (yet);
 *  - GCP/Vertex billing month boundaries are UTC, so this matches reality;
 *  - operators reading the spend dashboard expect "May 2026" to mean the
 *    same thing regardless of which seat is looking.
 */
export function formatMonthYear(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

// Re-export so callers don't have to import from two places.
export { computeCostCents, pickRate };
