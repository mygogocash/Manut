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
  ne,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { Db, DbTransaction } from "@nexora/db";
import { schema } from "@nexora/db";
import { alias } from "drizzle-orm/pg-core";
import { createCuid } from "../lib/id";

type DbLike = Db | DbTransaction;

const employee = alias(schema.users, "leave_employee");
const approver = alias(schema.users, "leave_approver");
const delegate = alias(schema.users, "leave_delegate");
const policyApproverUser = alias(schema.users, "policy_approver_user");
const stepApproverUser = alias(schema.users, "step_approver_user");
const decisionApproverUser = alias(schema.users, "decision_approver_user");
const decisionDecidedBy = alias(schema.users, "decision_decided_by");

async function loadTypeWithEntity(db: DbLike, row: typeof schema.leaveTypes.$inferSelect) {
  let entity: { id: string; name: string; code: string } | null = null;
  if (row.entityId) {
    const [e] = await db
      .select({ id: schema.entities.id, name: schema.entities.name, code: schema.entities.code })
      .from(schema.entities)
      .where(eq(schema.entities.id, row.entityId))
      .limit(1);
    entity = e ?? null;
  }
  return { ...row, entity };
}

async function loadRequestRow(db: DbLike, id: string, includeDeleted = false) {
  const parts: SQL[] = [eq(schema.leaveRequests.id, id)];
  if (!includeDeleted) parts.push(isNull(schema.leaveRequests.deletedAt));
  const [row] = await db
    .select({
      req: schema.leaveRequests,
      empId: employee.id,
      empName: employee.name,
      empEmail: employee.email,
      empDept: employee.department,
      empReportingTo: employee.reportingTo,
      ltId: schema.leaveTypes.id,
      ltName: schema.leaveTypes.name,
      ltCode: schema.leaveTypes.code,
      ltCategory: schema.leaveTypes.category,
      apprId: approver.id,
      apprName: approver.name,
      apprEmail: approver.email,
      delId: delegate.id,
      delName: delegate.name,
      delEmail: delegate.email,
      entId: schema.entities.id,
      entName: schema.entities.name,
    })
    .from(schema.leaveRequests)
    .innerJoin(employee, eq(schema.leaveRequests.employeeId, employee.id))
    .innerJoin(schema.leaveTypes, eq(schema.leaveRequests.leaveTypeId, schema.leaveTypes.id))
    .leftJoin(approver, eq(schema.leaveRequests.approvedBy, approver.id))
    .leftJoin(delegate, eq(schema.leaveRequests.delegatedTo, delegate.id))
    .leftJoin(schema.entities, eq(schema.leaveRequests.entityId, schema.entities.id))
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
    leaveType: {
      id: row.ltId,
      name: row.ltName,
      code: row.ltCode,
      category: row.ltCategory,
    },
    approver: row.apprId ? { id: row.apprId, name: row.apprName!, email: row.apprEmail! } : null,
    delegate: row.delId ? { id: row.delId, name: row.delName!, email: row.delEmail! } : null,
    entity: row.entId ? { id: row.entId, name: row.entName! } : null,
    delegatedToId: row.req.delegatedTo,
  };
}

export async function findTypes(db: Db, entityId?: string | null) {
  const parts: SQL[] = [eq(schema.leaveTypes.isActive, true)];
  if (entityId === null) {
    parts.push(isNull(schema.leaveTypes.entityId));
  } else if (entityId) {
    parts.push(or(eq(schema.leaveTypes.entityId, entityId), isNull(schema.leaveTypes.entityId))!);
  }
  const rows = await db
    .select()
    .from(schema.leaveTypes)
    .where(and(...parts))
    .orderBy(asc(schema.leaveTypes.entityId), asc(schema.leaveTypes.name));
  return Promise.all(rows.map((r) => loadTypeWithEntity(db, r)));
}

export async function findAllTypes(db: Db, filters?: { entityId?: string | "global" | null }) {
  const parts: SQL[] = [];
  if (filters?.entityId === "global") parts.push(isNull(schema.leaveTypes.entityId));
  else if (typeof filters?.entityId === "string") parts.push(eq(schema.leaveTypes.entityId, filters.entityId));
  const where = parts.length ? and(...parts) : undefined;
  const rows = await db
    .select()
    .from(schema.leaveTypes)
    .where(where)
    .orderBy(desc(schema.leaveTypes.isActive), asc(schema.leaveTypes.entityId), asc(schema.leaveTypes.name));
  return Promise.all(rows.map((r) => loadTypeWithEntity(db, r)));
}

export async function findTypeById(db: Db, id: string) {
  const [row] = await db.select().from(schema.leaveTypes).where(eq(schema.leaveTypes.id, id)).limit(1);
  return row ? loadTypeWithEntity(db, row) : null;
}

export async function findTypeByNameInEntity(db: Db, name: string, entityId: string | null) {
  const cond = entityId
    ? eq(schema.leaveTypes.entityId, entityId)
    : isNull(schema.leaveTypes.entityId);
  const [row] = await db
    .select()
    .from(schema.leaveTypes)
    .where(and(eq(schema.leaveTypes.name, name), cond))
    .limit(1);
  return row ?? null;
}

