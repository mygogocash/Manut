import type { Prisma } from "@manut/database";

import { prisma } from "@/infrastructure/database/prisma";
import { excludeDeleted, softDeleteUpdate } from "@/infrastructure/soft-delete";

const requestIncludes = {
  employee: {
    select: {
      id: true,
      name: true,
      email: true,
      department: true,
      reportingTo: true,
    },
  },
  approver: { select: { id: true, name: true, email: true } },
  delegate: { select: { id: true, name: true, email: true } },
  entity: { select: { id: true, name: true } },
  expenses: {
    select: {
      id: true,
      description: true,
      amount: true,
      currency: true,
      status: true,
      date: true,
    },
  },
} satisfies Prisma.TravelRequestInclude;

function generateRequestCode(): string {
  const now = new Date();
  const y = now.getFullYear().toString().slice(-2);
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `TR-${y}${m}-${rand}`;
}

export class TravelRepository {
  async findRequests(
    filters: {
      employeeId?: string;
      entityId?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
    },
    page: number,
    limit: number,
    scopeUserIds?: string[],
  ) {
    const where: Prisma.TravelRequestWhereInput = excludeDeleted("deletedAt");
    if (filters.employeeId) where.employeeId = filters.employeeId;
    else if (scopeUserIds) where.employeeId = { in: scopeUserIds };
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.status) where.status = filters.status;

    if (filters.startDate || filters.endDate) {
      where.departureDate = {};
      if (filters.startDate) {
        where.departureDate.gte = new Date(filters.startDate);
      }
      if (filters.endDate) where.departureDate.lte = new Date(filters.endDate);
    }

