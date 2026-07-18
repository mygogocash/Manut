import { HttpError } from "../http-error";
import {
  canReadExpenses,
  EXPENSE_CREATE,
  EXPENSE_HR_APPROVE,
  EXPENSE_HR_READ,
  hasExpensePermission,
} from "./access";
import type { ExpenseReportRecord, ExpensesStore } from "./store";

const CATEGORIES = new Set([
  "general",
  "business_or_bd",
  "allowance",
  "office",
]);

function asIso(value: string | Date | null | undefined): string | null {
  if (value == null) return null;
  return value instanceof Date ? value.toISOString() : value;
}

function serializeReport(raw: ExpenseReportRecord): Record<string, unknown> {
  return {
    id: raw.id,
    period: raw.period,
    title: raw.title,
    category: raw.category,
    status: raw.status,
    submittedAt: asIso(raw.submittedAt),
    approvedAt: asIso(raw.approvedAt),
    rejectReason: raw.rejectReason,
    reimbursedAt: asIso(raw.reimbursedAt),
    totalAmount: raw.totalAmount,
    totalCurrency: raw.totalCurrency,
    converted: raw.converted,
    missingRates: raw.missingRates,
    approvedTotal: raw.approvedTotal,
    createdAt: asIso(raw.createdAt),
    updatedAt: asIso(raw.updatedAt),
    employee: {
      id: raw.employeeId,
      name: raw.employeeName,
      email: raw.employeeEmail,
      department: raw.employeeDepartment,
    },
    entity: {
      id: raw.entityId,
      name: raw.entityName,
    },
    _count: { expenses: raw.expenseCount },
  };
}

function assertCanUseOfficeCategory(
  category: string | undefined,
  permissions: Set<string>,
): void {
  if (category !== "office") return;
  if (
    !hasExpensePermission(permissions, EXPENSE_HR_APPROVE) &&
    !hasExpensePermission(permissions, EXPENSE_HR_READ)
  ) {
    throw new HttpError(
      403,
      "FORBIDDEN",
      "Office category requires HR expense permission.",
    );
  }
}