export async function findTypeByCodeInEntity(db: Db, code: string, entityId: string | null) {
  const cond = entityId
    ? eq(schema.leaveTypes.entityId, entityId)
    : isNull(schema.leaveTypes.entityId);
  const [row] = await db
    .select()
    .from(schema.leaveTypes)
    .where(and(eq(schema.leaveTypes.code, code), cond))
    .limit(1);
  return row ?? null;
}

export async function findUserEntityId(db: Db, userId: string): Promise<string | null> {
  const [row] = await db
    .select({ entityId: schema.users.entityId })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return row?.entityId ?? null;
}

export async function createType(
  db: Db,
  data: {
    name: string;
    code: string;
    description?: string | null;
    category: string;
    daysPerYear: number;
    requiresApproval: boolean;
    isPaid: boolean;
    isActive: boolean;
    entityId?: string | null;
  },
) {
  const id = createCuid();
  await db.insert(schema.leaveTypes).values({
    id,
    entityId: data.entityId ?? null,
    name: data.name,
    code: data.code,
    description: data.description ?? null,
    category: data.category,
    daysPerYear: data.daysPerYear,
    requiresApproval: data.requiresApproval,
    isPaid: data.isPaid,
    isActive: data.isActive,
  });
  return findTypeById(db, id);
}

export async function updateType(
  db: Db,
  id: string,
  data: Partial<{
    name: string;
    code: string;
    description: string | null;
    category: string;
    daysPerYear: number;
    requiresApproval: boolean;
    isPaid: boolean;
    isActive: boolean;
    entityId: string | null;
  }>,
) {
  await db.update(schema.leaveTypes).set(data).where(eq(schema.leaveTypes.id, id));
  return findTypeById(db, id);
}

export async function deleteType(db: Db, id: string) {
  await db.delete(schema.leaveTypes).where(eq(schema.leaveTypes.id, id));
}

export async function countTypeReferences(db: Db, id: string) {
  const [[b], [r], [t]] = await Promise.all([
    db.select({ n: count() }).from(schema.leaveBalances).where(eq(schema.leaveBalances.leaveTypeId, id)),
    db
      .select({ n: count() })
      .from(schema.leaveRequests)
      .where(and(eq(schema.leaveRequests.leaveTypeId, id), isNull(schema.leaveRequests.deletedAt))),
    db.select({ n: count() }).from(schema.balanceTransactions).where(eq(schema.balanceTransactions.leaveTypeId, id)),
  ]);
  return { balances: Number(b?.n ?? 0), requests: Number(r?.n ?? 0), transactions: Number(t?.n ?? 0) };
}

export async function findApprovers(db: DbLike, leaveTypeId: string) {
  const rows = await db
    .select({
      row: schema.leavePolicyApprovers,
      userId: policyApproverUser.id,
      userName: policyApproverUser.name,
      userEmail: policyApproverUser.email,
    })
    .from(schema.leavePolicyApprovers)
    .leftJoin(policyApproverUser, eq(schema.leavePolicyApprovers.approverUserId, policyApproverUser.id))
    .where(eq(schema.leavePolicyApprovers.leaveTypeId, leaveTypeId))
    .orderBy(asc(schema.leavePolicyApprovers.order));
  return rows.map((r) => ({
    ...r.row,
    approverUser: r.userId ? { id: r.userId, name: r.userName!, email: r.userEmail! } : null,
  }));
}

export async function replaceApprovers(
  db: Db,
  leaveTypeId: string,
  rows: Array<{
    order: number;
    approverType: string;
    approverUserId?: string | null;
    skipWhenSubmitterIds?: string[];
    onlyWhenSubmitterIds?: string[];
    minDays?: number | null;
    maxDays?: number | null;
  }>,
) {
  return db.transaction(async (tx) => {
    await tx.delete(schema.leavePolicyApprovers).where(eq(schema.leavePolicyApprovers.leaveTypeId, leaveTypeId));
    if (rows.length === 0) return [];
    const now = new Date().toISOString();
    await tx.insert(schema.leavePolicyApprovers).values(
      rows.map((r) => ({
        id: crypto.randomUUID(),
        leaveTypeId,
        order: r.order,
        approverType: r.approverType,
        approverUserId: r.approverUserId ?? null,
        skipWhenSubmitterIds: r.skipWhenSubmitterIds ?? [],
        onlyWhenSubmitterIds: r.onlyWhenSubmitterIds ?? [],
        minDays: r.minDays ?? null,
        maxDays: r.maxDays ?? null,
        createdAt: now,
        updatedAt: now,
      })),
    );
    return findApprovers(tx, leaveTypeId);
  });
}

export async function findBalances(db: Db, employeeId: string, year: number) {
  const rows = await db
    .select({
      balance: schema.leaveBalances,
      ltId: schema.leaveTypes.id,
      ltName: schema.leaveTypes.name,
      ltCode: schema.leaveTypes.code,
      ltCategory: schema.leaveTypes.category,
      ltEntityId: schema.leaveTypes.entityId,
    })
    .from(schema.leaveBalances)
    .innerJoin(schema.leaveTypes, eq(schema.leaveBalances.leaveTypeId, schema.leaveTypes.id))
    .where(and(eq(schema.leaveBalances.employeeId, employeeId), eq(schema.leaveBalances.year, year)))
    .orderBy(asc(schema.leaveTypes.name));
  return rows.map((r) => ({
    ...r.balance,
    leaveType: {
      id: r.ltId,
      name: r.ltName,
      code: r.ltCode,
      category: r.ltCategory,
      entityId: r.ltEntityId,
    },
  }));
}

