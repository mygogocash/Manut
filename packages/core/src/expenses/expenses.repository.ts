import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  ne,
  sql,
  type SQL,
} from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";
import { alias } from "drizzle-orm/pg-core";
import { normaliseCurrencyCode } from "@nexora/utils";
import { resolveRate } from "../payroll/payroll.fx";
import { createCuid } from "../lib/id";
import {
  ORDER_PARK_OFFSET,
  planOrderCompaction,
} from "./expense-approval-order";
import { buildReportSearchCondition } from "./expense-shared";

type DbTransaction = Parameters<Parameters<Db["transaction"]>[0]>[0];
type DbLike = Db | DbTransaction;

const employeeUser = alias(schema.users, "exp_employee");
const approverUser = alias(schema.users, "exp_approver");
const stepApproverUser = alias(schema.users, "exp_step_approver");
const decisionApproverUser = alias(schema.users, "exp_decision_approver");
const decisionDecidedBy = alias(schema.users, "exp_decision_decided_by");
const reportEmployee = alias(schema.users, "exp_report_employee");

const employeeCols = {
  id: employeeUser.id,
  name: employeeUser.name,
  email: employeeUser.email,
  department: employeeUser.department,
};

const approverCols = {
  id: approverUser.id,
  name: approverUser.name,
  email: approverUser.email,
};

function notDeletedExpenses() {
  return isNull(schema.expenses.deletedAt);
}

function notDeletedReports() {
  return isNull(schema.expenseReports.deletedAt);
}

async function loadExpenseRelations(
  db: DbLike,
  row: typeof schema.expenses.$inferSelect,
) {
  const [[employee], entityRows, categoryRows, approverRows] = await Promise.all([
    db.select(employeeCols).from(employeeUser).where(eq(employeeUser.id, row.employeeId)).limit(1),
    db.select({ id: schema.entities.id, name: schema.entities.name }).from(schema.entities).where(eq(schema.entities.id, row.entityId)).limit(1),
    row.categoryId
      ? db.select({ id: schema.expenseCategories.id, name: schema.expenseCategories.name }).from(schema.expenseCategories).where(eq(schema.expenseCategories.id, row.categoryId)).limit(1)
      : Promise.resolve([]),
    row.approvedBy
      ? db.select(approverCols).from(approverUser).where(eq(approverUser.id, row.approvedBy)).limit(1)
      : Promise.resolve([]),
  ]);
  return {
    ...row,
    amount: Number(row.amount),
    employee: employee ?? null,
    entity: entityRows[0] ?? null,
    category: categoryRows[0] ?? null,
    approver: approverRows[0] ?? null,
  };
}

async function withExpense(db: DbLike, row: typeof schema.expenses.$inferSelect) {
  return loadExpenseRelations(db, row);
}

async function loadReportRelations(
  db: DbLike,
  row: typeof schema.expenseReports.$inferSelect,
  includeExpenses = false,
) {
  const [[employee], entityRows, approverRows, expenseCountRow, expenses] = await Promise.all([
    db.select(employeeCols).from(employeeUser).where(eq(employeeUser.id, row.employeeId)).limit(1),
    db.select({ id: schema.entities.id, name: schema.entities.name }).from(schema.entities).where(eq(schema.entities.id, row.entityId)).limit(1),
    row.approvedBy
      ? db.select(approverCols).from(approverUser).where(eq(approverUser.id, row.approvedBy)).limit(1)
      : Promise.resolve([]),
    db
      .select({ n: count() })
      .from(schema.expenses)
      .where(and(eq(schema.expenses.reportId, row.id), notDeletedExpenses())),
    includeExpenses
      ? db
          .select()
          .from(schema.expenses)
          .where(and(eq(schema.expenses.reportId, row.id), notDeletedExpenses()))
          .orderBy(asc(schema.expenses.date))
      : Promise.resolve([]),
  ]);
  const base = {
    ...row,
    approvedTotal: row.approvedTotal != null ? Number(row.approvedTotal) : null,
    employee: employee ?? null,
    entity: entityRows[0] ?? null,
    approver: approverRows[0] ?? null,
    _count: { expenses: Number(expenseCountRow[0]?.n ?? 0) },
  };
  if (!includeExpenses) return { ...base, expenses: [] as Awaited<ReturnType<typeof loadExpenseRelations>>[] };
  const expenseRows = await Promise.all(expenses.map((e) => loadExpenseRelations(db, e)));
  return { ...base, expenses: expenseRows };
}

function buildExpenseWhere(
  filters: {
    employeeId?: string;
    entityId?: string;
    categoryId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  },
  scopeUserIds?: string[],
) {
  const parts: SQL[] = [notDeletedExpenses()];
  if (filters.employeeId) parts.push(eq(schema.expenses.employeeId, filters.employeeId));
  else if (scopeUserIds?.length) parts.push(inArray(schema.expenses.employeeId, scopeUserIds));
  if (filters.entityId) parts.push(eq(schema.expenses.entityId, filters.entityId));
  if (filters.categoryId) parts.push(eq(schema.expenses.categoryId, filters.categoryId));
  if (filters.status) parts.push(eq(schema.expenses.status, filters.status));
  if (filters.startDate) parts.push(gte(schema.expenses.date, filters.startDate));
  if (filters.endDate) parts.push(lte(schema.expenses.date, filters.endDate));
  return and(...parts);
}

export async function findUserById(db: Db, userId: string) {
  const [row] = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      entityId: schema.users.entityId,
      reportingTo: schema.users.reportingTo,
      department: schema.users.department,
      isActive: schema.users.isActive,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return row ?? null;
}

