import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { logger } from "@/common/utils/logger";
import {
  type ChainOwner,
  chainRepository,
  type Tx,
} from "@/modules/approval-chains/chain.repository";
import {
  CHAIN_SCOPE_LABELS,
  type ChainProgress,
  type ChainScope,
  type ChainStepView,
  type ChainView,
  DECISION_STATUS,
  type DecisionStatus,
  type DecisionView,
  MAX_CHAIN_STEPS,
} from "@/modules/approval-chains/chain.types";

// The chain engine.
//
// Three jobs, and nothing else:
//
//   1. Read a chain's configuration.
//   2. Snapshot it onto a record when that record is submitted.
//   3. Advance the snapshot as decisions are recorded.
//
// It knows nothing about projects or proposals beyond an owner id. Deciding what
// a completed chain MEANS — pending_development for a request, approved for a
// proposal — stays with each module, because that is its state machine's job.

/** Rows the engine hands back after a decision, so the caller can react. */
export interface AdvanceResult {
  /** The stage just settled. */
  settledOrder: number;
  /** Next stage awaiting a decision, or null when the chain is exhausted. */
  nextOrder: number | null;
  /** True when every stage has approved. The caller finalises its own record. */
  isComplete: boolean;
}

export class ChainService {
  // ── Reading configuration ─────────────────────────────────────────────

  /**
   * A stage's approver, plus whether a configured person has gone missing.
   *
   * "Never configured" and "configured but deactivated" both leave the approver
   * null, but they need different things from an administrator, so the second is
   * flagged rather than folded into the first.
   */
  private toStepView(step: {
    id: string;
    order: number;
    name: string;
    description: string | null;
    approverUserId: string | null;
    isActive: boolean;
    isSystem: boolean;
    approverUser: {
      id: string;
      name: string;
      email: string;
      isActive: boolean;
    } | null;
  }): ChainStepView {
    const resolves = step.approverUser?.isActive === true;
    return {
      id: step.id,
      order: step.order,
      name: step.name,
      description: step.description,
      approver: resolves
        ? {
            id: step.approverUser!.id,
            name: step.approverUser!.name,
            email: step.approverUser!.email,
          }
        : null,
      approverMissing: step.approverUserId !== null && !resolves,
      isActive: step.isActive,
      isSystem: step.isSystem,
    };
  }

  async getChain(scope: ChainScope): Promise<ChainView | null> {
    const chain = await chainRepository.findChain(scope);
    if (!chain) return null;
    return {
      id: chain.id,
      scope: chain.scope as ChainScope,
      name: chain.name,
      description: chain.description,
      isActive: chain.isActive,
      steps: chain.steps.map((s) => this.toStepView(s)),
    };
  }

  async listChains(): Promise<ChainView[]> {
    const chains = await chainRepository.listChains();
    return chains.map((chain) => ({
      id: chain.id,
      scope: chain.scope as ChainScope,
      name: chain.name,
      description: chain.description,
      isActive: chain.isActive,
      steps: chain.steps.map((s) => this.toStepView(s)),
    }));
  }

  private async requireChain(scope: ChainScope) {
    const chain = await chainRepository.findChain(scope);
    if (!chain) {
      throw new NotFoundException(
        `No approval chain is configured for ${CHAIN_SCOPE_LABELS[scope] ?? scope}`,
      );
    }
    return chain;
  }

  // ── Editing configuration ─────────────────────────────────────────────

  async addStep(
    scope: ChainScope,
    input: {
      name: string;
      description?: string | null;
      approverUserId?: string | null;
    },
  ) {
    const chain = await this.requireChain(scope);

    const existing = await chainRepository.countSteps(chain.id);
    if (existing >= MAX_CHAIN_STEPS) {
      throw new BadRequestException(
        `A chain can hold at most ${MAX_CHAIN_STEPS} stages`,
      );
    }

    const order = await chainRepository.nextStepOrder(chain.id);
    return chainRepository.createStep({ chainId: chain.id, order, ...input });
  }

  /**
   * The shape of an approval is not an administrator's to remove.
   *
   * A system stage stays renameable and reassignable — that is the whole point of
   * the chain being configurable — but deleting or parking one would change what
   * the approval IS, not merely who performs it.
   */
  private assertNotSystemStage(step: { isSystem: boolean; name: string }) {
    if (step.isSystem) {
      throw new BadRequestException(
        `"${step.name}" is part of the approval flow and cannot be removed. You can rename it or change who approves at it.`,
      );
    }
  }

  async updateStep(
    stepId: string,
    input: {
      name?: string;
      description?: string | null;
      approverUserId?: string | null;
      isActive?: boolean;
    },
  ) {
    const step = await chainRepository.findStep(stepId);
    if (!step) throw new NotFoundException("Stage not found");

    // Deactivating the last active stage would leave a chain that approves
    // nothing, which is the same hazard as deleting it. Refused for the same
    // reason.
    if (input.isActive === false && step.isActive) {
      this.assertNotSystemStage(step);
      await this.assertNotLastActiveStep(step.chainId);
    }

    return chainRepository.updateStep(stepId, input);
  }

