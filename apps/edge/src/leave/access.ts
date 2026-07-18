export const LEAVE_READ = "leave:read";
export const LEAVE_HR_READ = "leave:hr-read";
export const LEAVE_REQUEST = "leave:request";
export const LEAVE_APPROVE = "leave:approve";
export const LEAVE_APPROVE_WFH = "leave:approve-wfh";

export function hasLeavePermission(
  permissions: ReadonlySet<string>,
  permission: string,
): boolean {
  return permissions.has(permission);
}

export function canReadLeave(permissions: ReadonlySet<string>): boolean {
  return permissions.has(LEAVE_READ) || permissions.has(LEAVE_HR_READ);
}

export function canRouteApproveLeave(
  permissions: ReadonlySet<string>,
): boolean {
  return (
    permissions.has(LEAVE_APPROVE) || permissions.has(LEAVE_HR_READ)
  );
}
