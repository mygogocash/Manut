import type { Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";
import type { ChainScope } from "@/modules/approval-chains/chain.types";

// Prisma access for approval chains.
//
// Reads and simple writes live here per the module convention. The snapshot and
// advance operations do NOT: they compose several writes that must land together
// and belong beside the rules that guard them, in chain.service.ts.

/** A transaction client, so callers can fold chain writes into their own. */
export type Tx = Prisma.TransactionClient;

const approverSelect = { id: true, name: true, email: true, isActive: true };

const stepSelect = {
  id: true,
  order: true,
  name: true,
  description: true,
  approverUserId: true,
  isActive: true,
  isSystem: true,
  approverUser: { select: approverSelect },
} satisfies Prisma.ApprovalChainStepSelect;

const decisionSelect = {
  id: true,
  order: true,
  name: true,
  status: true,
  approverUserId: true,
  decidedById: true,
  decidedAt: true,
  notes: true,
  approverUser: { select: approverSelect },
  decidedBy: { select: approverSelect },
} satisfies Prisma.ApprovalChainDecisionSelect;

/** Identifies the record a snapshot belongs to. Exactly one side is set. */
export type ChainOwner =
  | { projectId: string; proposalId?: undefined }
  | { proposalId: string; projectId?: undefined };

export class ChainRepository {
  // ── Configuration ─────────────────────────────────────────────────────

  findChain(scope: ChainScope) {
    return prisma.approvalChain.findUnique({
      where: { scope },
      include: { steps: { orderBy: { order: "asc" }, select: stepSelect } },
    });
  }

  findChainById(id: string) {
    return prisma.approvalChain.findUnique({
      where: { id },
      include: { steps: { orderBy: { order: "asc" }, select: stepSelect } },
    });
  }

  listChains() {
    return prisma.approvalChain.findMany({
      orderBy: { scope: "asc" },
      include: { steps: { orderBy: { order: "asc" }, select: stepSelect } },
    });
  }

  /** Creates the chain row for a scope. The migration seeds both, so this is
   *  only reached if a row was removed by hand. */
  createChain(scope: ChainScope, name: string, description?: string | null) {
    return prisma.approvalChain.create({
      data: { scope, name, description: description ?? null },
      include: { steps: { orderBy: { order: "asc" }, select: stepSelect } },
    });
  }

  updateChain(
    id: string,
    data: { name?: string; description?: string | null; isActive?: boolean },
  ) {
    return prisma.approvalChain.update({ where: { id }, data });
  }

  findStep(id: string) {
    return prisma.approvalChainStep.findUnique({
      where: { id },
      select: { ...stepSelect, chainId: true },
    });
  }

  countSteps(chainId: string, onlyActive = false) {
    return prisma.approvalChainStep.count({
      where: { chainId, ...(onlyActive ? { isActive: true } : {}) },
    });
  }

  /** Next free order, so a new stage lands at the end of the chain. */
  async nextStepOrder(chainId: string) {
    const last = await prisma.approvalChainStep.findFirst({
      where: { chainId },
      orderBy: { order: "desc" },
      select: { order: true },
    });
    return (last?.order ?? 0) + 1;
  }

  createStep(data: {
    chainId: string;
    order: number;
    name: string;
    description?: string | null;
    approverUserId?: string | null;
  }) {
    return prisma.approvalChainStep.create({
      data: {
        chainId: data.chainId,
        order: data.order,
        name: data.name,
        description: data.description ?? null,
        approverUserId: data.approverUserId ?? null,
      },
      select: stepSelect,
    });
  }

  updateStep(
    id: string,
    data: {
      name?: string;
      description?: string | null;
      approverUserId?: string | null;
      isActive?: boolean;
    },
  ) {
    return prisma.approvalChainStep.update({
      where: { id },
      data,
      select: stepSelect,
    });
  }

  deleteStep(id: string) {
    return prisma.approvalChainStep.delete({ where: { id } });
  }

  /**
   * Reorder in two phases: park every row in a high range, then renumber to
   * 1..N. A single pass would trip the `(chain_id, order)` unique index the
   * moment two stages swap.
   */
  reorderSteps(chainId: string, orderedIds: string[]) {
    return prisma.$transaction(async (tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.approvalChainStep.update({
          where: { id: orderedIds[i]! },
          data: { order: 10_000 + i },
        });
      }
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.approvalChainStep.update({
          where: { id: orderedIds[i]! },
          data: { order: i + 1 },
        });
      }
      return tx.approvalChainStep.findMany({
        where: { chainId },
        orderBy: { order: "asc" },
        select: stepSelect,
      });
    });
  }

  /** Every step id on a chain, to validate a reorder covers exactly the set. */
  async stepIds(chainId: string): Promise<string[]> {
    const rows = await prisma.approvalChainStep.findMany({
      where: { chainId },
      orderBy: { order: "asc" },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  /** Active steps in order, which is what a snapshot is built from. */
  activeSteps(chainId: string) {
    return prisma.approvalChainStep.findMany({
      where: { chainId, isActive: true },
      orderBy: { order: "asc" },
      select: stepSelect,
    });
  }

  // ── Per-record snapshot ───────────────────────────────────────────────

  /** Written inside the caller's transaction, so a record cannot be submitted
   *  without its chain snapshot. */
  createDecisions(
    tx: Tx,
    scope: ChainScope,
    owner: ChainOwner,
    rows: Array<{
      order: number;
      name: string;
      approverUserId: string | null;
      status: string;
    }>,
  ) {
    return tx.approvalChainDecision.createMany({
      data: rows.map((r) => ({
        scope,
        projectId: owner.projectId ?? null,
        proposalId: owner.proposalId ?? null,
        order: r.order,
        name: r.name,
        approverUserId: r.approverUserId,
        status: r.status,
      })),
    });
  }

  findDecisions(owner: ChainOwner) {
    return prisma.approvalChainDecision.findMany({
      where: {
        projectId: owner.projectId ?? undefined,
        proposalId: owner.proposalId ?? undefined,
      },
      orderBy: { order: "asc" },
      select: decisionSelect,
    });
  }

  findDecisionsTx(tx: Tx, owner: ChainOwner) {
    return tx.approvalChainDecision.findMany({
      where: {
        projectId: owner.projectId ?? undefined,
        proposalId: owner.proposalId ?? undefined,
      },
      orderBy: { order: "asc" },
      select: decisionSelect,
    });
  }

  /**
   * Records a decision on one stage, CONDITIONALLY on it still being pending.
   *
   * `updateMany` rather than `update` so the count reveals a race: two approvers
   * acting at once would otherwise both write, and the second would silently
   * overwrite the first. The caller treats count 0 as "somebody got here first".
   */
  settleDecision(
    tx: Tx,
    decisionId: string,
    data: {
      status: string;
      decidedById: string;
      decidedAt: Date;
      notes?: string | null;
    },
  ) {
    return tx.approvalChainDecision.updateMany({
      where: { id: decisionId, status: "pending" },
      data: {
        status: data.status,
        decidedById: data.decidedById,
        decidedAt: data.decidedAt,
        notes: data.notes ?? null,
      },
    });
  }

  /** Marks the remaining stages skipped, used when a record is rejected. */
  skipRemaining(tx: Tx, owner: ChainOwner, fromOrder: number) {
    return tx.approvalChainDecision.updateMany({
      where: {
        projectId: owner.projectId ?? undefined,
        proposalId: owner.proposalId ?? undefined,
        order: { gt: fromOrder },
        status: "pending",
      },
      data: { status: "skipped" },
    });
  }

  deleteDecisions(tx: Tx, owner: ChainOwner) {
    return tx.approvalChainDecision.deleteMany({
      where: {
        projectId: owner.projectId ?? undefined,
        proposalId: owner.proposalId ?? undefined,
      },
    });
  }

  /** System admins, the fallback when a stage names nobody who resolves. */
  systemAdmins() {
    return prisma.user.findMany({
      where: {
        isActive: true,
        email: { not: { endsWith: "@placeholder.local" } },
        userRoles: {
          some: { role: { isSystem: true, name: "Admin", deletedAt: null } },
        },
      },
      select: { id: true, name: true, email: true },
      take: 10,
    });
  }
}

export const chainRepository = new ChainRepository();
