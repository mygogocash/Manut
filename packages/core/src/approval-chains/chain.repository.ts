import {
  and,
  asc,
  count,
  desc,
  eq,
  gt,
  isNull,
  like,
  not,
  type SQL,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { ChainScope } from "@nexora/contracts/modules/approval-chains/chain.types";
import type { Db, DbTransaction } from "@nexora/db";
import { schema } from "@nexora/db";
import { createCuid } from "../lib/id";

export type { DbTransaction as Tx } from "@nexora/db";

/** Identifies the record a snapshot belongs to. Exactly one side is set. */
export type ChainOwner =
  | { projectId: string; proposalId?: undefined }
  | { proposalId: string; projectId?: undefined };

type DbLike = Db | DbTransaction;

const stepApprover = alias(schema.users, "chain_step_approver");
const decisionApprover = alias(schema.users, "chain_decision_approver");
const decisionDecidedBy = alias(schema.users, "chain_decision_decided_by");

function ownerWhere(owner: ChainOwner): SQL {
  if (owner.projectId !== undefined) {
    return eq(schema.approvalChainDecisions.projectId, owner.projectId);
  }
  return eq(schema.approvalChainDecisions.proposalId, owner.proposalId);
}

type StepShape = {
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
};

async function loadSteps(
  db: DbLike,
  chainId: string,
  onlyActive = false,
): Promise<StepShape[]> {
  const parts: SQL[] = [eq(schema.approvalChainSteps.chainId, chainId)];
  if (onlyActive) parts.push(eq(schema.approvalChainSteps.isActive, true));

  const rows = await db
    .select({
      id: schema.approvalChainSteps.id,
      order: schema.approvalChainSteps.order,
      name: schema.approvalChainSteps.name,
      description: schema.approvalChainSteps.description,
      approverUserId: schema.approvalChainSteps.approverUserId,
      isActive: schema.approvalChainSteps.isActive,
      isSystem: schema.approvalChainSteps.isSystem,
      approverId: stepApprover.id,
      approverName: stepApprover.name,
      approverEmail: stepApprover.email,
      approverIsActive: stepApprover.isActive,
    })
    .from(schema.approvalChainSteps)
    .leftJoin(
      stepApprover,
      eq(schema.approvalChainSteps.approverUserId, stepApprover.id),
    )
    .where(and(...parts))
    .orderBy(asc(schema.approvalChainSteps.order));

  return rows.map((r) => ({
    id: r.id,
    order: r.order,
    name: r.name,
    description: r.description,
    approverUserId: r.approverUserId,
    isActive: r.isActive,
    isSystem: r.isSystem,
    approverUser: r.approverId
      ? {
          id: r.approverId,
          name: r.approverName!,
          email: r.approverEmail!,
          isActive: r.approverIsActive!,
        }
      : null,
  }));
}

type DecisionShape = {
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
};

async function loadDecisions(
  db: DbLike,
  owner: ChainOwner,
): Promise<DecisionShape[]> {
  const rows = await db
    .select({
      id: schema.approvalChainDecisions.id,
      order: schema.approvalChainDecisions.order,
      name: schema.approvalChainDecisions.name,
      status: schema.approvalChainDecisions.status,
      decidedAt: schema.approvalChainDecisions.decidedAt,
      notes: schema.approvalChainDecisions.notes,
      approverId: decisionApprover.id,
      approverName: decisionApprover.name,
      approverEmail: decisionApprover.email,
      approverIsActive: decisionApprover.isActive,
      decidedById: decisionDecidedBy.id,
      decidedByName: decisionDecidedBy.name,
      decidedByEmail: decisionDecidedBy.email,
    })
    .from(schema.approvalChainDecisions)
    .leftJoin(
      decisionApprover,
      eq(
        schema.approvalChainDecisions.approverUserId,
        decisionApprover.id,
      ),
    )
    .leftJoin(
      decisionDecidedBy,
      eq(schema.approvalChainDecisions.decidedById, decisionDecidedBy.id),
    )
    .where(ownerWhere(owner))
    .orderBy(asc(schema.approvalChainDecisions.order));

  return rows.map((r) => ({
    id: r.id,
    order: r.order,
    name: r.name,
    status: r.status,
    decidedAt: r.decidedAt,
    notes: r.notes,
    approverUser: r.approverId
      ? {
          id: r.approverId,
          name: r.approverName!,
          email: r.approverEmail!,
          isActive: r.approverIsActive!,
        }
      : null,
    decidedBy: r.decidedById
      ? {
          id: r.decidedById,
          name: r.decidedByName!,
          email: r.decidedByEmail!,
        }
      : null,
  }));
}

export async function findChain(db: Db, scope: ChainScope) {
  const [chain] = await db
    .select()
    .from(schema.approvalChains)
    .where(eq(schema.approvalChains.scope, scope))
    .limit(1);
  if (!chain) return null;
  const steps = await loadSteps(db, chain.id);
  return { ...chain, steps };
}

export async function listChains(db: Db) {
  const chains = await db
    .select()
    .from(schema.approvalChains)
    .orderBy(asc(schema.approvalChains.scope));
  return Promise.all(
    chains.map(async (chain) => ({
      ...chain,
      steps: await loadSteps(db, chain.id),
    })),
  );
}

export async function updateChain(
  db: Db,
  id: string,
  data: {
    name?: string;
    description?: string | null;
    isActive?: boolean;
  },
) {
  const patch: Partial<typeof schema.approvalChains.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  };
  if (data.name !== undefined) patch.name = data.name;
  if (data.description !== undefined) patch.description = data.description;
  if (data.isActive !== undefined) patch.isActive = data.isActive;
  const [row] = await db
    .update(schema.approvalChains)
    .set(patch)
    .where(eq(schema.approvalChains.id, id))
    .returning();
  return row!;
}

