import {
  and,
  asc,
  count,
  desc,
  eq,
  isNull,
  type SQL,
} from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";
import { alias } from "drizzle-orm/pg-core";

const decisionApproverUser = alias(schema.users, "ca_decision_approver_user");
const decisionDecidedBy = alias(schema.users, "ca_decision_decided_by");
const stepApproverUser = alias(schema.users, "ca_step_approver_user");

const employeeCols = {
  id: schema.users.id,
  name: schema.users.name,
  email: schema.users.email,
  department: schema.users.department,
  jobTitle: schema.users.jobTitle,
};

const entityCols = {
  id: schema.entities.id,
  name: schema.entities.name,
  code: schema.entities.code,
};

const approverCols = {
  id: schema.users.id,
  name: schema.users.name,
  email: schema.users.email,
};

export type CashAdvanceWithRelations = NonNullable<
  Awaited<ReturnType<typeof findByIdIncludingDeleted>>
>;

async function loadItems(db: Db, requestId: string) {
  const rows = await db
    .select({
      id: schema.cashAdvanceItems.id,
      position: schema.cashAdvanceItems.position,
      description: schema.cashAdvanceItems.description,
      categoryId: schema.cashAdvanceItems.categoryId,
      requestedAmount: schema.cashAdvanceItems.requestedAmount,
      approvedAmount: schema.cashAdvanceItems.approvedAmount,
      receiptUrl: schema.cashAdvanceItems.receiptUrl,
      categoryName: schema.expenseCategories.name,
    })
    .from(schema.cashAdvanceItems)
    .leftJoin(
      schema.expenseCategories,
      eq(schema.cashAdvanceItems.categoryId, schema.expenseCategories.id),
    )
    .where(eq(schema.cashAdvanceItems.requestId, requestId))
    .orderBy(asc(schema.cashAdvanceItems.position));

  return rows.map((r) => ({
    id: r.id,
    position: r.position,
    description: r.description,
    categoryId: r.categoryId,
    requestedAmount: r.requestedAmount,
    approvedAmount: r.approvedAmount,
    receiptUrl: r.receiptUrl,
    category: r.categoryId && r.categoryName ? { id: r.categoryId, name: r.categoryName } : null,
  }));
}

async function loadDecisions(db: Db, requestId: string) {
  const rows = await db
    .select({
      id: schema.cashAdvanceApprovalDecisions.id,
      order: schema.cashAdvanceApprovalDecisions.order,
      name: schema.cashAdvanceApprovalDecisions.name,
      approverType: schema.cashAdvanceApprovalDecisions.approverType,
      approverUserId: schema.cashAdvanceApprovalDecisions.approverUserId,
      status: schema.cashAdvanceApprovalDecisions.status,
      decidedById: schema.cashAdvanceApprovalDecisions.decidedById,
      decidedAt: schema.cashAdvanceApprovalDecisions.decidedAt,
      notes: schema.cashAdvanceApprovalDecisions.notes,
      approverUserIdCol: decisionApproverUser.id,
      approverUserName: decisionApproverUser.name,
      approverUserEmail: decisionApproverUser.email,
      decidedByIdCol: decisionDecidedBy.id,
      decidedByName: decisionDecidedBy.name,
      decidedByEmail: decisionDecidedBy.email,
    })
    .from(schema.cashAdvanceApprovalDecisions)
    .leftJoin(
      decisionApproverUser,
      eq(schema.cashAdvanceApprovalDecisions.approverUserId, decisionApproverUser.id),
    )
    .leftJoin(
      decisionDecidedBy,
      eq(schema.cashAdvanceApprovalDecisions.decidedById, decisionDecidedBy.id),
    )
    .where(eq(schema.cashAdvanceApprovalDecisions.cashAdvanceRequestId, requestId))
    .orderBy(asc(schema.cashAdvanceApprovalDecisions.order));

  return rows.map((r) => ({
    id: r.id,
    order: r.order,
    name: r.name,
    approverType: r.approverType,
    approverUserId: r.approverUserId,
    status: r.status,
    decidedById: r.decidedById,
    decidedAt: r.decidedAt,
    notes: r.notes,
    approverUser:
      r.approverUserIdCol != null
        ? { id: r.approverUserIdCol, name: r.approverUserName!, email: r.approverUserEmail! }
        : null,
    decidedBy:
      r.decidedByIdCol != null
        ? { id: r.decidedByIdCol, name: r.decidedByName!, email: r.decidedByEmail! }
        : null,
  }));
}