export async function findUserWithEntity(db: Db, userId: string) {
  const user = await findUserById(db, userId);
  if (!user?.entityId) return { ...user, entity: null };
  const [entity] = await db
    .select({ name: schema.entities.name, code: schema.entities.code })
    .from(schema.entities)
    .where(eq(schema.entities.id, user.entityId))
    .limit(1);
  return { ...user, entity: entity ?? null };
}

export async function findActiveEntities(db: Db) {
  return db
    .select({
      id: schema.entities.id,
      name: schema.entities.name,
      code: schema.entities.code,
      country: schema.entities.country,
      currency: schema.entities.currency,
    })
    .from(schema.entities)
    .where(eq(schema.entities.isActive, true))
    .orderBy(asc(schema.entities.name));
}

export async function findTravelRequestForLink(db: Db, id: string) {
  const [row] = await db
    .select({ id: schema.travelRequests.id, employeeId: schema.travelRequests.employeeId })
    .from(schema.travelRequests)
    .where(eq(schema.travelRequests.id, id))
    .limit(1);
  return row ?? null;
}

export async function findExpenses(
  db: Db,
  filters: Parameters<typeof buildExpenseWhere>[0],
  page: number,
  limit: number,
  scopeUserIds?: string[],
) {
  const where = buildExpenseWhere(filters, scopeUserIds);
  const [totalRow] = await db.select({ n: count() }).from(schema.expenses).where(where);
  const rows = await db
    .select()
    .from(schema.expenses)
    .where(where)
    .orderBy(desc(schema.expenses.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);
  const data = await Promise.all(rows.map((r) => withExpense(db, r)));
  return { data, total: Number(totalRow?.n ?? 0) };
}

export async function findAllExpenses(
  db: Db,
  filters: Parameters<typeof buildExpenseWhere>[0],
) {
  const where = buildExpenseWhere(filters);
  const rows = await db
    .select()
    .from(schema.expenses)
    .where(where)
    .orderBy(desc(schema.expenses.createdAt));
  return Promise.all(rows.map((r) => withExpense(db, r)));
}

export async function findExpenseById(db: Db, id: string) {
  const [row] = await db
    .select()
    .from(schema.expenses)
    .where(and(eq(schema.expenses.id, id), notDeletedExpenses()))
    .limit(1);
  return row ? withExpense(db, row) : null;
}

export async function findExpenseByIdIncludingDeleted(db: Db, id: string) {
  const [row] = await db.select().from(schema.expenses).where(eq(schema.expenses.id, id)).limit(1);
  return row ? withExpense(db, row) : null;
}

export async function createExpense(
  db: Db,
  data: {
    employeeId: string;
    entityId: string;
    categoryId?: string;
    travelRequestId?: string;
    reportId?: string;
    description: string;
    amount: number;
    currency: string;
    date: string;
    receiptUrl?: string;
    notes?: string;
  },
) {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.insert(schema.expenses).values({
    id,
    employeeId: data.employeeId,
    entityId: data.entityId,
    categoryId: data.categoryId ?? null,
    travelRequestId: data.travelRequestId ?? null,
    reportId: data.reportId ?? null,
    description: data.description,
    amount: String(data.amount),
    currency: data.currency,
    date: data.date,
    receiptUrl: data.receiptUrl ?? null,
    notes: data.notes ?? null,
    status: "pending",
    updatedAt: now,
    createdAt: now,
  });
  const created = await findExpenseById(db, id);
  if (!created) throw new Error("Failed to create expense");
  return created;
}

export async function updateExpenseStatus(
  db: Db,
  id: string,
  data: {
    status: string;
    approvedBy?: string;
    approvedAt?: string;
    rejectReason?: string | null;
    reimbursedAt?: string | null;
  },
) {
  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString(), status: data.status };
  if (data.approvedBy !== undefined) patch.approvedBy = data.approvedBy;
  if (data.approvedAt !== undefined) patch.approvedAt = data.approvedAt;
  if (data.rejectReason !== undefined) patch.rejectReason = data.rejectReason;
  if (data.reimbursedAt !== undefined) patch.reimbursedAt = data.reimbursedAt;
  await db.update(schema.expenses).set(patch).where(eq(schema.expenses.id, id));
  const updated = await findExpenseById(db, id);
  if (!updated) throw new Error("Expense not found after update");
  return updated;
}

export async function updateExpense(
  db: Db,
  id: string,
  data: Partial<{
    categoryId: string | null;
    description: string;
    amount: number;
    currency: string;
    date: string;
    receiptUrl: string | null;
    notes: string | null;
  }>,
) {
  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (data.categoryId !== undefined) patch.categoryId = data.categoryId;
  if (data.description !== undefined) patch.description = data.description;
  if (data.amount !== undefined) patch.amount = String(data.amount);
  if (data.currency !== undefined) patch.currency = data.currency;
  if (data.date !== undefined) patch.date = data.date;
  if (data.receiptUrl !== undefined) patch.receiptUrl = data.receiptUrl;
  if (data.notes !== undefined) patch.notes = data.notes;
  await db.update(schema.expenses).set(patch).where(eq(schema.expenses.id, id));
  const updated = await findExpenseById(db, id);
  if (!updated) throw new Error("Expense not found after update");
  return updated;
}

export async function softDeleteExpense(db: Db, id: string) {
  const now = new Date().toISOString();
  await db.update(schema.expenses).set({ deletedAt: now, updatedAt: now }).where(eq(schema.expenses.id, id));
  return findExpenseByIdIncludingDeleted(db, id);
}

export async function restoreExpense(db: Db, id: string) {
  await db
    .update(schema.expenses)
    .set({ deletedAt: null, updatedAt: new Date().toISOString() })
    .where(eq(schema.expenses.id, id));
  return findExpenseById(db, id);
}