export function createExpensesService(store: ExpensesStore) {
  return {
    async list(
      userId: string,
      query: {
        page: number;
        limit: number;
        status?: string;
        period?: string;
      },
    ) {
      const permissions = await store.loadPermissions(userId);
      if (!canReadExpenses(permissions)) {
        throw new HttpError(403, "FORBIDDEN", "Missing required permission.");
      }

      // Self-scoped only. pendingForMe / includeAll stay on Express.
      const { data, total } = await store.findMany(
        {
          employeeId: userId,
          status: query.status,
          period: query.period,
        },
        query.page,
        query.limit,
      );

      return {
        data: data.map(serializeReport),
        meta: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
        },
      };
    },

    async create(
      userId: string,
      input: {
        entityId: string;
        period: string;
        title: string;
        category?: string;
        notes?: string;
      },
    ) {
      const permissions = await store.loadPermissions(userId);
      if (!hasExpensePermission(permissions, EXPENSE_CREATE)) {
        throw new HttpError(403, "FORBIDDEN", "Missing required permission.");
      }

      const title = input.title.trim();
      if (!title) {
        throw new HttpError(400, "INVALID_EXPENSE", "Title is required.");
      }
      if (!/^\d{4}-(0[1-9]|1[0-2])$/u.test(input.period)) {
        throw new HttpError(
          400,
          "INVALID_EXPENSE",
          "Period must be YYYY-MM.",
        );
      }
      if (!input.entityId.trim()) {
        throw new HttpError(400, "INVALID_EXPENSE", "Entity is required.");
      }

      const category = input.category?.trim() || "general";
      if (!CATEGORIES.has(category)) {
        throw new HttpError(400, "INVALID_EXPENSE", "Invalid category.");
      }
      assertCanUseOfficeCategory(category, permissions);

      const created = await store.create({
        employeeId: userId,
        entityId: input.entityId.trim(),
        period: input.period,
        title,
        category,
        notes: input.notes,
      });

      return { data: serializeReport(created) };
    },

    async getOwn(userId: string, reportId: string) {
      const permissions = await store.loadPermissions(userId);
      if (!canReadExpenses(permissions)) {
        throw new HttpError(403, "FORBIDDEN", "Missing required permission.");
      }

      const report = await store.findById(reportId);
      if (!report) {
        throw new HttpError(404, "NOT_FOUND", "Expense report not found.");
      }
      if (report.employeeId !== userId) {
        // Manager / approver / HR detail stays on Express.
        throw new HttpError(
          403,
          "EXPENSE_DETAIL_NOT_SELF",
          "Non-self expense detail remains on the API origin.",
        );
      }

      return { data: serializeReport(report) };
    },

    async addLine(
      userId: string,
      reportId: string,
      input: {
        description: string;
        amount: number;
        currency: string;
        date: string;
        categoryId?: string;
        travelRequestId?: string;
        notes?: string;
      },
    ) {
      const permissions = await store.loadPermissions(userId);
      if (!hasExpensePermission(permissions, EXPENSE_CREATE)) {
        throw new HttpError(403, "FORBIDDEN", "Missing required permission.");
      }

      const report = await store.findById(reportId);
      if (!report) {
        throw new HttpError(404, "NOT_FOUND", "Expense report not found");
      }
      if (report.employeeId !== userId) {
        throw new HttpError(
          403,
          "FORBIDDEN",
          "You can only edit your own reports",
        );
      }
      if (report.status !== "draft" && report.status !== "rejected") {
        throw new HttpError(
          400,
          "INVALID_EXPENSE",
          `Cannot add expenses to a report with status "${report.status}"`,
        );
      }

      const description = input.description.trim();
      if (!description) {
        throw new HttpError(400, "INVALID_EXPENSE", "Description is required.");
      }
      if (!Number.isFinite(input.amount) || input.amount <= 0) {
        throw new HttpError(
          400,
          "INVALID_EXPENSE",
          "Amount must be a positive number.",
        );
      }
      if (!/^\d{4}-\d{2}-\d{2}$/u.test(input.date)) {
        throw new HttpError(400, "INVALID_EXPENSE", "Date must be YYYY-MM-DD.");
      }

      if (input.categoryId) {
        const category = await store.findCategoryById(input.categoryId);
        if (category) {
          if (category.receiptRequired) {
            throw new HttpError(
              400,
              "INVALID_EXPENSE",
              `Category "${category.name}" requires a receipt`,
            );
          }
          if (
            category.spendingLimit != null &&
            input.amount > category.spendingLimit
          ) {
            throw new HttpError(
              400,
              "INVALID_EXPENSE",
              `Amount exceeds category spending limit of ${category.spendingLimit}`,
            );
          }
        }
      }

      const line = await store.addLine({
        reportId,
        employeeId: userId,
        entityId: report.entityId,
        description,
        amount: input.amount,
        currency: input.currency.trim().toUpperCase() || "THB",
        date: input.date,
        categoryId: input.categoryId,
        travelRequestId: input.travelRequestId,
        notes: input.notes?.trim() || undefined,
      });

      return {
        data: {
          id: line.id,
          description: line.description,
          amount: line.amount,
          currency: line.currency,
          date: line.date,
          status: line.status,
        },
      };
    },

    async updateLine(
      userId: string,
      reportId: string,
      expenseId: string,
      input: {
        description?: string;
        amount?: number;
        currency?: string;
        date?: string;
        categoryId?: string | null;
        notes?: string | null;
      },
    ) {
      const permissions = await store.loadPermissions(userId);
      if (!hasExpensePermission(permissions, EXPENSE_CREATE)) {
        throw new HttpError(403, "FORBIDDEN", "Missing required permission.");
      }

      const report = await store.findById(reportId);
      if (!report) {
        throw new HttpError(404, "NOT_FOUND", "Expense report not found");
      }
      if (report.employeeId !== userId) {
        throw new HttpError(
          403,
          "FORBIDDEN",
          "You can only edit your own reports",
        );
      }
      if (report.status !== "draft" && report.status !== "rejected") {
        throw new HttpError(
          400,
          "INVALID_EXPENSE",
          `Cannot edit expenses in a report with status "${report.status}"`,
        );
      }

      const expense = await store.findLineById(expenseId);
      if (!expense || expense.reportId !== reportId) {
        throw new HttpError(
          404,
          "NOT_FOUND",
          "Expense not found in this report",
        );
      }

      const line = await store.updateLine(expenseId, {
        description: input.description?.trim(),
        amount: input.amount,
        currency: input.currency?.trim().toUpperCase(),
        date: input.date,
        categoryId: input.categoryId,
        notes: input.notes,
      });

      return {
        data: {
          id: line.id,
          description: line.description,
          amount: line.amount,
          currency: line.currency,
          date: line.date,
          status: line.status,
        },
      };
    },

    async removeLine(userId: string, reportId: string, expenseId: string) {
      const permissions = await store.loadPermissions(userId);
      if (!hasExpensePermission(permissions, EXPENSE_CREATE)) {
        throw new HttpError(403, "FORBIDDEN", "Missing required permission.");
      }

      const report = await store.findById(reportId);
      if (!report) {
        throw new HttpError(404, "NOT_FOUND", "Expense report not found");
      }
      if (report.employeeId !== userId) {
        throw new HttpError(
          403,
          "FORBIDDEN",
          "You can only edit your own reports",
        );
      }
      if (report.status !== "draft" && report.status !== "rejected") {
        throw new HttpError(
          400,
          "INVALID_EXPENSE",
          `Cannot remove expenses from a report with status "${report.status}"`,
        );
      }

      const expense = await store.findLineById(expenseId);
      if (!expense || expense.reportId !== reportId) {
        throw new HttpError(
          404,
          "NOT_FOUND",
          "Expense not found in this report",
        );
      }

      await store.softDeleteLine(expenseId);
      return { data: { success: true } };
    },
  };
}

export type ExpensesService = ReturnType<typeof createExpensesService>;
