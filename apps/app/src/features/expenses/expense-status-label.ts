import type { ExpenseReportStatus } from "@manut/app-core";

/**
 * Human-facing labels for expense report statuses.
 *
 * TODO(you): keep these Title Case and aligned with web EXPENSE_STATUS_LABELS.
 * Prefer clarity over enum casing — e.g. "Payroll Processed" not "payroll_processed".
 */
export function expenseStatusLabel(status: ExpenseReportStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "submitted":
      return "Submitted";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "payroll_processed":
      return "Payroll Processed";
    case "reimbursed":
      return "Reimbursed";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
