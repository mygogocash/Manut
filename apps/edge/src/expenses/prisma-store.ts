import { createPrismaClient, type PrismaClient } from "@manut/database";

import { hyperdriveConnectionString } from "../hyperdrive";
import { loadUserPermissions } from "../rbac";
import type { RuntimeBindings } from "../runtime";
import type {
  ExpenseApprovalDecisionRecord,
  ExpenseApprovalStepRecord,
  ExpenseCategoryRecord,
  ExpenseLineFxRecord,
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
  receiptUrl: string | null;
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
    receiptUrl: row.receiptUrl,
  };
}

function asDate(value: Date | string): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return value.slice(0, 10);
}

function asIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : value;
}

function money(
  value: { toNumber?: () => number } | number | string | null,
): number | null {
  if (value == null) return null;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof value.toNumber === "function") return value.toNumber();
  return Number(value);
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

async function findExchangeRateValue(
  client: PrismaClient,
  baseCurrency: string,
  currency: string,
  asOf?: Date,
): Promise<number | null> {
  if (asOf) {
    const dated = await client.exchangeRate.findFirst({
      where: { baseCurrency, currency, effectiveDate: { lte: asOf } },
      orderBy: { effectiveDate: "desc" },
      select: { rate: true },
    });
    if (dated) return Number(dated.rate);
  }
  const latest = await client.exchangeRate.findFirst({
    where: { baseCurrency, currency },
    orderBy: { effectiveDate: "desc" },
    select: { rate: true },
  });
  return latest ? Number(latest.rate) : null;
}

async function resolveDirectOrInverse(
  client: PrismaClient,
  from: string,
  to: string,
  asOf?: Date,
): Promise<number | null> {
  if (from === to) return 1;
  const direct = await findExchangeRateValue(client, from, to, asOf);
  if (direct !== null) return direct;
  const inverse = await findExchangeRateValue(client, to, from, asOf);
  if (inverse !== null) return 1 / inverse;
  return null;
}

