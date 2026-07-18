export const PROJECTS_READ = "projects:read";
export const PROJECTS_READ_ALL = "projects:read-all";
export const PROJECTS_UPDATE = "projects:update";
export const PROJECTS_MANAGE = "projects:manage";

export const IT_CRM_READ = "it-crm:read";
export const IT_CRM_READ_ALL = "it-crm:read-all";
export const IT_CRM_UPDATE = "it-crm:update";
export const IT_CRM_MANAGE = "it-crm:manage";
export const IT_READ_ALL = "it:read-all";

export const PRODUCT_CRM_READ = "product-crm:read";
export const PRODUCT_CRM_READ_ALL = "product-crm:read-all";
export const PRODUCT_CRM_UPDATE = "product-crm:update";
export const PRODUCT_CRM_MANAGE = "product-crm:manage";

export const LEGAL_CRM_READ = "legal-crm:read";
export const LEGAL_CRM_READ_ALL = "legal-crm:read-all";
export const LEGAL_CRM_UPDATE = "legal-crm:update";
export const LEGAL_CRM_MANAGE = "legal-crm:manage";

export const ACCOUNTING_CRM_READ = "accounting-crm:read";
export const ACCOUNTING_CRM_READ_ALL = "accounting-crm:read-all";
export const ACCOUNTING_CRM_UPDATE = "accounting-crm:update";
export const ACCOUNTING_CRM_MANAGE = "accounting-crm:manage";

export const HR_CRM_READ = "hr-crm:read";
export const HR_CRM_READ_ALL = "hr-crm:read-all";
export const HR_CRM_UPDATE = "hr-crm:update";
export const HR_CRM_MANAGE = "hr-crm:manage";

const READ_ANY = [
  PROJECTS_READ,
  PROJECTS_READ_ALL,
  IT_CRM_READ,
  IT_CRM_READ_ALL,
  PRODUCT_CRM_READ,
  PRODUCT_CRM_READ_ALL,
  LEGAL_CRM_READ,
  LEGAL_CRM_READ_ALL,
  ACCOUNTING_CRM_READ,
  ACCOUNTING_CRM_READ_ALL,
  HR_CRM_READ,
  HR_CRM_READ_ALL,
] as const;

const WRITE_ANY = [
  PROJECTS_UPDATE,
  PROJECTS_MANAGE,
  IT_CRM_UPDATE,
  IT_CRM_MANAGE,
  PRODUCT_CRM_UPDATE,
  PRODUCT_CRM_MANAGE,
  LEGAL_CRM_UPDATE,
  LEGAL_CRM_MANAGE,
  ACCOUNTING_CRM_UPDATE,
  ACCOUNTING_CRM_MANAGE,
  HR_CRM_UPDATE,
  HR_CRM_MANAGE,
] as const;

export const PROJECTS_ADMIN_EXTRAS = [
  ...READ_ANY,
  ...WRITE_ANY,
  "projects:create",
  "projects:delete",
] as const;

export function hasAnyPermission(
  permissions: ReadonlySet<string>,
  codes: readonly string[],
): boolean {
  return codes.some((code) => permissions.has(code));
}

export function hasProjectsRead(permissions: ReadonlySet<string>): boolean {
  return hasAnyPermission(permissions, READ_ANY);
}

export function hasProjectsWrite(permissions: ReadonlySet<string>): boolean {
  return hasAnyPermission(permissions, WRITE_ANY);
}

export function canSeeAllProjects(
  permissions: ReadonlySet<string>,
  team?: string,
): boolean {
  if (permissions.has(PROJECTS_READ_ALL)) return true;
  if (
    team === "it" &&
    (permissions.has(IT_READ_ALL) || permissions.has(IT_CRM_READ_ALL))
  ) {
    return true;
  }
  if (team === "product" && permissions.has(PRODUCT_CRM_READ_ALL)) return true;
  if (team === "legal" && permissions.has(LEGAL_CRM_READ_ALL)) return true;
  if (team === "accounting" && permissions.has(ACCOUNTING_CRM_READ_ALL)) {
    return true;
  }
  if (team === "hr" && permissions.has(HR_CRM_READ_ALL)) return true;
  return false;
}

export function canAccessProjectAsAdmin(
  permissions: ReadonlySet<string>,
  team: string,
): boolean {
  return canSeeAllProjects(permissions, team);
}