    if (filters.search) {
      where.OR = [
        {
          employee: { name: { contains: filters.search, mode: "insensitive" } },
        },
        { origin: { contains: filters.search, mode: "insensitive" } },
        { destination: { contains: filters.search, mode: "insensitive" } },
        { purpose: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.travelRequest.findMany({
        where,
        include: requestIncludes,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.travelRequest.count({ where }),
    ]);

    return { data, total };
  }

  async findRequestById(id: string) {
    return prisma.travelRequest
      .findUnique({
        where: { id },
        include: requestIncludes,
      })
      .then((r) => (r && r.deletedAt ? null : r));
  }

  /** Like findRequestById but returns soft-deleted rows too (restore authz). */
  async findRequestByIdIncludingDeleted(id: string) {
    return prisma.travelRequest.findUnique({
      where: { id },
      include: requestIncludes,
    });
  }

  async createRequest(data: {
    employeeId: string;
    entityId?: string | null;
    origin: string;
    destination: string;
    purpose: string;
    departureDate: Date;
    returnDate: Date;
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
  }) {
    return prisma.travelRequest.create({
      data: {
        ...data,
        requestCode: generateRequestCode(),
        status: "pending",
        submittedAt: new Date(),
      },
      include: requestIncludes,
    });
  }

  async updateRequest(
    id: string,
    data: Prisma.TravelRequestUncheckedUpdateInput,
  ) {
    return prisma.travelRequest.update({
      where: { id },
      data,
      include: requestIncludes,
    });
  }

  async softDeleteRequest(id: string) {
    return prisma.travelRequest.update({
      where: { id },
      data: softDeleteUpdate("deletedAt"),
      include: requestIncludes,
    });
  }

  async restoreRequest(id: string) {
    return prisma.travelRequest.update({
      where: { id },
      data: { deletedAt: null },
      include: requestIncludes,
    });
  }

  async permanentDeleteRequest(id: string) {
    return prisma.travelRequest.delete({ where: { id } });
  }

  async updateRequestStatus(
    id: string,
    data: {
      status: string;
      approvedBy?: string;
      approvedAt?: Date;
      rejectReason?: string;
    },
  ) {
    return prisma.travelRequest.update({
      where: { id },
      data,
      include: requestIncludes,
    });
  }

  async findExpensesForTravel(travelRequestId: string) {
    return prisma.expense.findMany({
      where: { travelRequestId, ...excludeDeleted("deletedAt") },
      select: {
        id: true,
        description: true,
        amount: true,
        currency: true,
        status: true,
        date: true,
      },
      orderBy: { date: "desc" },
    });
  }

  async findAllRequests(filters: {
    employeeId?: string;
    entityId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    search?: string;
  }) {
    const where: Prisma.TravelRequestWhereInput = excludeDeleted("deletedAt");
    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.status) where.status = filters.status;

    if (filters.startDate || filters.endDate) {
      where.departureDate = {};
      if (filters.startDate) {
        where.departureDate.gte = new Date(filters.startDate);
      }
      if (filters.endDate) where.departureDate.lte = new Date(filters.endDate);
    }

    if (filters.search) {
      where.OR = [
        {
          employee: { name: { contains: filters.search, mode: "insensitive" } },
        },
        { origin: { contains: filters.search, mode: "insensitive" } },
        { destination: { contains: filters.search, mode: "insensitive" } },
        { purpose: { contains: filters.search, mode: "insensitive" } },
      ];
    }

    return prisma.travelRequest.findMany({
      where,
      include: requestIncludes,
      orderBy: { createdAt: "desc" },
    });
  }

  async findUserById(userId: string) {
    return prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        entityId: true,
        reportingTo: true,
      },
    });
  }

  // ── Approval chain ──────────────────────────────────────

  async findApprovalSteps(opts?: { activeOnly?: boolean }) {
    return prisma.travelApprovalStep.findMany({
      where: opts?.activeOnly ? { isActive: true } : undefined,
      orderBy: { order: "asc" },
      include: {
        approverUser: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async findApprovalStepById(id: string) {
    return prisma.travelApprovalStep.findUnique({
      where: { id },
      include: {
        approverUser: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async createApprovalStep(data: Prisma.TravelApprovalStepCreateInput) {
    return prisma.travelApprovalStep.create({
      data,
      include: {
        approverUser: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async updateApprovalStep(
    id: string,
    data: Prisma.TravelApprovalStepUpdateInput,
  ) {
    return prisma.travelApprovalStep.update({
      where: { id },
      data,
      include: {
        approverUser: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async deleteApprovalStep(id: string) {
    return prisma.travelApprovalStep.delete({ where: { id } });
  }

  async reorderApprovalSteps(orderedIds: string[]) {
    // Two-phase update so the @unique(order) constraint never sees a clash:
    // 1. Push existing rows to a high range.
    // 2. Renumber to the requested 1..N sequence.
    return prisma.$transaction(async (tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.travelApprovalStep.update({
          where: { id: orderedIds[i]! },
          data: { order: 10000 + i },
        });
      }
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.travelApprovalStep.update({
          where: { id: orderedIds[i]! },
          data: { order: i + 1 },
        });
      }
      return tx.travelApprovalStep.findMany({
        orderBy: { order: "asc" },
        include: {
          approverUser: { select: { id: true, name: true, email: true } },
        },
      });
    });
  }

  async nextStepOrder() {
    const last = await prisma.travelApprovalStep.findFirst({
      orderBy: { order: "desc" },
      select: { order: true },
    });
    return (last?.order ?? 0) + 1;
  }

  // ── Per-request decisions ───────────────────────────────

  async createDecisions(
    travelRequestId: string,
    rows: Array<{
      order: number;
      name: string;
      approverType: string;
      approverUserId?: string | null;
    }>,
  ) {
    return prisma.travelApprovalDecision.createMany({
      data: rows.map((r) => ({
        travelRequestId,
        order: r.order,
        name: r.name,
        approverType: r.approverType,
        approverUserId: r.approverUserId ?? null,
      })),
    });
  }

  async findDecisions(travelRequestId: string) {
    return prisma.travelApprovalDecision.findMany({
      where: { travelRequestId },
      orderBy: { order: "asc" },
      include: {
        approverUser: { select: { id: true, name: true, email: true } },
        decidedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async updateDecision(
    id: string,
    data: Prisma.TravelApprovalDecisionUpdateInput,
  ) {
    return prisma.travelApprovalDecision.update({
      where: { id },
      data,
      include: {
        approverUser: { select: { id: true, name: true, email: true } },
        decidedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  /**
   * Reassign any still-pending decisions whose snapshotted step name
   * matches `stepName` to the given approver. Used when an admin
   * changes a chain step's approver — pending in-flight requests
   * should follow the new approver, but resolved rows stay frozen.
   * Returns the number of rows updated.
   */
  async reassignPendingDecisionsByStepName(
    stepName: string,
    approverUserId: string | null,
  ) {
    const res = await prisma.travelApprovalDecision.updateMany({
      where: { name: stepName, status: "pending" },
      data: { approverUserId },
    });
    return res.count;
  }
}

export const travelRepository = new TravelRepository();
