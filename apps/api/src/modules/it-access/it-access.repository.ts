import type { Prisma } from "@manut/database";

import { prisma } from "@/infrastructure/database/prisma";

const userSelect = { id: true, name: true, email: true } as const;

const requestInclude = {
  employee: { select: { ...userSelect, reportingTo: true } },
  system: { select: { id: true, name: true, category: true } },
  grantedBy: { select: userSelect },
  decisions: {
    orderBy: { order: "asc" as const },
    include: {
      approverUser: { select: userSelect },
      decidedBy: { select: userSelect },
    },
  },
} satisfies Prisma.ItAccessRequestInclude;

export type ItAccessRequestWithRelations = Prisma.ItAccessRequestGetPayload<{
  include: typeof requestInclude;
}>;

const assignmentInclude = {
  employee: { select: userSelect },
  system: { select: { id: true, name: true, category: true } },
  grantedBy: { select: userSelect },
  revokedBy: { select: userSelect },
} satisfies Prisma.ItAccessAssignmentInclude;

export type ItAccessAssignmentWithRelations =
  Prisma.ItAccessAssignmentGetPayload<{ include: typeof assignmentInclude }>;

export class ItAccessRepository {
  // ── Systems ──
  listSystems(activeOnly: boolean) {
    return prisma.itSystem.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });
  }
  findSystem(id: string) {
    return prisma.itSystem.findUnique({ where: { id } });
  }
  createSystem(data: Prisma.ItSystemUncheckedCreateInput) {
    return prisma.itSystem.create({ data });
  }
  updateSystem(id: string, data: Prisma.ItSystemUncheckedUpdateInput) {
    return prisma.itSystem.update({ where: { id }, data });
  }
  deleteSystem(id: string) {
    return prisma.itSystem.delete({ where: { id } });
  }
  countSystemUsage(systemId: string) {
    return prisma.itAccessRequest.count({ where: { systemId } });
  }

  // ── Requests ──
  listRequests(args: {
    where: Prisma.ItAccessRequestWhereInput;
    skip: number;
    take: number;
  }) {
    return prisma.itAccessRequest.findMany({
      where: args.where,
      include: requestInclude,
      orderBy: { createdAt: "desc" },
      skip: args.skip,
      take: args.take,
    });
  }
  countRequests(where: Prisma.ItAccessRequestWhereInput) {
    return prisma.itAccessRequest.count({ where });
  }
  findRequest(id: string) {
    return prisma.itAccessRequest.findUnique({
      where: { id },
      include: requestInclude,
    });
  }
  createRequest(data: Prisma.ItAccessRequestUncheckedCreateInput) {
    return prisma.itAccessRequest.create({ data, include: requestInclude });
  }
  updateRequest(id: string, data: Prisma.ItAccessRequestUncheckedUpdateInput) {
    return prisma.itAccessRequest.update({
      where: { id },
      data,
      include: requestInclude,
    });
  }
  deleteRequest(id: string) {
    return prisma.itAccessRequest.delete({ where: { id } });
  }

  // ── Decisions ──
  replaceDecisions(
    requestId: string,
    rows: Array<{
      order: number;
      name: string;
      approverType: string;
      approverUserId: string | null;
    }>,
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.itAccessApprovalDecision.deleteMany({ where: { requestId } });
      if (rows.length > 0) {
        await tx.itAccessApprovalDecision.createMany({
          data: rows.map((r) => ({ requestId, ...r })),
        });
      }
    });
  }
  findDecisions(requestId: string) {
    return prisma.itAccessApprovalDecision.findMany({
      where: { requestId },
      orderBy: { order: "asc" },
    });
  }
  updateDecision(
    id: string,
    data: Prisma.ItAccessApprovalDecisionUncheckedUpdateInput,
  ) {
    return prisma.itAccessApprovalDecision.update({ where: { id }, data });
  }

  // ── Assignments ──
  listAssignments(where: Prisma.ItAccessAssignmentWhereInput) {
    return prisma.itAccessAssignment.findMany({
      where,
      include: assignmentInclude,
      orderBy: { grantedAt: "desc" },
    });
  }
  findAssignment(id: string) {
    return prisma.itAccessAssignment.findUnique({
      where: { id },
      include: assignmentInclude,
    });
  }
  createAssignment(data: Prisma.ItAccessAssignmentUncheckedCreateInput) {
    return prisma.itAccessAssignment.create({
      data,
      include: assignmentInclude,
    });
  }
  updateAssignment(
    id: string,
    data: Prisma.ItAccessAssignmentUncheckedUpdateInput,
  ) {
    return prisma.itAccessAssignment.update({
      where: { id },
      data,
      include: assignmentInclude,
    });
  }
  activeAssignmentsForEmployee(employeeId: string) {
    return prisma.itAccessAssignment.findMany({
      where: { employeeId, status: "active" },
      include: assignmentInclude,
    });
  }
  activeAssignmentsForSystemEmployee(employeeId: string, systemId: string) {
    return prisma.itAccessAssignment.findMany({
      where: { employeeId, systemId, status: "active" },
    });
  }

  // ── IT-specific audit trail ──
  writeAudit(data: Prisma.ItAccessAuditLogUncheckedCreateInput) {
    return prisma.itAccessAuditLog.create({ data });
  }
  listAudit(where: Prisma.ItAccessAuditLogWhereInput) {
    return prisma.itAccessAuditLog.findMany({
      where,
      include: {
        user: { select: userSelect },
        targetUser: { select: userSelect },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  }

  findUserById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, email: true, reportingTo: true },
    });
  }
}

export const itAccessRepository = new ItAccessRepository();
