import { createPrismaClient, type PrismaClient } from "@manut/database";

import { HttpError } from "../http-error";
import { hyperdriveConnectionString } from "../hyperdrive";
import { loadUserPermissions } from "../rbac";
import type { RuntimeBindings } from "../runtime";
import type {
  LeaveApprovalDecisionRecord,
  LeaveApprovalStepRecord,
  LeaveBalanceRecord,
  LeavePolicyApproverRecord,
  LeaveRequestDetailRecord,
  LeaveRequestRecord,
  LeaveStore,
  LeaveTypeRecord,
  LeaveUserRecord,
} from "./store";

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function asDate(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function daysToString(
  value: { toString?: () => string } | number | string,
): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value.toString === "function") return value.toString();
  return String(value);
}

function moneyNumber(
  value: { toNumber?: () => number } | number | string,
): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof value.toNumber === "function") return value.toNumber();
  return Number(value);
}

function asStringIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

const ADMIN_EXTRAS = [
  "leave:read",
  "leave:hr-read",
  "leave:request",
  "leave:approve",
  "leave:approve-wfh",
] as const;

const DETAIL_INCLUDES = {
  employee: {
    select: {
      id: true,
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
    },
  },
} as const;

function mapDetail(row: {
  id: string;
  employeeId: string;
  startDate: Date;
  endDate: Date;
  durationType: string;
  halfDayPeriod: string | null;
  days: { toString?: () => string } | number | string;
  reason: string | null;
  status: string;
  createdAt: Date;
  currentStepOrder: number | null;
  delegatedToId: string | null;
  source: string;
  employee: { reportingTo: string | null };
  leaveType: {
    id: string;
    name: string;
    code: string;
    category: string;
    daysPerYear: number;
  };
}): LeaveRequestDetailRecord {
  return {
    ...mapRequest(row),
    currentStepOrder: row.currentStepOrder,
    delegatedToId: row.delegatedToId,
    source: row.source === "carried" ? "carried" : "entitled",
    leaveTypeDaysPerYear: row.leaveType.daysPerYear,
    employeeReportingTo: row.employee.reportingTo,
  };
}

function mapRequest(row: {
  id: string;
  employeeId: string;
  startDate: Date;
  endDate: Date;
  durationType: string;
  halfDayPeriod: string | null;
  days: { toString?: () => string } | number | string;
  reason: string | null;
  status: string;
  createdAt: Date;
  leaveType: {
    id: string;
    name: string;
    code: string;
    category: string;
  };
}): LeaveRequestRecord {
  return {
    id: row.id,
    employeeId: row.employeeId,
    leaveTypeId: row.leaveType.id,
    leaveTypeName: row.leaveType.name,
    leaveTypeCode: row.leaveType.code,
    leaveTypeCategory: row.leaveType.category,
    startDate: asDate(row.startDate),
    endDate: asDate(row.endDate),
    durationType: row.durationType,
    halfDayPeriod: row.halfDayPeriod,
    days: daysToString(row.days),
    reason: row.reason,
    status: row.status,
    createdAt: asIso(row.createdAt),
  };
}

async function materializeBalance(
  tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
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

async function consumeBalance(
  tx: Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0],
  data: {
    employeeId: string;
    leaveTypeId: string;
    year: number;
    days: number;
    source: "entitled" | "carried";
    defaultEntitlement: number;
  },
) {
  const balance = await materializeBalance(tx, data);
  const isCarried = data.source === "carried";
  const maximumUsed = isCarried
    ? moneyNumber(balance.carried) - data.days
    : moneyNumber(balance.entitled) +
      moneyNumber(balance.adjustment) -
      data.days;
  const consumed = await tx.leaveBalance.updateMany({
    where: isCarried
      ? { id: balance.id, carriedUsed: { lte: maximumUsed } }
      : { id: balance.id, used: { lte: maximumUsed } },
    data: isCarried
      ? { carriedUsed: { increment: data.days } }
      : { used: { increment: data.days } },
  });
  if (consumed.count !== 1) {
    throw new HttpError(
      409,
      "LEAVE_BALANCE_RACE",
      "Leave balance changed and no longer has enough available days; refresh and try again",
    );
  }
}