export async function permanentDeleteExpense(db: Db, id: string) {
  await db.delete(schema.expenses).where(eq(schema.expenses.id, id));
  return { id, deleted: true };
}

function buildReportWhere(filters: {
  employeeId?: string;
  employeeIds?: string[];
  reportIds?: string[];
  status?: string;
  period?: string;
  search?: string;
}) {
  const parts: SQL[] = [notDeletedReports()];
  if (filters.reportIds?.length) parts.push(inArray(schema.expenseReports.id, filters.reportIds));
  else if (filters.employeeId) parts.push(eq(schema.expenseReports.employeeId, filters.employeeId));
  else if (filters.employeeIds?.length) parts.push(inArray(schema.expenseReports.employeeId, filters.employeeIds));
  if (filters.status) parts.push(eq(schema.expenseReports.status, filters.status));
  if (filters.period) parts.push(eq(schema.expenseReports.period, filters.period));
  const searchCond = buildReportSearchCondition(filters.search, { name: reportEmployee.name });
  if (searchCond) {
    return and(...parts, searchCond);
  }
  return and(...parts);
}

export async function findReports(
  db: Db,
  filters: Parameters<typeof buildReportWhere>[0],
  page: number,
  limit: number,
) {
  const where = buildReportWhere(filters);
  const [totalRow] = await db.select({ n: count() }).from(schema.expenseReports).where(where);
  const rows = await db
    .select({ report: schema.expenseReports })
    .from(schema.expenseReports)
    .leftJoin(reportEmployee, eq(schema.expenseReports.employeeId, reportEmployee.id))
    .where(where)
    .orderBy(desc(schema.expenseReports.period), desc(schema.expenseReports.createdAt))
    .limit(limit)
    .offset((page - 1) * limit);
  const data = await Promise.all(rows.map((r) => loadReportRelations(db, r.report)));
  return { data, total: Number(totalRow?.n ?? 0) };
}

export async function summaryReportCounts(
  db: Db,
  filters: { employeeId?: string; status?: string; year?: string },
) {
  const parts: SQL[] = [notDeletedReports()];
  if (filters.employeeId) parts.push(eq(schema.expenseReports.employeeId, filters.employeeId));
  if (filters.status) parts.push(eq(schema.expenseReports.status, filters.status));
  if (filters.year) parts.push(sql`${schema.expenseReports.period} LIKE ${filters.year + "-%"}`);
  const where = and(...parts);
  const rows = await db
    .select({
      period: schema.expenseReports.period,
      status: schema.expenseReports.status,
      n: count(),
    })
    .from(schema.expenseReports)
    .where(where)
    .groupBy(schema.expenseReports.period, schema.expenseReports.status);
  return rows.map((r) => ({ period: r.period, status: r.status, _count: { _all: Number(r.n) } }));
}

export async function findReportLinesForSummary(
  db: Db,
  filters: { employeeId?: string; status?: string; year?: string },
) {
  const reportParts: SQL[] = [notDeletedReports()];
  if (filters.employeeId) reportParts.push(eq(schema.expenseReports.employeeId, filters.employeeId));
  if (filters.status) reportParts.push(eq(schema.expenseReports.status, filters.status));
  if (filters.year) reportParts.push(sql`${schema.expenseReports.period} LIKE ${filters.year + "-%"}`);
  const rows = await db
    .select({
      amount: schema.expenses.amount,
      currency: schema.expenses.currency,
      date: schema.expenses.date,
      reportId: schema.expenses.reportId,
      period: schema.expenseReports.period,
    })
    .from(schema.expenses)
    .innerJoin(schema.expenseReports, eq(schema.expenses.reportId, schema.expenseReports.id))
    .where(and(notDeletedExpenses(), ...reportParts));
  return rows.map((r) => ({
    amount: r.amount,
    currency: r.currency,
    date: r.date,
    reportId: r.reportId,
    report: { period: r.period },
  }));
}

export async function findReportById(db: Db, id: string) {
  const [row] = await db
    .select()
    .from(schema.expenseReports)
    .where(and(eq(schema.expenseReports.id, id), notDeletedReports()))
    .limit(1);
  return row ? loadReportRelations(db, row, true) : null;
}

export async function findReportByIdIncludingDeleted(db: Db, id: string) {
  const [row] = await db.select().from(schema.expenseReports).where(eq(schema.expenseReports.id, id)).limit(1);
  return row ? loadReportRelations(db, row, true) : null;
}

export async function createReport(
  db: Db,
  data: {
    employeeId: string;
    entityId: string;
    period: string;
    title: string;
    category?: string;
    notes?: string;
  },
) {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.insert(schema.expenseReports).values({
    id,
    employeeId: data.employeeId,
    entityId: data.entityId,
    period: data.period,
    title: data.title,
    category: data.category ?? "general",
    notes: data.notes ?? null,
    status: "draft",
    updatedAt: now,
    createdAt: now,
  });
  const created = await findReportById(db, id);
  if (!created) throw new Error("Failed to create report");
  return created;
}

export async function updateReport(
  db: Db,
  id: string,
  data: Partial<{
    title: string;
    period: string;
    category: string;
    notes: string | null;
    status: string;
    submittedAt: string | null;
    approvedBy: string | null;
    approvedAt: string | null;
    approvedTotal: number | null;
    rejectReason: string | null;
    reimbursedAt: string | null;
    currentStepOrder: number | null;
  }>,
) {
  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (k === "approvedTotal") patch[k] = v === null ? null : String(v);
    else patch[k] = v;
  }
  await db.update(schema.expenseReports).set(patch).where(eq(schema.expenseReports.id, id));
  const updated = await findReportById(db, id);
  if (!updated) throw new Error("Report not found after update");
  return updated;
}