export async function findRequests(
  db: Db,
  filters: {
    employeeId?: string;
    entityId?: string;
    status?: string;
    leaveTypeId?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
    managerScopeUserId?: string;
  },
  page: number,
  limit: number,
) {
  const parts: SQL[] = [isNull(schema.leaveRequests.deletedAt)];

  if (filters.managerScopeUserId) {
    const reportRows = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(and(eq(schema.users.reportingTo, filters.managerScopeUserId), eq(schema.users.isActive, true)));
    const ids = [filters.managerScopeUserId, ...reportRows.map((r) => r.id)];
    parts.push(inArray(schema.leaveRequests.employeeId, ids));
  }
  if (filters.employeeId) parts.push(eq(schema.leaveRequests.employeeId, filters.employeeId));
  if (filters.entityId) parts.push(eq(schema.leaveRequests.entityId, filters.entityId));
  if (filters.status) parts.push(eq(schema.leaveRequests.status, filters.status));
  if (filters.leaveTypeId) parts.push(eq(schema.leaveRequests.leaveTypeId, filters.leaveTypeId));
  if (filters.startDate) parts.push(gte(schema.leaveRequests.startDate, filters.startDate));
  if (filters.endDate) parts.push(lte(schema.leaveRequests.startDate, filters.endDate));
  if (filters.search) {
    const q = `%${filters.search}%`;
    parts.push(
      or(ilike(employee.name, q), ilike(schema.leaveTypes.name, q))!,
    );
  }

  const where = and(...parts);
  const offset = (page - 1) * limit;

  const [totalRow] = await db
    .select({ n: count() })
    .from(schema.leaveRequests)
    .innerJoin(employee, eq(schema.leaveRequests.employeeId, employee.id))
    .innerJoin(schema.leaveTypes, eq(schema.leaveRequests.leaveTypeId, schema.leaveTypes.id))
    .where(where);

  const ids = await db
    .select({ id: schema.leaveRequests.id })
    .from(schema.leaveRequests)
    .innerJoin(employee, eq(schema.leaveRequests.employeeId, employee.id))
    .innerJoin(schema.leaveTypes, eq(schema.leaveRequests.leaveTypeId, schema.leaveTypes.id))
    .where(where)
    .orderBy(desc(schema.leaveRequests.createdAt))
    .limit(limit)
    .offset(offset);

  const data = (
    await Promise.all(ids.map(({ id }) => loadRequestRow(db, id)))
  ).filter((r): r is NonNullable<typeof r> => r !== null);

  return { data, total: Number(totalRow?.n ?? 0) };
}

export async function findRequestById(db: DbLike, id: string) {
  return loadRequestRow(db, id, false);
}

export async function findRequestByIdIncludingDeleted(db: Db, id: string) {
  return loadRequestRow(db, id, true);
}

export async function createRequest(
  db: Db,
  data: {
    employeeId: string;
    leaveTypeId: string;
    entityId?: string | null;
    startDate: string;
    endDate: string;
    days: number;
    durationType?: "full_day" | "half_day";
    halfDayPeriod?: "am" | "pm" | null;
    reason?: string;
    source?: "entitled" | "carried";
  },
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.leaveRequests).values({
    id,
    employeeId: data.employeeId,
    leaveTypeId: data.leaveTypeId,
    entityId: data.entityId ?? null,
    startDate: data.startDate,
    endDate: data.endDate,
    days: String(data.days),
    durationType: data.durationType ?? "full_day",
    halfDayPeriod: data.halfDayPeriod ?? null,
    reason: data.reason ?? null,
    source: data.source ?? "entitled",
    status: "pending",
    updatedAt: now,
  });
  return findRequestById(db, id);
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
  const patch: Record<string, unknown> = {
    ...data,
    updatedAt: new Date().toISOString(),
  };
  if (data.status === "approved" || data.status === "rejected") {
    patch.delegatedTo = null;
  }
  await db.update(schema.leaveRequests).set(patch).where(eq(schema.leaveRequests.id, id));
  return findRequestById(db, id);
}

export async function updateRequest(
  db: Db,
  id: string,
  data: Partial<typeof schema.leaveRequests.$inferInsert>,
) {
  await db
    .update(schema.leaveRequests)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.leaveRequests.id, id));
  return findRequestById(db, id);
}