async function withRelations(db: Db, row: typeof schema.cashAdvanceRequests.$inferSelect) {
  const [[employee], entityRows, approverRows, items, approvalDecisions] = await Promise.all([
    db.select(employeeCols).from(schema.users).where(eq(schema.users.id, row.employeeId)).limit(1),
    row.entityId
      ? db.select(entityCols).from(schema.entities).where(eq(schema.entities.id, row.entityId)).limit(1)
      : Promise.resolve([]),
    row.approvedBy
      ? db.select(approverCols).from(schema.users).where(eq(schema.users.id, row.approvedBy)).limit(1)
      : Promise.resolve([]),
    loadItems(db, row.id),
    loadDecisions(db, row.id),
  ]);

  return {
    ...row,
    employee: employee ?? null,
    entity: entityRows[0] ?? null,
    approver: approverRows[0] ?? null,
    items,
    approvalDecisions,
  };
}

function buildListWhere(filters: { employeeId?: string; status?: string }) {
  const parts: SQL[] = [isNull(schema.cashAdvanceRequests.deletedAt)];
  if (filters.employeeId) parts.push(eq(schema.cashAdvanceRequests.employeeId, filters.employeeId));
  if (filters.status) parts.push(eq(schema.cashAdvanceRequests.status, filters.status));
  return and(...parts);
}

export async function list(
  db: Db,
  filters: { employeeId?: string; status?: string },
  skip: number,
  take: number,
) {
  const where = buildListWhere(filters);
  const [totalRow] = await db.select({ n: count() }).from(schema.cashAdvanceRequests).where(where);
  const rows = await db
    .select()
    .from(schema.cashAdvanceRequests)
    .where(where)
    .orderBy(desc(schema.cashAdvanceRequests.createdAt))
    .limit(take)
    .offset(skip);
  const data = await Promise.all(rows.map((r) => withRelations(db, r)));
  return { data, total: Number(totalRow?.n ?? 0) };
}

export async function countRequests(db: Db, filters: { employeeId?: string; status?: string }) {
  const where = buildListWhere(filters);
  const [totalRow] = await db.select({ n: count() }).from(schema.cashAdvanceRequests).where(where);
  return Number(totalRow?.n ?? 0);
}

export async function findById(db: Db, id: string) {
  const [row] = await db
    .select()
    .from(schema.cashAdvanceRequests)
    .where(and(eq(schema.cashAdvanceRequests.id, id), isNull(schema.cashAdvanceRequests.deletedAt)))
    .limit(1);
  return row ? withRelations(db, row) : null;
}

export async function findByIdIncludingDeleted(db: Db, id: string) {
  const [row] = await db
    .select()
    .from(schema.cashAdvanceRequests)
    .where(eq(schema.cashAdvanceRequests.id, id))
    .limit(1);
  return row ? withRelations(db, row) : null;
}

export async function create(
  db: Db,
  data: {
    employeeId: string;
    entityId: string | null;
    requestDate: string;
    position: string | null;
    department: string | null;
    directManager: string | null;
    payoutMode: string;
    bankName: string | null;
    bankCountry: string | null;
    bankAccountNo: string | null;
    swiftCode: string | null;
    currency: string;
    notes: string | null;
    requestedTotal: number;
    items: Array<{
      description: string;
      requestedAmount: number;
      approvedAmount?: number;
      categoryId?: string | null;
      receiptUrl?: string | null;
    }>;
  },
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.cashAdvanceRequests).values({
    id,
    employeeId: data.employeeId,
    entityId: data.entityId,
    requestDate: data.requestDate,
    position: data.position,
    department: data.department,
    directManager: data.directManager,
    payoutMode: data.payoutMode,
    bankName: data.bankName,
    bankCountry: data.bankCountry,
    bankAccountNo: data.bankAccountNo,
    swiftCode: data.swiftCode,
    currency: data.currency,
    notes: data.notes,
    requestedTotal: String(data.requestedTotal),
    updatedAt: now,
  });
  if (data.items.length > 0) {
    await db.insert(schema.cashAdvanceItems).values(
      data.items.map((it, idx) => ({
        id: crypto.randomUUID(),
        requestId: id,
        position: idx + 1,
        description: it.description,
        requestedAmount: String(it.requestedAmount),
        approvedAmount: String(it.approvedAmount ?? 0),
        categoryId: it.categoryId ?? null,
        receiptUrl: it.receiptUrl ?? null,
        updatedAt: now,
      })),
    );
  }
  return findByIdIncludingDeleted(db, id);
}