  /**
   * An empty chain is refused rather than allowed.
   *
   * A chain with no stages would mean "submitted equals approved" — a
   * configuration that silently removes approval entirely. Far more likely a
   * mistake than an intention, so the API will not save it. Disabling the whole
   * flow is a different action, and belongs to the module, not to its chain.
   */
  private async assertNotLastActiveStep(chainId: string) {
    const active = await chainRepository.countSteps(chainId, true);
    if (active <= 1) {
      throw new BadRequestException(
        "A chain must keep at least one active stage. Add a replacement stage first.",
      );
    }
  }

  async removeStep(stepId: string) {
    const step = await chainRepository.findStep(stepId);
    if (!step) throw new NotFoundException("Stage not found");
    this.assertNotSystemStage(step);
    if (step.isActive) await this.assertNotLastActiveStep(step.chainId);

    await chainRepository.deleteStep(stepId);

    // Renumber so orders stay 1..N with no gap. A gap is harmless to routing,
    // which walks by ascending order, but it reads as data loss in the editor.
    const remaining = await chainRepository.stepIds(step.chainId);
    if (remaining.length > 0) {
      await chainRepository.reorderSteps(step.chainId, remaining);
    }
    return { removed: true };
  }

  async reorderSteps(scope: ChainScope, orderedIds: string[]) {
    const chain = await this.requireChain(scope);
    const known = await chainRepository.stepIds(chain.id);

    // The request must name exactly the chain's stages: a partial list would
    // renumber some rows and leave others stranded at their old order.
    const sameSize = orderedIds.length === known.length;
    const sameSet =
      sameSize &&
      new Set(orderedIds).size === orderedIds.length &&
      orderedIds.every((id) => known.includes(id));
    if (!sameSet) {
      throw new BadRequestException(
        "Reordering must list every stage of the chain exactly once",
      );
    }

    return chainRepository.reorderSteps(chain.id, orderedIds);
  }

  async updateChain(
    scope: ChainScope,
    input: { name?: string; description?: string | null; isActive?: boolean },
  ) {
    const chain = await this.requireChain(scope);
    return chainRepository.updateChain(chain.id, input);
  }

  // ── Snapshotting onto a record ────────────────────────────────────────

  /**
   * Copy the chain onto a record, inside the caller's transaction.
   *
   * Returns the number of stages snapshotted. **Zero is a meaningful answer**: it
   * means no chain is configured, or every stage is inactive, and the caller must
   * fall back to its own coded default rather than treating the record as
   * approved. Silence here would auto-approve, which is the one outcome nobody
   * wants from a misconfiguration.
   *
   * The snapshot is a COPY. Editing the chain afterwards changes nothing about a
   * record already in flight — that is the whole reason it exists.
   */
  async snapshot(
    tx: Tx,
    scope: ChainScope,
    owner: ChainOwner,
  ): Promise<{ stages: number; firstOrder: number | null }> {
    const chain = await chainRepository.findChain(scope);
    if (!chain || !chain.isActive) {
      logger.warn("No active approval chain; module default applies", {
        scope,
      });
      return { stages: 0, firstOrder: null };
    }

    const steps = await chainRepository.activeSteps(chain.id);
    if (steps.length === 0) {
      logger.warn(
        "Approval chain has no active stages; module default applies",
        {
          scope,
          chainId: chain.id,
        },
      );
      return { stages: 0, firstOrder: null };
    }

    // Snapshot orders are 1..N over the ACTIVE steps, so an inactive stage in
    // the middle of a chain does not leave a hole in the record's progress.
    const rows = steps.map((step, i) => ({
      order: i + 1,
      name: step.name,
      approverUserId: step.approverUser?.isActive ? step.approverUserId : null,
      status: DECISION_STATUS.PENDING as string,
    }));

    await chainRepository.createDecisions(tx, scope, owner, rows);
    return { stages: rows.length, firstOrder: 1 };
  }

  // ── Reading a record's progress ───────────────────────────────────────

  private toDecisionView(d: {
    id: string;
    order: number;
    name: string;
    status: string;
    decidedAt: Date | null;
    notes: string | null;
    approverUser: { id: string; name: string; email: string } | null;
    decidedBy: { id: string; name: string; email: string } | null;
  }): DecisionView {
    return {
      id: d.id,
      order: d.order,
      name: d.name,
      status: d.status as DecisionStatus,
      approver: d.approverUser,
      decidedBy: d.decidedBy,
      decidedAt: d.decidedAt?.toISOString() ?? null,
      notes: d.notes,
    };
  }

  async progress(owner: ChainOwner): Promise<ChainProgress> {
    const decisions = await chainRepository.findDecisions(owner);
    const views = decisions.map((d) => this.toDecisionView(d));
    const pending = views.find((d) => d.status === DECISION_STATUS.PENDING);
    const rejected = views.some((d) => d.status === DECISION_STATUS.REJECTED);

    return {
      currentOrder: pending?.order ?? null,
      // A record with no snapshot is NOT complete. It follows the module's coded
      // default, and calling it complete would auto-approve every legacy record.
      isComplete: views.length > 0 && !pending && !rejected,
      isRejected: rejected,
      totalStages: views.length,
      decisions: views,
    };
  }

