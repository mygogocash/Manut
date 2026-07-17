/**
 * Expense service facade — composes the four domain sub-services into a
 * single object so callers (`expenses.controller`, `cron.controller`,
 * tests) don't need to know about the internal split.
 *
 * Sub-service files:
 *   expense-items.service.ts     — individual expense CRUD + approval
 *   expense-reports.service.ts   — monthly report workflow
 *   expense-categories.service.ts — category CRUD + spending overview
 *   expense-settings.service.ts  — approval chain, exchange rates, notifications
 *   expense-shared.ts            — shared utilities and types
 */

import { expenseCategoriesService } from "@/modules/expenses/expense-categories.service";
import { expenseItemsService } from "@/modules/expenses/expense-items.service";
import { expenseReportsService } from "@/modules/expenses/expense-reports.service";
import { expenseSettingsService } from "@/modules/expenses/expense-settings.service";

export type {
  ExpenseRecipient,
  ExpenseRecipientMode,
} from "@/modules/expenses/expense-shared";
export {
  currentExpensePeriodBangkok,
  expenseReminderVariantForEntityCode,
  isExpenseReminderDayBangkok,
} from "@/modules/expenses/expense-shared";

export const expensesService = {
  ...expenseItemsService,
  ...expenseReportsService,
  ...expenseCategoriesService,
  ...expenseSettingsService,
};
