import {
  and,
  asc,
  count,
  desc,
  eq,
  type SQL,
} from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";
import { alias } from "drizzle-orm/pg-core";
import { createCuid } from "../lib/id";

const employee = alias(schema.users, "it_access_employee");
const grantedByUser = alias(schema.users, "it_access_granted_by");
const approverUser = alias(schema.users, "it_access_approver");
const decidedByUser = alias(schema.users, "it_access_decided_by");
const assignEmployee = alias(schema.users, "it_access_assign_employee");
const assignGrantedBy = alias(schema.users, "it_access_assign_granted_by");
const assignRevokedBy = alias(schema.users, "it_access_assign_revoked_by");
const auditUser = alias(schema.users, "it_access_audit_user");
const auditTarget = alias(schema.users, "it_access_audit_target");

const personPick = {
  id: schema.users.id,
  name: schema.users.name,
  email: schema.users.email,
};

async function loadDecisions(db: Db, requestId: string) {
  const rows = await db
    .select({
      decision: schema.itAccessApprovalDecisions,
      approverId: approverUser.id,
      approverName: approverUser.name,
      approverEmail: approverUser.email,
      decidedById: decidedByUser.id,
      decidedByName: decidedByUser.name,
      decidedByEmail: decidedByUser.email,
    })
    .from(schema.itAccessApprovalDecisions)
    .leftJoin(approverUser, eq(schema.itAccessApprovalDecisions.approverUserId, approverUser.id))
    .leftJoin(decidedByUser, eq(schema.itAccessApprovalDecisions.decidedById, decidedByUser.id))
    .where(eq(schema.itAccessApprovalDecisions.requestId, requestId))
    .orderBy(asc(schema.itAccessApprovalDecisions.order));

  return rows.map((r) => ({
    ...r.decision,
    approverUser: r.approverId
      ? { id: r.approverId, name: r.approverName!, email: r.approverEmail! }
      : null,
    decidedBy: r.decidedById
      ? { id: r.decidedById, name: r.decidedByName!, email: r.decidedByEmail! }
      : null,
  }));
}

async function loadRequestRow(db: Db, where: SQL) {
  const [row] = await db
    .select({
      request: schema.itAccessRequests,
      employeeId: employee.id,
      employeeName: employee.name,
      employeeEmail: employee.email,
      employeeReportingTo: employee.reportingTo,
      system: schema.itSystems,
      grantedById: grantedByUser.id,
      grantedByName: grantedByUser.name,
      grantedByEmail: grantedByUser.email,
    })
    .from(schema.itAccessRequests)
    .innerJoin(employee, eq(schema.itAccessRequests.employeeId, employee.id))
    .innerJoin(schema.itSystems, eq(schema.itAccessRequests.systemId, schema.itSystems.id))
    .leftJoin(grantedByUser, eq(schema.itAccessRequests.grantedBy, grantedByUser.id))
    .where(where)
    .limit(1);

  if (!row) return null;
  const decisions = await loadDecisions(db, row.request.id);
  return {
    ...row.request,
    employee: {
      id: row.employeeId,
      name: row.employeeName,
      email: row.employeeEmail,
      reportingTo: row.employeeReportingTo,
    },
    system: { id: row.system.id, name: row.system.name, category: row.system.category },
    grantedBy: row.grantedById
      ? { id: row.grantedById, name: row.grantedByName!, email: row.grantedByEmail! }
      : null,
    decisions,
  };
}

export type ItAccessRequestWithRelations = NonNullable<Awaited<ReturnType<typeof findRequest>>>;

export async function listSystems(db: Db, activeOnly: boolean) {
  return db
    .select()
    .from(schema.itSystems)
    .where(activeOnly ? eq(schema.itSystems.isActive, true) : undefined)
    .orderBy(asc(schema.itSystems.sortOrder), asc(schema.itSystems.name));
}

export async function findSystem(db: Db, id: string) {
  const [row] = await db.select().from(schema.itSystems).where(eq(schema.itSystems.id, id)).limit(1);
  return row ?? null;
}

export async function createSystem(
  db: Db,
  data: {
    name: string;
    description: string | null;
    category: string | null;
    isActive: boolean;
    sortOrder: number;
  },
) {
  const now = new Date().toISOString();
  const id = createCuid();
  await db.insert(schema.itSystems).values({ id, ...data, createdAt: now, updatedAt: now });
  const row = await findSystem(db, id);
  return row!;
}

export async function updateSystem(
  db: Db,
  id: string,
  data: Partial<{
    name: string;
    description: string | null;
    category: string | null;
    isActive: boolean;
    sortOrder: number;
  }>,
) {
  const now = new Date().toISOString();
  await db.update(schema.itSystems).set({ ...data, updatedAt: now }).where(eq(schema.itSystems.id, id));
  const row = await findSystem(db, id);
  return row!;
}