export async function softDeleteReport(db: Db, id: string) {
  const now = new Date().toISOString();
  await db.update(schema.expenseReports).set({ deletedAt: now, updatedAt: now }).where(eq(schema.expenseReports.id, id));
  return findReportByIdIncludingDeleted(db, id);
}

export async function restoreReport(db: Db, id: string) {
  await db
    .update(schema.expenseReports)
    .set({ deletedAt: null, updatedAt: new Date().toISOString() })
    .where(eq(schema.expenseReports.id, id));
  return findReportById(db, id);
}

export async function permanentDeleteReport(db: Db, id: string) {
  await db.delete(schema.expenseReports).where(eq(schema.expenseReports.id, id));
  return { id, deleted: true };
}

export async function sumReportTotalsByCurrency(db: Db, reportId: string) {
  const rows = await db
    .select({ currency: schema.expenses.currency, total: sql<string>`sum(${schema.expenses.amount})` })
    .from(schema.expenses)
    .where(and(eq(schema.expenses.reportId, reportId), notDeletedExpenses()))
    .groupBy(schema.expenses.currency);
  return rows.map((r) => ({ currency: r.currency, amount: Number(r.total ?? 0) }));
}

export async function findReportExpenseLines(db: Db, reportId: string) {
  return db
    .select({ amount: schema.expenses.amount, currency: schema.expenses.currency, date: schema.expenses.date })
    .from(schema.expenses)
    .where(and(eq(schema.expenses.reportId, reportId), notDeletedExpenses()));
}

export async function updateExpensesByReportId(
  db: DbLike,
  reportId: string,
  data: Record<string, unknown>,
  statusFilter?: string,
) {
  const parts: SQL[] = [eq(schema.expenses.reportId, reportId), notDeletedExpenses()];
  if (statusFilter) parts.push(eq(schema.expenses.status, statusFilter));
  await db.update(schema.expenses).set({ ...data, updatedAt: new Date().toISOString() }).where(and(...parts));
}

async function loadStep(row: typeof schema.expenseApprovalSteps.$inferSelect) {
  return row;
}

export async function findApprovalSteps(db: DbLike, opts?: { activeOnly?: boolean }) {
  const rows = await db
    .select({
      step: schema.expenseApprovalSteps,
      approverUserIdCol: stepApproverUser.id,
      approverUserName: stepApproverUser.name,
      approverUserEmail: stepApproverUser.email,
    })
    .from(schema.expenseApprovalSteps)
    .leftJoin(stepApproverUser, eq(schema.expenseApprovalSteps.approverUserId, stepApproverUser.id))
    .where(opts?.activeOnly ? eq(schema.expenseApprovalSteps.isActive, true) : undefined)
    .orderBy(asc(schema.expenseApprovalSteps.order));
  return rows.map((r) => ({
    ...r.step,
    amountMinBaht: r.step.amountMinBaht != null ? Number(r.step.amountMinBaht) : null,
    amountMaxBaht: r.step.amountMaxBaht != null ? Number(r.step.amountMaxBaht) : null,
    approverUser:
      r.approverUserIdCol != null
        ? { id: r.approverUserIdCol, name: r.approverUserName!, email: r.approverUserEmail! }
        : null,
  }));
}

export async function findApprovalStepById(db: Db, id: string) {
  const steps = await findApprovalSteps(db);
  return steps.find((s) => s.id === id) ?? null;
}

export async function createApprovalStep(
  db: Db,
  data: {
    order: number;
    name: string;
    description?: string | null;
    approverType: string;
    stageRole: string;
    approverUserId?: string | null;
    skipWhenSubmitterIds?: unknown;
    onlyWhenSubmitterIds?: unknown;
    categoryFilter?: unknown;
    amountMinBaht?: number | null;
    amountMaxBaht?: number | null;
    isActive?: boolean;
  },
) {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.insert(schema.expenseApprovalSteps).values({
    id,
    order: data.order,
    name: data.name,
    description: data.description ?? null,
    approverType: data.approverType,
    stageRole: data.stageRole,
    approverUserId: data.approverUserId ?? null,
    skipWhenSubmitterIds: data.skipWhenSubmitterIds ?? [],
    onlyWhenSubmitterIds: data.onlyWhenSubmitterIds ?? [],
    categoryFilter: data.categoryFilter ?? [],
    amountMinBaht: data.amountMinBaht != null ? String(data.amountMinBaht) : null,
    amountMaxBaht: data.amountMaxBaht != null ? String(data.amountMaxBaht) : null,
    isActive: data.isActive ?? true,
    createdAt: now,
    updatedAt: now,
  });
  return findApprovalStepById(db, id);
}

export async function updateApprovalStep(
  db: Db,
  id: string,
  data: Partial<{
    order: number;
    name: string;
    description: string | null;
    approverType: string;
    stageRole: string;
    approverUserId: string | null;
    skipWhenSubmitterIds: unknown;
    onlyWhenSubmitterIds: unknown;
    categoryFilter: unknown;
    amountMinBaht: number | null;
    amountMaxBaht: number | null;
    isActive: boolean;
  }>,
) {
  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (k === "amountMinBaht" || k === "amountMaxBaht") patch[k] = v === null ? null : String(v);
    else patch[k] = v;
  }
  await db.update(schema.expenseApprovalSteps).set(patch).where(eq(schema.expenseApprovalSteps.id, id));
  return findApprovalStepById(db, id);
}

