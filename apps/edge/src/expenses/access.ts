export const EXPENSE_READ = "expense:read";
export const EXPENSE_CREATE = "expense:create";
export const EXPENSE_HR_READ = "expense:hr-read";
export const EXPENSE_HR_APPROVE = "expense:hr-approve";

export function hasExpensePermission(
  permissions: ReadonlySet<string>,
  permission: string,
): boolean {
  return permissions.has(permission);
}

export function canReadExpenses(permissions: ReadonlySet<string>): boolean {
  return (
    permissions.has(EXPENSE_READ) || permissions.has(EXPENSE_HR_READ)
  );
}
