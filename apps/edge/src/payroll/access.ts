export const PAYROLL_READ = "payroll:read";
export const PAYROLL_CREATE = "payroll:create";
export const PAYROLL_APPROVE = "payroll:approve";
export const PAYROLL_HR_ADMIN = "payroll:hr-admin";

export function canReadPayroll(permissions: ReadonlySet<string>): boolean {
  return permissions.has(PAYROLL_READ);
}

export function isPayrollManager(permissions: ReadonlySet<string>): boolean {
  return (
    permissions.has(PAYROLL_CREATE) ||
    permissions.has(PAYROLL_APPROVE) ||
    permissions.has(PAYROLL_HR_ADMIN)
  );
}