export async function deleteSystem(db: Db, id: string) {
  await db.delete(schema.itSystems).where(eq(schema.itSystems.id, id));
}

export async function countSystemUsage(db: Db, systemId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(schema.itAccessRequests)
    .where(eq(schema.itAccessRequests.systemId, systemId));
  return Number(row?.n ?? 0);
}

export async function listRequests(
  db: Db,
  args: { whereParts: SQL[]; skip: number; take: number },
) {
  const where = args.whereParts.length ? and(...args.whereParts) : undefined;
  const ids = await db
    .select({ id: schema.itAccessRequests.id })
    .from(schema.itAccessRequests)
    .where(where)
    .orderBy(desc(schema.itAccessRequests.createdAt))
    .limit(args.take)
    .offset(args.skip);
  const out: ItAccessRequestWithRelations[] = [];
  for (const { id } of ids) {
    const row = await findRequest(db, id);
    if (row) out.push(row);
  }
  return out;
}

export async function countRequests(db: Db, whereParts: SQL[]) {
  const where = whereParts.length ? and(...whereParts) : undefined;
  const [row] = await db.select({ n: count() }).from(schema.itAccessRequests).where(where);
  return Number(row?.n ?? 0);
}

export async function findRequest(db: Db, id: string) {
  return loadRequestRow(db, eq(schema.itAccessRequests.id, id));
}

export async function createRequest(
  db: Db,
  data: {
    employeeId: string;
    systemId: string;
    requestType: string;
    requestedAccessLevel: string;
    businessJustification: string;
    startDate: string | null;
    endDate: string | null;
    status: string;
  },
) {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.insert(schema.itAccessRequests).values({
    id,
    employeeId: data.employeeId,
    systemId: data.systemId,
    requestType: data.requestType,
    requestedAccessLevel: data.requestedAccessLevel,
    businessJustification: data.businessJustification,
    startDate: data.startDate,
    endDate: data.endDate,
    status: data.status,
    updatedAt: now,
  });
  return (await findRequest(db, id))!;
}

export async function updateRequest(
  db: Db,
  id: string,
  data: Record<string, unknown>,
) {
  const now = new Date().toISOString();
  await db
    .update(schema.itAccessRequests)
    .set({ ...data, updatedAt: now })
    .where(eq(schema.itAccessRequests.id, id));
  return (await findRequest(db, id))!;
}

export async function deleteRequest(db: Db, id: string) {
  await db.delete(schema.itAccessRequests).where(eq(schema.itAccessRequests.id, id));
}

export async function replaceDecisions(
  db: Db,
  requestId: string,
  rows: Array<{
    order: number;
    name: string;
    approverType: string;
    approverUserId: string | null;
  }>,
) {
  await db.transaction(async (tx) => {
    await tx
      .delete(schema.itAccessApprovalDecisions)
      .where(eq(schema.itAccessApprovalDecisions.requestId, requestId));
    if (rows.length === 0) return;
    const now = new Date().toISOString();
    await tx.insert(schema.itAccessApprovalDecisions).values(
      rows.map((r) => ({
        id: crypto.randomUUID(),
        requestId,
        order: r.order,
        name: r.name,
        approverType: r.approverType,
        approverUserId: r.approverUserId,
        status: "pending",
        createdAt: now,
      })),
    );
  });
}

export async function findDecisions(db: Db, requestId: string) {
  return loadDecisions(db, requestId);
}

export async function updateDecision(
  db: Db,
  id: string,
  data: {
    status?: string;
    decidedById?: string | null;
    decidedAt?: string | null;
    notes?: string | null;
  },
) {
  await db.update(schema.itAccessApprovalDecisions).set(data).where(eq(schema.itAccessApprovalDecisions.id, id));
}

async function loadAssignment(db: Db, id: string) {
  const [row] = await db
    .select({
      assignment: schema.itAccessAssignments,
      employeeId: assignEmployee.id,
      employeeName: assignEmployee.name,
      employeeEmail: assignEmployee.email,
      system: schema.itSystems,
      grantedById: assignGrantedBy.id,
      grantedByName: assignGrantedBy.name,
      grantedByEmail: assignGrantedBy.email,
      revokedById: assignRevokedBy.id,
      revokedByName: assignRevokedBy.name,
      revokedByEmail: assignRevokedBy.email,
    })
    .from(schema.itAccessAssignments)
    .innerJoin(assignEmployee, eq(schema.itAccessAssignments.employeeId, assignEmployee.id))
    .innerJoin(schema.itSystems, eq(schema.itAccessAssignments.systemId, schema.itSystems.id))
    .innerJoin(assignGrantedBy, eq(schema.itAccessAssignments.grantedBy, assignGrantedBy.id))
    .leftJoin(assignRevokedBy, eq(schema.itAccessAssignments.revokedBy, assignRevokedBy.id))
    .where(eq(schema.itAccessAssignments.id, id))
    .limit(1);
  if (!row) return null;
  return {
    ...row.assignment,
    employee: { id: row.employeeId, name: row.employeeName, email: row.employeeEmail },
    system: { id: row.system.id, name: row.system.name, category: row.system.category },
    grantedBy: { id: row.grantedById, name: row.grantedByName!, email: row.grantedByEmail! },
    revokedBy: row.revokedById
      ? { id: row.revokedById, name: row.revokedByName!, email: row.revokedByEmail! }
      : null,
  };
}

