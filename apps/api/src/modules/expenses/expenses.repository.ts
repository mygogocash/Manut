import type { Prisma } from "@manut/database";

import { prisma } from "@/infrastructure/database/prisma";
import { excludeDeleted, softDeleteUpdate } from "@/infrastructure/soft-delete";
import { createExchangeRateService } from "@/modules/exchange-rates/exchange-rates.service";

const expenseIncludes = {
  employee: { select: { id: true, name: true, email: true, department: true } },
  entity: { select: { id: true, name: true } },
  category: { select: { id: true, name: true } },
  approver: { select: { id: true, name: true, email: true } },
} satisfies Prisma.ExpenseInclude;

const reportIncludes = {
  employee: { select: { id: true, name: true, email: true, department: true } },
  entity: { select: { id: true, name: true } },
  approver: { select: { id: true, name: true, email: true } },
  _count: { select: { expenses: true } },
} satisfies Prisma.ExpenseReportInclude;

export class ExpensesRepository {
  async findExpenses(
    filters: {
      employeeId?: string;
      entityId?: string;
      categoryId?: string;
      status?: string;
      startDate?: string;
      endDate?: string;
    },
    page: number,
    limit: number,
    scopeUserIds?: string[],
  ) {
    const where: Prisma.ExpenseWhereInput = excludeDeleted("deletedAt");
    if (filters.employeeId) where.employeeId = filters.employeeId;
    else if (scopeUserIds) where.employeeId = { in: scopeUserIds };
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.status) where.status = filters.status;

    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = new Date(filters.startDate);
      if (filters.endDate) where.date.lte = new Date(filters.endDate);
    }

    const [data, total] = await Promise.all([
      prisma.expense.findMany({
        where,
        include: expenseIncludes,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.expense.count({ where }),
    ]);

    return { data, total };
  }

  async findExpenseById(id: string) {
    return prisma.expense
      .findUnique({
        where: { id },
        include: expenseIncludes,
      })
      .then((e) => (e && e.deletedAt ? null : e));
  }

  /** Like findExpenseById but returns soft-deleted rows too (restore authz). */
  async findExpenseByIdIncludingDeleted(id: string) {
    return prisma.expense.findUnique({
      where: { id },
      include: expenseIncludes,
    });
  }

  async createExpense(data: {
    employeeId: string;
    entityId: string;
    categoryId?: string;
    travelRequestId?: string;
    description: string;
    amount: number;
    currency: string;
    date: string;
    receiptUrl?: string;
    notes?: string;
  }) {
    return prisma.expense.create({
      data: {
        ...data,
        date: new Date(data.date),
      },
      include: expenseIncludes,
    });
  }

  async updateExpenseStatus(
    id: string,
    data: {
      status: string;
      approvedBy?: string;
      approvedAt?: Date;
      rejectReason?: string;
    },
  ) {
    return prisma.expense.update({
      where: { id },
      data,
      include: expenseIncludes,
    });
  }
  async updateExpense(id: string, data: Prisma.ExpenseUncheckedUpdateInput) {
    return prisma.expense.update({
      where: { id },
      data,
      include: expenseIncludes,
    });
  }

  async findAllExpenses(filters: {
    employeeId?: string;
    entityId?: string;
    categoryId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const where: Prisma.ExpenseWhereInput = excludeDeleted("deletedAt");
    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.status) where.status = filters.status;

    if (filters.startDate || filters.endDate) {
      where.date = {};
      if (filters.startDate) where.date.gte = new Date(filters.startDate);
      if (filters.endDate) where.date.lte = new Date(filters.endDate);
    }

    return prisma.expense.findMany({
      where,
      include: expenseIncludes,
      orderBy: { createdAt: "desc" },
    });
  }

  async softDeleteExpense(id: string) {
    return prisma.expense.update({
      where: { id },
      data: softDeleteUpdate("deletedAt"),
      include: expenseIncludes,
    });
  }

  async restoreExpense(id: string) {
    return prisma.expense.update({
      where: { id },
      data: { deletedAt: null },
      include: expenseIncludes,
    });
  }

  async permanentDeleteExpense(id: string) {
    return prisma.expense.delete({ where: { id } });
  }

  // ── Expense reports ──

  async findReports(
    filters: {
      employeeId?: string;
      employeeIds?: string[];
      reportIds?: string[];
      status?: string;
      period?: string;
    },
    page: number,
    limit: number,
  ) {
    const where: Prisma.ExpenseReportWhereInput = excludeDeleted("deletedAt");
    if (filters.reportIds) {
      where.id = { in: filters.reportIds };
    } else if (filters.employeeId) {
      where.employeeId = filters.employeeId;
    } else if (filters.employeeIds) {
      where.employeeId = { in: filters.employeeIds };
    }
    if (filters.status) where.status = filters.status;
    if (filters.period) where.period = filters.period;

    const [data, total] = await Promise.all([
      prisma.expenseReport.findMany({
        where,
        include: reportIncludes,
        orderBy: [{ period: "desc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.expenseReport.count({ where }),
    ]);

    return { data, total };
  }

  // ── Monthly summary (workspace-wide roll-up) ──

  // Per-period report counts split by status, computed DB-side. `year`
  // narrows to a calendar year via the YYYY-MM `period` prefix.
  async summaryReportCounts(filters: {
    employeeId?: string;
    status?: string;
    year?: string;
  }) {
    const where: Prisma.ExpenseReportWhereInput = excludeDeleted("deletedAt");
    if (filters.employeeId) where.employeeId = filters.employeeId;
    if (filters.status) where.status = filters.status;
    if (filters.year) where.period = { startsWith: `${filters.year}-` };

    return prisma.expenseReport.groupBy({
      by: ["period", "status"],
      where,
      _count: { _all: true },
    });
  }

  // Line items of matching, non-deleted reports — for the per-date THB
  // sum. `report: { is: … }` also drops orphan lines (reportId null) and
  // lines whose parent report is soft-deleted or filtered out.
  async findReportLinesForSummary(filters: {
    employeeId?: string;
    status?: string;
    year?: string;
  }) {
    const reportWhere: Prisma.ExpenseReportWhereInput =
      excludeDeleted("deletedAt");
    if (filters.employeeId) reportWhere.employeeId = filters.employeeId;
    if (filters.status) reportWhere.status = filters.status;
    if (filters.year) reportWhere.period = { startsWith: `${filters.year}-` };

    return prisma.expense.findMany({
      where: {
        ...excludeDeleted("deletedAt"),
        report: { is: reportWhere },
      },
      select: {
        amount: true,
        currency: true,
        date: true,
        reportId: true,
        report: { select: { period: true } },
      },
    });
  }

  async findReportById(id: string) {
    return prisma.expenseReport
      .findUnique({
        where: { id },
        include: {
          ...reportIncludes,
          expenses: {
            where: excludeDeleted("deletedAt"),
            include: expenseIncludes,
          },
        },
      })
      .then((r) => (r && r.deletedAt ? null : r));
  }

  /** Like findReportById but returns soft-deleted reports too (restore authz). */
  async findReportByIdIncludingDeleted(id: string) {
    return prisma.expenseReport.findUnique({
      where: { id },
      include: {
        ...reportIncludes,
        expenses: {
          where: excludeDeleted("deletedAt"),
          include: expenseIncludes,
        },
      },
    });
  }

  async createReport(data: {
    employeeId: string;
    entityId: string;
    period: string;
    title: string;
    category?: string;
    notes?: string;
  }) {
    return prisma.expenseReport.create({
      data: { ...data, status: "draft" },
      include: reportIncludes,
    });
  }

  async updateReport(
    id: string,
    data: Prisma.ExpenseReportUncheckedUpdateInput,
  ) {
    return prisma.expenseReport.update({
      where: { id },
      data,
      include: reportIncludes,
    });
  }

  async softDeleteReport(id: string) {
    return prisma.expenseReport.update({
      where: { id },
      data: softDeleteUpdate("deletedAt"),
      include: reportIncludes,
    });
  }

  async restoreReport(id: string) {
    return prisma.expenseReport.update({
      where: { id },
      data: { deletedAt: null },
      include: reportIncludes,
    });
  }

  async permanentDeleteReport(id: string) {
    return prisma.expenseReport.delete({ where: { id } });
  }

  async findReportExpenses(reportId: string) {
    return prisma.expense.findMany({
      where: { reportId, ...excludeDeleted("deletedAt") },
      include: expenseIncludes,
      orderBy: { date: "asc" },
    });
  }

  async sumReportTotal(reportId: string) {
    const result = await prisma.expense.aggregate({
      where: { reportId, ...excludeDeleted("deletedAt") },
      _sum: { amount: true },
    });
    return Number(result._sum.amount ?? 0);
  }

  /**
   * Per-currency subtotals for a report. Drives the list/detail
   * "Total" column — single-currency reports display in their native
   * currency; mixed reports get converted to THB upstream.
   */
  async sumReportTotalsByCurrency(reportId: string) {
    const rows = await prisma.expense.groupBy({
      by: ["currency"],
      where: { reportId, ...excludeDeleted("deletedAt") },
      _sum: { amount: true },
    });
    return rows.map((r) => ({
      currency: r.currency,
      amount: Number(r._sum.amount ?? 0),
    }));
  }

  // Per-line amount/currency/date — used to convert each expense to THB
  // at the rate effective on its OWN date (not one rate for the report).
  async findReportExpenseLines(reportId: string) {
    return prisma.expense.findMany({
      where: { reportId, ...excludeDeleted("deletedAt") },
      select: { amount: true, currency: true, date: true },
    });
  }

  // ── Approval chain (admin) ──

  async findApprovalSteps(opts?: { activeOnly?: boolean }) {
    return prisma.expenseApprovalStep.findMany({
      where: opts?.activeOnly ? { isActive: true } : undefined,
      orderBy: { order: "asc" },
      include: {
        approverUser: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async findApprovalStepById(id: string) {
    return prisma.expenseApprovalStep.findUnique({
      where: { id },
      include: {
        approverUser: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async createApprovalStep(data: Prisma.ExpenseApprovalStepCreateInput) {
    return prisma.expenseApprovalStep.create({
      data,
      include: {
        approverUser: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async updateApprovalStep(
    id: string,
    data: Prisma.ExpenseApprovalStepUpdateInput,
  ) {
    return prisma.expenseApprovalStep.update({
      where: { id },
      data,
      include: {
        approverUser: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async deleteApprovalStep(id: string) {
    return prisma.expenseApprovalStep.delete({ where: { id } });
  }

  async reorderApprovalSteps(orderedIds: string[]) {
    // Two-phase update so the @unique(order) constraint never sees a
    // clash. Mirrors the travel-chain reorder.
    return prisma.$transaction(async (tx) => {
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.expenseApprovalStep.update({
          where: { id: orderedIds[i]! },
          data: { order: 10000 + i },
        });
      }
      for (let i = 0; i < orderedIds.length; i++) {
        await tx.expenseApprovalStep.update({
          where: { id: orderedIds[i]! },
          data: { order: i + 1 },
        });
      }
      return tx.expenseApprovalStep.findMany({
        orderBy: { order: "asc" },
        include: {
          approverUser: { select: { id: true, name: true, email: true } },
        },
      });
    });
  }

  async nextStepOrder() {
    const last = await prisma.expenseApprovalStep.findFirst({
      orderBy: { order: "desc" },
      select: { order: true },
    });
    return (last?.order ?? 0) + 1;
  }

  // ── Per-report decisions ──

  async createDecisions(
    expenseReportId: string,
    rows: Array<{
      order: number;
      name: string;
      approverType: string;
      approverUserId?: string | null;
    }>,
  ) {
    return prisma.expenseApprovalDecision.createMany({
      data: rows.map((r) => ({
        expenseReportId,
        order: r.order,
        name: r.name,
        approverType: r.approverType,
        approverUserId: r.approverUserId ?? null,
      })),
    });
  }

  async findDecisions(expenseReportId: string) {
    return prisma.expenseApprovalDecision.findMany({
      where: { expenseReportId },
      orderBy: { order: "asc" },
      include: {
        approverUser: { select: { id: true, name: true, email: true } },
        decidedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async updateDecision(
    id: string,
    data: Prisma.ExpenseApprovalDecisionUpdateInput,
  ) {
    return prisma.expenseApprovalDecision.update({ where: { id }, data });
  }

  async deleteDecisionsForReport(expenseReportId: string) {
    return prisma.expenseApprovalDecision.deleteMany({
      where: { expenseReportId },
    });
  }

  /**
   * Reassign any still-pending decisions whose snapshotted step name
   * matches `stepName` to the given approver. Mirrors the travel
   * cascade — admin chain edits propagate to in-flight reports
   * without rewriting already-decided rows.
   */
  async reassignPendingDecisionsByStepName(
    stepName: string,
    approverUserId: string | null,
  ) {
    const res = await prisma.expenseApprovalDecision.updateMany({
      where: { name: stepName, status: "pending" },
      data: { approverUserId },
    });
    return res.count;
  }

  // ── ExpenseCategory CRUD ──

  async findCategories() {
    return prisma.expenseCategory.findMany({ orderBy: { name: "asc" } });
  }

  async findCategoryById(id: string) {
    return prisma.expenseCategory.findUnique({ where: { id } });
  }

  async createCategory(data: {
    name: string;
    description?: string;
    glAccountId?: string;
    isActive?: boolean;
    spendingLimit?: number;
    limitPeriod?: string;
    receiptRequired?: boolean;
    isAllowance?: boolean;
  }) {
    return prisma.expenseCategory.create({ data });
  }

  async updateCategory(
    id: string,
    data: {
      name?: string;
      description?: string;
      glAccountId?: string;
      isActive?: boolean;
      spendingLimit?: number;
      limitPeriod?: string;
      receiptRequired?: boolean;
      isAllowance?: boolean;
    },
  ) {
    return prisma.expenseCategory.update({ where: { id }, data });
  }

  async deleteCategoryById(id: string) {
    return prisma.expenseCategory.delete({ where: { id } });
  }

  // ── Exchange Rates ──

  async findExchangeRates(baseCurrency: string, date?: string) {
    const where: Prisma.ExchangeRateWhereInput = { baseCurrency };
    if (date) {
      where.effectiveDate = { lte: new Date(date) };
    }
    return prisma.exchangeRate.findMany({
      where,
      orderBy: [{ currency: "asc" }, { effectiveDate: "desc" }],
      distinct: date ? ["currency"] : undefined,
    });
  }

  async upsertExchangeRate(data: {
    baseCurrency: string;
    currency: string;
    rate: number;
    effectiveDate: string;
    source?: string;
  }) {
    const effectiveDate = new Date(data.effectiveDate);
    return prisma.exchangeRate.upsert({
      where: {
        baseCurrency_currency_effectiveDate: {
          baseCurrency: data.baseCurrency,
          currency: data.currency,
          effectiveDate,
        },
      },
      update: { rate: data.rate, source: data.source },
      create: {
        baseCurrency: data.baseCurrency,
        currency: data.currency,
        rate: data.rate,
        effectiveDate,
        source: data.source ?? "manual",
      },
    });
  }

  async findLatestRate(baseCurrency: string, currency: string) {
    return prisma.exchangeRate.findFirst({
      where: { baseCurrency, currency },
      orderBy: { effectiveDate: "desc" },
    });
  }

  async convertAmount(
    amount: number,
    fromCurrency: string,
    toCurrency: string,
    // Value the conversion at the rate effective on this date (e.g. the
    // expense's own date). Omitted → latest rate.
    asOf?: Date,
  ): Promise<{ converted: number; rate: number } | null> {
    const from = fromCurrency.trim().toUpperCase();
    const to = toCurrency.trim().toUpperCase();
    if (from === to) return { converted: amount, rate: 1 };

    const lookup = await createExchangeRateService().resolveRate(
      from,
      to,
      asOf,
    );
    if (lookup.source === "missing") return null;

    const rate = lookup.rate;
    return {
      converted: Math.round(amount * rate * 100) / 100,
      rate,
    };
  }
}

export const expensesRepository = new ExpensesRepository();
