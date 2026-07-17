import type { Request } from "express";

import { PERMISSIONS } from "@/common/constants/permissions";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { logAudit } from "@/infrastructure/audit/audit.service";
import { sendEmail } from "@/infrastructure/email/email.service";
import {
  itAccessDecisionEmail,
  itAccessRequestEmail,
} from "@/infrastructure/email/templates";
import { PORTAL_URL } from "@/lib/portal-url";
import {
  type ItAccessAssignmentWithRelations,
  itAccessRepository,
  type ItAccessRequestWithRelations,
} from "@/modules/it-access/it-access.repository";
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
} from "@/modules/it-access/it-access.validation";

const RESOURCE = "it-access";
const PORTAL = `${PORTAL_URL}/it-operations/access`;

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

function parseDate(v: string | null | undefined): Date | null | undefined {
  if (v === undefined) return undefined;
  if (v === null || v === "") return null;
  return new Date(`${v}T00:00:00.000Z`);
}

function requestDTO(r: ItAccessRequestWithRelations) {
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
    startDate: r.startDate?.toISOString() ?? null,
    endDate: r.endDate?.toISOString() ?? null,
    status: r.status,
    currentStepOrder: r.currentStepOrder ?? null,
    managerComments: r.managerComments,
    itComments: r.itComments,
    rejectReason: r.rejectReason,
    submittedAt: r.submittedAt?.toISOString() ?? null,
    grantedBy: r.grantedBy,
    grantedAt: r.grantedAt?.toISOString() ?? null,
    approvalChain: r.decisions.map((d) => ({
      order: d.order,
      name: d.name,
      approverType: d.approverType,
      approverUser: d.approverUser,
      status: d.status,
      decidedBy: d.decidedBy,
      decidedAt: d.decidedAt?.toISOString() ?? null,
      notes: d.notes,
    })),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function assignmentDTO(a: ItAccessAssignmentWithRelations) {
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
    grantedAt: a.grantedAt.toISOString(),
    expiresAt: a.expiresAt?.toISOString() ?? null,
    revokedBy: a.revokedBy,
    revokedAt: a.revokedAt?.toISOString() ?? null,
    revokeReason: a.revokeReason,
  };
}

export class ItAccessService {
  // ── Systems ──
  async listSystems(activeOnly: boolean) {
    const rows = await itAccessRepository.listSystems(activeOnly);
    return { data: rows };
  }

  async createSystem(
    input: CreateSystemInput,
    _actorId: string,
    req?: Request,
  ) {
    const row = await itAccessRepository.createSystem({
      name: input.name,
      description: input.description ?? null,
      category: input.category ?? null,
      isActive: input.isActive,
      sortOrder: input.sortOrder,
    });
    void logAudit({
      action: "create",
      resource: `${RESOURCE}-system`,
      resourceId: row.id,
      details: { name: input.name },
      req,
    });
    return { data: row };
  }

  async updateSystem(
    id: string,
    input: UpdateSystemInput,
    _actorId: string,
    req?: Request,
  ) {
    const existing = await itAccessRepository.findSystem(id);
    if (!existing) throw new NotFoundException("System not found");
    const row = await itAccessRepository.updateSystem(id, {
      ...("name" in input ? { name: input.name } : {}),
      ...("description" in input
        ? { description: input.description ?? null }
        : {}),
      ...("category" in input ? { category: input.category ?? null } : {}),
      ...("isActive" in input ? { isActive: input.isActive } : {}),
      ...("sortOrder" in input ? { sortOrder: input.sortOrder } : {}),
    });
    void logAudit({
      action: "update",
      resource: `${RESOURCE}-system`,
      resourceId: id,
      details: { ...input },
      req,
    });
    return { data: row };
  }

  async deleteSystem(id: string, _actorId: string, req?: Request) {
    const existing = await itAccessRepository.findSystem(id);
    if (!existing) throw new NotFoundException("System not found");
    const usage = await itAccessRepository.countSystemUsage(id);
    if (usage > 0) {
      // Don't orphan request history - deactivate instead of delete.
      throw new ConflictException(
        "System has request history; deactivate it instead of deleting",
      );
    }
    await itAccessRepository.deleteSystem(id);
    void logAudit({
      action: "delete",
      resource: `${RESOURCE}-system`,
      resourceId: id,
      details: { name: existing.name },
      req,
    });
    return { data: { id } };
  }

