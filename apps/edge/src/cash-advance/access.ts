export const CASH_ADVANCE_READ = "cash-advance:read";
export const CASH_ADVANCE_CREATE = "cash-advance:create";
export const CASH_ADVANCE_READ_ALL = "cash-advance:read-all";
export const CASH_ADVANCE_APPROVE = "cash-advance:approve";

export function hasCashAdvancePermission(
  permissions: ReadonlySet<string>,
  permission: string,
): boolean {
  return permissions.has(permission);
}

export function canReadCashAdvance(permissions: ReadonlySet<string>): boolean {
  return (
    permissions.has(CASH_ADVANCE_READ) ||
    permissions.has(CASH_ADVANCE_READ_ALL) ||
    permissions.has(CASH_ADVANCE_APPROVE)
  );
}
