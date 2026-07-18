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
  };
}

export type ExpensesService = ReturnType<typeof createExpensesService>;
