export const DEALS_READ = "deals:read";
export const DEALS_CREATE = "deals:create";
export const DEALS_UPDATE = "deals:update";
export const CRM_TEAM_READ = "crm:team-read";

export function hasDealPermission(
  permissions: ReadonlySet<string>,
  permission: string,
): boolean {
  return permissions.has(permission);
}