export type ItAccessAssignmentWithRelations = NonNullable<Awaited<ReturnType<typeof findAssignment>>>;

export async function listAssignments(db: Db, whereParts: SQL[]) {
  const where = whereParts.length ? and(...whereParts) : undefined;
  const ids = await db
    .select({ id: schema.itAccessAssignments.id })
    .from(schema.itAccessAssignments)
    .where(where)
    .orderBy(desc(schema.itAccessAssignments.grantedAt));
  const out: ItAccessAssignmentWithRelations[] = [];
  for (const { id } of ids) {
    const row = await loadAssignment(db, id);
    if (row) out.push(row);
  }
  return out;
}

export async function findAssignment(db: Db, id: string) {
  return loadAssignment(db, id);
}

export async function createAssignment(
  db: Db,
  data: {
    requestId: string;
    employeeId: string;
    systemId: string;
    accessLevel: string;
    status: string;
    grantedById: string;
    expiresAt: string | null;
  },
) {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.insert(schema.itAccessAssignments).values({
    id,
    requestId: data.requestId,
    employeeId: data.employeeId,
    systemId: data.systemId,
    accessLevel: data.accessLevel,
    status: data.status,
    grantedBy: data.grantedById,
    grantedAt: now,
    expiresAt: data.expiresAt,
    updatedAt: now,
  });
  return (await loadAssignment(db, id))!;
}

export async function updateAssignment(
  db: Db,
  id: string,
  data: Record<string, unknown>,
) {
  const now = new Date().toISOString();
  await db
    .update(schema.itAccessAssignments)
    .set({ ...data, updatedAt: now })
    .where(eq(schema.itAccessAssignments.id, id));
  return (await loadAssignment(db, id))!;
}

export async function activeAssignmentsForEmployee(db: Db, employeeId: string) {
  return listAssignments(db, [
    eq(schema.itAccessAssignments.employeeId, employeeId),
    eq(schema.itAccessAssignments.status, "active"),
  ]);
}

export async function activeAssignmentsForSystemEmployee(
  db: Db,
  employeeId: string,
  systemId: string,
) {
  return db
    .select()
    .from(schema.itAccessAssignments)
    .where(
      and(
        eq(schema.itAccessAssignments.employeeId, employeeId),
        eq(schema.itAccessAssignments.systemId, systemId),
        eq(schema.itAccessAssignments.status, "active"),
      ),
    );
}

export async function writeAudit(
  db: Db,
  data: {
    action: string;
    userId: string;
    targetUserId?: string | null;
    requestId?: string | null;
    assignmentId?: string | null;
    comments?: string | null;
    previousValue?: unknown;
    newValue?: unknown;
  },
) {
  const now = new Date().toISOString();
  await db.insert(schema.itAccessAuditLogs).values({
    id: crypto.randomUUID(),
    action: data.action,
    userId: data.userId,
    targetUserId: data.targetUserId ?? null,
    requestId: data.requestId ?? null,
    assignmentId: data.assignmentId ?? null,
    comments: data.comments ?? null,
    previousValue: data.previousValue ?? null,
    newValue: data.newValue ?? null,
    createdAt: now,
  });
}

export async function listAudit(db: Db, whereParts: SQL[]) {
  const where = whereParts.length ? and(...whereParts) : undefined;
  const rows = await db
    .select({
      log: schema.itAccessAuditLogs,
      userId: auditUser.id,
      userName: auditUser.name,
      userEmail: auditUser.email,
      targetId: auditTarget.id,
      targetName: auditTarget.name,
      targetEmail: auditTarget.email,
    })
    .from(schema.itAccessAuditLogs)
    .leftJoin(auditUser, eq(schema.itAccessAuditLogs.userId, auditUser.id))
    .leftJoin(auditTarget, eq(schema.itAccessAuditLogs.targetUserId, auditTarget.id))
    .where(where)
    .orderBy(desc(schema.itAccessAuditLogs.createdAt))
    .limit(200);

  return rows.map((r) => ({
    ...r.log,
    user: r.userId ? { id: r.userId, name: r.userName!, email: r.userEmail! } : null,
    targetUser: r.targetId ? { id: r.targetId, name: r.targetName!, email: r.targetEmail! } : null,
  }));
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
