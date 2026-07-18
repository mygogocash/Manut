import { createPrismaClient, type PrismaClient } from "@manut/database";

import { hyperdriveConnectionString } from "../hyperdrive";
import { loadUserPermissions } from "../rbac";
import type { RuntimeBindings } from "../runtime";
import type {
  CashAdvanceApprovalStepRecord,
  CashAdvanceRequestRecord,
  CashAdvanceStore,
} from "./store";

function asStringIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function moneyOrNull(
  value: { toNumber?: () => number } | number | string | null,
): number | null {
  if (value == null) return null;
  return money(value);
}

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
  items: Array<{
    id: string;
    description: string;
    receiptUrl: string | null;
  }>;
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
      receiptUrl: item.receiptUrl,
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
    select: { id: true, description: true, receiptUrl: true },
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

    async findRegistered(query) {
      const { createPrismaFileUploadLookup } = await import(
        "../file-upload-lookup"
      );
      return createPrismaFileUploadLookup(client).findRegistered(query);
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
              categoryId: item.categoryId ?? null,
              receiptUrl: item.receiptUrl ?? null,
            })),
          },
        },
        include: LIST_INCLUDES,
      });
      return mapRow(row);
    },

    async update(id, input) {
      if (input.items) {
        await client.$transaction(async (tx) => {
          await tx.cashAdvanceItem.deleteMany({ where: { requestId: id } });
          if (input.items && input.items.length > 0) {
            await tx.cashAdvanceItem.createMany({
              data: input.items.map((item, index) => ({
                requestId: id,
                position: index + 1,
                description: item.description,
                requestedAmount: item.requestedAmount,
                approvedAmount: 0,
                categoryId: item.categoryId ?? null,
                receiptUrl: item.receiptUrl ?? null,
              })),
            });
          }
        });
      }

      const requestedTotal = input.items
        ? input.items.reduce((sum, item) => sum + item.requestedAmount, 0)
        : undefined;

      const row = await client.cashAdvanceRequest.update({
        where: { id },
        data: {
          ...(input.entityId !== undefined && { entityId: input.entityId }),
          ...(input.payoutMode !== undefined && {
            payoutMode: input.payoutMode,
          }),
          ...(input.bankName !== undefined && { bankName: input.bankName }),
          ...(input.bankAccountNo !== undefined && {
            bankAccountNo: input.bankAccountNo,
          }),
          ...(input.currency !== undefined && { currency: input.currency }),
          ...(input.notes !== undefined && { notes: input.notes }),
          ...(requestedTotal !== undefined && { requestedTotal }),
        },
        include: LIST_INCLUDES,
      });
      return mapRow(row);
    },

    async findById(id) {
      const row = await client.cashAdvanceRequest.findFirst({
        where: { id, deletedAt: null },
        include: LIST_INCLUDES,
      });
      return row ? mapRow(row) : null;
    },

    async findActiveApprovalSteps() {
      const rows = await client.cashAdvanceApprovalStep.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
      });
      return rows.map(
        (row): CashAdvanceApprovalStepRecord => ({
          id: row.id,
          order: row.order,
          name: row.name,
          approverType: row.approverType,
          approverUserId: row.approverUserId,
          skipWhenSubmitterIds: asStringIds(row.skipWhenSubmitterIds),
          onlyWhenSubmitterIds: asStringIds(row.onlyWhenSubmitterIds),
          payoutModeFilter: asStringIds(row.payoutModeFilter),
          amountMin: moneyOrNull(row.amountMin),
          amountMax: moneyOrNull(row.amountMax),
          isActive: row.isActive,
        }),
      );
    },

    async submitWithDecisions(id, rows) {
      return client.$transaction(async (tx) => {
        await tx.cashAdvanceApprovalDecision.deleteMany({
          where: { requestId: id },
        });
        await tx.cashAdvanceApprovalDecision.createMany({
          data: rows.map((row) => ({
            requestId: id,
            order: row.order,
            name: row.name,
            approverType: row.approverType,
            approverUserId: row.approverUserId,
          })),
        });
        const updated = await tx.cashAdvanceRequest.update({
          where: { id },
          data: {
            status: "submitted",
            submittedAt: new Date(),
            rejectReason: null,
            currentStepOrder: 1,
          },
          include: LIST_INCLUDES,
        });
        return mapRow(updated);
      });
    },
  };
}

export function createHyperdriveCashAdvanceStore(
  env: RuntimeBindings,
): CashAdvanceStore {
  const client = createPrismaClient(hyperdriveConnectionString(env));
  return createPrismaCashAdvanceStore(client);
}
