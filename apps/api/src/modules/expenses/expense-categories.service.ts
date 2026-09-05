/**
 * Expense category CRUD and per-category spending overview.
 */

import type { Prisma } from "@nexora/database";

import { PERMISSIONS } from "@/common/constants/permissions";
import { NotFoundException } from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import { expensesRepository } from "@/modules/expenses/expenses.repository";
import type {
  CreateCategoryInput,
  UpdateCategoryInput,
} from "@/modules/expenses/expenses.validation";

async function listCategories() {
  return expensesRepository.findCategories();
}

async function createCategory(input: CreateCategoryInput) {
  return expensesRepository.createCategory({
    name: input.name,
    description: input.description,
    glAccountId: input.glAccountId,
    isActive: input.isActive,
    spendingLimit: input.spendingLimit,
    limitPeriod: input.limitPeriod,
    receiptRequired: input.receiptRequired,
    isAllowance: input.isAllowance,
  });
}

async function updateCategory(id: string, input: UpdateCategoryInput) {
  const existing = await expensesRepository.findCategoryById(id);
  if (!existing) throw new NotFoundException("Expense category not found");
  return expensesRepository.updateCategory(id, input);
}

async function deleteCategory(id: string) {
  const existing = await expensesRepository.findCategoryById(id);
  if (!existing) throw new NotFoundException("Expense category not found");
  return expensesRepository.deleteCategoryById(id);
}

async function getCategorySpendingOverview(
  userPermissions: string[],
  userId: string,
  startDate?: string,
  endDate?: string,
) {
  const hasHrRead = userPermissions.includes(PERMISSIONS.EXPENSE_HR_READ);
  const where: Record<string, unknown> = {
    status: { in: ["approved", "reimbursed"] },
  };
  if (!hasHrRead) where.employeeId = userId;
  if (startDate || endDate) {
    const date: Record<string, Date> = {};
    if (startDate) date.gte = new Date(startDate);
    if (endDate) date.lte = new Date(endDate);
    where.date = date;
  }

  const rows = await prisma.expense.groupBy({
    by: ["categoryId"],
    where: where as Prisma.ExpenseWhereInput,
    _sum: { amount: true },
    _count: { _all: true },
  });

  const categoryIds = rows
    .map((r) => r.categoryId)
    .filter((id): id is string => !!id);
  const categories = await prisma.expenseCategory.findMany({
    where: { id: { in: categoryIds } },
    select: { id: true, name: true, spendingLimit: true, limitPeriod: true },
  });
  const catMap = new Map(categories.map((c) => [c.id, c]));

  return {
    data: rows.map((r) => {
      const cat = r.categoryId ? catMap.get(r.categoryId) : null;
      return {
        categoryId: r.categoryId,
        categoryName: cat?.name ?? "Uncategorized",
        totalAmount: Number(r._sum.amount ?? 0),
        count: r._count._all,
        spendingLimit: cat?.spendingLimit ? Number(cat.spendingLimit) : null,
        limitPeriod: cat?.limitPeriod ?? null,
      };
    }),
  };
}

export const expenseCategoriesService = {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategorySpendingOverview,
};