export async function findStep(db: Db, id: string) {
  const [row] = await db
    .select({
      id: schema.approvalChainSteps.id,
      order: schema.approvalChainSteps.order,
      name: schema.approvalChainSteps.name,
      description: schema.approvalChainSteps.description,
      approverUserId: schema.approvalChainSteps.approverUserId,
      isActive: schema.approvalChainSteps.isActive,
      isSystem: schema.approvalChainSteps.isSystem,
      chainId: schema.approvalChainSteps.chainId,
      approverId: stepApprover.id,
      approverName: stepApprover.name,
      approverEmail: stepApprover.email,
      approverIsActive: stepApprover.isActive,
    })
    .from(schema.approvalChainSteps)
    .leftJoin(
      stepApprover,
      eq(schema.approvalChainSteps.approverUserId, stepApprover.id),
    )
    .where(eq(schema.approvalChainSteps.id, id))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    order: row.order,
    name: row.name,
    description: row.description,
    approverUserId: row.approverUserId,
    isActive: row.isActive,
    isSystem: row.isSystem,
    chainId: row.chainId,
    approverUser: row.approverId
      ? {
          id: row.approverId,
          name: row.approverName!,
          email: row.approverEmail!,
          isActive: row.approverIsActive!,
        }
      : null,
  };
}

export async function countSteps(
  db: Db,
  chainId: string,
  onlyActive = false,
) {
  const parts: SQL[] = [eq(schema.approvalChainSteps.chainId, chainId)];
  if (onlyActive) parts.push(eq(schema.approvalChainSteps.isActive, true));
  const [row] = await db
    .select({ n: count() })
    .from(schema.approvalChainSteps)
    .where(and(...parts));
  return Number(row?.n ?? 0);
}

export async function nextStepOrder(db: Db, chainId: string) {
  const [last] = await db
    .select({ order: schema.approvalChainSteps.order })
    .from(schema.approvalChainSteps)
    .where(eq(schema.approvalChainSteps.chainId, chainId))
    .orderBy(desc(schema.approvalChainSteps.order))
    .limit(1);
  return (last?.order ?? 0) + 1;
}

export async function createStep(
  db: Db,
  data: {
    chainId: string;
    order: number;
    name: string;
    description?: string | null;
    approverUserId?: string | null;
  },
) {
  const id = createCuid();
  const now = new Date().toISOString();
  await db.insert(schema.approvalChainSteps).values({
    id,
    chainId: data.chainId,
    order: data.order,
    name: data.name,
    description: data.description ?? null,
    approverUserId: data.approverUserId ?? null,
    updatedAt: now,
  });
  const step = await findStep(db, id);
  return step!;
}

