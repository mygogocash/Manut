import { PERMISSIONS } from "@nexora/contracts";
import type {
  CreateRequestInput,
  CreateSystemInput,
  DecisionInput,
  GrantInput,
  RejectInput,
  RequestQuery,
  RevokeAssignmentInput,
  UpdateRequestInput,
  UpdateSystemInput,
} from "@nexora/contracts/modules/it-access/it-access.validation";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";
import { eq } from "drizzle-orm";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "../http-exception";
import * as repo from "./repository";

function canViewAll(perms: string[]): boolean {
  return (
    perms.includes(PERMISSIONS.IT_ACCESS_VIEW) ||
    perms.includes(PERMISSIONS.IT_ACCESS_APPROVE) ||
    perms.includes(PERMISSIONS.IT_ACCESS_MANAGE)
  );
}

function canApproveIt(perms: string[]): boolean {
  return (
    perms.includes(PERMISSIONS.IT_ACCESS_APPROVE) ||
    perms.includes(PERMISSIONS.IT_ACCESS_MANAGE)
  );
}

function canManage(perms: string[]): boolean {
  return perms.includes(PERMISSIONS.IT_ACCESS_MANAGE);
}

function parseDate(v: string | null | undefined): string | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  return v;
}

function requestDTO(r: repo.ItAccessRequestWithRelations) {
  return {
    id: r.id,
    requestNumber: r.requestNumber,
    employeeId: r.employeeId,
    employee: {
      id: r.employee.id,
      name: r.employee.name,
      email: r.employee.email,
    },
    systemId: r.systemId,
    system: r.system,
    requestType: r.requestType,
    requestedAccessLevel: r.requestedAccessLevel,
    businessJustification: r.businessJustification,
    startDate: r.startDate ?? null,
    endDate: r.endDate ?? null,
    status: r.status,
    currentStepOrder: r.currentStepOrder ?? null,
    managerComments: r.managerComments,
    itComments: r.itComments,
    rejectReason: r.rejectReason,
    submittedAt: r.submittedAt ?? null,
    grantedBy: r.grantedBy,
    grantedAt: r.grantedAt ?? null,
    approvalChain: r.decisions.map((d) => ({
      order: d.order,
      name: d.name,
      approverType: d.approverType,
      approverUser: d.approverUser,
      status: d.status,
      decidedBy: d.decidedBy,
      decidedAt: d.decidedAt ?? null,
      notes: d.notes,
    })),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

function assignmentDTO(a: repo.ItAccessAssignmentWithRelations) {
  return {
    id: a.id,
    requestId: a.requestId,
    employeeId: a.employeeId,
    employee: a.employee,
    systemId: a.systemId,
    system: a.system,
    accessLevel: a.accessLevel,
    status: a.status,
    grantedBy: a.grantedBy,
    grantedAt: a.grantedAt,
    expiresAt: a.expiresAt ?? null,
    revokedBy: a.revokedBy,
    revokedAt: a.revokedAt ?? null,
    revokeReason: a.revokeReason,
  };
}

export async function listSystems(db: Db, activeOnly: boolean) {
  const rows = await repo.listSystems(db, activeOnly);
  return { data: rows };
}

export async function createSystem(db: Db, input: CreateSystemInput, actorId: string) {
  const row = await repo.createSystem(db, {
    name: input.name,
    description: input.description ?? null,
    category: input.category ?? null,
    isActive: input.isActive,
    sortOrder: input.sortOrder,
  });
  await repo.writeAudit(db, {
    action: "system-created",
    userId: actorId,
    newValue: { name: input.name, systemId: row.id },
  });
  return { data: row };
}

export async function updateSystem(
  db: Db,
  id: string,
  input: UpdateSystemInput,
  actorId: string,
) {
  const existing = await repo.findSystem(db, id);
  if (!existing) throw new NotFoundException("System not found");
  const row = await repo.updateSystem(db, id, {
    ...("name" in input ? { name: input.name } : {}),
    ...("description" in input ? { description: input.description ?? null } : {}),
    ...("category" in input ? { category: input.category ?? null } : {}),
    ...("isActive" in input ? { isActive: input.isActive } : {}),
    ...("sortOrder" in input ? { sortOrder: input.sortOrder } : {}),
  });
  await repo.writeAudit(db, {
    action: "system-updated",
    userId: actorId,
    newValue: { systemId: id, ...input },
  });
  return { data: row };
}

export async function deleteSystem(db: Db, id: string, actorId: string) {
  const existing = await repo.findSystem(db, id);
  if (!existing) throw new NotFoundException("System not found");
  const usage = await repo.countSystemUsage(db, id);
  if (usage > 0) {
    throw new ConflictException(
      "System has request history; deactivate it instead of deleting",
    );
  }
  await repo.deleteSystem(db, id);
  await repo.writeAudit(db, {
    action: "system-deleted",
    userId: actorId,
    newValue: { systemId: id, name: existing.name },
  });
  return { data: { id } };
}

export async function listRequests(
  db: Db,
  actorId: string,
  perms: string[],
  query: RequestQuery,
) {
  const whereParts = [];
  const wantsAll = query.scope === "all" && canViewAll(perms);
  if (!wantsAll) {
    whereParts.push(eq(schema.itAccessRequests.employeeId, actorId));
  } else if (query.employeeId) {
    whereParts.push(eq(schema.itAccessRequests.employeeId, query.employeeId));
  }
  if (query.status) whereParts.push(eq(schema.itAccessRequests.status, query.status));
  if (query.systemId) whereParts.push(eq(schema.itAccessRequests.systemId, query.systemId));

  const skip = (query.page - 1) * query.limit;
  const [rows, total] = await Promise.all([
    repo.listRequests(db, { whereParts, skip, take: query.limit }),
    repo.countRequests(db, whereParts),
  ]);
  return {
    data: rows.map(requestDTO),
    meta: { page: query.page, limit: query.limit, total },
  };
}

async function loadOwned(db: Db, id: string, actorId: string, perms: string[]) {
  const row = await repo.findRequest(db, id);
  if (!row) throw new NotFoundException("Access request not found");
  if (row.employeeId !== actorId && !canViewAll(perms)) {
    throw new ForbiddenException("No access to this request");
  }
  return row;
}

export async function getRequest(db: Db, id: string, actorId: string, perms: string[]) {
  return { data: requestDTO(await loadOwned(db, id, actorId, perms)) };
}

export async function createRequest(
  db: Db,
  input: CreateRequestInput,
  actorId: string,
  perms: string[],
) {
  const employeeId =
    input.employeeId && canViewAll(perms) ? input.employeeId : actorId;
  const system = await repo.findSystem(db, input.systemId);
  if (!system || !system.isActive) {
    throw new BadRequestException("Unknown or inactive system");
  }
  const row = await repo.createRequest(db, {
    employeeId,
    systemId: input.systemId,
    requestType: input.requestType,
    requestedAccessLevel: input.requestedAccessLevel,
    businessJustification: input.businessJustification,
    startDate: parseDate(input.startDate) ?? null,
    endDate: parseDate(input.endDate) ?? null,
    status: "draft",
  });
  await repo.writeAudit(db, {
    action: "request-created",
    userId: actorId,
    targetUserId: employeeId,
    requestId: row.id,
    newValue: { systemId: input.systemId, requestType: input.requestType },
  });
  return { data: requestDTO(row) };
}

export async function updateRequest(
  db: Db,
  id: string,
  input: UpdateRequestInput,
  actorId: string,
  perms: string[],
) {
  const existing = await loadOwned(db, id, actorId, perms);
  if (existing.status !== "draft") {
    throw new BadRequestException("Only draft requests can be edited");
  }
  const row = await repo.updateRequest(db, id, {
    ...("systemId" in input ? { systemId: input.systemId } : {}),
    ...("requestType" in input ? { requestType: input.requestType } : {}),
    ...("requestedAccessLevel" in input
      ? { requestedAccessLevel: input.requestedAccessLevel }
      : {}),
    ...("businessJustification" in input
      ? { businessJustification: input.businessJustification }
      : {}),
    ...("startDate" in input ? { startDate: parseDate(input.startDate) } : {}),
    ...("endDate" in input ? { endDate: parseDate(input.endDate) } : {}),
  });
  await repo.writeAudit(db, {
    action: "request-updated",
    userId: actorId,
    targetUserId: existing.employeeId,
    requestId: id,
    newValue: input,
  });
  return { data: requestDTO(row) };
}

export async function deleteRequest(
  db: Db,
  id: string,
  actorId: string,
  perms: string[],
) {
  const existing = await loadOwned(db, id, actorId, perms);
  if (existing.status !== "draft" && !canManage(perms)) {
    throw new BadRequestException("Only draft requests can be deleted");
  }
  await repo.deleteRequest(db, id);
  await repo.writeAudit(db, {
    action: "request-deleted",
    userId: actorId,
    targetUserId: existing.employeeId,
    requestId: id,
  });
  return { data: { id } };
}

async function buildChain(db: Db, employeeId: string) {
  const emp = await repo.findUserById(db, employeeId);
  const rows: Array<{
    order: number;
    name: string;
    approverType: string;
    approverUserId: string | null;
  }> = [];
  let order = 1;
  if (emp?.reportingTo) {
    rows.push({
      order: order++,
      name: "Manager Approval",
      approverType: "manager",
      approverUserId: emp.reportingTo,
    });
  }
  rows.push({
    order: order++,
    name: "IT Approval",
    approverType: "it",
    approverUserId: null,
  });
  return rows;
}

export async function submitRequest(
  db: Db,
  id: string,
  actorId: string,
  perms: string[],
) {
  const existing = await loadOwned(db, id, actorId, perms);
  if (existing.employeeId !== actorId && !canViewAll(perms)) {
    throw new ForbiddenException("You can only submit your own request");
  }
  if (existing.status !== "draft") {
    throw new BadRequestException(
      `Cannot submit a request with status "${existing.status}"`,
    );
  }
  const chain = await buildChain(db, existing.employeeId);
  await repo.replaceDecisions(db, id, chain);
  const firstOrder = chain[0]!.order;
  const status =
    chain[0]!.approverType === "manager" ? "pending-manager" : "pending-it";
  const row = await repo.updateRequest(db, id, {
    status,
    currentStepOrder: firstOrder,
    submittedAt: new Date().toISOString(),
  });
  await repo.writeAudit(db, {
    action: "request-submitted",
    userId: actorId,
    targetUserId: existing.employeeId,
    requestId: id,
    newValue: { status },
  });
  return { data: requestDTO(row) };
}

function assertCanActOnStep(
  step: { approverType: string; approverUserId: string | null },
  actorId: string,
  perms: string[],
) {
  if (step.approverType === "it") {
    if (!canApproveIt(perms)) {
      throw new ForbiddenException("Only IT can act on this step");
    }
    return;
  }
  if (canManage(perms)) return;
  if (step.approverUserId !== actorId) {
    throw new ForbiddenException(
      "Only the requester's manager can approve this step",
    );
  }
}

export async function approveRequest(
  db: Db,
  id: string,
  input: DecisionInput,
  actorId: string,
  perms: string[],
) {
  const existing = await repo.findRequest(db, id);
  if (!existing) throw new NotFoundException("Access request not found");
  if (!["pending-manager", "pending-it"].includes(existing.status)) {
    throw new BadRequestException(
      `Request is not awaiting approval (status "${existing.status}")`,
    );
  }
  const decisions = await repo.findDecisions(db, id);
  const order = existing.currentStepOrder ?? 1;
  const decision = decisions.find((d) => d.order === order);
  if (!decision) throw new BadRequestException("No pending approval step");
  assertCanActOnStep(decision, actorId, perms);

  await repo.updateDecision(db, decision.id, {
    status: "approved",
    decidedById: actorId,
    decidedAt: new Date().toISOString(),
    notes: input.notes ?? null,
  });

  const isManagerStep = decision.approverType === "manager";
  const next = decisions.find(
    (d) => d.order > decision.order && d.status === "pending",
  );

  let row: repo.ItAccessRequestWithRelations;
  if (next) {
    row = await repo.updateRequest(db, id, {
      status:
        next.approverType === "manager" ? "pending-manager" : "pending-it",
      currentStepOrder: next.order,
      ...(isManagerStep ? { managerComments: input.notes ?? null } : {}),
    });
  } else {
    row = await repo.updateRequest(db, id, {
      status: "approved",
      currentStepOrder: null,
      ...(isManagerStep
        ? { managerComments: input.notes ?? null }
        : { itComments: input.notes ?? null }),
    });
  }

  await repo.writeAudit(db, {
    action: isManagerStep ? "manager-approved" : "it-approved",
    userId: actorId,
    targetUserId: existing.employeeId,
    requestId: id,
    comments: input.notes ?? null,
    newValue: { status: row.status },
  });
  return { data: requestDTO(row) };
}

export async function rejectRequest(
  db: Db,
  id: string,
  input: RejectInput,
  actorId: string,
  perms: string[],
) {
  const existing = await repo.findRequest(db, id);
  if (!existing) throw new NotFoundException("Access request not found");
  if (!["pending-manager", "pending-it"].includes(existing.status)) {
    throw new BadRequestException("Request is not awaiting approval");
  }
  const decisions = await repo.findDecisions(db, id);
  const order = existing.currentStepOrder ?? 1;
  const decision = decisions.find((d) => d.order === order);
  if (!decision) throw new BadRequestException("No pending approval step");
  assertCanActOnStep(decision, actorId, perms);

  await repo.updateDecision(db, decision.id, {
    status: "rejected",
    decidedById: actorId,
    decidedAt: new Date().toISOString(),
    notes: input.reason,
  });
  const row = await repo.updateRequest(db, id, {
    status: "rejected",
    currentStepOrder: null,
    rejectReason: input.reason,
  });
  await repo.writeAudit(db, {
    action: "rejected",
    userId: actorId,
    targetUserId: existing.employeeId,
    requestId: id,
    comments: input.reason,
    newValue: { status: "rejected" },
  });
  return { data: requestDTO(row) };
}

export async function grantRequest(
  db: Db,
  id: string,
  input: GrantInput,
  actorId: string,
) {
  const existing = await repo.findRequest(db, id);
  if (!existing) throw new NotFoundException("Access request not found");
  if (existing.status !== "approved") {
    throw new BadRequestException(
      "Only fully-approved requests can be granted",
    );
  }
  const accessLevel = input.accessLevel ?? existing.requestedAccessLevel;

  if (existing.requestType === "revoke") {
    const active = await repo.activeAssignmentsForSystemEmployee(
      db,
      existing.employeeId,
      existing.systemId,
    );
    for (const a of active) {
      await repo.updateAssignment(db, a.id, {
        status: "revoked",
        revokedBy: actorId,
        revokedAt: new Date().toISOString(),
        revokeReason: input.notes ?? "Revoke request granted",
      });
    }
  } else {
    await repo.createAssignment(db, {
      requestId: existing.id,
      employeeId: existing.employeeId,
      systemId: existing.systemId,
      accessLevel,
      status: "active",
      grantedById: actorId,
      expiresAt: existing.endDate ?? null,
    });
  }

  const row = await repo.updateRequest(db, id, {
    status: "granted",
    grantedBy: actorId,
    grantedAt: new Date().toISOString(),
    itComments: input.notes ?? existing.itComments,
  });
  await repo.writeAudit(db, {
    action: "granted",
    userId: actorId,
    targetUserId: existing.employeeId,
    requestId: id,
    comments: input.notes ?? null,
    newValue: { status: "granted", accessLevel },
  });
  return { data: requestDTO(row) };
}

export async function listAssignments(
  db: Db,
  opts: { employeeId?: string; systemId?: string; status?: string },
) {
  const whereParts = [];
  if (opts.employeeId) {
    whereParts.push(eq(schema.itAccessAssignments.employeeId, opts.employeeId));
  }
  if (opts.systemId) {
    whereParts.push(eq(schema.itAccessAssignments.systemId, opts.systemId));
  }
  if (opts.status) {
    whereParts.push(eq(schema.itAccessAssignments.status, opts.status));
  }
  const rows = await repo.listAssignments(db, whereParts);
  return { data: rows.map(assignmentDTO) };
}

export async function revokeAssignment(
  db: Db,
  id: string,
  input: RevokeAssignmentInput,
  actorId: string,
) {
  const existing = await repo.findAssignment(db, id);
  if (!existing) throw new NotFoundException("Assignment not found");
  if (existing.status !== "active") {
    throw new BadRequestException("Assignment is already revoked");
  }
  const row = await repo.updateAssignment(db, id, {
    status: "revoked",
    revokedBy: actorId,
    revokedAt: new Date().toISOString(),
    revokeReason: input.reason,
  });
  await repo.writeAudit(db, {
    action: "revoked",
    userId: actorId,
    targetUserId: existing.employeeId,
    assignmentId: id,
    comments: input.reason,
    previousValue: { status: "active" },
    newValue: { status: "revoked" },
  });
  return { data: assignmentDTO(row) };
}

export async function offboardEmployee(
  db: Db,
  employeeId: string,
  actorId: string,
  reason: string,
) {
  const active = await repo.activeAssignmentsForEmployee(db, employeeId);
  for (const a of active) {
    await repo.updateAssignment(db, a.id, {
      status: "revoked",
      revokedBy: actorId,
      revokedAt: new Date().toISOString(),
      revokeReason: reason,
    });
    await repo.writeAudit(db, {
      action: "revoked",
      userId: actorId,
      targetUserId: employeeId,
      assignmentId: a.id,
      comments: reason,
      previousValue: { status: "active" },
      newValue: { status: "revoked" },
    });
  }
  return { data: { revokedCount: active.length } };
}

export async function listAudit(
  db: Db,
  opts: { requestId?: string; targetUserId?: string },
) {
  const whereParts = [];
  if (opts.requestId) {
    whereParts.push(eq(schema.itAccessAuditLogs.requestId, opts.requestId));
  }
  if (opts.targetUserId) {
    whereParts.push(eq(schema.itAccessAuditLogs.targetUserId, opts.targetUserId));
  }
  const rows = await repo.listAudit(db, whereParts);
  return {
    data: rows.map((a) => ({
      id: a.id,
      action: a.action,
      user: a.user,
      targetUser: a.targetUser,
      requestId: a.requestId,
      assignmentId: a.assignmentId,
      comments: a.comments,
      previousValue: a.previousValue,
      newValue: a.newValue,
      createdAt: a.createdAt,
    })),
  };
}