async function resolveRate(
  client: PrismaClient,
  fromCurrency: string,
  toCurrency: string,
  asOf?: Date,
): Promise<number | null> {
  const from = fromCurrency.trim().toUpperCase();
  const to = toCurrency.trim().toUpperCase();
  if (from === to) return 1;

  const direct = await findExchangeRateValue(client, from, to, asOf);
  if (direct !== null) return direct;

  const inverse = await findExchangeRateValue(client, to, from, asOf);
  if (inverse !== null) return 1 / inverse;

  for (const bridge of ["USD", "THB", "EUR"] as const) {
    if (bridge === from || bridge === to) continue;
    const leg1 = await resolveDirectOrInverse(client, from, bridge, asOf);
    if (leg1 === null) continue;
    const leg2 = await resolveDirectOrInverse(client, bridge, to, asOf);
    if (leg2 === null) continue;
    return leg1 * leg2;
  }
  return null;
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
    select: { amount: true, currency: true, date: true },
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
    const rate = await resolveRate(client, currency, "THB", line.date);
    if (rate === null) {
      if (!missing.includes(currency)) missing.push(currency);
      continue;
    }
    thb += Math.round(amount * rate * 100) / 100;
  }

  if (missing.length > 0) {
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
  currentStepOrder: number | null;
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
    currentStepOrder: raw.currentStepOrder,
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

async function loadReport(
  client: PrismaClient,
  id: string,
): Promise<ExpenseReportRecord | null> {
  const row = await client.expenseReport.findFirst({
    where: { id, deletedAt: null },
    include: REPORT_INCLUDES,
  });
  if (!row) return null;
  const totals = await computeReportTotal(client, row.id);
  return { ...mapBase(row), ...totals };
}

export function createPrismaExpensesStore(client: PrismaClient): ExpensesStore {
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
        employeeId?: string;
        id?: { in: string[] };
        status?: string;
        period?: string;
      } = {
        deletedAt: null,
      };
      if (filters.employeeId) where.employeeId = filters.employeeId;
      if (filters.reportIds) where.id = { in: filters.reportIds };
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
      return loadReport(client, id);
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
          isAllowance: true,
        },
      });
      if (!row) return null;
      const mapped: ExpenseCategoryRecord = {
        id: row.id,
        name: row.name,
        receiptRequired: row.receiptRequired,
        spendingLimit: money(row.spendingLimit),
        isAllowance: row.isAllowance,
      };
      return mapped;
    },

    async findLineById(id) {
      const row = await client.expense.findFirst({
        where: { id, deletedAt: null },
      });
      return row ? mapLine(row) : null;
    },

    async findLinesForReport(reportId) {
      const rows = await client.expense.findMany({
        where: { reportId, deletedAt: null },
        select: {
          id: true,
          amount: true,
          currency: true,
          date: true,
          categoryId: true,
        },
      });
      return rows.map(
        (row): ExpenseLineFxRecord => ({
          id: row.id,
          amount: money(row.amount) ?? 0,
          currency: row.currency.trim().toUpperCase(),
          date: asDate(row.date),
          categoryId: row.categoryId,
        }),
      );
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
          receiptUrl: input.receiptUrl ?? null,
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
          ...(input.receiptUrl !== undefined && {
            receiptUrl: input.receiptUrl,
          }),
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

    async findPendingForMeReportIds(userId) {
      const pendingDecisions = await client.expenseApprovalDecision.findMany({
        where: {
          status: "pending",
          expenseReport: { status: "submitted", deletedAt: null },
          OR: [
            { approverType: "user", approverUserId: userId },
            {
              approverType: "manager",
              expenseReport: {
                employee: { reportingTo: userId, isActive: true },
              },
            },
          ],
        },
        select: {
          expenseReportId: true,
          order: true,
          expenseReport: { select: { currentStepOrder: true } },
        },
      });
      const currentStepIds = pendingDecisions
        .filter((d) => d.order === d.expenseReport.currentStepOrder)
        .map((d) => d.expenseReportId);

      const legacy = await client.expenseReport.findMany({
        where: {
          status: "submitted",
          deletedAt: null,
          approvalDecisions: { none: {} },
          employee: { reportingTo: userId, isActive: true },
        },
        select: { id: true },
      });

      const managerBackup = await client.expenseReport.findMany({
        where: {
          status: "submitted",
          deletedAt: null,
          employee: { reportingTo: userId, isActive: true },
        },
        select: { id: true },
      });

      return Array.from(
        new Set([
          ...currentStepIds,
          ...legacy.map((r) => r.id),
          ...managerBackup.map((r) => r.id),
        ]),
      );
    },

    async findActiveApprovalSteps() {
      const rows = await client.expenseApprovalStep.findMany({
        where: { isActive: true },
        orderBy: { order: "asc" },
      });
      return rows.map(
        (row): ExpenseApprovalStepRecord => ({
          id: row.id,
          order: row.order,
          name: row.name,
          approverType: row.approverType,
          approverUserId: row.approverUserId,
          skipWhenSubmitterIds: asStringArray(row.skipWhenSubmitterIds),
          onlyWhenSubmitterIds: asStringArray(row.onlyWhenSubmitterIds),
          categoryFilter: asStringArray(row.categoryFilter),
          amountMinBaht: money(row.amountMinBaht),
          amountMaxBaht: money(row.amountMaxBaht),
          isActive: row.isActive,
        }),
      );
    },

    async findDecisions(reportId) {
      const rows = await client.expenseApprovalDecision.findMany({
        where: { expenseReportId: reportId },
        orderBy: { order: "asc" },
      });
      return rows.map(
        (row): ExpenseApprovalDecisionRecord => ({
          id: row.id,
          order: row.order,
          name: row.name,
          approverType: row.approverType,
          approverUserId: row.approverUserId,
          status: row.status,
          approvedAmount: money(row.approvedAmount),
        }),
      );
    },

    async findManagerChain(userId) {
      const submitter = await client.user.findUnique({
        where: { id: userId },
        select: { reportingTo: true },
      });
      if (!submitter?.reportingTo) {
        return { l1UserId: null, l2UserId: null };
      }
      const l1 = await client.user.findUnique({
        where: { id: submitter.reportingTo },
        select: { reportingTo: true },
      });
      return {
        l1UserId: submitter.reportingTo,
        l2UserId: l1?.reportingTo ?? null,
      };
    },

    async findEmployeeReportingTo(employeeId) {
      const row = await client.user.findUnique({
        where: { id: employeeId },
        select: { reportingTo: true },
      });
      return row?.reportingTo ?? null;
    },

    async findCategoriesAllowance(categoryIds) {
      if (categoryIds.length === 0) return [];
      const unique = Array.from(new Set(categoryIds));
      return client.expenseCategory.findMany({
        where: { id: { in: unique } },
        select: { id: true, isAllowance: true },
      });
    },

    async findExchangeRate(baseCurrency, currency, asOf) {
      return findExchangeRateValue(client, baseCurrency, currency, asOf);
    },

    async snapshotDecisions(id, rows) {
      await client.$transaction(async (tx) => {
        await tx.expenseApprovalDecision.deleteMany({
          where: { expenseReportId: id },
        });
        if (rows.length > 0) {
          await tx.expenseApprovalDecision.createMany({
            data: rows.map((row) => ({
              expenseReportId: id,
              order: row.order,
              name: row.name,
              approverType: row.approverType,
              approverUserId: row.approverUserId,
              status: "pending",
            })),
          });
        }
        await tx.expenseReport.update({
          where: { id },
          data: { currentStepOrder: 1 },
        });
      });
    },

    async submitWithDecisions(id, rows, opts) {
      await client.$transaction(async (tx) => {
        await tx.expenseApprovalDecision.deleteMany({
          where: { expenseReportId: id },
        });
        if (rows.length > 0) {
          await tx.expenseApprovalDecision.createMany({
            data: rows.map((row) => ({
              expenseReportId: id,
              order: row.order,
              name: row.name,
              approverType: row.approverType,
              approverUserId: row.approverUserId,
              status: "pending",
            })),
          });
        }
        await tx.expenseReport.update({
          where: { id },
          data: {
            status: "submitted",
            submittedAt: new Date(),
            rejectReason: null,
            currentStepOrder: 1,
            ...(opts?.category ? { category: opts.category } : {}),
          },
        });
      });
      const loaded = await loadReport(client, id);
      if (!loaded) throw new Error("Expense report missing after submit");
      return loaded;
    },

    async finaliseAllowance(id, actorId) {
      const now = new Date();
      await client.$transaction(async (tx) => {
        await tx.expenseReport.update({
          where: { id },
          data: {
            status: "reimbursed",
            submittedAt: now,
            approvedBy: actorId,
            approvedAt: now,
            reimbursedAt: now,
            rejectReason: null,
            currentStepOrder: null,
          },
        });
        await tx.expense.updateMany({
          where: { reportId: id, deletedAt: null },
          data: {
            status: "reimbursed",
            approvedBy: actorId,
            approvedAt: now,
            reimbursedAt: now,
          },
        });
      });
      const loaded = await loadReport(client, id);
      if (!loaded) throw new Error("Expense report missing after allowance");
      return loaded;
    },

    async approveStep(input) {
      await client.$transaction(async (tx) => {
        await tx.expenseApprovalDecision.update({
          where: { id: input.decisionId },
          data: {
            status: "approved",
            decidedById: input.approverId,
            decidedAt: new Date(),
            approvedAmount: input.approvedAmount,
            notes: input.notes,
          },
        });
        await tx.expenseReport.update({
          where: { id: input.reportId },
          data: {
            status: input.isFinalStep ? "approved" : "submitted",
            approvedBy: input.isFinalStep ? input.approverId : undefined,
            approvedAt: input.isFinalStep ? new Date() : undefined,
            approvedTotal: input.isFinalStep
              ? input.finalApprovedTotal
              : undefined,
            rejectReason: null,
            currentStepOrder: input.nextStepOrder,
          },
        });
        if (input.isFinalStep) {
          await tx.expense.updateMany({
            where: { reportId: input.reportId, deletedAt: null },
            data: {
              status: "approved",
              approvedBy: input.approverId,
              approvedAt: new Date(),
            },
          });
        }
      });
      const loaded = await loadReport(client, input.reportId);
      if (!loaded) throw new Error("Expense report missing after approve");
      return loaded;
    },

    async rejectStep(input) {
      await client.$transaction(async (tx) => {
        if (input.decisionId) {
          await tx.expenseApprovalDecision.update({
            where: { id: input.decisionId },
            data: {
              status: "rejected",
              decidedById: input.approverId,
              decidedAt: new Date(),
              notes: input.reason,
            },
          });
        }
        await tx.expenseReport.update({
          where: { id: input.reportId },
          data: {
            status: "rejected",
            approvedBy: input.approverId,
            approvedAt: new Date(),
            rejectReason: input.reason,
            currentStepOrder: null,
          },
        });
      });
      const loaded = await loadReport(client, input.reportId);
      if (!loaded) throw new Error("Expense report missing after reject");
      return loaded;
    },
  };
}

export function createHyperdriveExpensesStore(
  env: RuntimeBindings,
): ExpensesStore {
  const client = createPrismaClient(hyperdriveConnectionString(env));
  return createPrismaExpensesStore(client);
}
