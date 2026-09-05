import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  isNull,
  lte,
  or,
  type SQL,
} from "drizzle-orm";
import type { Db, DbTransaction } from "@nexora/db";
import { schema } from "@nexora/db";
import { alias } from "drizzle-orm/pg-core";

type DbLike = Db | DbTransaction;

const employee = alias(schema.users, "travel_employee");
const approver = alias(schema.users, "travel_approver");
const delegate = alias(schema.users, "travel_delegate");
const stepApproverUser = alias(schema.users, "travel_step_approver_user");
const decisionApproverUser = alias(schema.users, "travel_decision_approver_user");
const decisionDecidedBy = alias(schema.users, "travel_decision_decided_by");

function generateRequestCode(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TR-${y}${m}-${rand}`;
}

async function loadRequestRow(db: DbLike, id: string, includeDeleted = false) {
  const parts: SQL[] = [eq(schema.travelRequests.id, id)];
  if (!includeDeleted) parts.push(isNull(schema.travelRequests.deletedAt));
  const [row] = await db
    .select({
      req: schema.travelRequests,
      empId: employee.id,
      empName: employee.name,
      empEmail: employee.email,
      empDept: employee.department,
      empReportingTo: employee.reportingTo,
      apprId: approver.id,
      apprName: approver.name,
      apprEmail: approver.email,
      delId: delegate.id,
      delName: delegate.name,
      delEmail: delegate.email,
      entId: schema.entities.id,
      entName: schema.entities.name,
    })
    .from(schema.travelRequests)
    .innerJoin(employee, eq(schema.travelRequests.employeeId, employee.id))
    .leftJoin(approver, eq(schema.travelRequests.approvedBy, approver.id))
    .leftJoin(delegate, eq(schema.travelRequests.delegatedTo, delegate.id))
    .leftJoin(schema.entities, eq(schema.travelRequests.entityId, schema.entities.id))
    .where(and(...parts))
    .limit(1);
  if (!row) return null;
  return {
    ...row.req,
    employee: {
      id: row.empId,
      name: row.empName,
      email: row.empEmail,
      department: row.empDept,
      reportingTo: row.empReportingTo,
    },
    approver: row.apprId ? { id: row.apprId, name: row.apprName!, email: row.apprEmail! } : null,
    delegate: row.delId ? { id: row.delId, name: row.delName!, email: row.delEmail! } : null,
    entity: row.entId ? { id: row.entId, name: row.entName! } : null,
  };
}

function buildRequestWhere(
  filters: {
    employeeId?: string;
    entityId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    managerScopeUserId?: string;
  },
  scopedEmployeeIds?: string[],
): SQL[] {
  const parts: SQL[] = [isNull(schema.travelRequests.deletedAt)];
  if (scopedEmployeeIds?.length) {
    parts.push(inArray(schema.travelRequests.employeeId, scopedEmployeeIds));
  } else if (filters.employeeId) {
    parts.push(eq(schema.travelRequests.employeeId, filters.employeeId));
  }
  if (filters.entityId) parts.push(eq(schema.travelRequests.entityId, filters.entityId));
  if (filters.status) parts.push(eq(schema.travelRequests.status, filters.status));
  if (filters.startDate) parts.push(gte(schema.travelRequests.departureDate, filters.startDate));
  if (filters.endDate) parts.push(lte(schema.travelRequests.departureDate, filters.endDate));
  if (filters.search) {
    const q = `%${filters.search}%`;
    parts.push(
      or(
        ilike(employee.name, q),
        ilike(schema.travelRequests.origin, q),
        ilike(schema.travelRequests.destination, q),
        ilike(schema.travelRequests.purpose, q),
      )!,
    );
  }
  return parts;
}

export type TravelRequestRow = NonNullable<Awaited<ReturnType<typeof findRequestById>>>;

export async function findRequests(
  db: Db,
  filters: {
    employeeId?: string;
    entityId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    managerScopeUserId?: string;
  },
  page: number,
  limit: number,
) {
  let scopedEmployeeIds: string[] | undefined;
  if (filters.managerScopeUserId) {
    const reportRows = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.reportingTo, filters.managerScopeUserId), eq(schema.users.isActive, true)));
    scopedEmployeeIds = [filters.managerScopeUserId, ...reportRows.map((r) => r.id)];
  }

  const parts = buildRequestWhere(filters, scopedEmployeeIds);
  const where = and(...parts);
  const offset = (page - 1) * limit;

  const [totalRow] = await db
    .select({ n: count() })
    .from(schema.travelRequests)
    .innerJoin(employee, eq(schema.travelRequests.employeeId, employee.id))
    .where(where);

  const rows = await db
    .select({ id: schema.travelRequests.id })
    .from(schema.travelRequests)
    .innerJoin(employee, eq(schema.travelRequests.employeeId, employee.id))
    .where(where)
    .orderBy(desc(schema.travelRequests.createdAt))
    .limit(limit)
    .offset(offset);

  const data = (await Promise.all(rows.map((r) => loadRequestRow(db, r.id)))).filter(
    (r): r is TravelRequestRow => r !== null,
  );

  return { data, total: Number(totalRow?.n ?? 0) };
}

export async function findAllRequests(
  db: Db,
  filters: {
    employeeId?: string;
    entityId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  },
) {
  const parts = buildRequestWhere(filters);
  const where = and(...parts);
  const rows = await db
    .select({ id: schema.travelRequests.id })
    .from(schema.travelRequests)
    .innerJoin(employee, eq(schema.travelRequests.employeeId, employee.id))
    .where(where)
    .orderBy(desc(schema.travelRequests.createdAt));
  return (await Promise.all(rows.map((r) => loadRequestRow(db, r.id)))).filter(
    (r): r is TravelRequestRow => r !== null,
  );
}

export async function findRequestById(db: Db, id: string) {
  return loadRequestRow(db, id, false);
}

export async function findRequestByIdIncludingDeleted(db: Db, id: string) {
  return loadRequestRow(db, id, true);
}

export async function createRequest(
  db: Db,
  data: {
    employeeId: string;
    entityId?: string | null;
    origin: string;
    destination: string;
    purpose: string;
    departureDate: string;
    returnDate: string;
    estimatedBudget?: number;
    cashAdvance?: number;
    currency: string;
    category?: string;
    flightType?: string;
    departureTimePreference?: string;
    returnTimePreference?: string;
    mealPreference?: string;
    seatingPreference?: string;
    seatingPreferenceOther?: string;
    dummyTicketRequired?: boolean;
    visaRequired?: boolean;
    hotelRequired: boolean;
    hotelLocationPreference?: string;
    preferredHotel?: string;
    hotelDetails?: string;
    notes?: string;
  },
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.travelRequests).values({
    id,
    requestCode: generateRequestCode(),
    employeeId: data.employeeId,
    entityId: data.entityId ?? null,
    origin: data.origin,
    destination: data.destination,
    purpose: data.purpose,
    departureDate: data.departureDate,
    returnDate: data.returnDate,
    estimatedBudget: data.estimatedBudget != null ? String(data.estimatedBudget) : null,
    cashAdvance: data.cashAdvance != null ? String(data.cashAdvance) : null,
    currency: data.currency,
    category: data.category ?? "general",
    flightType: data.flightType ?? null,
    departureTimePreference: data.departureTimePreference ?? null,
    returnTimePreference: data.returnTimePreference ?? null,
    mealPreference: data.mealPreference ?? null,
    seatingPreference: data.seatingPreference ?? null,
    seatingPreferenceOther: data.seatingPreferenceOther ?? null,
    dummyTicketRequired: data.dummyTicketRequired ?? false,
    visaRequired: data.visaRequired ?? false,
    hotelRequired: data.hotelRequired,
    hotelLocationPreference: data.hotelLocationPreference ?? null,
    preferredHotel: data.preferredHotel ?? null,
    hotelDetails: data.hotelDetails ?? null,
    notes: data.notes ?? null,
    status: "pending",
    submittedAt: now,
    createdAt: now,
    updatedAt: now,
  });
  return findRequestById(db, id);
}

export async function updateRequest(
  db: Db,
  id: string,
  data: Partial<{
    origin: string;
    destination: string;
    purpose: string;
    departureDate: string;
    returnDate: string;
    estimatedBudget: number | null;
    cashAdvance: number | null;
    currency: string;
    category: string;
    flightType: string | null;
    departureTimePreference: string | null;
    returnTimePreference: string | null;
    mealPreference: string | null;
    seatingPreference: string | null;
    seatingPreferenceOther: string | null;
    dummyTicketRequired: boolean;
    visaRequired: boolean;
    hotelRequired: boolean;
    hotelLocationPreference: string | null;
    preferredHotel: string | null;
    hotelDetails: string | null;
    notes: string | null;
    currentStepOrder: number | null;
    delegatedTo: string | null;
    attachments: unknown;
    status: string;
    approvedBy: string | null;
    approvedAt: string | null;
    rejectReason: string | null;
  }>,
) {
  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue;
    if (k === "estimatedBudget" || k === "cashAdvance") {
      patch[k] = v === null ? null : String(v);
    } else {
      patch[k] = v;
    }
  }
  await db.update(schema.travelRequests).set(patch).where(eq(schema.travelRequests.id, id));
  return findRequestById(db, id);
}

export async function softDeleteRequest(db: Db, id: string) {
  const now = new Date().toISOString();
  await db
    .update(schema.travelRequests)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(schema.travelRequests.id, id));
  return findRequestByIdIncludingDeleted(db, id);
}

export async function restoreRequest(db: Db, id: string) {
  const now = new Date().toISOString();
  await db
    .update(schema.travelRequests)
    .set({ deletedAt: null, updatedAt: now })
    .where(eq(schema.travelRequests.id, id));
  return findRequestById(db, id);
}

export async function permanentDeleteRequest(db: Db, id: string) {
  await db.delete(schema.travelRequests).where(eq(schema.travelRequests.id, id));
  return { id, deleted: true };
}

export async function updateRequestStatus(
  db: Db,
  id: string,
  data: {
    status: string;
    approvedBy?: string;
    approvedAt?: string;
    rejectReason?: string;
  },
) {
  return updateRequest(db, id, {
    status: data.status,
    approvedBy: data.approvedBy ?? null,
    approvedAt: data.approvedAt ?? null,
    rejectReason: data.rejectReason ?? null,
  });
}

export async function findExpensesForTravel(db: Db, travelRequestId: string) {
  return db
    .select({
      id: schema.expenses.id,
      description: schema.expenses.description,
      amount: schema.expenses.amount,
      currency: schema.expenses.currency,
      status: schema.expenses.status,
      date: schema.expenses.date,
    })
    .from(schema.expenses)
    .where(and(eq(schema.expenses.travelRequestId, travelRequestId), isNull(schema.expenses.deletedAt)))
    .orderBy(desc(schema.expenses.date));
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
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return row ?? null;
}

export async function findApprovalSteps(db: DbLike, opts?: { activeOnly?: boolean }) {
  const parts: SQL[] = [];
  if (opts?.activeOnly) parts.push(eq(schema.travelApprovalSteps.isActive, true));
  const where = parts.length ? and(...parts) : undefined;
  const rows = await db
    .select({
      step: schema.travelApprovalSteps,
      userId: stepApproverUser.id,
      userName: stepApproverUser.name,
      userEmail: stepApproverUser.email,
    })
    .from(schema.travelApprovalSteps)
    .leftJoin(stepApproverUser, eq(schema.travelApprovalSteps.approverUserId, stepApproverUser.id))
    .where(where)
    .orderBy(asc(schema.travelApprovalSteps.order));
  return rows.map((r) => ({
    ...r.step,
    amountMinBaht: r.step.amountMinBaht != null ? Number(r.step.amountMinBaht) : null,
    amountMaxBaht: r.step.amountMaxBaht != null ? Number(r.step.amountMaxBaht) : null,
    approverUser: r.userId ? { id: r.userId, name: r.userName!, email: r.userEmail! } : null,
  }));
}

export async function findApprovalStepById(db: Db, id: string) {
  const [row] = await db
    .select({
      step: schema.travelApprovalSteps,
      userId: stepApproverUser.id,
      userName: stepApproverUser.name,
      userEmail: stepApproverUser.email,
    })
    .from(schema.travelApprovalSteps)
    .leftJoin(stepApproverUser, eq(schema.travelApprovalSteps.approverUserId, stepApproverUser.id))
    .where(eq(schema.travelApprovalSteps.id, id))
    .limit(1);
  if (!row) return null;
  return {
    ...row.step,
    amountMinBaht: row.step.amountMinBaht != null ? Number(row.step.amountMinBaht) : null,
    amountMaxBaht: row.step.amountMaxBaht != null ? Number(row.step.amountMaxBaht) : null,
    approverUser: row.userId ? { id: row.userId, name: row.userName!, email: row.userEmail! } : null,
  };
}

export async function createApprovalStep(
  db: Db,
  data: {
    order: number;
    name: string;
    description?: string | null;
    approverType: string;
    approverUserId?: string | null;
    skipWhenSubmitterIds: unknown;
    onlyWhenSubmitterIds: unknown;
    categoryFilter: unknown;
    amountMinBaht?: number | null;
    amountMaxBaht?: number | null;
    isActive: boolean;
  },
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.travelApprovalSteps).values({
    id,
    order: data.order,
    name: data.name,
    description: data.description ?? null,
    approverType: data.approverType,
    approverUserId: data.approverUserId ?? null,
    skipWhenSubmitterIds: data.skipWhenSubmitterIds as never,
    onlyWhenSubmitterIds: data.onlyWhenSubmitterIds as never,
    categoryFilter: data.categoryFilter as never,
    amountMinBaht: data.amountMinBaht != null ? String(data.amountMinBaht) : null,
    amountMaxBaht: data.amountMaxBaht != null ? String(data.amountMaxBaht) : null,
    isActive: data.isActive,
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
    if (k === "amountMinBaht" || k === "amountMaxBaht") {
      patch[k] = v === null ? null : String(v);
    } else {
      patch[k] = v;
    }
  }
  await db.update(schema.travelApprovalSteps).set(patch).where(eq(schema.travelApprovalSteps.id, id));
  return findApprovalStepById(db, id);
}

export async function deleteApprovalStep(db: Db, id: string) {
  await db.delete(schema.travelApprovalSteps).where(eq(schema.travelApprovalSteps.id, id));
  return { id, deleted: true };
}

export async function reorderApprovalSteps(db: Db, orderedIds: string[]) {
  return db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(schema.travelApprovalSteps)
        .set({ order: 10000 + i, updatedAt: new Date().toISOString() })
        .where(eq(schema.travelApprovalSteps.id, orderedIds[i]!));
    }
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(schema.travelApprovalSteps)
        .set({ order: i + 1, updatedAt: new Date().toISOString() })
        .where(eq(schema.travelApprovalSteps.id, orderedIds[i]!));
    }
    return findApprovalSteps(tx);
  });
}

export async function nextStepOrder(db: Db) {
  const [row] = await db
    .select({ order: schema.travelApprovalSteps.order })
    .from(schema.travelApprovalSteps)
    .orderBy(desc(schema.travelApprovalSteps.order))
    .limit(1);
  return (row?.order ?? 0) + 1;
}

export async function createDecisions(
  db: DbLike,
  travelRequestId: string,
  rows: Array<{
    order: number;
    name: string;
    approverType: string;
    approverUserId?: string | null;
  }>,
) {
  if (rows.length === 0) return;
  const now = new Date().toISOString();
  await db.insert(schema.travelApprovalDecisions).values(
    rows.map((r) => ({
      id: crypto.randomUUID(),
      travelRequestId,
      order: r.order,
      name: r.name,
      approverType: r.approverType,
      approverUserId: r.approverUserId ?? null,
      status: "pending",
      createdAt: now,
    })),
  );
}

export async function findDecisions(db: DbLike, travelRequestId: string) {
  const rows = await db
    .select({
      d: schema.travelApprovalDecisions,
      apprId: decisionApproverUser.id,
      apprName: decisionApproverUser.name,
      apprEmail: decisionApproverUser.email,
      decId: decisionDecidedBy.id,
      decName: decisionDecidedBy.name,
      decEmail: decisionDecidedBy.email,
    })
    .from(schema.travelApprovalDecisions)
    .leftJoin(
      decisionApproverUser,
      eq(schema.travelApprovalDecisions.approverUserId, decisionApproverUser.id),
    )
    .leftJoin(
      decisionDecidedBy,
      eq(schema.travelApprovalDecisions.decidedById, decisionDecidedBy.id),
    )
    .where(eq(schema.travelApprovalDecisions.travelRequestId, travelRequestId))
    .orderBy(asc(schema.travelApprovalDecisions.order));
  return rows.map((r) => ({
    ...r.d,
    approverUser: r.apprId ? { id: r.apprId, name: r.apprName!, email: r.apprEmail! } : null,
    decidedBy: r.decId ? { id: r.decId, name: r.decName!, email: r.decEmail! } : null,
  }));
}

export async function findDecisionsForRequests(db: Db, travelRequestIds: string[]) {
  if (travelRequestIds.length === 0) return [];
  return db
    .select({
      travelRequestId: schema.travelApprovalDecisions.travelRequestId,
      order: schema.travelApprovalDecisions.order,
      status: schema.travelApprovalDecisions.status,
      approverType: schema.travelApprovalDecisions.approverType,
      approverUserId: schema.travelApprovalDecisions.approverUserId,
    })
    .from(schema.travelApprovalDecisions)
    .where(inArray(schema.travelApprovalDecisions.travelRequestId, travelRequestIds));
}

export async function updateDecision(
  db: Db,
  id: string,
  data: {
    status: string;
    decidedById?: string | null;
    decidedAt?: string | null;
    notes?: string | null;
    approverUserId?: string | null;
  },
) {
  await db
    .update(schema.travelApprovalDecisions)
    .set({
      status: data.status,
      decidedById: data.decidedById ?? null,
      decidedAt: data.decidedAt ?? null,
      notes: data.notes ?? null,
      ...(data.approverUserId !== undefined ? { approverUserId: data.approverUserId } : {}),
    })
    .where(eq(schema.travelApprovalDecisions.id, id));
  const [row] = await db
    .select()
    .from(schema.travelApprovalDecisions)
    .where(eq(schema.travelApprovalDecisions.id, id))
    .limit(1);
  return row ?? null;
}

export async function reassignPendingDecisionsByStepName(
  db: Db,
  stepName: string,
  approverUserId: string | null,
) {
  await db
    .update(schema.travelApprovalDecisions)
    .set({ approverUserId })
    .where(
      and(
        eq(schema.travelApprovalDecisions.name, stepName),
        eq(schema.travelApprovalDecisions.status, "pending"),
      ),
    );
}