export async function update(
  db: Db,
  id: string,
  data: Partial<{
    entityId: string | null;
    requestDate: string;
    position: string | null;
    department: string | null;
    directManager: string | null;
    payoutMode: string;
    bankName: string | null;
    bankCountry: string | null;
    bankAccountNo: string | null;
    swiftCode: string | null;
    currency: string;
    notes: string | null;
    requestedTotal: number;
    status: string;
    currentStepOrder: number | null;
    approvedTotal: number;
    rejectReason: string | null;
    submittedAt: string | null;
    approvedBy: string | null;
    approvedAt: string | null;
    disbursedAt: string | null;
    disbursementProofUrl: string | null;
    clearedAt: string | null;
  }>,
) {
  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (data.entityId !== undefined) patch.entityId = data.entityId;
  if (data.requestDate !== undefined) patch.requestDate = data.requestDate;
  if (data.position !== undefined) patch.position = data.position;
  if (data.department !== undefined) patch.department = data.department;
  if (data.directManager !== undefined) patch.directManager = data.directManager;
  if (data.payoutMode !== undefined) patch.payoutMode = data.payoutMode;
  if (data.bankName !== undefined) patch.bankName = data.bankName;
  if (data.bankCountry !== undefined) patch.bankCountry = data.bankCountry;
  if (data.bankAccountNo !== undefined) patch.bankAccountNo = data.bankAccountNo;
  if (data.swiftCode !== undefined) patch.swiftCode = data.swiftCode;
  if (data.currency !== undefined) patch.currency = data.currency;
  if (data.notes !== undefined) patch.notes = data.notes;
  if (data.requestedTotal !== undefined) patch.requestedTotal = String(data.requestedTotal);
  if (data.status !== undefined) patch.status = data.status;
  if (data.currentStepOrder !== undefined) patch.currentStepOrder = data.currentStepOrder;
  if (data.approvedTotal !== undefined) patch.approvedTotal = String(data.approvedTotal);
  if (data.rejectReason !== undefined) patch.rejectReason = data.rejectReason;
  if (data.submittedAt !== undefined) patch.submittedAt = data.submittedAt;
  if (data.approvedBy !== undefined) patch.approvedBy = data.approvedBy;
  if (data.approvedAt !== undefined) patch.approvedAt = data.approvedAt;
  if (data.disbursedAt !== undefined) patch.disbursedAt = data.disbursedAt;
  if (data.disbursementProofUrl !== undefined) patch.disbursementProofUrl = data.disbursementProofUrl;
  if (data.clearedAt !== undefined) patch.clearedAt = data.clearedAt;

  await db
    .update(schema.cashAdvanceRequests)
    .set(patch as typeof schema.cashAdvanceRequests.$inferInsert)
    .where(eq(schema.cashAdvanceRequests.id, id));
  return findByIdIncludingDeleted(db, id);
}

export async function softDelete(db: Db, id: string) {
  const now = new Date().toISOString();
  await db
    .update(schema.cashAdvanceRequests)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(schema.cashAdvanceRequests.id, id));
  return findByIdIncludingDeleted(db, id);
}

export async function restore(db: Db, id: string) {
  const now = new Date().toISOString();
  await db
    .update(schema.cashAdvanceRequests)
    .set({ deletedAt: null, updatedAt: now })
    .where(eq(schema.cashAdvanceRequests.id, id));
  return findByIdIncludingDeleted(db, id);
}

export async function permanentDelete(db: Db, id: string) {
  await db.delete(schema.cashAdvanceRequests).where(eq(schema.cashAdvanceRequests.id, id));
}

export async function replaceItems(
  db: Db,
  requestId: string,
  items: Array<{
    description: string;
    requestedAmount: number;
    approvedAmount?: number;
    categoryId?: string | null;
    receiptUrl?: string | null;
  }>,
) {
  await db.transaction(async (tx) => {
    await tx.delete(schema.cashAdvanceItems).where(eq(schema.cashAdvanceItems.requestId, requestId));
    if (items.length === 0) return;
    const now = new Date().toISOString();
    await tx.insert(schema.cashAdvanceItems).values(
      items.map((it, idx) => ({
        id: crypto.randomUUID(),
        requestId,
        position: idx + 1,
        description: it.description,
        requestedAmount: String(it.requestedAmount),
        approvedAmount: String(it.approvedAmount ?? 0),
        categoryId: it.categoryId ?? null,
        receiptUrl: it.receiptUrl ?? null,
        updatedAt: now,
      })),
    );
  });
}