export async function findCalendarRows(db: Db, from: string, to: string, department?: string) {
  const parts: SQL[] = [
    isNull(schema.leaveRequests.deletedAt),
    inArray(schema.leaveRequests.status, ["approved", "pending"]),
    lte(schema.leaveRequests.startDate, to),
    gte(schema.leaveRequests.endDate, from),
  ];
  if (department?.trim()) {
    parts.push(ilike(employee.department, department.trim()));
  }
  const rows = await db
    .select({
      req: schema.leaveRequests,
      empId: employee.id,
      empName: employee.name,
      empDept: employee.department,
      ltId: schema.leaveTypes.id,
      ltName: schema.leaveTypes.name,
      ltCode: schema.leaveTypes.code,
      ltCategory: schema.leaveTypes.category,
    })
    .from(schema.leaveRequests)
    .innerJoin(employee, eq(schema.leaveRequests.employeeId, employee.id))
    .innerJoin(schema.leaveTypes, eq(schema.leaveRequests.leaveTypeId, schema.leaveTypes.id))
    .where(and(...parts))
    .orderBy(asc(schema.leaveRequests.startDate), asc(employee.name));
  return rows.map((r) => ({
    ...r.req,
    employee: { id: r.empId, name: r.empName, department: r.empDept },
    leaveType: { id: r.ltId, name: r.ltName, code: r.ltCode, category: r.ltCategory },
  }));
}

export async function findPendingForReminder(
  db: Db,
  minAgeHours: number,
  minHoursSinceReminder: number,
  maxReminders: number,
) {
  const now = Date.now();
  const createdBefore = new Date(now - minAgeHours * 3600_000).toISOString();
  const reminderBefore = new Date(now - minHoursSinceReminder * 3600_000).toISOString();
  const rows = await db
    .select({ id: schema.leaveRequests.id })
    .from(schema.leaveRequests)
    .where(
      and(
        isNull(schema.leaveRequests.deletedAt),
        eq(schema.leaveRequests.status, "pending"),
        sql`${schema.leaveRequests.reminderCount} < ${maxReminders}`,
        lte(schema.leaveRequests.createdAt, createdBefore),
        or(isNull(schema.leaveRequests.lastReminderAt), lte(schema.leaveRequests.lastReminderAt, reminderBefore)),
      ),
    );
  return (
    await Promise.all(rows.map(({ id }) => findRequestById(db, id)))
  ).filter((r): r is NonNullable<typeof r> => r !== null);
}

export async function checkOverlap(
  db: Db,
  employeeId: string,
  startDate: string,
  endDate: string,
  excludeId?: string,
) {
  const parts: SQL[] = [
    isNull(schema.leaveRequests.deletedAt),
    eq(schema.leaveRequests.employeeId, employeeId),
    inArray(schema.leaveRequests.status, ["pending", "approved"]),
    lte(schema.leaveRequests.startDate, endDate),
    gte(schema.leaveRequests.endDate, startDate),
  ];
  if (excludeId) parts.push(ne(schema.leaveRequests.id, excludeId));
  const [row] = await db
    .select({ id: schema.leaveRequests.id })
    .from(schema.leaveRequests)
    .where(and(...parts))
    .limit(1);
  return row ?? null;
}

export async function updateBalance(
  db: DbLike,
  employeeId: string,
  leaveTypeId: string,
  year: number,
  usedDelta: number,
  source: "entitled" | "carried" = "entitled",
) {
  const [existing] = await db
    .select()
    .from(schema.leaveBalances)
    .where(
      and(
        eq(schema.leaveBalances.employeeId, employeeId),
        eq(schema.leaveBalances.leaveTypeId, leaveTypeId),
        eq(schema.leaveBalances.year, year),
      ),
    )
    .limit(1);
  if (!existing) throw new Error("Leave balance not found");
  const delta = String(usedDelta);
  if (source === "carried") {
    const next = String(Number(existing.carriedUsed) + usedDelta);
    await db
      .update(schema.leaveBalances)
      .set({ carriedUsed: next })
      .where(eq(schema.leaveBalances.id, existing.id));
  } else {
    const next = String(Number(existing.used) + usedDelta);
    await db.update(schema.leaveBalances).set({ used: next }).where(eq(schema.leaveBalances.id, existing.id));
  }
  return existing;
}

export async function setBalanceDeducted(db: DbLike, id: string, balanceDeducted: boolean) {
  await db
    .update(schema.leaveRequests)
    .set({ balanceDeducted, updatedAt: new Date().toISOString() })
    .where(eq(schema.leaveRequests.id, id));
}

export async function findBalance(db: Db, employeeId: string, leaveTypeId: string, year: number) {
  const [row] = await db
    .select()
    .from(schema.leaveBalances)
    .where(
      and(
        eq(schema.leaveBalances.employeeId, employeeId),
        eq(schema.leaveBalances.leaveTypeId, leaveTypeId),
        eq(schema.leaveBalances.year, year),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function findUserById(db: Db, userId: string) {
  const [row] = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      entityId: schema.users.entityId,
      isActive: schema.users.isActive,
      reportingTo: schema.users.reportingTo,
    })
    .from(schema.users)
    .where(eq(schema.users.id, userId))
    .limit(1);
  return row ?? null;
}

export async function findDirectReportIds(db: Db, managerId: string): Promise<string[]> {
  const rows = await db
    .select({ id: schema.users.id })
    .from(schema.users)
    .where(and(eq(schema.users.reportingTo, managerId), eq(schema.users.isActive, true)));
  return rows.map((r) => r.id);
}

export async function findDirectReports(db: Db, managerId: string) {
  const rows = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      avatarUrl: schema.users.avatarUrl,
      department: schema.users.department,
      jobTitle: schema.users.jobTitle,
      entityId: schema.users.entityId,
      entId: schema.entities.id,
      entCode: schema.entities.code,
      entName: schema.entities.name,
    })
    .from(schema.users)
    .leftJoin(schema.entities, eq(schema.users.entityId, schema.entities.id))
    .where(and(eq(schema.users.reportingTo, managerId), eq(schema.users.isActive, true)))
    .orderBy(asc(schema.users.name));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    avatarUrl: r.avatarUrl,
    department: r.department,
    jobTitle: r.jobTitle,
    entityId: r.entityId,
    entity: r.entId ? { id: r.entId, code: r.entCode!, name: r.entName! } : null,
  }));
}

