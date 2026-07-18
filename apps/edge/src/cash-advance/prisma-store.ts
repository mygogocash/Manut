import { createPrismaClient, type PrismaClient } from "@manut/database";

import { hyperdriveConnectionString } from "../hyperdrive";
import { loadUserPermissions } from "../rbac";
import type { RuntimeBindings } from "../runtime";
import type { CashAdvanceRequestRecord, CashAdvanceStore } from "./store";

function asDate(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function money(value: { toNumber?: () => number } | number | string): number {
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof value.toNumber === "function") return value.toNumber();
  return Number(value);
}

const ADMIN_EXTRAS = [
  "cash-advance:read",
  "cash-advance:create",
  "cash-advance:read-all",
  "cash-advance:approve",
] as const;

function mapRow(row: {
  id: string;
  requestNumber: number;
  requestDate: Date;
  payoutMode: string;
  currency: string;
  status: string;
  requestedTotal: { toNumber?: () => number } | number | string;
  approvedTotal: { toNumber?: () => number } | number | string;
  rejectReason: string | null;
  employeeId: string;
  bankName: string | null;
  bankAccountNo: string | null;
  notes: string | null;
  employee: { id: string; name: string | null; email: string };
  entity: { id: string; name: string } | null;
  items: Array<{ id: string; description: string }>;
}): CashAdvanceRequestRecord {
  return {
    id: row.id,
    requestNumber: row.requestNumber,
    requestDate: asDate(row.requestDate),
    payoutMode: row.payoutMode,
    currency: row.currency,
    status: row.status,
    requestedTotal: money(row.requestedTotal),
    approvedTotal: money(row.approvedTotal),
    rejectReason: row.rejectReason,
    employeeId: row.employee.id,
    employeeName: row.employee.name ?? "User",
    employeeEmail: row.employee.email,
    entityId: row.entity?.id ?? null,
    entityName: row.entity?.name ?? null,
    items: row.items.map((item) => ({
      id: item.id,
      description: item.description,
    })),
    bankName: row.bankName,
    bankAccountNo: row.bankAccountNo,
    notes: row.notes,
  };
}

const LIST_INCLUDES = {
  employee: { select: { id: true, name: true, email: true } },
  entity: { select: { id: true, name: true } },
  items: {
    select: { id: true, description: true },
    orderBy: { position: "asc" as const },
  },
};

export function createPrismaCashAdvanceStore(
  client: PrismaClient,
): CashAdvanceStore {
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
        client.cashAdvanceRequest.findMany({
          where,
          include: LIST_INCLUDES,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        client.cashAdvanceRequest.count({ where }),
      ]);

      return { data: rows.map(mapRow), total };
    },

    async create(input) {
      const requestedTotal = input.items.reduce(
        (sum, item) => sum + item.requestedAmount,
        0,
      );
      const row = await client.cashAdvanceRequest.create({
        data: {
          employeeId: input.employeeId,
          entityId: input.entityId ?? null,
          payoutMode: input.payoutMode,
          bankName: input.bankName ?? null,
          bankAccountNo: input.bankAccountNo ?? null,
          currency: input.currency,
          notes: input.notes ?? null,
          requestedTotal,
          status: "draft",
          items: {
            create: input.items.map((item, index) => ({
              position: index + 1,
              description: item.description,
              requestedAmount: item.requestedAmount,
              approvedAmount: 0,
            })),
          },
        },
        include: LIST_INCLUDES,
      });
      return mapRow(row);
    },
  };
}

export function createHyperdriveCashAdvanceStore(
  env: RuntimeBindings,
): CashAdvanceStore {
  const client = createPrismaClient(hyperdriveConnectionString(env));
  return createPrismaCashAdvanceStore(client);
}