export async function findApprovalSteps(db: Db, opts: { activeOnly?: boolean } = {}) {
  const query = db
    .select({
      id: schema.cashAdvanceApprovalSteps.id,
      order: schema.cashAdvanceApprovalSteps.order,
      name: schema.cashAdvanceApprovalSteps.name,
      description: schema.cashAdvanceApprovalSteps.description,
      approverType: schema.cashAdvanceApprovalSteps.approverType,
      approverUserId: schema.cashAdvanceApprovalSteps.approverUserId,
      skipWhenSubmitterIds: schema.cashAdvanceApprovalSteps.skipWhenSubmitterIds,
      onlyWhenSubmitterIds: schema.cashAdvanceApprovalSteps.onlyWhenSubmitterIds,
      payoutModeFilter: schema.cashAdvanceApprovalSteps.payoutModeFilter,
      amountMin: schema.cashAdvanceApprovalSteps.amountMin,
      amountMax: schema.cashAdvanceApprovalSteps.amountMax,
      isActive: schema.cashAdvanceApprovalSteps.isActive,
      createdAt: schema.cashAdvanceApprovalSteps.createdAt,
      updatedAt: schema.cashAdvanceApprovalSteps.updatedAt,
      approverUserIdCol: stepApproverUser.id,
      approverUserName: stepApproverUser.name,
      approverUserEmail: stepApproverUser.email,
    })
    .from(schema.cashAdvanceApprovalSteps)
    .leftJoin(stepApproverUser, eq(schema.cashAdvanceApprovalSteps.approverUserId, stepApproverUser.id))
    .orderBy(asc(schema.cashAdvanceApprovalSteps.order));

  const rows = opts.activeOnly
    ? await query.where(eq(schema.cashAdvanceApprovalSteps.isActive, true))
    : await query;

  return rows.map((r) => ({
    id: r.id,
    order: r.order,
    name: r.name,
    description: r.description,
    approverType: r.approverType,
    approverUserId: r.approverUserId,
    skipWhenSubmitterIds: r.skipWhenSubmitterIds,
    onlyWhenSubmitterIds: r.onlyWhenSubmitterIds,
    payoutModeFilter: r.payoutModeFilter,
    amountMin: r.amountMin,
    amountMax: r.amountMax,
    isActive: r.isActive,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    approverUser:
      r.approverUserIdCol != null
        ? { id: r.approverUserIdCol, name: r.approverUserName!, email: r.approverUserEmail! }
        : null,
  }));
}

export async function findStepById(db: Db, id: string) {
  const [row] = await db
    .select()
    .from(schema.cashAdvanceApprovalSteps)
    .where(eq(schema.cashAdvanceApprovalSteps.id, id))
    .limit(1);
  return row ?? null;
}

export async function maxStepOrder(db: Db): Promise<number> {
  const [row] = await db
    .select({ order: schema.cashAdvanceApprovalSteps.order })
    .from(schema.cashAdvanceApprovalSteps)
    .orderBy(desc(schema.cashAdvanceApprovalSteps.order))
    .limit(1);
  return row?.order ?? 0;
}

export async function createStep(
  db: Db,
  data: {
    order: number;
    name: string;
    description: string | null;
    approverType: string;
    approverUserId: string | null;
    skipWhenSubmitterIds: unknown;
    onlyWhenSubmitterIds: unknown;
    payoutModeFilter: unknown;
    amountMin: number | null;
    amountMax: number | null;
    isActive: boolean;
  },
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.cashAdvanceApprovalSteps).values({
    id,
    order: data.order,
    name: data.name,
    description: data.description,
    approverType: data.approverType,
    approverUserId: data.approverUserId,
    skipWhenSubmitterIds: data.skipWhenSubmitterIds as never,
    onlyWhenSubmitterIds: data.onlyWhenSubmitterIds as never,
    payoutModeFilter: data.payoutModeFilter as never,
    amountMin: data.amountMin != null ? String(data.amountMin) : null,
    amountMax: data.amountMax != null ? String(data.amountMax) : null,
    isActive: data.isActive,
    updatedAt: now,
  });
  return findStepById(db, id);
}

