export const VISA_READ = "visa:read";
export const VISA_HR_READ = "visa:hr-read";
export const VISA_MANAGE = "visa:manage";

export function canReadVisa(permissions: ReadonlySet<string>): boolean {
  return (
    permissions.has(VISA_READ) ||
    permissions.has(VISA_HR_READ) ||
    permissions.has(VISA_MANAGE)
  );
}

export function canManageVisa(permissions: ReadonlySet<string>): boolean {
  return permissions.has(VISA_MANAGE);
}