export async function findAllReportees(db: Db) {
  const rows = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      avatarUrl: schema.users.avatarUrl,
      department: schema.users.department,
      jobTitle: schema.users.jobTitle,
      entityId: schema.users.entityId,
      entId: schema.entities.id,
      entCode: schema.entities.code,
      entName: schema.entities.name,
    })
    .from(schema.users)
    .leftJoin(schema.entities, eq(schema.users.entityId, schema.entities.id))
    .where(eq(schema.users.isActive, true))
    .orderBy(asc(schema.users.name));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    avatarUrl: r.avatarUrl,
    department: r.department,
    jobTitle: r.jobTitle,
    entityId: r.entityId,
    entity: r.entId ? { id: r.entId, code: r.entCode!, name: r.entName! } : null,
  }));
}

export async function findTypesForEntities(db: Db, entityIds: Array<string | null>) {
  const concrete = entityIds.filter((id): id is string => !!id);
  const parts: SQL[] = [eq(schema.leaveTypes.isActive, true)];
  if (concrete.length > 0) {
    parts.push(or(isNull(schema.leaveTypes.entityId), inArray(schema.leaveTypes.entityId, concrete))!);
  } else {
    parts.push(isNull(schema.leaveTypes.entityId));
  }
  return db
    .select({
      id: schema.leaveTypes.id,
      name: schema.leaveTypes.name,
      code: schema.leaveTypes.code,
      category: schema.leaveTypes.category,
      entityId: schema.leaveTypes.entityId,
      daysPerYear: schema.leaveTypes.daysPerYear,
    })
    .from(schema.leaveTypes)
    .where(and(...parts))
    .orderBy(asc(schema.leaveTypes.entityId), asc(schema.leaveTypes.name));
}

export async function findBalancesForEmployees(db: Db, employeeIds: string[], year: number) {
  if (employeeIds.length === 0) return [];
  const rows = await db
    .select({
      balance: schema.leaveBalances,
      ltId: schema.leaveTypes.id,
      ltName: schema.leaveTypes.name,
      ltCode: schema.leaveTypes.code,
      ltCategory: schema.leaveTypes.category,
      ltEntityId: schema.leaveTypes.entityId,
    })
    .from(schema.leaveBalances)
    .innerJoin(schema.leaveTypes, eq(schema.leaveBalances.leaveTypeId, schema.leaveTypes.id))
    .where(and(inArray(schema.leaveBalances.employeeId, employeeIds), eq(schema.leaveBalances.year, year)))
    .orderBy(asc(schema.leaveBalances.employeeId), asc(schema.leaveTypes.name));
  return rows.map((r) => ({
    ...r.balance,
    leaveType: {
      id: r.ltId,
      name: r.ltName,
      code: r.ltCode,
      category: r.ltCategory,
      entityId: r.ltEntityId,
    },
  }));
}

export async function createBalanceTransaction(
  db: DbLike,
  data: {
    employeeId: string;
    leaveTypeId: string;
    year: number;
    type: string;
    amount: number;
    description?: string;
    referenceId?: string;
  },
) {
  const id = crypto.randomUUID();
  await db.insert(schema.balanceTransactions).values({
    id,
    employeeId: data.employeeId,
    leaveTypeId: data.leaveTypeId,
    year: data.year,
    type: data.type,
    amount: String(data.amount),
    description: data.description ?? null,
    referenceId: data.referenceId ?? null,
  });
  return { id, ...data };
}

