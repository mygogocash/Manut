import type {
  ChainProgress,
  ChainScope,
  ChainStepView,
  ChainView,
  DecisionStatus,
  DecisionView,
} from "@nexora/contracts/modules/approval-chains/chain.types";
import {
  CHAIN_SCOPE_LABELS,
  DECISION_STATUS,
  MAX_CHAIN_STEPS,
} from "@nexora/contracts/modules/approval-chains/chain.types";
import type { Db } from "@nexora/db";
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from "../http-exception";
import * as chainRepository from "./chain.repository";
import type { ChainOwner, Tx } from "./chain.repository";

/** Rows the engine hands back after a decision, so the caller can react. */
export interface AdvanceResult {
  settledOrder: number;
  nextOrder: number | null;
  isComplete: boolean;
}

function toStepView(step: {
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

function toDecisionView(d: {
  id: string;
  order: number;
  name: string;
  status: string;
  decidedAt: string | null;
  notes: string | null;
  approverUser: {
    id: string;
    name: string;
    email: string;
    isActive: boolean;
  } | null;
  decidedBy: { id: string; name: string; email: string } | null;
}): DecisionView {
  return {
    id: d.id,
    order: d.order,
    name: d.name,
    status: d.status as DecisionStatus,
    approver: d.approverUser
      ? {
          id: d.approverUser.id,
          name: d.approverUser.name,
          email: d.approverUser.email,
        }
      : null,
    decidedBy: d.decidedBy,
    decidedAt: d.decidedAt,
    notes: d.notes,
  };
}

async function requireChain(db: Db, scope: ChainScope) {
  const chain = await chainRepository.findChain(db, scope);
  if (!chain) {
    throw new NotFoundException(
      `No approval chain is configured for ${CHAIN_SCOPE_LABELS[scope] ?? scope}`,
    );
  }
  return chain;
}

function assertNotSystemStage(step: { isSystem: boolean; name: string }) {
  if (step.isSystem) {
    throw new BadRequestException(
      `"${step.name}" is part of the approval flow and cannot be removed. You can rename it or change who approves at it.`,
    );
  }
}

async function assertNotLastActiveStep(db: Db, chainId: string) {
  const active = await chainRepository.countSteps(db, chainId, true);
  if (active <= 1) {
    throw new BadRequestException(
      "A chain must keep at least one active stage. Add a replacement stage first.",
    );
  }
}

export async function getChain(
  db: Db,
  scope: ChainScope,
): Promise<ChainView | null> {
  const chain = await chainRepository.findChain(db, scope);
  if (!chain) return null;
  return {
    id: chain.id,
    scope: chain.scope as ChainScope,
    name: chain.name,
    description: chain.description,
    isActive: chain.isActive,
    steps: chain.steps.map((s) => toStepView(s)),
  };
}

export async function listChains(db: Db): Promise<ChainView[]> {
  const chains = await chainRepository.listChains(db);
  return chains.map((chain) => ({
    id: chain.id,
    scope: chain.scope as ChainScope,
    name: chain.name,
    description: chain.description,
    isActive: chain.isActive,
    steps: chain.steps.map((s) => toStepView(s)),
  }));
}

export async function addStep(
  db: Db,
  scope: ChainScope,
  input: {
    name: string;
    description?: string | null;
    approverUserId?: string | null;
  },
) {
  const chain = await requireChain(db, scope);

  const existing = await chainRepository.countSteps(db, chain.id);
  if (existing >= MAX_CHAIN_STEPS) {
    throw new BadRequestException(
      `A chain can hold at most ${MAX_CHAIN_STEPS} stages`,
    );
  }

  const order = await chainRepository.nextStepOrder(db, chain.id);
  return chainRepository.createStep(db, { chainId: chain.id, order, ...input });
}

export async function updateStep(
  db: Db,
  stepId: string,
  input: {
    name?: string;
    description?: string | null;
    approverUserId?: string | null;
    isActive?: boolean;
  },
) {
  const step = await chainRepository.findStep(db, stepId);
  if (!step) throw new NotFoundException("Stage not found");

  if (input.isActive === false && step.isActive) {
    assertNotSystemStage(step);
    await assertNotLastActiveStep(db, step.chainId);
  }

  return chainRepository.updateStep(db, stepId, input);
}

export async function removeStep(db: Db, stepId: string) {
  const step = await chainRepository.findStep(db, stepId);
  if (!step) throw new NotFoundException("Stage not found");
  assertNotSystemStage(step);
  if (step.isActive) await assertNotLastActiveStep(db, step.chainId);

  await chainRepository.deleteStep(db, stepId);

  const remaining = await chainRepository.stepIds(db, step.chainId);
  if (remaining.length > 0) {
    await chainRepository.reorderSteps(db, step.chainId, remaining);
  }
  return { removed: true };
}

export async function reorderSteps(
  db: Db,
  scope: ChainScope,
  orderedIds: string[],
) {
  const chain = await requireChain(db, scope);
  const known = await chainRepository.stepIds(db, chain.id);

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

  return chainRepository.reorderSteps(db, chain.id, orderedIds);
}

export async function updateChain(
  db: Db,
  scope: ChainScope,
  input: { name?: string; description?: string | null; isActive?: boolean },
) {
  const chain = await requireChain(db, scope);
  return chainRepository.updateChain(db, chain.id, input);
}

export async function snapshot(
  db: Db,
  tx: Tx,
  scope: ChainScope,
  owner: ChainOwner,
): Promise<{ stages: number; firstOrder: number | null }> {
  const chain = await chainRepository.findChain(db, scope);
  if (!chain || !chain.isActive) {
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "approval_chain_snapshot_no_active_chain",
        scope,
      }),
    );
    return { stages: 0, firstOrder: null };
  }

  const steps = await chainRepository.activeSteps(db, chain.id);
  if (steps.length === 0) {
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "approval_chain_snapshot_no_active_stages",
        scope,
        chainId: chain.id,
      }),
    );
    return { stages: 0, firstOrder: null };
  }

  const rows = steps.map((step, i) => ({
    order: i + 1,
    name: step.name,
    approverUserId: step.approverUser?.isActive ? step.approverUserId : null,
    status: DECISION_STATUS.PENDING as string,
  }));

  await chainRepository.createDecisions(tx, scope, owner, rows);
  return { stages: rows.length, firstOrder: 1 };
}

