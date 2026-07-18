import { createPrismaClient, type PrismaClient } from "@manut/database";

import { hyperdriveConnectionString } from "../hyperdrive";
import { loadUserPermissions } from "../rbac";
import type { RuntimeBindings } from "../runtime";
import type { LeaveRequestRecord, LeaveStore } from "./store";

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

const ADMIN_EXTRAS = ["leave:read", "leave:hr-read", "leave:request"] as const;

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

      const data: LeaveRequestRecord[] = rows.map((row) => ({
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
      }));

      return { data, total };
    },
  };
}

export function createHyperdriveLeaveStore(env: RuntimeBindings): LeaveStore {
  const client = createPrismaClient(hyperdriveConnectionString(env));
  return createPrismaLeaveStore(client);
}