export async function findBalanceDrift(db: Db, year: number | null) {
  return db.execute(sql`
      WITH approved AS (
        SELECT lr.employee_id,
               lr.leave_type_id,
               EXTRACT(YEAR FROM lr.start_date)::int AS year,
               SUM(CASE WHEN lr.source = 'carried' THEN 0 ELSE lr.days END)::float8 AS entitled_days,
               SUM(CASE WHEN lr.source = 'carried' THEN lr.days ELSE 0 END)::float8 AS carried_days,
               SUM(CASE WHEN lr.balance_deducted THEN 0 ELSE lr.days END)::float8 AS undeducted_days
        FROM leave_requests lr
        WHERE lr.status = 'approved' AND lr.deleted_at IS NULL
        GROUP BY 1, 2, 3
      ),
      deleted_approved AS (
        SELECT lr.employee_id,
               lr.leave_type_id,
               EXTRACT(YEAR FROM lr.start_date)::int AS year,
               SUM(lr.days)::float8 AS days
        FROM leave_requests lr
        WHERE lr.status = 'approved' AND lr.deleted_at IS NOT NULL
        GROUP BY 1, 2, 3
      ),
      ledger AS (
        SELECT bt.employee_id,
               bt.leave_type_id,
               bt.year,
               COUNT(*)::int AS row_count,
               SUM(bt.amount)::float8 AS delta
        FROM balance_transactions bt
        WHERE bt.type IN ('manual_adjustment', 'bulk_import')
        GROUP BY 1, 2, 3
      )
      SELECT lb.id                              AS balance_id,
             u.id                               AS employee_id,
             u.name                             AS employee_name,
             u.email                            AS employee_email,
             lt.id                              AS leave_type_id,
             lt.name                            AS leave_type_name,
             lb.year                            AS year,
             lb.entitled::float8                AS entitled,
             lb.used::float8                    AS used,
             lb.carried_used::float8            AS carried_used,
             COALESCE(a.entitled_days, 0)       AS approved_days,
             COALESCE(a.carried_days, 0)        AS approved_carried_days,
             (lb.used::float8 - COALESCE(a.entitled_days, 0))        AS drift,
             (lb.carried_used::float8 - COALESCE(a.carried_days, 0)) AS carried_drift,
             COALESCE(d.days, 0)                AS deleted_approved_days,
             COALESCE(a.undeducted_days, 0)     AS undeducted_approved_days,
             COALESCE(l.row_count, 0)           AS ledger_row_count,
             COALESCE(l.delta, 0)               AS ledger_delta
      FROM leave_balances lb
      JOIN users u        ON u.id = lb.employee_id
      JOIN leave_types lt ON lt.id = lb.leave_type_id
      LEFT JOIN approved a         ON a.employee_id = lb.employee_id
                                  AND a.leave_type_id = lb.leave_type_id
                                  AND a.year = lb.year
      LEFT JOIN deleted_approved d ON d.employee_id = lb.employee_id
                                  AND d.leave_type_id = lb.leave_type_id
                                  AND d.year = lb.year
      LEFT JOIN ledger l           ON l.employee_id = lb.employee_id
                                  AND l.leave_type_id = lb.leave_type_id
                                  AND l.year = lb.year
      WHERE (${year}::int IS NULL OR lb.year = ${year}::int)
        AND (lb.used::float8        <> COALESCE(a.entitled_days, 0)
          OR lb.carried_used::float8 <> COALESCE(a.carried_days, 0))
      ORDER BY ABS(lb.used::float8 - COALESCE(a.entitled_days, 0)) DESC,
               u.name ASC,
               lt.name ASC
    `) as Promise<
    Array<{
      balance_id: string;
      employee_id: string;
      employee_name: string;
      employee_email: string;
      leave_type_id: string;
      leave_type_name: string;
      year: number;
      entitled: number;
      used: number;
      carried_used: number;
      approved_days: number;
      approved_carried_days: number;
      drift: number;
      carried_drift: number;
      deleted_approved_days: number;
      undeducted_approved_days: number;
      ledger_row_count: number;
      ledger_delta: number;
    }>
  >;
}

export async function countBalances(db: Db, year: number | null) {
  const parts: SQL[] = [];
  if (year !== null) parts.push(eq(schema.leaveBalances.year, year));
  const where = parts.length ? and(...parts) : undefined;
  const [row] = await db.select({ n: count() }).from(schema.leaveBalances).where(where);
  return Number(row?.n ?? 0);
}

export async function findBalanceTransactions(
  db: Db,
  employeeId: string,
  year: number,
  leaveTypeId?: string,
) {
  const parts: SQL[] = [
    eq(schema.balanceTransactions.employeeId, employeeId),
    eq(schema.balanceTransactions.year, year),
  ];
  if (leaveTypeId) parts.push(eq(schema.balanceTransactions.leaveTypeId, leaveTypeId));
  const rows = await db
    .select({
      tx: schema.balanceTransactions,
      ltId: schema.leaveTypes.id,
      ltName: schema.leaveTypes.name,
      ltCode: schema.leaveTypes.code,
      ltCategory: schema.leaveTypes.category,
    })
    .from(schema.balanceTransactions)
    .innerJoin(schema.leaveTypes, eq(schema.balanceTransactions.leaveTypeId, schema.leaveTypes.id))
    .where(and(...parts))
    .orderBy(desc(schema.balanceTransactions.createdAt));
  return rows.map((r) => ({
    ...r.tx,
    leaveType: { id: r.ltId, name: r.ltName, code: r.ltCode, category: r.ltCategory },
  }));
}

