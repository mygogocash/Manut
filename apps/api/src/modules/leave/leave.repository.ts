import type { Prisma } from "@manut/database";

import { ConflictException } from "@/common/exceptions/http-exception";
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
  leaveType: {
    select: {
      id: true,
      name: true,
      code: true,
      category: true,
      daysPerYear: true,
      requiresApproval: true,
    },
  },
  approver: { select: { id: true, name: true, email: true } },
  delegate: { select: { id: true, name: true, email: true } },
  entity: { select: { id: true, name: true } },
} satisfies Prisma.LeaveRequestInclude;

const typeInclude = {
  entity: { select: { id: true, name: true, code: true } },
} satisfies Prisma.LeaveTypeInclude;

export class LeaveRepository {
  private async materializeBalance(
    tx: Prisma.TransactionClient,
    data: {
      employeeId: string;
      leaveTypeId: string;
      year: number;
      defaultEntitlement: number;
    },
  ) {
    return tx.leaveBalance.upsert({
      where: {
        employeeId_leaveTypeId_year: {
          employeeId: data.employeeId,
          leaveTypeId: data.leaveTypeId,
          year: data.year,
        },
      },
      create: {
        employeeId: data.employeeId,
        leaveTypeId: data.leaveTypeId,
        year: data.year,
        entitled: data.defaultEntitlement,
        used: 0,
        carriedUsed: 0,
      },
      update: {},
    });
  }

  /**
   * Consumes a balance bucket with the capacity predicate on the same row
   * update. Competing approvals therefore serialize on the balance row and
   * cannot both spend the same remaining entitlement.
   */
  private async consumeBalance(
    tx: Prisma.TransactionClient,
    data: {
      employeeId: string;
      leaveTypeId: string;
      year: number;
      days: number;
      source: "entitled" | "carried";
      defaultEntitlement: number;
    },
  ) {
    const balance = await this.materializeBalance(tx, data);
    const isCarried = data.source === "carried";
    const maximumUsed = isCarried
      ? Number(balance.carried) - data.days
      : Number(balance.entitled) + Number(balance.adjustment) - data.days;
    const consumed = await tx.leaveBalance.updateMany({
      where: isCarried
        ? { id: balance.id, carriedUsed: { lte: maximumUsed } }
        : { id: balance.id, used: { lte: maximumUsed } },
      data: isCarried
        ? { carriedUsed: { increment: data.days } }
        : { used: { increment: data.days } },
    });
    if (consumed.count !== 1) {
      throw new ConflictException(
        "Leave balance changed and no longer has enough available days; refresh and try again",
      );
    }
  }

  /**
   * Active policies visible to a given entity. Passing null returns
   * only global policies (entity-agnostic). The Apply-for-leave UI and
   * balance synthesis use this so an employee only sees policies that
   * apply to them.
   */
  async findTypes(entityId?: string | null) {
    const where: Prisma.LeaveTypeWhereInput = { isActive: true };
    if (entityId === null) {
      where.entityId = null;
    } else if (entityId) {
      where.OR = [{ entityId }, { entityId: null }];
    }
    return prisma.leaveType.findMany({
      where,
      orderBy: [{ entityId: "asc" }, { name: "asc" }],
      include: typeInclude,
    });
  }

