import { createPrismaClient, type PrismaClient } from "@manut/database";

import { hyperdriveConnectionString } from "../hyperdrive";
import { loadUserPermissions } from "../rbac";
import type { RuntimeBindings } from "../runtime";
import type {
  ExpenseCategoryRecord,
  ExpenseLineRecord,
  ExpenseReportRecord,
  ExpensesStore,
} from "./store";

function moneyString(
  value: { toString?: () => string } | number | string,
): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value.toString === "function") return value.toString();
  return String(value);
}

function mapLine(row: {
  id: string;
  reportId: string | null;
  employeeId: string;
  description: string;
  amount: { toString?: () => string } | number | string;
  currency: string;
  date: Date;
  status: string;
  categoryId: string | null;
  notes: string | null;
}): ExpenseLineRecord {
  return {
    id: row.id,
    reportId: row.reportId ?? "",
    employeeId: row.employeeId,
    description: row.description,
    amount: moneyString(row.amount),
    currency: row.currency,
    date: asDate(row.date),
    status: row.status,
    categoryId: row.categoryId,
    notes: row.notes,
  };
}

function asDate(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function money(value: { toNumber?: () => number } | number | string | null): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof value.toNumber === "function") return value.toNumber();
  return Number(value);
}

async function computeReportTotal(
  client: PrismaClient,
  reportId: string,
): Promise<{
  totalAmount: number;
  totalCurrency: string;
  converted: boolean;
  missingRates: string[];
}> {
  const lines = await client.expense.findMany({
    where: { reportId, deletedAt: null },
    select: { amount: true, currency: true },
  });
  if (lines.length === 0) {
    return {
      totalAmount: 0,
      totalCurrency: "THB",
      converted: true,
      missingRates: [],
    };
  }

  const missing: string[] = [];
  let thb = 0;
  for (const line of lines) {
    const amount = money(line.amount) ?? 0;
    const currency = line.currency.trim().toUpperCase();
    if (currency === "THB") {
      thb += amount;
      continue;
    }
    if (!missing.includes(currency)) missing.push(currency);
  }

  if (missing.length > 0) {
    // Full FX conversion stays on Express for non-THB lines in this slice.
    return {
      totalAmount: 0,
      totalCurrency: "THB",
      converted: false,
      missingRates: missing,
    };
  }

  return {
    totalAmount: Math.round(thb * 100) / 100,
    totalCurrency: "THB",
    converted: true,
    missingRates: [],
  };
}

function mapBase(raw: {
  id: string;
  period: string;
  title: string;
  category: string;
  status: string;
  submittedAt: Date | null;
  approvedAt: Date | null;
  rejectReason: string | null;
  reimbursedAt: Date | null;
  approvedTotal: { toNumber?: () => number } | number | string | null;
  createdAt: Date;
  updatedAt: Date;
  employeeId: string;
  entityId: string;
  employee: {
    id: string;
    name: string | null;
    email: string;
    department: string | null;
  };
  entity: { id: string; name: string };
  _count: { expenses: number };
}): Omit<
  ExpenseReportRecord,
  "totalAmount" | "totalCurrency" | "converted" | "missingRates"
> {
  return {
    id: raw.id,
    period: raw.period,
    title: raw.title,
    category: raw.category,
    status: raw.status,
    submittedAt: raw.submittedAt ? asIso(raw.submittedAt) : null,
    approvedAt: raw.approvedAt ? asIso(raw.approvedAt) : null,
    rejectReason: raw.rejectReason,
    reimbursedAt: raw.reimbursedAt ? asIso(raw.reimbursedAt) : null,
    approvedTotal: money(raw.approvedTotal),
    createdAt: asIso(raw.createdAt),
    updatedAt: asIso(raw.updatedAt),
    employeeId: raw.employeeId,
    employeeName: raw.employee.name ?? "User",
    employeeEmail: raw.employee.email,
    employeeDepartment: raw.employee.department,
    entityId: raw.entityId,
    entityName: raw.entity.name,
    expenseCount: raw._count.expenses,
  };
}