export function createPrismaLeaveStore(client: PrismaClient): LeaveStore {
  return {
    async loadPermissions(userId) {
      return loadUserPermissions(client, userId, ADMIN_EXTRAS);
    },

    async findMany(filters, page, limit) {
      const where: {
        deletedAt: null;
        employeeId: string;
        status?: string;
      } = {
        deletedAt: null,
        employeeId: filters.employeeId,
      };
      if (filters.status) where.status = filters.status;

      const [rows, total] = await Promise.all([
        client.leaveRequest.findMany({
          where,
          include: {
            leaveType: {
              select: {
                id: true,
                name: true,
                code: true,
                category: true,
              },
            },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        client.leaveRequest.count({ where }),
      ]);

      return { data: rows.map(mapRequest), total };
    },

    async findLeaveTypeById(id) {
      const row = await client.leaveType.findFirst({
        where: { id, isActive: true },
        select: {
          id: true,
          name: true,
          code: true,
          category: true,
          entityId: true,
          daysPerYear: true,
          requiresApproval: true,
          isActive: true,
        },
      });
      if (!row) return null;
      const mapped: LeaveTypeRecord = {
        id: row.id,
        name: row.name,
        code: row.code,
        category: row.category,
        entityId: row.entityId,
        daysPerYear: row.daysPerYear,
        requiresApproval: row.requiresApproval,
        isActive: row.isActive,
      };
      return mapped;
    },

    async findUserById(userId) {
      const row = await client.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          entityId: true,
          isActive: true,
          reportingTo: true,
        },
      });
      if (!row) return null;
      const mapped: LeaveUserRecord = {
        id: row.id,
        entityId: row.entityId,
        isActive: row.isActive,
        reportingTo: row.reportingTo,
      };
      return mapped;
    },

    async findBalance(employeeId, leaveTypeId, year) {
      const row = await client.leaveBalance.findUnique({
        where: {
          employeeId_leaveTypeId_year: { employeeId, leaveTypeId, year },
        },
      });
      if (!row) return null;
      const mapped: LeaveBalanceRecord = {
        employeeId: row.employeeId,
        leaveTypeId: row.leaveTypeId,
        year: row.year,
        entitled: moneyNumber(row.entitled),
        used: moneyNumber(row.used),
        carried: moneyNumber(row.carried),
        carriedUsed: moneyNumber(row.carriedUsed),
        carriedExpiry: row.carriedExpiry ? asDate(row.carriedExpiry) : null,
        adjustment: moneyNumber(row.adjustment),
      };
      return mapped;
    },

    async checkOverlap(employeeId, startDate, endDate) {
      const overlap = await client.leaveRequest.findFirst({
        where: {
          deletedAt: null,
          employeeId,
          status: { in: ["pending", "approved"] },
          startDate: { lte: new Date(endDate) },
          endDate: { gte: new Date(startDate) },
        },
        select: { id: true },
      });
      return overlap != null;
    },

    async createRequest(input) {
      const source = input.source;
      const autoApproved = !input.requiresApproval;
      const start = new Date(input.startDate);
      const end = new Date(input.endDate);
      const year = Number(input.startDate.slice(0, 4));

      return client.$transaction(async (tx) => {
        const balanceData = {
          employeeId: input.employeeId,
          leaveTypeId: input.leaveTypeId,
          year,
          defaultEntitlement: input.defaultEntitlement,
        };
        if (autoApproved) {
          await consumeBalance(tx, {
            ...balanceData,
            days: input.days,
            source,
          });
        } else {
          await materializeBalance(tx, balanceData);
        }

        const request = await tx.leaveRequest.create({
          data: {
            employeeId: input.employeeId,
            leaveTypeId: input.leaveTypeId,
            entityId: input.entityId,
            startDate: start,
            endDate: end,
            days: input.days,
            durationType: input.durationType,
            halfDayPeriod: input.halfDayPeriod,
            reason: input.reason,
            source,
            status: autoApproved ? "approved" : "pending",
            approvedAt: autoApproved ? new Date() : null,
          },
          include: {
            leaveType: {
              select: {
                id: true,
                name: true,
                code: true,
                category: true,
              },
            },
          },
        });

        if (autoApproved) {
          await tx.balanceTransaction.create({
            data: {
              employeeId: input.employeeId,
              leaveTypeId: input.leaveTypeId,
              year,
              type: source === "carried" ? "used_carried" : "used",
              amount: input.days,
              description: input.approvalDescription,
              referenceId: request.id,
            },
          });
        }

        return mapRequest(request);
      });
    },

    async findActiveApprovalSteps() {
      const rows = await client.leaveApprovalStep.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
      });
      return rows.map(
        (row): LeaveApprovalStepRecord => ({
          id: row.id,
          order: row.order,
          name: row.name,
          approverType: row.approverType,
          approverUserId: row.approverUserId,
          skipWhenSubmitterIds: asStringIds(row.skipWhenSubmitterIds),
          onlyWhenSubmitterIds: asStringIds(row.onlyWhenSubmitterIds),
          isActive: row.isActive,
        }),
      );
    },

    async initializeApprovalChain(leaveRequestId, rows) {
      return client.$transaction(async (tx) => {
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
            approverUserId: row.approverUserId,
          })),
        });
        return true;
      });
    },

    async findRequestById(id) {
      const row = await client.leaveRequest.findFirst({
        where: { id, deletedAt: null },
        include: DETAIL_INCLUDES,
      });
      return row ? mapDetail(row) : null;
    },

    async findDecisions(leaveRequestId) {
      const rows = await client.leaveApprovalDecision.findMany({
        where: { leaveRequestId },
        orderBy: { order: "asc" },
      });
      return rows.map(
        (row): LeaveApprovalDecisionRecord => ({
          id: row.id,
          leaveRequestId: row.leaveRequestId,
          order: row.order,
          name: row.name,
          approverType: row.approverType,
          approverUserId: row.approverUserId,
          status: row.status,
        }),
      );
    },

    async findPolicyApprovers(leaveTypeId) {
      const rows = await client.leavePolicyApprover.findMany({
        where: { leaveTypeId },
        orderBy: { order: "asc" },
      });
      return rows.map(
        (row): LeavePolicyApproverRecord => ({
          approverType: row.approverType,
          approverUserId: row.approverUserId,
        }),
      );
    },

    async approveRequestStep(input) {
      return client.$transaction(async (tx) => {
        const transition = await tx.leaveRequest.updateMany({
          where: {
            id: input.requestId,
            status: "pending",
            currentStepOrder: input.expectedStepOrder,
          },
          data:
            input.nextStepOrder === null
              ? {
                  status: "approved",
                  approvedBy: input.approverId,
                  approvedAt: new Date(),
                  currentStepOrder: null,
                }
              : { currentStepOrder: input.nextStepOrder },
        });
        if (transition.count !== 1) return null;

        if (input.currentDecisionId) {
          await tx.leaveApprovalDecision.update({
            where: { id: input.currentDecisionId },
            data: {
              status: "approved",
              decidedById: input.approverId,
              decidedAt: new Date(),
            },
          });
        }

        if (input.nextStepOrder === null) {
          await consumeBalance(tx, {
            employeeId: input.employeeId,
            leaveTypeId: input.leaveTypeId,
            year: input.year,
            days: input.days,
            source: input.source,
            defaultEntitlement: input.defaultEntitlement,
          });
          await tx.balanceTransaction.create({
            data: {
              employeeId: input.employeeId,
              leaveTypeId: input.leaveTypeId,
              year: input.year,
              type: input.source === "carried" ? "used_carried" : "used",
              amount: input.days,
              description: input.description,
              referenceId: input.requestId,
            },
          });
        }

        const row = await tx.leaveRequest.findUniqueOrThrow({
          where: { id: input.requestId },
          include: {
            leaveType: {
              select: {
                id: true,
                name: true,
                code: true,
                category: true,
              },
            },
          },
        });
        return mapRequest(row);
      });
    },

    async rejectRequestStep(input) {
      return client.$transaction(async (tx) => {
        const transition = await tx.leaveRequest.updateMany({
          where: {
            id: input.requestId,
            status: "pending",
            currentStepOrder: input.expectedStepOrder,
          },
          data: {
            status: "rejected",
            approvedBy: input.approverId,
            approvedAt: new Date(),
            rejectReason: input.reason,
            currentStepOrder: null,
            delegatedToId: null,
          },
        });
        if (transition.count !== 1) return null;

        if (input.currentDecisionId) {
          const decision = await tx.leaveApprovalDecision.updateMany({
            where: { id: input.currentDecisionId, status: "pending" },
            data: {
              status: "rejected",
              decidedById: input.approverId,
              decidedAt: new Date(),
              notes: input.reason,
            },
          });
          if (decision.count !== 1) {
            throw new HttpError(
              409,
              "LEAVE_CHAIN_RACE",
              "Leave approval decision changed while the request was being rejected; refresh and try again",
            );
          }
        }

        const row = await tx.leaveRequest.findUniqueOrThrow({
          where: { id: input.requestId },
          include: {
            leaveType: {
              select: {
                id: true,
                name: true,
                code: true,
                category: true,
              },
            },
          },
        });
        return mapRequest(row);
      });
    },

    async cancelRequest(input) {
      return client.$transaction(async (tx) => {
        const transition = await tx.leaveRequest.updateMany({
          where: { id: input.requestId, status: input.expectedStatus },
          data: {
            status: "cancelled",
            ...(input.approvedBy
              ? { approvedBy: input.approvedBy, approvedAt: new Date() }
              : {}),
          },
        });
        if (transition.count !== 1) return null;

        if (input.refund) {
          const refund = input.refund;
          const balance = await materializeBalance(tx, {
            employeeId: refund.employeeId,
            leaveTypeId: refund.leaveTypeId,
            year: refund.year,
            defaultEntitlement: refund.defaultEntitlement,
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
            throw new HttpError(
              409,
              "LEAVE_BALANCE_RACE",
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
              referenceId: input.requestId,
            },
          });
        }

        const row = await tx.leaveRequest.findUniqueOrThrow({
          where: { id: input.requestId },
          include: {
            leaveType: {
              select: {
                id: true,
                name: true,
                code: true,
                category: true,
              },
            },
          },
        });
        return mapRequest(row);
      });
    },
  };
}

export function createHyperdriveLeaveStore(env: RuntimeBindings): LeaveStore {
  const client = createPrismaClient(hyperdriveConnectionString(env));
  return createPrismaLeaveStore(client);
}
