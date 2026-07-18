export const LEAVE_READ = "leave:read";
export const LEAVE_HR_READ = "leave:hr-read";
export const LEAVE_REQUEST = "leave:request";

export function hasLeavePermission(
  permissions: ReadonlySet<string>,
  permission: string,
): boolean {
  return permissions.has(permission);
}

export function canReadLeave(permissions: ReadonlySet<string>): boolean {
  return permissions.has(LEAVE_READ) || permissions.has(LEAVE_HR_READ);
}