  /**
   * Who should be notified about the stage currently awaiting a decision.
   *
   * Falls back to system admins when the stage names nobody who resolves. A
   * request that stalls visibly, with somebody told about it, beats one routed
   * into silence.
   */
  async currentApprovers(owner: ChainOwner) {
    const decisions = await chainRepository.findDecisions(owner);
    const pending = decisions.find((d) => d.status === DECISION_STATUS.PENDING);
    if (!pending) return [];

    if (pending.approverUser?.isActive) {
      const { id, name, email } = pending.approverUser;
      return [{ id, name, email }];
    }

    logger.warn("Approval stage has no resolvable approver; using admins", {
      decisionId: pending.id,
      stage: pending.name,
    });
    return chainRepository.systemAdmins();
  }

  /**
   * May this person decide the stage a record is waiting at?
   *
   * Identity, not permission: being the named approver IS the authority. A
   * super-grant holder may also act, because somebody has to be able to unstick
   * a chain whose approver has left, and when a stage resolves to nobody the
   * fallback is a system admin. All three answers are returned separately so the
   * caller can say WHY rather than just refusing.
   */
  async canDecide(
    owner: ChainOwner,
    actorId: string,
    opts: { hasSuperGrant: boolean; isSystemAdmin: boolean },
  ): Promise<{
    allowed: boolean;
    reason?: string;
    decisionId?: string;
    order?: number;
  }> {
    const progress = await this.progress(owner);

    if (progress.totalStages === 0) {
      return {
        allowed: false,
        reason: "This record is not following a configured approval chain",
      };
    }
    if (progress.isRejected) {
      return { allowed: false, reason: "This record was already rejected" };
    }
    if (progress.isComplete) {
      return { allowed: false, reason: "Every stage has already approved" };
    }

    const pending = progress.decisions.find(
      (d) => d.status === DECISION_STATUS.PENDING,
    )!;

    const isNamed = pending.approver?.id === actorId;
    const stageHasNobody = pending.approver === null;

    if (
      isNamed ||
      opts.hasSuperGrant ||
      (stageHasNobody && opts.isSystemAdmin)
    ) {
      return { allowed: true, decisionId: pending.id, order: pending.order };
    }

    return {
      allowed: false,
      reason: pending.approver
        ? `This stage is waiting on ${pending.approver.name}`
        : "This stage has no approver configured. A system administrator must fix the chain.",
    };
  }

  // ── Advancing ─────────────────────────────────────────────────────────

  /**
   * Record a decision on the stage a record is waiting at and report where it
   * lands. Runs inside the caller's transaction, so the record's own status
   * change and this cannot diverge.
   *
   * A rejection settles the current stage and marks every later stage skipped:
   * the chain is over, and leaving stages pending would keep the record in
   * somebody's queue forever.
   */
  async advance(
    tx: Tx,
    owner: ChainOwner,
    input: {
      decisionId: string;
      approve: boolean;
      actorId: string;
      notes?: string | null;
    },
  ): Promise<AdvanceResult> {
    const before = await chainRepository.findDecisionsTx(tx, owner);
    const target = before.find((d) => d.id === input.decisionId);
    if (!target) throw new NotFoundException("Approval stage not found");

    const settled = await chainRepository.settleDecision(tx, input.decisionId, {
      status: input.approve
        ? DECISION_STATUS.APPROVED
        : DECISION_STATUS.REJECTED,
      decidedById: input.actorId,
      decidedAt: new Date(),
      notes: input.notes ?? null,
    });

    // The conditional update matched nothing, so this stage was settled by
    // somebody else between the read and the write.
    if (settled.count === 0) {
      throw new ConflictException(
        "Somebody else has already decided this stage. Reload to see where it is now.",
      );
    }

    if (!input.approve) {
      await chainRepository.skipRemaining(tx, owner, target.order);
      return { settledOrder: target.order, nextOrder: null, isComplete: false };
    }

    const next = before.find(
      (d) => d.order > target.order && d.status === DECISION_STATUS.PENDING,
    );
    return {
      settledOrder: target.order,
      nextOrder: next?.order ?? null,
      isComplete: next === undefined,
    };
  }

  /**
   * Discard a record's snapshot so it can be re-submitted against the CURRENT
   * chain — used when a request is returned to draft or a rejection is reopened.
   *
   * Deliberately a fresh snapshot rather than a reset of the old one: by the time
   * something is resubmitted the chain may have changed, and the resubmission
   * should follow today's rules, not the ones captured weeks ago.
   */
  async clear(tx: Tx, owner: ChainOwner) {
    return chainRepository.deleteDecisions(tx, owner);
  }
}

export const chainService = new ChainService();