export async function progress(
  db: Db,
  owner: ChainOwner,
): Promise<ChainProgress> {
  const decisions = await chainRepository.findDecisions(db, owner);
  const views = decisions.map((d) => toDecisionView(d));
  const pending = views.find((d) => d.status === DECISION_STATUS.PENDING);
  const rejected = views.some((d) => d.status === DECISION_STATUS.REJECTED);

  return {
    currentOrder: pending?.order ?? null,
    isComplete: views.length > 0 && !pending && !rejected,
    isRejected: rejected,
    totalStages: views.length,
    decisions: views,
  };
}

export async function currentApprovers(db: Db, owner: ChainOwner) {
  const decisions = await chainRepository.findDecisions(db, owner);
  const pending = decisions.find((d) => d.status === DECISION_STATUS.PENDING);
  if (!pending) return [];

  if (pending.approverUser?.isActive) {
    const { id, name, email } = pending.approverUser;
    return [{ id, name, email }];
  }

  console.warn(
    JSON.stringify({
      level: "warn",
      event: "approval_chain_no_resolvable_approver",
      decisionId: pending.id,
      stage: pending.name,
    }),
  );
  return chainRepository.systemAdmins(db);
}

export async function canDecide(
  db: Db,
  owner: ChainOwner,
  actorId: string,
  opts: { hasSuperGrant: boolean; isSystemAdmin: boolean },
): Promise<{
  allowed: boolean;
  reason?: string;
  decisionId?: string;
  order?: number;
}> {
  const prog = await progress(db, owner);

  if (prog.totalStages === 0) {
    return {
      allowed: false,
      reason: "This record is not following a configured approval chain",
    };
  }
  if (prog.isRejected) {
    return { allowed: false, reason: "This record was already rejected" };
  }
  if (prog.isComplete) {
    return { allowed: false, reason: "Every stage has already approved" };
  }

  const pending = prog.decisions.find(
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

export async function advance(
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

export async function clear(tx: Tx, owner: ChainOwner) {
  return chainRepository.deleteDecisions(tx, owner);
}