export async function findApprovalSteps(db: DbLike, opts?: { activeOnly?: boolean }) {
  const parts: SQL[] = [];
  if (opts?.activeOnly) parts.push(eq(schema.leaveApprovalSteps.isActive, true));
  const where = parts.length ? and(...parts) : undefined;
  const rows = await db
    .select({
      step: schema.leaveApprovalSteps,
      userId: stepApproverUser.id,
      userName: stepApproverUser.name,
      userEmail: stepApproverUser.email,
    })
    .from(schema.leaveApprovalSteps)
    .leftJoin(stepApproverUser, eq(schema.leaveApprovalSteps.approverUserId, stepApproverUser.id))
    .where(where)
    .orderBy(asc(schema.leaveApprovalSteps.order));
  return rows.map((r) => ({
    ...r.step,
    approverUser: r.userId ? { id: r.userId, name: r.userName!, email: r.userEmail! } : null,
  }));
}

export async function findApprovalStepById(db: Db, id: string) {
  const [row] = await db
    .select({
      step: schema.leaveApprovalSteps,
      userId: stepApproverUser.id,
      userName: stepApproverUser.name,
      userEmail: stepApproverUser.email,
    })
    .from(schema.leaveApprovalSteps)
    .leftJoin(stepApproverUser, eq(schema.leaveApprovalSteps.approverUserId, stepApproverUser.id))
    .where(eq(schema.leaveApprovalSteps.id, id))
    .limit(1);
  if (!row) return null;
  return {
    ...row.step,
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
    isActive: boolean;
  },
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.leaveApprovalSteps).values({
    id,
    order: data.order,
    name: data.name,
    description: data.description ?? null,
    approverType: data.approverType,
    approverUserId: data.approverUserId ?? null,
    skipWhenSubmitterIds: data.skipWhenSubmitterIds as never,
    onlyWhenSubmitterIds: data.onlyWhenSubmitterIds as never,
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
    isActive: boolean;
  }>,
) {
  const now = new Date().toISOString();
  await db
    .update(schema.leaveApprovalSteps)
    .set({ ...data, updatedAt: now })
    .where(eq(schema.leaveApprovalSteps.id, id));
  return findApprovalStepById(db, id);
}

export async function deleteApprovalStep(db: Db, id: string) {
  await db.delete(schema.leaveApprovalSteps).where(eq(schema.leaveApprovalSteps.id, id));
}

export async function reorderApprovalSteps(db: Db, orderedIds: string[]) {
  return db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(schema.leaveApprovalSteps)
        .set({ order: 10000 + i, updatedAt: new Date().toISOString() })
        .where(eq(schema.leaveApprovalSteps.id, orderedIds[i]!));
    }
    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(schema.leaveApprovalSteps)
        .set({ order: i + 1, updatedAt: new Date().toISOString() })
        .where(eq(schema.leaveApprovalSteps.id, orderedIds[i]!));
    }
    return findApprovalSteps(tx);
  });
}

export async function nextApprovalStepOrder(db: Db) {
  const [row] = await db
    .select({ order: schema.leaveApprovalSteps.order })
    .from(schema.leaveApprovalSteps)
    .orderBy(desc(schema.leaveApprovalSteps.order))
    .limit(1);
  return (row?.order ?? 0) + 1;
}

export async function createDecisions(
  db: DbLike,
  leaveRequestId: string,
  rows: Array<{
    order: number;
    name: string;
    approverType: string;
    approverUserId?: string | null;
  }>,
) {
  if (rows.length === 0) return;
  const now = new Date().toISOString();
  await db.insert(schema.leaveApprovalDecisions).values(
    rows.map((r) => ({
      id: crypto.randomUUID(),
      leaveRequestId,
      order: r.order,
      name: r.name,
      approverType: r.approverType,
      approverUserId: r.approverUserId ?? null,
      status: "pending",
      createdAt: now,
    })),
  );
}

export async function findDecisions(db: DbLike, leaveRequestId: string) {
  const rows = await db
    .select({
      d: schema.leaveApprovalDecisions,
      apprId: decisionApproverUser.id,
      apprName: decisionApproverUser.name,
      apprEmail: decisionApproverUser.email,
      decId: decisionDecidedBy.id,
      decName: decisionDecidedBy.name,
      decEmail: decisionDecidedBy.email,
    })
    .from(schema.leaveApprovalDecisions)
    .leftJoin(decisionApproverUser, eq(schema.leaveApprovalDecisions.approverUserId, decisionApproverUser.id))
    .leftJoin(decisionDecidedBy, eq(schema.leaveApprovalDecisions.decidedById, decisionDecidedBy.id))
    .where(eq(schema.leaveApprovalDecisions.leaveRequestId, leaveRequestId))
    .orderBy(asc(schema.leaveApprovalDecisions.order));
  return rows.map((r) => ({
    ...r.d,
    approverUser: r.apprId ? { id: r.apprId, name: r.apprName!, email: r.apprEmail! } : null,
    decidedBy: r.decId ? { id: r.decId, name: r.decName!, email: r.decEmail! } : null,
  }));
}

export async function updateDecision(
  db: DbLike,
  id: string,
  data: Partial<{
    status: string;
    decidedById: string | null;
    decidedAt: string | null;
    notes: string | null;
  }>,
) {
  await db.update(schema.leaveApprovalDecisions).set(data).where(eq(schema.leaveApprovalDecisions.id, id));
}

export async function deleteDecisionsForRequest(db: DbLike, leaveRequestId: string) {
  await db
    .delete(schema.leaveApprovalDecisions)
    .where(eq(schema.leaveApprovalDecisions.leaveRequestId, leaveRequestId));
}