  // ── Requests ──
  async listRequests(actorId: string, perms: string[], query: RequestQuery) {
    const where: Parameters<typeof itAccessRepository.countRequests>[0] = {};
    const wantsAll = query.scope === "all" && canViewAll(perms);
    if (!wantsAll) {
      where.employeeId = actorId;
    } else if (query.employeeId) {
      where.employeeId = query.employeeId;
    }
    if (query.status) where.status = query.status;
    if (query.systemId) where.systemId = query.systemId;

    const [rows, total] = await Promise.all([
      itAccessRepository.listRequests({
        where,
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      itAccessRepository.countRequests(where),
    ]);
    return {
      data: rows.map(requestDTO),
      meta: { page: query.page, limit: query.limit, total },
    };
  }

  private async loadOwned(id: string, actorId: string, perms: string[]) {
    const row = await itAccessRepository.findRequest(id);
    if (!row) throw new NotFoundException("Access request not found");
    if (row.employeeId !== actorId && !canViewAll(perms)) {
      throw new ForbiddenException("No access to this request");
    }
    return row;
  }

  async getRequest(id: string, actorId: string, perms: string[]) {
    return { data: requestDTO(await this.loadOwned(id, actorId, perms)) };
  }

  async createRequest(
    input: CreateRequestInput,
    actorId: string,
    perms: string[],
    req?: Request,
  ) {
    // On-behalf submission needs view-all (HR/IT); otherwise force self.
    const employeeId =
      input.employeeId && canViewAll(perms) ? input.employeeId : actorId;
    const system = await itAccessRepository.findSystem(input.systemId);
    if (!system || !system.isActive) {
      throw new BadRequestException("Unknown or inactive system");
    }
    const row = await itAccessRepository.createRequest({
      employeeId,
      systemId: input.systemId,
      requestType: input.requestType,
      requestedAccessLevel: input.requestedAccessLevel,
      businessJustification: input.businessJustification,
      startDate: parseDate(input.startDate) ?? null,
      endDate: parseDate(input.endDate) ?? null,
      status: "draft",
    });
    void logAudit({
      action: "create",
      resource: `${RESOURCE}-request`,
      resourceId: row.id,
      details: { systemId: input.systemId, requestType: input.requestType },
      req,
    });
    return { data: requestDTO(row) };
  }

  async updateRequest(
    id: string,
    input: UpdateRequestInput,
    actorId: string,
    perms: string[],
    req?: Request,
  ) {
    const existing = await this.loadOwned(id, actorId, perms);
    if (existing.status !== "draft") {
      throw new BadRequestException("Only draft requests can be edited");
    }
    const row = await itAccessRepository.updateRequest(id, {
      ...("systemId" in input ? { systemId: input.systemId } : {}),
      ...("requestType" in input ? { requestType: input.requestType } : {}),
      ...("requestedAccessLevel" in input
        ? { requestedAccessLevel: input.requestedAccessLevel }
        : {}),
      ...("businessJustification" in input
        ? { businessJustification: input.businessJustification }
        : {}),
      ...("startDate" in input
        ? { startDate: parseDate(input.startDate) }
        : {}),
      ...("endDate" in input ? { endDate: parseDate(input.endDate) } : {}),
    });
    void logAudit({
      action: "update",
      resource: `${RESOURCE}-request`,
      resourceId: id,
      details: { ...input },
      req,
    });
    return { data: requestDTO(row) };
  }

  async deleteRequest(
    id: string,
    actorId: string,
    perms: string[],
    req?: Request,
  ) {
    const existing = await this.loadOwned(id, actorId, perms);
    if (existing.status !== "draft" && !canManage(perms)) {
      throw new BadRequestException("Only draft requests can be deleted");
    }
    await itAccessRepository.deleteRequest(id);
    void logAudit({
      action: "delete",
      resource: `${RESOURCE}-request`,
      resourceId: id,
      req,
    });
    return { data: { id } };
  }

  /** Build the fixed Manager -> IT chain, skipping manager if none exists. */
  private async buildChain(employeeId: string) {
    const emp = await itAccessRepository.findUserById(employeeId);
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

  async submitRequest(
    id: string,
    actorId: string,
    perms: string[],
    req?: Request,
  ) {
    const existing = await this.loadOwned(id, actorId, perms);
    if (existing.employeeId !== actorId && !canViewAll(perms)) {
      throw new ForbiddenException("You can only submit your own request");
    }
    if (existing.status !== "draft") {
      throw new BadRequestException(
        `Cannot submit a request with status "${existing.status}"`,
      );
    }
    const chain = await this.buildChain(existing.employeeId);
    await itAccessRepository.replaceDecisions(id, chain);
    const firstOrder = chain[0]!.order;
    const status =
      chain[0]!.approverType === "manager" ? "pending-manager" : "pending-it";
    const row = await itAccessRepository.updateRequest(id, {
      status,
      currentStepOrder: firstOrder,
      submittedAt: new Date(),
    });
    await itAccessRepository.writeAudit({
      action: "request-submitted",
      userId: actorId,
      targetUserId: existing.employeeId,
      requestId: id,
      newValue: { status },
    });
    void logAudit({
      action: "submit",
      resource: `${RESOURCE}-request`,
      resourceId: id,
      req,
    });
    await this.notifyCurrentApprover(row);
    return { data: requestDTO(row) };
  }

  private async notifyCurrentApprover(row: ItAccessRequestWithRelations) {
    const order = row.currentStepOrder;
    if (!order) return;
    const decisions = await itAccessRepository.findDecisions(row.id);
    const step = decisions.find((d) => d.order === order);
    if (!step) return;
    // Manager step -> email the named approver. IT step -> email is best-effort
    // skipped here (IT works the queue); a desk fan-out could be added later.
    if (step.approverType === "manager" && step.approverUserId) {
      const approver = await itAccessRepository.findUserById(
        step.approverUserId,
      );
      if (approver?.email) {
        const mail = itAccessRequestEmail({
          approverName: approver.name,
          requesterName: row.employee.name,
          systemName: row.system.name,
          requestType: row.requestType,
          accessLevel: row.requestedAccessLevel,
          justification: row.businessJustification,
          stepName: step.name,
          portalUrl: PORTAL,
        });
        void sendEmail({ to: approver.email, ...mail });
      }
    }
  }

  private assertCanActOnStep(
    step: { approverType: string; approverUserId: string | null },
    request: ItAccessRequestWithRelations,
    actorId: string,
    perms: string[],
  ) {
    if (step.approverType === "it") {
      if (!canApproveIt(perms)) {
        throw new ForbiddenException("Only IT can act on this step");
      }
      return;
    }
    // Manager step: the assigned manager, or an IT/manage holder override.
    if (canManage(perms)) return;
    if (step.approverUserId !== actorId) {
      throw new ForbiddenException(
        "Only the requester's manager can approve this step",
      );
    }
  }

  async approveRequest(
    id: string,
    input: DecisionInput,
    actorId: string,
    perms: string[],
    req?: Request,
  ) {
    const existing = await itAccessRepository.findRequest(id);
    if (!existing) throw new NotFoundException("Access request not found");
    if (!["pending-manager", "pending-it"].includes(existing.status)) {
      throw new BadRequestException(
        `Request is not awaiting approval (status "${existing.status}")`,
      );
    }
    const decisions = await itAccessRepository.findDecisions(id);
    const order = existing.currentStepOrder ?? 1;
    const decision = decisions.find((d) => d.order === order);
    if (!decision) throw new BadRequestException("No pending approval step");
    this.assertCanActOnStep(decision, existing, actorId, perms);

    await itAccessRepository.updateDecision(decision.id, {
      status: "approved",
      decidedById: actorId,
      decidedAt: new Date(),
      notes: input.notes ?? null,
    });

    const isManagerStep = decision.approverType === "manager";
    const next = decisions.find(
      (d) => d.order > decision.order && d.status === "pending",
    );

    let row: ItAccessRequestWithRelations;
    if (next) {
      row = await itAccessRepository.updateRequest(id, {
        status:
          next.approverType === "manager" ? "pending-manager" : "pending-it",
        currentStepOrder: next.order,
        ...(isManagerStep ? { managerComments: input.notes ?? null } : {}),
      });
      await this.notifyCurrentApprover(row);
    } else {
      // Final approval - chain complete.
      row = await itAccessRepository.updateRequest(id, {
        status: "approved",
        currentStepOrder: null,
        ...(isManagerStep
          ? { managerComments: input.notes ?? null }
          : { itComments: input.notes ?? null }),
      });
      if (row.employee.email) {
        const mail = itAccessDecisionEmail({
          requesterName: row.employee.name,
          systemName: row.system.name,
          decision: "approved",
          byName: "IT",
          note: input.notes,
          portalUrl: PORTAL,
        });
        void sendEmail({ to: row.employee.email, ...mail });
      }
    }

    await itAccessRepository.writeAudit({
      action: isManagerStep ? "manager-approved" : "it-approved",
      userId: actorId,
      targetUserId: existing.employeeId,
      requestId: id,
      comments: input.notes ?? null,
      newValue: { status: row.status },
    });
    void logAudit({
      action: "approve",
      resource: `${RESOURCE}-request`,
      resourceId: id,
      details: { step: decision.name },
      req,
    });
    return { data: requestDTO(row) };
  }

  async rejectRequest(
    id: string,
    input: RejectInput,
    actorId: string,
    perms: string[],
    req?: Request,
  ) {
    const existing = await itAccessRepository.findRequest(id);
    if (!existing) throw new NotFoundException("Access request not found");
    if (!["pending-manager", "pending-it"].includes(existing.status)) {
      throw new BadRequestException("Request is not awaiting approval");
    }
    const decisions = await itAccessRepository.findDecisions(id);
    const order = existing.currentStepOrder ?? 1;
    const decision = decisions.find((d) => d.order === order);
    if (!decision) throw new BadRequestException("No pending approval step");
    this.assertCanActOnStep(decision, existing, actorId, perms);

    await itAccessRepository.updateDecision(decision.id, {
      status: "rejected",
      decidedById: actorId,
      decidedAt: new Date(),
      notes: input.reason,
    });
    const row = await itAccessRepository.updateRequest(id, {
      status: "rejected",
      currentStepOrder: null,
      rejectReason: input.reason,
    });
    await itAccessRepository.writeAudit({
      action: "rejected",
      userId: actorId,
      targetUserId: existing.employeeId,
      requestId: id,
      comments: input.reason,
      newValue: { status: "rejected" },
    });
    void logAudit({
      action: "reject",
      resource: `${RESOURCE}-request`,
      resourceId: id,
      req,
    });
    if (row.employee.email) {
      const mail = itAccessDecisionEmail({
        requesterName: row.employee.name,
        systemName: row.system.name,
        decision: "rejected",
        byName: decision.name,
        note: input.reason,
        portalUrl: PORTAL,
      });
      void sendEmail({ to: row.employee.email, ...mail });
    }
    return { data: requestDTO(row) };
  }

  /**
   * Final provisioning step (it:access:manage). For revoke-type requests we
   * revoke matching active assignments; otherwise we create/refresh one.
   */
  async grantRequest(
    id: string,
    input: GrantInput,
    actorId: string,
    req?: Request,
  ) {
    const existing = await itAccessRepository.findRequest(id);
    if (!existing) throw new NotFoundException("Access request not found");
    if (existing.status !== "approved") {
      throw new BadRequestException(
        "Only fully-approved requests can be granted",
      );
    }
    const accessLevel = input.accessLevel ?? existing.requestedAccessLevel;

    if (existing.requestType === "revoke") {
      const active =
        await itAccessRepository.activeAssignmentsForSystemEmployee(
          existing.employeeId,
          existing.systemId,
        );
      for (const a of active) {
        await itAccessRepository.updateAssignment(a.id, {
          status: "revoked",
          revokedById: actorId,
          revokedAt: new Date(),
          revokeReason: input.notes ?? "Revoke request granted",
        });
      }
    } else {
      await itAccessRepository.createAssignment({
        requestId: existing.id,
        employeeId: existing.employeeId,
        systemId: existing.systemId,
        accessLevel,
        status: "active",
        grantedById: actorId,
        expiresAt: existing.endDate ?? null,
      });
    }

    const row = await itAccessRepository.updateRequest(id, {
      status: "granted",
      grantedById: actorId,
      grantedAt: new Date(),
      itComments: input.notes ?? existing.itComments,
    });
    await itAccessRepository.writeAudit({
      action: "granted",
      userId: actorId,
      targetUserId: existing.employeeId,
      requestId: id,
      comments: input.notes ?? null,
      newValue: { status: "granted", accessLevel },
    });
    void logAudit({
      action: "grant",
      resource: `${RESOURCE}-request`,
      resourceId: id,
      details: { employeeId: existing.employeeId, systemId: existing.systemId },
      req,
    });
    if (row.employee.email) {
      const mail = itAccessDecisionEmail({
        requesterName: row.employee.name,
        systemName: row.system.name,
        decision: "granted",
        byName: row.grantedBy?.name ?? "IT",
        note: input.notes,
        portalUrl: PORTAL,
      });
      void sendEmail({ to: row.employee.email, ...mail });
    }
    return { data: requestDTO(row) };
  }

  // ── Assignments ──
  async listAssignments(opts: {
    employeeId?: string;
    systemId?: string;
    status?: string;
  }) {
    const where: Parameters<typeof itAccessRepository.listAssignments>[0] = {};
    if (opts.employeeId) where.employeeId = opts.employeeId;
    if (opts.systemId) where.systemId = opts.systemId;
    if (opts.status) where.status = opts.status;
    const rows = await itAccessRepository.listAssignments(where);
    return { data: rows.map(assignmentDTO) };
  }

  async revokeAssignment(
    id: string,
    input: RevokeAssignmentInput,
    actorId: string,
    req?: Request,
  ) {
    const existing = await itAccessRepository.findAssignment(id);
    if (!existing) throw new NotFoundException("Assignment not found");
    if (existing.status !== "active") {
      throw new BadRequestException("Assignment is already revoked");
    }
    const row = await itAccessRepository.updateAssignment(id, {
      status: "revoked",
      revokedById: actorId,
      revokedAt: new Date(),
      revokeReason: input.reason,
    });
    await itAccessRepository.writeAudit({
      action: "revoked",
      userId: actorId,
      targetUserId: existing.employeeId,
      assignmentId: id,
      comments: input.reason,
      previousValue: { status: "active" },
      newValue: { status: "revoked" },
    });
    void logAudit({
      action: "revoke",
      resource: `${RESOURCE}-assignment`,
      resourceId: id,
      details: { employeeId: existing.employeeId, systemId: existing.systemId },
      req,
    });
    if (existing.employee.email) {
      const mail = itAccessDecisionEmail({
        requesterName: existing.employee.name,
        systemName: existing.system.name,
        decision: "revoked",
        byName: row.revokedBy?.name ?? "IT",
        note: input.reason,
        portalUrl: PORTAL,
      });
      void sendEmail({ to: existing.employee.email, ...mail });
    }
    return { data: assignmentDTO(row) };
  }

  /** Offboarding: revoke every active assignment for an employee. */
  async offboardEmployee(
    employeeId: string,
    actorId: string,
    reason: string,
    req?: Request,
  ) {
    const active =
      await itAccessRepository.activeAssignmentsForEmployee(employeeId);
    for (const a of active) {
      await itAccessRepository.updateAssignment(a.id, {
        status: "revoked",
        revokedById: actorId,
        revokedAt: new Date(),
        revokeReason: reason,
      });
      await itAccessRepository.writeAudit({
        action: "revoked",
        userId: actorId,
        targetUserId: employeeId,
        assignmentId: a.id,
        comments: reason,
        previousValue: { status: "active" },
        newValue: { status: "revoked" },
      });
    }
    void logAudit({
      action: "offboard",
      resource: `${RESOURCE}-assignment`,
      resourceId: employeeId,
      details: { revokedCount: active.length, reason },
      req,
    });
    return { data: { revokedCount: active.length } };
  }

  // ── IT-specific audit trail (UI) ──
  async listAudit(opts: { requestId?: string; targetUserId?: string }) {
    const where: Parameters<typeof itAccessRepository.listAudit>[0] = {};
    if (opts.requestId) where.requestId = opts.requestId;
    if (opts.targetUserId) where.targetUserId = opts.targetUserId;
    const rows = await itAccessRepository.listAudit(where);
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
        createdAt: a.createdAt.toISOString(),
      })),
    };
  }
}

export const itAccessService = new ItAccessService();