const REPORT_INCLUDES = {
  employee: {
    select: { id: true, name: true, email: true, department: true },
  },
  entity: { select: { id: true, name: true } },
  _count: { select: { expenses: true } },
};

const ADMIN_EXTRAS = [
  "expense:read",
  "expense:create",
  "expense:hr-read",
  "expense:hr-approve",
] as const;

export function createPrismaExpensesStore(client: PrismaClient): ExpensesStore {
  return {
    async loadPermissions(userId) {
      return loadUserPermissions(client, userId, ADMIN_EXTRAS);
    },

    async findMany(filters, page, limit) {
      const where: {
        deletedAt: null;
        employeeId: string;
        status?: string;
        period?: string;
      } = {
        deletedAt: null,
        employeeId: filters.employeeId,
      };
      if (filters.status) where.status = filters.status;
      if (filters.period) where.period = filters.period;

      const [rows, total] = await Promise.all([
        client.expenseReport.findMany({
          where,
          include: REPORT_INCLUDES,
          orderBy: { createdAt: "desc" },
          skip: (page - 1) * limit,
          take: limit,
        }),
        client.expenseReport.count({ where }),
      ]);

      const data = await Promise.all(
        rows.map(async (row) => {
          const totals = await computeReportTotal(client, row.id);
          return { ...mapBase(row), ...totals };
        }),
      );

      return { data, total };
    },

    async findById(id) {
      const row = await client.expenseReport.findFirst({
        where: { id, deletedAt: null },
        include: REPORT_INCLUDES,
      });
      if (!row) return null;
      const totals = await computeReportTotal(client, row.id);
      return { ...mapBase(row), ...totals };
    },

    async create(input) {
      const row = await client.expenseReport.create({
        data: {
          employeeId: input.employeeId,
          entityId: input.entityId,
          period: input.period,
          title: input.title,
          category: input.category,
          notes: input.notes,
          status: "draft",
        },
        include: REPORT_INCLUDES,
      });
      return {
        ...mapBase(row),
        totalAmount: 0,
        totalCurrency: "THB",
        converted: true,
        missingRates: [],
      };
    },

    async findCategoryById(id) {
      const row = await client.expenseCategory.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          receiptRequired: true,
          spendingLimit: true,
        },
      });
      if (!row) return null;
      const mapped: ExpenseCategoryRecord = {
        id: row.id,
        name: row.name,
        receiptRequired: row.receiptRequired,
        spendingLimit: money(row.spendingLimit),
      };
      return mapped;
    },

    async findLineById(id) {
      const row = await client.expense.findFirst({
        where: { id, deletedAt: null },
      });
      return row ? mapLine(row) : null;
    },

    async addLine(input) {
      const row = await client.expense.create({
        data: {
          employeeId: input.employeeId,
          entityId: input.entityId,
          reportId: input.reportId,
          description: input.description,
          amount: input.amount,
          currency: input.currency,
          date: new Date(input.date),
          categoryId: input.categoryId,
          travelRequestId: input.travelRequestId,
          notes: input.notes,
          status: "pending",
        },
      });
      return mapLine(row);
    },

    async updateLine(id, input) {
      const row = await client.expense.update({
        where: { id },
        data: {
          ...(input.description !== undefined && {
            description: input.description,
          }),
          ...(input.amount !== undefined && { amount: input.amount }),
          ...(input.currency !== undefined && { currency: input.currency }),
          ...(input.date !== undefined && { date: new Date(input.date) }),
          ...(input.categoryId !== undefined && {
            categoryId: input.categoryId,
          }),
          ...(input.notes !== undefined && { notes: input.notes }),
        },
      });
      return mapLine(row);
    },

    async softDeleteLine(id) {
      await client.expense.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    },
  };
}

export function createHyperdriveExpensesStore(
  env: RuntimeBindings,
): ExpensesStore {
  const client = createPrismaClient(hyperdriveConnectionString(env));
  return createPrismaExpensesStore(client);
}