export async function updateRequestStepOrder(db: Db, id: string, currentStepOrder: number | null) {
  await db
    .update(schema.leaveRequests)
    .set({ currentStepOrder, updatedAt: new Date().toISOString() })
    .where(eq(schema.leaveRequests.id, id));
}

export async function softDeleteRequest(db: Db, id: string) {
  const now = new Date().toISOString();
  await db
    .update(schema.leaveRequests)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(schema.leaveRequests.id, id));
  return findRequestByIdIncludingDeleted(db, id);
}

export async function restoreRequest(db: Db, id: string) {
  await db
    .update(schema.leaveRequests)
    .set({ deletedAt: null, updatedAt: new Date().toISOString() })
    .where(eq(schema.leaveRequests.id, id));
  return findRequestById(db, id);
}

export async function permanentDeleteRequest(db: Db, id: string) {
  await db.delete(schema.leaveRequests).where(eq(schema.leaveRequests.id, id));
}

export async function claimPendingRequest(
  tx: DbTransaction,
  requestId: string,
  data: Partial<typeof schema.leaveRequests.$inferInsert>,
) {
  const [updated] = await tx
    .update(schema.leaveRequests)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(and(eq(schema.leaveRequests.id, requestId), eq(schema.leaveRequests.status, "pending")))
    .returning();
  if (!updated) {
    const { ConflictException } = await import("../http-exception");
    throw new ConflictException("This leave request was already actioned by someone else");
  }
  return updated;
}

export async function findUsersByEmails(
  db: Db,
  emails: string[],
): Promise<Array<{ id: string; email: string; name: string; entityId: string | null }>> {
  if (emails.length === 0) return [];
  return db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      name: schema.users.name,
      entityId: schema.users.entityId,
    })
    .from(schema.users)
    .where(inArray(schema.users.email, emails));
}

export async function findUserWithEntity(db: Db, userId: string) {
  const [row] = await db
    .select({
      id: schema.users.id,
      department: schema.users.department,
      entName: schema.entities.name,
    })
    .from(schema.users)
    .leftJoin(schema.entities, eq(schema.users.entityId, schema.entities.id))
    .where(eq(schema.users.id, userId))
    .limit(1);
  return row ?? null;
}

export async function findLeaveBalanceById(db: Db, id: string) {
  const [row] = await db.select().from(schema.leaveBalances).where(eq(schema.leaveBalances.id, id)).limit(1);
  return row ?? null;
}

export async function updateLeaveBalanceRow(
  db: Db,
  id: string,
  data: Partial<typeof schema.leaveBalances.$inferInsert>,
) {
  await db.update(schema.leaveBalances).set(data).where(eq(schema.leaveBalances.id, id));
  return findLeaveBalanceById(db, id);
}

export async function createLeaveBalanceRow(
  db: Db,
  data: {
    employeeId: string;
    leaveTypeId: string;
    year: number;
    entitled: number;
    used: number;
    carried: number;
    carriedUsed: number;
    carriedExpiry: string | null;
    adjustment: number;
  },
) {
  const id = crypto.randomUUID();
  await db.insert(schema.leaveBalances).values({
    id,
    employeeId: data.employeeId,
    leaveTypeId: data.leaveTypeId,
    year: data.year,
    entitled: String(data.entitled),
    used: String(data.used),
    carried: String(data.carried),
    carriedUsed: String(data.carriedUsed),
    carriedExpiry: data.carriedExpiry,
    adjustment: String(data.adjustment),
  });
  return findLeaveBalanceById(db, id);
}

export async function groupRequestsByStatus(
  db: Db,
  whereParts: SQL[],
  yearStart: string,
  yearEnd: string,
) {
  const parts = [...whereParts, gte(schema.leaveRequests.createdAt, yearStart), lte(schema.leaveRequests.createdAt, yearEnd)];
  const rows = await db
    .select({ status: schema.leaveRequests.status, n: count() })
    .from(schema.leaveRequests)
    .where(and(...parts))
    .groupBy(schema.leaveRequests.status);
  return rows.map((r) => ({ status: r.status, count: Number(r.n) }));
}

export async function groupRequestsByLeaveType(
  db: Db,
  whereParts: SQL[],
  yearStart: string,
  yearEnd: string,
) {
  const parts = [...whereParts, gte(schema.leaveRequests.createdAt, yearStart), lte(schema.leaveRequests.createdAt, yearEnd)];
  const rows = await db
    .select({ leaveTypeId: schema.leaveRequests.leaveTypeId, n: count() })
    .from(schema.leaveRequests)
    .where(and(...parts))
    .groupBy(schema.leaveRequests.leaveTypeId);
  return rows.map((r) => ({ leaveTypeId: r.leaveTypeId, count: Number(r.n) }));
}

export async function findLeaveTypesByIds(db: Db, ids: string[]) {
  if (ids.length === 0) return [];
  return db
    .select({ id: schema.leaveTypes.id, name: schema.leaveTypes.name, code: schema.leaveTypes.code })
    .from(schema.leaveTypes)
    .where(inArray(schema.leaveTypes.id, ids));
}