export async function deleteApprovalStep(db: Db, id: string) {
  return db.transaction(async (tx) => {
    await tx.delete(schema.expenseApprovalSteps).where(eq(schema.expenseApprovalSteps.id, id));
    const remaining = await tx
      .select({ id: schema.expenseApprovalSteps.id, order: schema.expenseApprovalSteps.order })
      .from(schema.expenseApprovalSteps)
      .orderBy(asc(schema.expenseApprovalSteps.order));
    const plan = planOrderCompaction(remaining);
    if (plan) {
      for (let i = 0; i < plan.length; i++) {
        await tx
          .update(schema.expenseApprovalSteps)
          .set({ order: ORDER_PARK_OFFSET + i, updatedAt: new Date().toISOString() })
          .where(eq(schema.expenseApprovalSteps.id, plan[i]!.id));
      }
      for (const assignment of plan) {
        await tx
          .update(schema.expenseApprovalSteps)
          .set({ order: assignment.order, updatedAt: new Date().toISOString() })
          .where(eq(schema.expenseApprovalSteps.id, assignment.id));
      }
    }
    return { id, deleted: true };
  });
}

export async function reorderApprovalSteps(db: Db, orderedIds: string[]) {
  return db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(schema.expenseApprovalSteps)
        .set({ order: ORDER_PARK_OFFSET + i, updatedAt: new Date().toISOString() })
        .where(eq(schema.expenseApprovalSteps.id, orderedIds[i]!));
    }
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(schema.expenseApprovalSteps)
        .set({ order: i + 1, updatedAt: new Date().toISOString() })
        .where(eq(schema.expenseApprovalSteps.id, orderedIds[i]!));
    }
    return findApprovalSteps(tx);
  });
}

export async function nextStepOrder(db: Db) {
  const [row] = await db
    .select({ order: schema.expenseApprovalSteps.order })
    .from(schema.expenseApprovalSteps)
    .orderBy(desc(schema.expenseApprovalSteps.order))
    .limit(1);
  return (row?.order ?? 0) + 1;
}

export async function createDecisions(
  db: DbLike,
  expenseReportId: string,
  rows: Array<{
    order: number;
    name: string;
    approverType: string;
    stageRole: string;
    approverUserId?: string | null;
  }>,
) {
  if (rows.length === 0) return;
  const now = new Date().toISOString();
  await db.insert(schema.expenseApprovalDecisions).values(
    rows.map((r) => ({
      id: crypto.randomUUID(),
      expenseReportId,
      order: r.order,
      name: r.name,
      approverType: r.approverType,
      stageRole: r.stageRole,
      approverUserId: r.approverUserId ?? null,
      status: "pending",
      createdAt: now,
    })),
  );
}

