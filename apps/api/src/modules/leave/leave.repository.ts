import type { Prisma } from "@nexora/database";

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
  leaveType: { select: { id: true, name: true, code: true, category: true } },
  approver: { select: { id: true, name: true, email: true } },
  delegate: { select: { id: true, name: true, email: true } },
  entity: { select: { id: true, name: true } },
} satisfies Prisma.LeaveRequestInclude;

const typeInclude = {
  entity: { select: { id: true, name: true, code: true } },
} satisfies Prisma.LeaveTypeInclude;

export class LeaveRepository {
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
    return prisma.leaveType.findUnique({
      where: { entityId_name: { entityId: entityId ?? null, name } },
    });
  }

  async findTypeByCodeInEntity(code: string, entityId: string | null) {
    return prisma.leaveType.findUnique({
      where: { entityId_code: { entityId: entityId ?? null, code } },
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
      skipWhenSubmitterIds?: string[];
      onlyWhenSubmitterIds?: string[];
      minDays?: number | null;
      maxDays?: number | null;
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
          skipWhenSubmitterIds: r.skipWhenSubmitterIds ?? [],
          onlyWhenSubmitterIds: r.onlyWhenSubmitterIds ?? [],
          minDays: r.minDays ?? null,
          maxDays: r.maxDays ?? null,
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
  }) {
    return prisma.leaveRequest.create({
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
        source: data.source ?? "entitled",
      },
      include: requestIncludes,
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

  /**
   * Apply a signed delta to one bucket of a leave balance. Pass `client`
   * to enrol the write in a caller-owned interactive transaction — the
   * approval path does, so the status flip and the deduction commit or
   * roll back together.
   */
  async updateBalance(
    employeeId: string,
    leaveTypeId: string,
    year: number,
    usedDelta: number,
    source: "entitled" | "carried" = "entitled",
    client: Prisma.TransactionClient = prisma,
  ) {
    return client.leaveBalance.update({
      where: {
        employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year },
      },
      data:
        source === "carried"
          ? { carriedUsed: { increment: usedDelta } }
          : { used: { increment: usedDelta } },
    });
  }

  /**
   * Flip the "days are currently drawn down" flag on a request. Every
   * balance mutation keeps this in lockstep so refunds and restores are
   * idempotent.
   */
  async setBalanceDeducted(
    id: string,
    balanceDeducted: boolean,
    client: Prisma.TransactionClient = prisma,
  ) {
    return client.leaveRequest.update({
      where: { id },
      data: { balanceDeducted },
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

  async createBalanceTransaction(
    data: {
      employeeId: string;
      leaveTypeId: string;
      year: number;
      type: string;
      amount: number;
      description?: string;
      referenceId?: string;
    },
    client: Prisma.TransactionClient = prisma,
  ) {
    return client.balanceTransaction.create({ data });
  }

  /**
   * Rows where the stored `LeaveBalance` counter disagrees with the sum
   * of the employee's own visible approved requests.
   *
   * `used` is a stored counter, not a derived value, so it can drift
   * from `leave_requests` and nothing in the product notices. This is
   * the read model that makes that drift visible.
   *
   * Year is derived with `EXTRACT(YEAR FROM start_date)`, matching the
   * service's `startDate.getFullYear()` — `start_date` is a DATE, Prisma
   * hands it back as UTC midnight, and the API runs UTC, so the two
   * agree. They would not on a host west of UTC.
   *
   * Sums are cast to float8 rather than left as numeric: leave days are
   * always multiples of 0.5, which float64 represents exactly, and it
   * saves coercing a Decimal on every field.
   */
  async findBalanceDrift(year: number | null) {
    return prisma.$queryRaw<
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
    >`
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
    `;
  }

  /** Total balance rows in scope, so the report can say "12 of 480". */
  async countBalances(year: number | null) {
    return prisma.leaveBalance.count({
      where: year === null ? {} : { year },
    });
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