export async function updateStep(
  db: Db,
  id: string,
  data: {
    name?: string;
    description?: string | null;
    approverUserId?: string | null;
    isActive?: boolean;
  },
) {
  const patch: Partial<typeof schema.approvalChainSteps.$inferInsert> = {
    updatedAt: new Date().toISOString(),
  };
  if (data.name !== undefined) patch.name = data.name;
  if (data.description !== undefined) patch.description = data.description;
  if (data.approverUserId !== undefined) {
    patch.approverUserId = data.approverUserId;
  }
  if (data.isActive !== undefined) patch.isActive = data.isActive;
  await db
    .update(schema.approvalChainSteps)
    .set(patch)
    .where(eq(schema.approvalChainSteps.id, id));
  const step = await findStep(db, id);
  return step!;
}

export async function deleteStep(db: Db, id: string) {
  await db
    .delete(schema.approvalChainSteps)
    .where(eq(schema.approvalChainSteps.id, id));
}

export async function reorderSteps(
  db: Db,
  chainId: string,
  orderedIds: string[],
) {
  const now = new Date().toISOString();
  return db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(schema.approvalChainSteps)
        .set({ order: 10_000 + i, updatedAt: now })
        .where(eq(schema.approvalChainSteps.id, orderedIds[i]!));
    }
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(schema.approvalChainSteps)
        .set({ order: i + 1, updatedAt: now })
        .where(eq(schema.approvalChainSteps.id, orderedIds[i]!));
    }
    return loadSteps(tx, chainId);
  });
}

export async function stepIds(db: Db, chainId: string): Promise<string[]> {
  const rows = await db
    .select({ id: schema.approvalChainSteps.id })
    .from(schema.approvalChainSteps)
    .where(eq(schema.approvalChainSteps.chainId, chainId))
    .orderBy(asc(schema.approvalChainSteps.order));
  return rows.map((r) => r.id);
}

export async function activeSteps(db: Db, chainId: string) {
  return loadSteps(db, chainId, true);
}

export async function createDecisions(
  tx: DbTransaction,
  scope: ChainScope,
  owner: ChainOwner,
  rows: Array<{
    order: number;
    name: string;
    approverUserId: string | null;
    status: string;
  }>,
) {
  if (rows.length === 0) return;
  const now = new Date().toISOString();
  await tx.insert(schema.approvalChainDecisions).values(
    rows.map((r) => ({
      id: createCuid(),
      scope,
      projectId: owner.projectId ?? null,
      proposalId: owner.proposalId ?? null,
      order: r.order,
      name: r.name,
      approverUserId: r.approverUserId,
      status: r.status,
      createdAt: now,
    })),
  );
}

export async function findDecisions(db: Db, owner: ChainOwner) {
  return loadDecisions(db, owner);
}

export async function findDecisionsTx(tx: DbTransaction, owner: ChainOwner) {
  return loadDecisions(tx, owner);
}

export async function settleDecision(
  tx: DbTransaction,
  decisionId: string,
  data: {
    status: string;
    decidedById: string;
    decidedAt: Date;
    notes?: string | null;
  },
) {
  const updated = await tx
    .update(schema.approvalChainDecisions)
    .set({
      status: data.status,
      decidedById: data.decidedById,
      decidedAt: data.decidedAt.toISOString(),
      notes: data.notes ?? null,
    })
    .where(
      and(
        eq(schema.approvalChainDecisions.id, decisionId),
        eq(schema.approvalChainDecisions.status, "pending"),
      ),
    )
    .returning({ id: schema.approvalChainDecisions.id });
  return { count: updated.length };
}

export async function skipRemaining(
  tx: DbTransaction,
  owner: ChainOwner,
  fromOrder: number,
) {
  await tx
    .update(schema.approvalChainDecisions)
    .set({ status: "skipped" })
    .where(
      and(
        ownerWhere(owner),
        gt(schema.approvalChainDecisions.order, fromOrder),
        eq(schema.approvalChainDecisions.status, "pending"),
      ),
    );
}

export async function deleteDecisions(tx: DbTransaction, owner: ChainOwner) {
  await tx
    .delete(schema.approvalChainDecisions)
    .where(ownerWhere(owner));
}

export async function systemAdmins(db: Db) {
  return db
    .selectDistinct({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
    })
    .from(schema.users)
    .innerJoin(schema.userRoles, eq(schema.userRoles.userId, schema.users.id))
    .innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
    .where(
      and(
        eq(schema.users.isActive, true),
        not(like(schema.users.email, "%@placeholder.local")),
        eq(schema.roles.isSystem, true),
        eq(schema.roles.name, "Admin"),
        isNull(schema.roles.deletedAt),
      ),
    )
    .limit(10);
}