export async function findDecisions(db: Db, expenseReportId: string) {
  const rows = await db
    .select({
      id: schema.expenseApprovalDecisions.id,
      expenseReportId: schema.expenseApprovalDecisions.expenseReportId,
      order: schema.expenseApprovalDecisions.order,
      name: schema.expenseApprovalDecisions.name,
      approverType: schema.expenseApprovalDecisions.approverType,
      stageRole: schema.expenseApprovalDecisions.stageRole,
      approverUserId: schema.expenseApprovalDecisions.approverUserId,
      status: schema.expenseApprovalDecisions.status,
      decidedById: schema.expenseApprovalDecisions.decidedById,
      decidedAt: schema.expenseApprovalDecisions.decidedAt,
      approvedAmount: schema.expenseApprovalDecisions.approvedAmount,
      notes: schema.expenseApprovalDecisions.notes,
      approverUserIdCol: decisionApproverUser.id,
      approverUserName: decisionApproverUser.name,
      approverUserEmail: decisionApproverUser.email,
      decidedByIdCol: decisionDecidedBy.id,
      decidedByName: decisionDecidedBy.name,
      decidedByEmail: decisionDecidedBy.email,
    })
    .from(schema.expenseApprovalDecisions)
    .leftJoin(decisionApproverUser, eq(schema.expenseApprovalDecisions.approverUserId, decisionApproverUser.id))
    .leftJoin(decisionDecidedBy, eq(schema.expenseApprovalDecisions.decidedById, decisionDecidedBy.id))
    .where(eq(schema.expenseApprovalDecisions.expenseReportId, expenseReportId))
    .orderBy(asc(schema.expenseApprovalDecisions.order));
  return rows.map((r) => ({
    id: r.id,
    expenseReportId: r.expenseReportId,
    order: r.order,
    name: r.name,
    approverType: r.approverType,
    stageRole: r.stageRole,
    approverUserId: r.approverUserId,
    status: r.status,
    decidedById: r.decidedById,
    decidedAt: r.decidedAt,
    approvedAmount: r.approvedAmount != null ? Number(r.approvedAmount) : null,
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

export async function updateDecision(
  db: Db,
  id: string,
  data: Partial<{
    status: string;
    decidedById: string | null;
    decidedAt: string | null;
    approvedAmount: number | null;
    notes: string | null;
    approverUserId: string | null;
  }>,
) {
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (k === "approvedAmount") patch[k] = v === null ? null : String(v);
    else patch[k] = v;
  }
  await db.update(schema.expenseApprovalDecisions).set(patch).where(eq(schema.expenseApprovalDecisions.id, id));
}

export async function deleteDecisionsForReport(db: Db, expenseReportId: string) {
  await db.delete(schema.expenseApprovalDecisions).where(eq(schema.expenseApprovalDecisions.expenseReportId, expenseReportId));
}

export async function reassignPendingDecisionsByStepName(
  db: Db,
  stepName: string,
  approverUserId: string | null,
) {
  await db
    .update(schema.expenseApprovalDecisions)
    .set({ approverUserId })
    .where(and(eq(schema.expenseApprovalDecisions.name, stepName), eq(schema.expenseApprovalDecisions.status, "pending")));
}

export async function findPendingReportIdsForApprover(db: Db, userId: string) {
  const pendingDecisions = await db
    .select({
      expenseReportId: schema.expenseApprovalDecisions.expenseReportId,
      order: schema.expenseApprovalDecisions.order,
      currentStepOrder: schema.expenseReports.currentStepOrder,
    })
    .from(schema.expenseApprovalDecisions)
    .innerJoin(schema.expenseReports, eq(schema.expenseApprovalDecisions.expenseReportId, schema.expenseReports.id))
    .where(
      and(
        eq(schema.expenseApprovalDecisions.status, "pending"),
        eq(schema.expenseReports.status, "submitted"),
        sql`(
          (${schema.expenseApprovalDecisions.approverType} = 'user' AND ${schema.expenseApprovalDecisions.approverUserId} = ${userId})
          OR (${schema.expenseApprovalDecisions.approverType} = 'manager' AND EXISTS (
            SELECT 1 FROM ${schema.users} u WHERE u.id = ${schema.expenseReports.employeeId}
            AND u.reporting_to = ${userId}::uuid AND u.is_active = true
          ))
        )`,
      ),
    );
  const currentStepIds = pendingDecisions
    .filter((d) => d.order === d.currentStepOrder)
    .map((d) => d.expenseReportId);

  const legacy = await db
    .select({ id: schema.expenseReports.id })
    .from(schema.expenseReports)
    .innerJoin(schema.users, eq(schema.expenseReports.employeeId, schema.users.id))
    .leftJoin(
      schema.expenseApprovalDecisions,
      eq(schema.expenseApprovalDecisions.expenseReportId, schema.expenseReports.id),
    )
    .where(
      and(
        eq(schema.expenseReports.status, "submitted"),
        eq(schema.users.reportingTo, userId),
        eq(schema.users.isActive, true),
        isNull(schema.expenseApprovalDecisions.id),
      ),
    );

  const managerBackup = await db
    .select({ id: schema.expenseReports.id })
    .from(schema.expenseReports)
    .innerJoin(schema.users, eq(schema.expenseReports.employeeId, schema.users.id))
    .where(
      and(
        eq(schema.expenseReports.status, "submitted"),
        eq(schema.users.reportingTo, userId),
        eq(schema.users.isActive, true),
      ),
    );

  return Array.from(
    new Set([
      ...currentStepIds,
      ...legacy.map((r) => r.id),
      ...managerBackup.map((r) => r.id),
    ]),
  );
}

export async function hasDecisionForUser(db: Db, reportId: string, userId: string) {
  const [row] = await db
    .select({ id: schema.expenseApprovalDecisions.id })
    .from(schema.expenseApprovalDecisions)
    .where(and(eq(schema.expenseApprovalDecisions.expenseReportId, reportId), eq(schema.expenseApprovalDecisions.approverUserId, userId)))
    .limit(1);
  return !!row;
}

export async function findCategories(db: Db) {
  return db.select().from(schema.expenseCategories).orderBy(asc(schema.expenseCategories.name));
}

export async function findCategoryById(db: Db, id: string) {
  const [row] = await db.select().from(schema.expenseCategories).where(eq(schema.expenseCategories.id, id)).limit(1);
  return row ?? null;
}

export async function findCategoriesByIds(db: Db, ids: string[]) {
  if (ids.length === 0) return [];
  return db.select().from(schema.expenseCategories).where(inArray(schema.expenseCategories.id, ids));
}

export async function createCategory(
  db: Db,
  data: {
    name: string;
    description?: string;
    glAccountId?: string;
    isActive?: boolean;
    spendingLimit?: number;
    limitPeriod?: string;
    receiptRequired?: boolean;
    isAllowance?: boolean;
  },
) {
  const id = createCuid();
  await db.insert(schema.expenseCategories).values({
    id,
    name: data.name,
    description: data.description ?? null,
    glAccountId: data.glAccountId ?? null,
    isActive: data.isActive ?? true,
    spendingLimit: data.spendingLimit != null ? String(data.spendingLimit) : null,
    limitPeriod: data.limitPeriod ?? null,
    receiptRequired: data.receiptRequired ?? false,
    isAllowance: data.isAllowance ?? false,
  });
  return findCategoryById(db, id);
}

export async function updateCategory(
  db: Db,
  id: string,
  data: Partial<{
    name: string;
    description: string | null;
    glAccountId: string | null;
    isActive: boolean;
    spendingLimit: number | null;
    limitPeriod: string | null;
    receiptRequired: boolean;
    isAllowance: boolean;
  }>,
) {
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (k === "spendingLimit") patch[k] = v === null ? null : String(v);
    else patch[k] = v;
  }
  await db.update(schema.expenseCategories).set(patch).where(eq(schema.expenseCategories.id, id));
  return findCategoryById(db, id);
}

export async function deleteCategoryById(db: Db, id: string) {
  await db.delete(schema.expenseCategories).where(eq(schema.expenseCategories.id, id));
  return { id, deleted: true };
}

export async function groupSpendingByCategory(
  db: Db,
  filters: { employeeId?: string; startDate?: string; endDate?: string },
) {
  const parts: SQL[] = [
    notDeletedExpenses(),
    inArray(schema.expenses.status, ["approved", "reimbursed", "payroll_processed"]),
  ];
  if (filters.employeeId) parts.push(eq(schema.expenses.employeeId, filters.employeeId));
  if (filters.startDate) parts.push(gte(schema.expenses.date, filters.startDate));
  if (filters.endDate) parts.push(lte(schema.expenses.date, filters.endDate));
  const rows = await db
    .select({
      categoryId: schema.expenses.categoryId,
      total: sql<string>`sum(${schema.expenses.amount})`,
      n: count(),
    })
    .from(schema.expenses)
    .where(and(...parts))
    .groupBy(schema.expenses.categoryId);
  return rows.map((r) => ({
    categoryId: r.categoryId,
    totalAmount: Number(r.total ?? 0),
    count: Number(r.n),
  }));
}

export async function findExchangeRates(db: Db, baseCurrency: string, date?: string) {
  const parts = [eq(schema.exchangeRates.baseCurrency, baseCurrency)];
  if (date) parts.push(lte(schema.exchangeRates.effectiveDate, date));
  const rows = await db
    .select()
    .from(schema.exchangeRates)
    .where(and(...parts))
    .orderBy(asc(schema.exchangeRates.currency), desc(schema.exchangeRates.effectiveDate));
  if (!date) return rows;
  const seen = new Set<string>();
  const out: typeof rows = [];
  for (const row of rows) {
    if (seen.has(row.currency)) continue;
    seen.add(row.currency);
    out.push(row);
  }
  return out;
}

export async function upsertExchangeRate(
  db: Db,
  data: {
    baseCurrency: string;
    currency: string;
    rate: number;
    effectiveDate: string;
    source?: string;
  },
) {
  const existing = await db
    .select({ id: schema.exchangeRates.id })
    .from(schema.exchangeRates)
    .where(
      and(
        eq(schema.exchangeRates.baseCurrency, data.baseCurrency),
        eq(schema.exchangeRates.currency, data.currency),
        eq(schema.exchangeRates.effectiveDate, data.effectiveDate),
      ),
    )
    .limit(1);
  const now = new Date().toISOString();
  if (existing[0]) {
    await db
      .update(schema.exchangeRates)
      .set({ rate: String(data.rate), source: data.source ?? "manual" })
      .where(eq(schema.exchangeRates.id, existing[0].id));
    return db.select().from(schema.exchangeRates).where(eq(schema.exchangeRates.id, existing[0].id)).then((r) => r[0]);
  }
  const id = crypto.randomUUID();
  await db.insert(schema.exchangeRates).values({
    id,
    baseCurrency: data.baseCurrency,
    currency: data.currency,
    rate: String(data.rate),
    effectiveDate: data.effectiveDate,
    source: data.source ?? "manual",
    createdAt: now,
  });
  const [row] = await db.select().from(schema.exchangeRates).where(eq(schema.exchangeRates.id, id)).limit(1);
  return row;
}

export async function convertAmount(
  db: Db,
  amount: number,
  fromCurrency: string,
  toCurrency: string,
  asOf?: Date,
): Promise<{ converted: number; rate: number } | null> {
  const from = normaliseCurrencyCode(fromCurrency);
  const to = normaliseCurrencyCode(toCurrency);
  if (from === to) return { converted: amount, rate: 1 };
  const lookup = await resolveRate(db, from, to, asOf);
  if (lookup.source === "missing") return null;
  const rate = lookup.rate;
  return { converted: Math.round(amount * rate * 100) / 100, rate };
}

export async function finalizeAllowanceReportTx(
  db: Db,
  reportId: string,
  userId: string,
) {
  const now = new Date().toISOString();
  return db.transaction(async (tx) => {
    await tx
      .update(schema.expenseReports)
      .set({
        status: "reimbursed",
        submittedAt: now,
        approvedBy: userId,
        approvedAt: now,
        reimbursedAt: now,
        rejectReason: null,
        currentStepOrder: null,
        updatedAt: now,
      })
      .where(eq(schema.expenseReports.id, reportId));
    await updateExpensesByReportId(tx, reportId, {
      status: "reimbursed",
      approvedBy: userId,
      approvedAt: now,
      reimbursedAt: now,
    });
    const [row] = await tx.select().from(schema.expenseReports).where(eq(schema.expenseReports.id, reportId)).limit(1);
    if (!row) throw new Error("Report missing");
    const [[employee]] = await Promise.all([
      tx
        .select({ id: employeeUser.id, name: employeeUser.name, email: employeeUser.email })
        .from(employeeUser)
        .where(eq(employeeUser.id, row.employeeId))
        .limit(1),
    ]);
    return { ...row, employee: employee ?? null };
  });
}

export async function approveReportTx(
  db: Db,
  args: {
    reportId: string;
    currentDecisionId: string;
    approverId: string;
    approvedAmountOverride: number | null;
    notes?: string;
    isFinalStep: boolean;
    nextStepOrder: number | null;
  },
) {
  const now = new Date().toISOString();
  return db.transaction(async (tx) => {
    await tx
      .update(schema.expenseApprovalDecisions)
      .set({
        status: "approved",
        decidedById: args.approverId,
        decidedAt: now,
        approvedAmount: args.approvedAmountOverride != null ? String(args.approvedAmountOverride) : null,
        notes: args.notes ?? null,
      })
      .where(eq(schema.expenseApprovalDecisions.id, args.currentDecisionId));

    let finalApprovedTotal: number | null = null;
    if (args.isFinalStep) {
      const allDecisions = await tx
        .select({ approvedAmount: schema.expenseApprovalDecisions.approvedAmount })
        .from(schema.expenseApprovalDecisions)
        .where(eq(schema.expenseApprovalDecisions.expenseReportId, args.reportId))
        .orderBy(asc(schema.expenseApprovalDecisions.order));
      const overrides = allDecisions
        .filter((d) => d.approvedAmount !== null)
        .map((d) => Number(d.approvedAmount));
      if (overrides.length > 0) finalApprovedTotal = overrides[overrides.length - 1]!;
    }

    await tx
      .update(schema.expenseReports)
      .set({
        status: args.isFinalStep ? "approved" : "submitted",
        approvedBy: args.isFinalStep ? args.approverId : undefined,
        approvedAt: args.isFinalStep ? now : undefined,
        approvedTotal: args.isFinalStep ? (finalApprovedTotal != null ? String(finalApprovedTotal) : null) : undefined,
        rejectReason: null,
        currentStepOrder: args.isFinalStep ? null : args.nextStepOrder,
        updatedAt: now,
      })
      .where(eq(schema.expenseReports.id, args.reportId));

    if (args.isFinalStep) {
      await updateExpensesByReportId(tx, args.reportId, {
        status: "approved",
        approvedBy: args.approverId,
        approvedAt: now,
      });
    }

    const [row] = await tx.select().from(schema.expenseReports).where(eq(schema.expenseReports.id, args.reportId)).limit(1);
    const [employee] = await tx
      .select({ id: employeeUser.id, name: employeeUser.name, email: employeeUser.email })
      .from(employeeUser)
      .where(eq(employeeUser.id, row!.employeeId))
      .limit(1);
    return { ...row!, approvedTotal: row!.approvedTotal != null ? Number(row!.approvedTotal) : null, employee: employee ?? null };
  });
}

export async function rejectReportTx(db: Db, reportId: string, approverId: string, reason: string) {
  const now = new Date().toISOString();
  await db
    .update(schema.expenseReports)
    .set({
      status: "rejected",
      approvedBy: approverId,
      approvedAt: now,
      rejectReason: reason,
      currentStepOrder: null,
      updatedAt: now,
    })
    .where(eq(schema.expenseReports.id, reportId));
  const [row] = await db.select().from(schema.expenseReports).where(eq(schema.expenseReports.id, reportId)).limit(1);
  const [employee] = await db
    .select({ id: employeeUser.id, name: employeeUser.name, email: employeeUser.email })
    .from(employeeUser)
    .where(eq(employeeUser.id, row!.employeeId))
    .limit(1);
  return { ...row!, employee: employee ?? null };
}

export async function markPayrollProcessedTx(db: Db, reportId: string, actorId: string) {
  const now = new Date().toISOString();
  return db.transaction(async (tx) => {
    await tx
      .update(schema.expenseReports)
      .set({ status: "payroll_processed", approvedBy: actorId, updatedAt: now })
      .where(eq(schema.expenseReports.id, reportId));
    await updateExpensesByReportId(tx, reportId, { status: "payroll_processed" }, "approved");
    const [row] = await tx.select().from(schema.expenseReports).where(eq(schema.expenseReports.id, reportId)).limit(1);
    return row!;
  });
}

export async function reimburseReportTx(db: Db, reportId: string, actorId: string) {
  const now = new Date().toISOString();
  return db.transaction(async (tx) => {
    await tx
      .update(schema.expenseReports)
      .set({ status: "reimbursed", reimbursedAt: now, approvedBy: actorId, updatedAt: now })
      .where(eq(schema.expenseReports.id, reportId));
    await updateExpensesByReportId(tx, reportId, { status: "reimbursed", reimbursedAt: now });
    const [row] = await tx.select().from(schema.expenseReports).where(eq(schema.expenseReports.id, reportId)).limit(1);
    const [employee] = await tx
      .select({ id: employeeUser.id, name: employeeUser.name, email: employeeUser.email })
      .from(employeeUser)
      .where(eq(employeeUser.id, row!.employeeId))
      .limit(1);
    return { ...row!, approvedTotal: row!.approvedTotal != null ? Number(row!.approvedTotal) : null, employee: employee ?? null };
  });
}

export async function revertReimbursementTx(db: Db, reportId: string) {
  const now = new Date().toISOString();
  return db.transaction(async (tx) => {
    await tx
      .update(schema.expenseReports)
      .set({ status: "approved", reimbursedAt: null, updatedAt: now })
      .where(eq(schema.expenseReports.id, reportId));
    await updateExpensesByReportId(tx, reportId, { status: "approved", reimbursedAt: null }, "reimbursed");
    const [row] = await tx.select().from(schema.expenseReports).where(eq(schema.expenseReports.id, reportId)).limit(1);
    const [employee] = await tx
      .select({ id: employeeUser.id, name: employeeUser.name, email: employeeUser.email })
      .from(employeeUser)
      .where(eq(employeeUser.id, row!.employeeId))
      .limit(1);
    return { ...row!, employee: employee ?? null };
  });
}

export async function findFiledReportEmployeeIds(db: Db, period: string, employeeIds: string[]) {
  if (employeeIds.length === 0) return [];
  const rows = await db
    .select({ employeeId: schema.expenseReports.employeeId })
    .from(schema.expenseReports)
    .where(
      and(
        eq(schema.expenseReports.period, period),
        inArray(schema.expenseReports.employeeId, employeeIds),
        inArray(schema.expenseReports.status, ["submitted", "approved", "reimbursed", "payroll_processed"]),
        notDeletedReports(),
      ),
    );
  return rows.map((r) => r.employeeId);
}

export async function findActiveUsersForReminders(db: Db) {
  return db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      entityCode: schema.entities.code,
      entityName: schema.entities.name,
    })
    .from(schema.users)
    .innerJoin(schema.entities, eq(schema.users.entityId, schema.entities.id))
    .where(and(eq(schema.users.isActive, true), ne(schema.users.email, ""), eq(schema.entities.isActive, true)));
}