export async function updateStep(
  db: Db,
  id: string,
  data: Partial<{
    order: number;
    name: string;
    description: string | null;
    approverType: string;
    approverUserId: string | null;
    skipWhenSubmitterIds: unknown;
    onlyWhenSubmitterIds: unknown;
    payoutModeFilter: unknown;
    amountMin: number | null;
    amountMax: number | null;
    isActive: boolean;
  }>,
) {
  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (data.order !== undefined) patch.order = data.order;
  if (data.name !== undefined) patch.name = data.name;
  if (data.description !== undefined) patch.description = data.description;
  if (data.approverType !== undefined) patch.approverType = data.approverType;
  if (data.approverUserId !== undefined) patch.approverUserId = data.approverUserId;
  if (data.skipWhenSubmitterIds !== undefined) patch.skipWhenSubmitterIds = data.skipWhenSubmitterIds;
  if (data.onlyWhenSubmitterIds !== undefined) patch.onlyWhenSubmitterIds = data.onlyWhenSubmitterIds;
  if (data.payoutModeFilter !== undefined) patch.payoutModeFilter = data.payoutModeFilter;
  if (data.amountMin !== undefined) patch.amountMin = data.amountMin != null ? String(data.amountMin) : null;
  if (data.amountMax !== undefined) patch.amountMax = data.amountMax != null ? String(data.amountMax) : null;
  if (data.isActive !== undefined) patch.isActive = data.isActive;

  await db
    .update(schema.cashAdvanceApprovalSteps)
    .set(patch as typeof schema.cashAdvanceApprovalSteps.$inferInsert)
    .where(eq(schema.cashAdvanceApprovalSteps.id, id));
  return findStepById(db, id);
}

export async function deleteStep(db: Db, id: string) {
  await db.delete(schema.cashAdvanceApprovalSteps).where(eq(schema.cashAdvanceApprovalSteps.id, id));
}

export async function reorderSteps(db: Db, orderedIds: string[]) {
  await db.transaction(async (tx) => {
    await Promise.all(
      orderedIds.map((id, idx) =>
        tx
          .update(schema.cashAdvanceApprovalSteps)
          .set({ order: -(idx + 1), updatedAt: new Date().toISOString() })
          .where(eq(schema.cashAdvanceApprovalSteps.id, id)),
      ),
    );
    await Promise.all(
      orderedIds.map((id, idx) =>
        tx
          .update(schema.cashAdvanceApprovalSteps)
          .set({ order: idx + 1, updatedAt: new Date().toISOString() })
          .where(eq(schema.cashAdvanceApprovalSteps.id, id)),
      ),
    );
  });
}

export async function deleteDecisions(db: Db, requestId: string) {
  await db
    .delete(schema.cashAdvanceApprovalDecisions)
    .where(eq(schema.cashAdvanceApprovalDecisions.cashAdvanceRequestId, requestId));
}

export async function createDecisions(
  db: Db,
  requestId: string,
  rows: Array<{
    order: number;
    name: string;
    approverType: string;
    approverUserId: string | null;
  }>,
) {
  if (rows.length === 0) return;
  await db.insert(schema.cashAdvanceApprovalDecisions).values(
    rows.map((r) => ({
      id: crypto.randomUUID(),
      cashAdvanceRequestId: requestId,
      order: r.order,
      name: r.name,
      approverType: r.approverType,
      approverUserId: r.approverUserId,
    })),
  );
}

export async function findDecisions(db: Db, requestId: string) {
  return db
    .select()
    .from(schema.cashAdvanceApprovalDecisions)
    .where(eq(schema.cashAdvanceApprovalDecisions.cashAdvanceRequestId, requestId))
    .orderBy(asc(schema.cashAdvanceApprovalDecisions.order));
}

export async function updateDecision(
  db: Db,
  id: string,
  data: Partial<{
    status: string;
    decidedById: string | null;
    decidedAt: string | null;
    notes: string | null;
  }>,
) {
  await db
    .update(schema.cashAdvanceApprovalDecisions)
    .set(data)
    .where(eq(schema.cashAdvanceApprovalDecisions.id, id));
}

export async function updateItemApprovedAmount(db: Db, id: string, approvedAmount: number) {
  await db
    .update(schema.cashAdvanceItems)
    .set({
      approvedAmount: String(approvedAmount),
      updatedAt: new Date().toISOString(),
    })
    .where(eq(schema.cashAdvanceItems.id, id));
}

export async function findUserById(db: Db, id: string) {
  const [row] = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      reportingTo: schema.users.reportingTo,
    })
    .from(schema.users)
    .where(eq(schema.users.id, id))
    .limit(1);
  return row ?? null;
}
