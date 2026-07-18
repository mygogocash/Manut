import { createPrismaClient, type PrismaClient } from "@manut/database";

import { hyperdriveConnectionString } from "../hyperdrive";
import { loadUserPermissions } from "../rbac";
import type { RuntimeBindings } from "../runtime";
import type { PayrollRunRecord, PayrollStore } from "./store";

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function moneyString(
  value: { toString?: () => string } | number | string,
): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value.toString === "function") return value.toString();
  return String(value);
}

const ADMIN_EXTRAS = [
  "payroll:read",
  "payroll:create",
  "payroll:approve",
  "payroll:hr-admin",
] as const;

export function createPrismaPayrollStore(client: PrismaClient): PayrollStore {
  return {
    async loadPermissions(userId) {
      return loadUserPermissions(client, userId, ADMIN_EXTRAS);
    },

    async findMany(filters, page, limit) {
      const where: {
        status?: string;
        period?: string;
        entityId?: string;
        payslips: { some: { employeeId: string } };
      } = {
        payslips: { some: { employeeId: filters.employeeIdScope } },
      };
      if (filters.status) where.status = filters.status;
      if (filters.period) where.period = filters.period;
      if (filters.entityId) where.entityId = filters.entityId;

      const [rows, total] = await Promise.all([
        client.payrollRun.findMany({
          where,
          include: {
            entity: { select: { id: true, name: true } },
            runner: { select: { id: true, name: true } },
            approver: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        client.payrollRun.count({ where }),
      ]);

      const data: PayrollRunRecord[] = rows.map((row) => ({
        id: row.id,
        period: row.period,
        status: row.status,
        totalGross: moneyString(row.totalGross),
        totalNet: moneyString(row.totalNet),
        totalTax: moneyString(row.totalTax),
        createdAt: asIso(row.createdAt),
        entityId: row.entity.id,
        entityName: row.entity.name,
        runnerId: row.runner.id,
        runnerName: row.runner.name ?? "Runner",
        approverId: row.approver?.id ?? null,
        approverName: row.approver?.name ?? null,
      }));

      return { data, total };
    },
  };
}

export function createHyperdrivePayrollStore(
  env: RuntimeBindings,
): PayrollStore {
  const client = createPrismaClient(hyperdriveConnectionString(env));
  return createPrismaPayrollStore(client);
}