  async findAllTypes(filters?: { entityId?: string | "global" | null }) {
    const where: Prisma.LeaveTypeWhereInput = {};
    if (filters?.entityId === "global") where.entityId = null;
    else if (typeof filters?.entityId === "string") {
      where.entityId = filters.entityId;
    }
    return prisma.leaveType.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { entityId: "asc" }, { name: "asc" }],
      include: typeInclude,
    });
  }

  async findTypeById(id: string) {
    return prisma.leaveType.findUnique({
      where: { id },
      include: typeInclude,
    });
  }

  async findTypeByNameInEntity(name: string, entityId: string | null) {
    return prisma.leaveType.findFirst({
      where: { entityId, name },
    });
  }

  async findTypeByCodeInEntity(code: string, entityId: string | null) {
    return prisma.leaveType.findFirst({
      where: { entityId, code },
    });
  }

  async findUserEntityId(userId: string): Promise<string | null> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { entityId: true },
    });
    return user?.entityId ?? null;
  }

  async createType(data: Prisma.LeaveTypeCreateInput) {
    return prisma.leaveType.create({ data, include: typeInclude });
  }

  async updateType(id: string, data: Prisma.LeaveTypeUpdateInput) {
    return prisma.leaveType.update({
      where: { id },
      data,
      include: typeInclude,
    });
  }

  async deleteType(id: string) {
    return prisma.leaveType.delete({ where: { id } });
  }

  /** Counts to decide whether a hard delete is safe. */
  async countTypeReferences(id: string) {
    const [balances, requests, transactions] = await Promise.all([
      prisma.leaveBalance.count({ where: { leaveTypeId: id } }),
      prisma.leaveRequest.count({
        where: { leaveTypeId: id, ...excludeDeleted("deletedAt") },
      }),
      prisma.balanceTransaction.count({ where: { leaveTypeId: id } }),
    ]);
    return { balances, requests, transactions };
  }

  async findApprovers(leaveTypeId: string) {
    return prisma.leavePolicyApprover.findMany({
      where: { leaveTypeId },
      orderBy: { order: "asc" },
      include: {
        approverUser: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async replaceApprovers(
    leaveTypeId: string,
    rows: Array<{
      order: number;
      approverType: string;
      approverUserId?: string | null;
    }>,
  ) {
    return prisma.$transaction(async (tx) => {
      await tx.leavePolicyApprover.deleteMany({ where: { leaveTypeId } });
      if (rows.length === 0) return [];
      await tx.leavePolicyApprover.createMany({
        data: rows.map((r) => ({
          leaveTypeId,
          order: r.order,
          approverType: r.approverType,
          approverUserId: r.approverUserId ?? null,
        })),
      });
      return tx.leavePolicyApprover.findMany({
        where: { leaveTypeId },
        orderBy: { order: "asc" },
        include: {
          approverUser: { select: { id: true, name: true, email: true } },
        },
      });
    });
  }

  async findBalances(employeeId: string, year: number) {
    return prisma.leaveBalance.findMany({
      where: { employeeId, year },
      include: {
        leaveType: {
          select: {
            id: true,
            name: true,
            code: true,
            category: true,
            entityId: true,
          },
        },
      },
      orderBy: { leaveType: { name: "asc" } },
    });
  }

  async findRequests(
    filters: {
      employeeId?: string;
      entityId?: string;
      status?: string;
      leaveTypeId?: string;
      startDate?: string;
      endDate?: string;
      search?: string;
      /** When set, rows are limited to this user’s own requests or their direct reports. */
      managerScopeUserId?: string;
    },
    page: number,
    limit: number,
  ) {
    const and: Prisma.LeaveRequestWhereInput[] = [excludeDeleted("deletedAt")];

    if (filters.managerScopeUserId) {
      and.push({
        OR: [
          { employeeId: filters.managerScopeUserId },
          { employee: { reportingTo: filters.managerScopeUserId } },
        ],
      });
    }

    if (filters.employeeId) and.push({ employeeId: filters.employeeId });
    if (filters.entityId) and.push({ entityId: filters.entityId });
    if (filters.status) and.push({ status: filters.status });
    if (filters.leaveTypeId) and.push({ leaveTypeId: filters.leaveTypeId });

    if (filters.startDate || filters.endDate) {
      const startDate: Prisma.DateTimeFilter = {};
      if (filters.startDate) startDate.gte = new Date(filters.startDate);
      if (filters.endDate) startDate.lte = new Date(filters.endDate);
      and.push({ startDate });
    }

    if (filters.search) {
      and.push({
        OR: [
          {
            employee: {
              name: { contains: filters.search, mode: "insensitive" },
            },
          },
          {
            leaveType: {
              name: { contains: filters.search, mode: "insensitive" },
            },
          },
        ],
      });
    }

    const where: Prisma.LeaveRequestWhereInput =
      and.length > 0 ? { AND: and } : {};

    const [data, total] = await Promise.all([
      prisma.leaveRequest.findMany({
        where,
        include: requestIncludes,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.leaveRequest.count({ where }),
    ]);

    return { data, total };
  }

  async findRequestById(id: string) {
    return prisma.leaveRequest
      .findUnique({
        where: { id },
        include: requestIncludes,
      })
      .then((r) => (r && r.deletedAt ? null : r));
  }

  /** Like findRequestById but returns soft-deleted rows too (restore authz). */
  async findRequestByIdIncludingDeleted(id: string) {
    return prisma.leaveRequest.findUnique({
      where: { id },
      include: requestIncludes,
    });
  }

  async createRequest(data: {
    employeeId: string;
    leaveTypeId: string;
    entityId?: string | null;
    startDate: Date;
    endDate: Date;
    days: number;
    durationType?: "full_day" | "half_day";
    halfDayPeriod?: "am" | "pm" | null;
    reason?: string;
    source?: "entitled" | "carried";
    defaultEntitlement: number;
    requiresApproval: boolean;
    approvalDescription: string;
  }) {
    const source = data.source ?? "entitled";
    const autoApproved = !data.requiresApproval;

    return prisma.$transaction(async (tx) => {
      const balanceData = {
        employeeId: data.employeeId,
        leaveTypeId: data.leaveTypeId,
        year: data.startDate.getFullYear(),
        defaultEntitlement: data.defaultEntitlement,
      };
      if (autoApproved) {
        await this.consumeBalance(tx, {
          ...balanceData,
          days: data.days,
          source,
        });
      } else {
        await this.materializeBalance(tx, balanceData);
      }

      const request = await tx.leaveRequest.create({
        data: {
          employeeId: data.employeeId,
          leaveTypeId: data.leaveTypeId,
          entityId: data.entityId ?? null,
          startDate: data.startDate,
          endDate: data.endDate,
          days: data.days,
          durationType: data.durationType ?? "full_day",
          halfDayPeriod: data.halfDayPeriod ?? null,
          reason: data.reason,
          source,
          status: autoApproved ? "approved" : "pending",
          approvedAt: autoApproved ? new Date() : null,
        },
        include: requestIncludes,
      });

      if (autoApproved) {
        await tx.balanceTransaction.create({
          data: {
            employeeId: data.employeeId,
            leaveTypeId: data.leaveTypeId,
            year: data.startDate.getFullYear(),
            type: source === "carried" ? "used_carried" : "used",
            amount: data.days,
            description: data.approvalDescription,
            referenceId: request.id,
          },
        });
      }

      return request;
    });
  }

  /**
   * Atomically advances one approval step. On the final step, the request
   * status, materialized balance, and audit transaction commit together.
   * A null result means another actor already changed the expected request
   * state, so callers must fail closed instead of replaying the mutation.
   */
  async approveRequestStep(data: {
    requestId: string;
    approverId: string;
    currentDecisionId: string | null;
    expectedStepOrder: number | null;
    nextStepOrder: number | null;
    employeeId: string;
    leaveTypeId: string;
    year: number;
    days: number;
    source: "entitled" | "carried";
    defaultEntitlement: number;
    description: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const transition = await tx.leaveRequest.updateMany({
        where: {
          id: data.requestId,
          status: "pending",
          currentStepOrder: data.expectedStepOrder,
        },
        data:
          data.nextStepOrder === null
            ? {
                status: "approved",
                approvedBy: data.approverId,
                approvedAt: new Date(),
                currentStepOrder: null,
              }
            : { currentStepOrder: data.nextStepOrder },
      });
      if (transition.count !== 1) return null;

      if (data.currentDecisionId) {
        await tx.leaveApprovalDecision.update({
          where: { id: data.currentDecisionId },
          data: {
            status: "approved",
            decidedById: data.approverId,
            decidedAt: new Date(),
          },
        });
      }

      if (data.nextStepOrder === null) {
        await this.consumeBalance(tx, {
          employeeId: data.employeeId,
          leaveTypeId: data.leaveTypeId,
          year: data.year,
          days: data.days,
          source: data.source,
          defaultEntitlement: data.defaultEntitlement,
        });
        await tx.balanceTransaction.create({
          data: {
            employeeId: data.employeeId,
            leaveTypeId: data.leaveTypeId,
            year: data.year,
            type: data.source === "carried" ? "used_carried" : "used",
            amount: data.days,
            description: data.description,
            referenceId: data.requestId,
          },
        });
      }

      return tx.leaveRequest.findUniqueOrThrow({
        where: { id: data.requestId },
        include: requestIncludes,
      });
    });
  }

  /**
   * Cancels the expected request state and, when required, reverses the
   * approved balance plus ledger entry in the same transaction. The status
   * predicate is the idempotency guard for concurrent retries.
   */
  async cancelRequestAtomically(data: {
    requestId: string;
    expectedStatus: "pending" | "approved" | "pending_cancellation";
    approvedBy?: string;
    refund: {
      employeeId: string;
      leaveTypeId: string;
      year: number;
      days: number;
      source: "entitled" | "carried";
      defaultEntitlement: number;
      description: string;
    } | null;
  }) {
    return prisma.$transaction(async (tx) => {
      const transition = await tx.leaveRequest.updateMany({
        where: { id: data.requestId, status: data.expectedStatus },
        data: {
          status: "cancelled",
          ...(data.approvedBy
            ? { approvedBy: data.approvedBy, approvedAt: new Date() }
            : {}),
        },
      });
      if (transition.count !== 1) return null;

      if (data.refund) {
        const refund = data.refund;
        const balance = await tx.leaveBalance.upsert({
          where: {
            employeeId_leaveTypeId_year: {
              employeeId: refund.employeeId,
              leaveTypeId: refund.leaveTypeId,
              year: refund.year,
            },
          },
          create: {
            employeeId: refund.employeeId,
            leaveTypeId: refund.leaveTypeId,
            year: refund.year,
            entitled: refund.defaultEntitlement,
            used: refund.source === "entitled" ? refund.days : 0,
            carried: refund.source === "carried" ? refund.days : 0,
            carriedUsed: refund.source === "carried" ? refund.days : 0,
          },
          update: {},
        });
        const refunded = await tx.leaveBalance.updateMany({
          where:
            refund.source === "carried"
              ? { id: balance.id, carriedUsed: { gte: refund.days } }
              : { id: balance.id, used: { gte: refund.days } },
          data:
            refund.source === "carried"
              ? { carriedUsed: { decrement: refund.days } }
              : { used: { decrement: refund.days } },
        });
        if (refunded.count !== 1) {
          throw new ConflictException(
            "Leave balance is inconsistent with this approved request; repair the balance before cancelling",
          );
        }
        await tx.balanceTransaction.create({
          data: {
            employeeId: refund.employeeId,
            leaveTypeId: refund.leaveTypeId,
            year: refund.year,
            type:
              refund.source === "carried"
                ? "cancellation_refund_carried"
                : "cancellation_refund",
            amount: -refund.days,
            description: refund.description,
            referenceId: data.requestId,
          },
        });
      }

      return tx.leaveRequest.findUniqueOrThrow({
        where: { id: data.requestId },
        include: requestIncludes,
      });
    });
  }

  /** A late rejection cannot overwrite an approval that already committed. */
  async rejectRequestStepAtomically(data: {
    requestId: string;
    approverId: string;
    currentDecisionId: string | null;
    expectedStepOrder: number | null;
    reason: string;
  }) {
    return prisma.$transaction(async (tx) => {
      const transition = await tx.leaveRequest.updateMany({
        where: {
          id: data.requestId,
          status: "pending",
          currentStepOrder: data.expectedStepOrder,
        },
        data: {
          status: "rejected",
          approvedBy: data.approverId,
          approvedAt: new Date(),
          rejectReason: data.reason,
          currentStepOrder: null,
          delegatedToId: null,
        },
      });
      if (transition.count !== 1) return null;

      if (data.currentDecisionId) {
        const decision = await tx.leaveApprovalDecision.updateMany({
          where: { id: data.currentDecisionId, status: "pending" },
          data: {
            status: "rejected",
            decidedById: data.approverId,
            decidedAt: new Date(),
            notes: data.reason,
          },
        });
        if (decision.count !== 1) {
          throw new ConflictException(
            "Leave approval decision changed while the request was being rejected; refresh and try again",
          );
        }
      }

      return tx.leaveRequest.findUniqueOrThrow({
        where: { id: data.requestId },
        include: requestIncludes,
      });
    });
  }

  /** A late cancellation rejection cannot undo a committed refund. */
  async rejectCancellationAtomically(requestId: string) {
    return prisma.$transaction(async (tx) => {
      const transition = await tx.leaveRequest.updateMany({
        where: { id: requestId, status: "pending_cancellation" },
        data: { status: "approved" },
      });
      if (transition.count !== 1) return null;

      return tx.leaveRequest.findUniqueOrThrow({
        where: { id: requestId },
        include: requestIncludes,
      });
    });
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
    return prisma.leaveRequest.update({
      where: { id },
      data: {
        ...data,
        ...(data.status === "approved" || data.status === "rejected"
          ? { delegatedToId: null }
          : {}),
      },
      include: requestIncludes,
    });
  }

  async updateRequest(
    id: string,
    data: Prisma.LeaveRequestUncheckedUpdateInput,
  ) {
    return prisma.leaveRequest.update({
      where: { id },
      data,
      include: requestIncludes,
    });
  }

  async findCalendarRows(from: Date, to: Date, department?: string) {
    const where: Prisma.LeaveRequestWhereInput = {
      ...excludeDeleted("deletedAt"),
      status: { in: ["approved", "pending"] },
      AND: [{ startDate: { lte: to } }, { endDate: { gte: from } }],
    };
    const dept = department?.trim();
    if (dept) {
      where.employee = {
        department: { equals: dept, mode: "insensitive" },
      };
    }
    return prisma.leaveRequest.findMany({
      where,
      include: {
        employee: {
          select: { id: true, name: true, department: true },
        },
        leaveType: {
          select: { id: true, name: true, code: true, category: true },
        },
      },
      orderBy: [{ startDate: "asc" }, { employee: { name: "asc" } }],
    });
  }

  async findPendingForReminder(
    minAgeHours: number,
    minHoursSinceReminder: number,
    maxReminders: number,
  ) {
    const now = new Date();
    const createdBefore = new Date(now.getTime() - minAgeHours * 3600_000);
    const reminderBefore = new Date(
      now.getTime() - minHoursSinceReminder * 3600_000,
    );
    return prisma.leaveRequest.findMany({
      where: {
        ...excludeDeleted("deletedAt"),
        status: "pending",
        reminderCount: { lt: maxReminders },
        createdAt: { lte: createdBefore },
        OR: [
          { lastReminderAt: null },
          { lastReminderAt: { lte: reminderBefore } },
        ],
      },
      include: requestIncludes,
    });
  }

  async checkOverlap(
    employeeId: string,
    startDate: Date,
    endDate: Date,
    excludeId?: string,
  ) {
    const where: Prisma.LeaveRequestWhereInput = {
      ...excludeDeleted("deletedAt"),
      employeeId,
      status: { in: ["pending", "approved"] },
      startDate: { lte: endDate },
      endDate: { gte: startDate },
    };
    if (excludeId) {
      where.id = { not: excludeId };
    }
    return prisma.leaveRequest.findFirst({ where });
  }

  async updateBalance(
    employeeId: string,
    leaveTypeId: string,
    year: number,
    usedDelta: number,
    source: "entitled" | "carried" = "entitled",
  ) {
    return prisma.leaveBalance.update({
      where: {
        employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year },
      },
      data:
        source === "carried"
          ? { carriedUsed: { increment: usedDelta } }
          : { used: { increment: usedDelta } },
    });
  }

  async findBalance(employeeId: string, leaveTypeId: string, year: number) {
    return prisma.leaveBalance.findUnique({
      where: {
        employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year },
      },
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
        isActive: true,
        reportingTo: true,
      },
    });
  }

  async findDirectReportIds(managerId: string): Promise<string[]> {
    const rows = await prisma.user.findMany({
      where: { reportingTo: managerId, isActive: true },
      select: { id: true },
    });
    return rows.map((r) => r.id);
  }

  async findDirectReports(managerId: string) {
    return prisma.user.findMany({
      where: { reportingTo: managerId, isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        department: true,
        jobTitle: true,
        entityId: true,
        entity: { select: { id: true, code: true, name: true } },
      },
      orderBy: { name: "asc" },
    });
  }

  async findAllReportees() {
    return prisma.user.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        email: true,
        avatarUrl: true,
        department: true,
        jobTitle: true,
        entityId: true,
        entity: { select: { id: true, code: true, name: true } },
      },
      orderBy: { name: "asc" },
    });
  }

  /**
   * Active leave types whose entity is in `entityIds` or is `null`
   * (global). Used to synthesize zero-used balances for employees who
   * don't have a `LeaveBalance` row yet for the year.
   */
  async findTypesForEntities(entityIds: Array<string | null>) {
    const concrete = entityIds.filter((id): id is string => !!id);
    return prisma.leaveType.findMany({
      where: {
        isActive: true,
        OR: [
          { entityId: null },
          ...(concrete.length > 0 ? [{ entityId: { in: concrete } }] : []),
        ],
      },
      orderBy: [{ entityId: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        code: true,
        category: true,
        entityId: true,
        daysPerYear: true,
      },
    });
  }

  async findBalancesForEmployees(employeeIds: string[], year: number) {
    if (employeeIds.length === 0) return [];
    return prisma.leaveBalance.findMany({
      where: { employeeId: { in: employeeIds }, year },
      include: {
        leaveType: {
          select: {
            id: true,
            name: true,
            code: true,
            category: true,
            entityId: true,
          },
        },
      },
      orderBy: [{ employeeId: "asc" }, { leaveType: { name: "asc" } }],
    });
  }

  async createBalanceTransaction(data: {
    employeeId: string;
    leaveTypeId: string;
    year: number;
    type: string;
    amount: number;
    description?: string;
    referenceId?: string;
  }) {
    return prisma.balanceTransaction.create({ data });
  }

  async findBalanceTransactions(
    employeeId: string,
    year: number,
    leaveTypeId?: string,
  ) {
    const where: Prisma.BalanceTransactionWhereInput = { employeeId, year };
    if (leaveTypeId) where.leaveTypeId = leaveTypeId;
    return prisma.balanceTransaction.findMany({
      where,
      include: {
        leaveType: {
          select: { id: true, name: true, code: true, category: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  // ── Approval chain (admin) ──

  async findApprovalSteps(opts?: { activeOnly?: boolean }) {
    return prisma.leaveApprovalStep.findMany({
      where: opts?.activeOnly ? { isActive: true } : undefined,
      orderBy: { order: "asc" },
      include: {
        approverUser: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async findApprovalStepById(id: string) {
    return prisma.leaveApprovalStep.findUnique({
      where: { id },
      include: {
        approverUser: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async createApprovalStep(data: Prisma.LeaveApprovalStepCreateInput) {
    return prisma.leaveApprovalStep.create({
      data,
      include: {
        approverUser: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async updateApprovalStep(
    id: string,
    data: Prisma.LeaveApprovalStepUpdateInput,
  ) {
    return prisma.leaveApprovalStep.update({
      where: { id },
      data,
      include: {
        approverUser: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async deleteApprovalStep(id: string) {
    return prisma.leaveApprovalStep.delete({ where: { id } });
  }

  async reorderApprovalSteps(orderedIds: string[]) {
    return prisma.$transaction(async (tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.leaveApprovalStep.update({
          where: { id: orderedIds[i]! },
          data: { order: 10000 + i },
        });
      }
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.leaveApprovalStep.update({
          where: { id: orderedIds[i]! },
          data: { order: i + 1 },
        });
      }
      return tx.leaveApprovalStep.findMany({
        orderBy: { order: "asc" },
        include: {
          approverUser: { select: { id: true, name: true, email: true } },
        },
      });
    });
  }

  async nextApprovalStepOrder() {
    const last = await prisma.leaveApprovalStep.findFirst({
      orderBy: { order: "desc" },
      select: { order: true },
    });
    return (last?.order ?? 0) + 1;
  }

  // ── Per-request decisions ──

  async initializeApprovalChainAtomically(
    leaveRequestId: string,
    rows: Array<{
      order: number;
      name: string;
      approverType: string;
      approverUserId?: string | null;
    }>,
  ) {
    return prisma.$transaction(async (tx) => {
      const claimed = await tx.leaveRequest.updateMany({
        where: {
          id: leaveRequestId,
          status: "pending",
          currentStepOrder: null,
        },
        data: { currentStepOrder: 1 },
      });
      if (claimed.count !== 1) return false;

      await tx.leaveApprovalDecision.createMany({
        data: rows.map((row) => ({
          leaveRequestId,
          order: row.order,
          name: row.name,
          approverType: row.approverType,
          approverUserId: row.approverUserId ?? null,
        })),
      });
      return true;
    });
  }

  async createDecisions(
    leaveRequestId: string,
    rows: Array<{
      order: number;
      name: string;
      approverType: string;
      approverUserId?: string | null;
    }>,
  ) {
    return prisma.leaveApprovalDecision.createMany({
      data: rows.map((r) => ({
        leaveRequestId,
        order: r.order,
        name: r.name,
        approverType: r.approverType,
        approverUserId: r.approverUserId ?? null,
      })),
    });
  }

  async findDecisions(leaveRequestId: string) {
    return prisma.leaveApprovalDecision.findMany({
      where: { leaveRequestId },
      orderBy: { order: "asc" },
      include: {
        approverUser: { select: { id: true, name: true, email: true } },
        decidedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async updateDecision(
    id: string,
    data: Prisma.LeaveApprovalDecisionUpdateInput,
  ) {
    return prisma.leaveApprovalDecision.update({ where: { id }, data });
  }

  async deleteDecisionsForRequest(leaveRequestId: string) {
    return prisma.leaveApprovalDecision.deleteMany({
      where: { leaveRequestId },
    });
  }

  async updateRequestStepOrder(id: string, currentStepOrder: number | null) {
    return prisma.leaveRequest.update({
      where: { id },
      data: { currentStepOrder },
    });
  }

  // ── Soft delete ──

  async softDeleteRequest(id: string) {
    return prisma.leaveRequest.update({
      where: { id },
      data: softDeleteUpdate("deletedAt"),
      include: requestIncludes,
    });
  }

  async restoreRequest(id: string) {
    return prisma.leaveRequest.update({
      where: { id },
      data: { deletedAt: null },
      include: requestIncludes,
    });
  }

  async permanentDeleteRequest(id: string) {
    return prisma.leaveRequest.delete({ where: { id } });
  }
}

export const leaveRepository = new LeaveRepository();
