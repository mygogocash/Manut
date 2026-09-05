import { asc, desc, eq } from "drizzle-orm";
import type { Db, DbTransaction } from "@nexora/db";
import { schema } from "@nexora/db";
import { alias } from "drizzle-orm/pg-core";

type DbLike = Db | DbTransaction;

const approverUser = alias(schema.users, "payroll_approval_approver");

const stepCols = {
  id: schema.payrollApprovalSteps.id,
  order: schema.payrollApprovalSteps.order,
  name: schema.payrollApprovalSteps.name,
  description: schema.payrollApprovalSteps.description,
  approverUserId: schema.payrollApprovalSteps.approverUserId,
  isActive: schema.payrollApprovalSteps.isActive,
  createdAt: schema.payrollApprovalSteps.createdAt,
  updatedAt: schema.payrollApprovalSteps.updatedAt,
  approverId: approverUser.id,
  approverName: approverUser.name,
  approverEmail: approverUser.email,
  approverJobTitle: approverUser.jobTitle,
};

function mapStep(row: {
  id: string;
  order: number;
  name: string;
  description: string | null;
  approverUserId: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  approverId: string | null;
  approverName: string | null;
  approverEmail: string | null;
  approverJobTitle: string | null;
}) {
  return {
    id: row.id,
    order: row.order,
    name: row.name,
    description: row.description,
    approverUserId: row.approverUserId,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    approverUser: row.approverId
      ? {
          id: row.approverId,
          name: row.approverName ?? "",
          email: row.approverEmail ?? "",
          jobTitle: row.approverJobTitle,
        }
      : null,
  };
}

export async function list(db: DbLike) {
  const rows = await db
    .select(stepCols)
    .from(schema.payrollApprovalSteps)
    .leftJoin(approverUser, eq(schema.payrollApprovalSteps.approverUserId, approverUser.id))
    .orderBy(asc(schema.payrollApprovalSteps.order));
  return rows.map(mapStep);
}

export async function findById(db: DbLike, id: string) {
  const [row] = await db
    .select(stepCols)
    .from(schema.payrollApprovalSteps)
    .leftJoin(approverUser, eq(schema.payrollApprovalSteps.approverUserId, approverUser.id))
    .where(eq(schema.payrollApprovalSteps.id, id))
    .limit(1);
  return row ? mapStep(row) : null;
}

export async function nextOrder(db: DbLike) {
  const [last] = await db
    .select({ order: schema.payrollApprovalSteps.order })
    .from(schema.payrollApprovalSteps)
    .orderBy(desc(schema.payrollApprovalSteps.order))
    .limit(1);
  return (last?.order ?? 0) + 1;
}

export async function create(
  db: DbLike,
  data: {
    order: number;
    name: string;
    description: string | null;
    approverUserId: string;
    isActive: boolean;
  },
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.payrollApprovalSteps).values({
    id,
    order: data.order,
    name: data.name,
    description: data.description,
    approverUserId: data.approverUserId,
    isActive: data.isActive,
    createdAt: now,
    updatedAt: now,
  });
  return findById(db, id);
}

export async function update(
  db: DbLike,
  id: string,
  data: Partial<{
    name: string;
    description: string | null;
    approverUserId: string;
    isActive: boolean;
  }>,
) {
  const patch: Record<string, string | boolean | null> = {
    updatedAt: new Date().toISOString(),
  };
  if (data.name !== undefined) patch.name = data.name;
  if (data.description !== undefined) patch.description = data.description;
  if (data.approverUserId !== undefined) patch.approverUserId = data.approverUserId;
  if (data.isActive !== undefined) patch.isActive = data.isActive;
  await db
    .update(schema.payrollApprovalSteps)
    .set(patch)
    .where(eq(schema.payrollApprovalSteps.id, id));
  return findById(db, id);
}

export async function remove(db: DbLike, id: string) {
  await db.delete(schema.payrollApprovalSteps).where(eq(schema.payrollApprovalSteps.id, id));
}

export async function reorder(db: Db, orderedIds: string[]) {
  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(schema.payrollApprovalSteps)
        .set({ order: -(i + 1), updatedAt: new Date().toISOString() })
        .where(eq(schema.payrollApprovalSteps.id, orderedIds[i]!));
    }
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(schema.payrollApprovalSteps)
        .set({ order: i + 1, updatedAt: new Date().toISOString() })
        .where(eq(schema.payrollApprovalSteps.id, orderedIds[i]!));
    }
  });
}
