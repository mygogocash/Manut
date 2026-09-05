import { and, count, eq, inArray, isNull } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";
import { ALL_PERMISSION_CODES, normalizePermissionCode } from "@nexora/contracts/common/constants/permissions";
import { applyManagerImplicitPerms } from "./manager-implicit-perms";

/** The one role that bypasses every permission gate (CLAUDE.md: `isSystem && name === "Admin"`). */
export const SYSTEM_ADMIN_ROLE = "Admin";

export type RoleRow = { name: string; isSystem: boolean; permissionCodes: string[] };

/**
 * Pure port of apps/api auth.service `resolvePermissions`: the System Admin role
 * expands to every known permission code; every other role contributes its
 * explicit role_permissions rows. Codes are normalized so legacy variants match.
 */
export function resolvePermissions(roles: readonly RoleRow[]): string[] {
  const permissions = new Set<string>();
  const isSystemAdmin = roles.some((r) => r.isSystem && r.name === SYSTEM_ADMIN_ROLE);
  if (isSystemAdmin) {
    for (const code of ALL_PERMISSION_CODES) permissions.add(normalizePermissionCode(code));
    return [...permissions];
  }
  for (const role of roles) for (const code of role.permissionCodes) permissions.add(normalizePermissionCode(code));
  return [...permissions];
}

/** Count of active direct reports (`users.reporting_to`). Cheap indexed lookup. */
export async function countActiveDirectReports(db: Db, userId: string): Promise<number> {
  const [row] = await db
    .select({ n: count() })
    .from(schema.users)
    .where(and(eq(schema.users.reportingTo, userId), eq(schema.users.isActive, true), isNull(schema.users.deletedAt)));
  return Number(row?.n ?? 0);
}

/** Loads a user's roles (+ their permission codes) and resolves the effective permission set. */
export async function loadUserPermissions(db: Db, userId: string): Promise<{ roles: string[]; permissions: string[]; isSystemAdmin: boolean }> {
  const rows = await db
    .select({ roleId: schema.roles.id, name: schema.roles.name, isSystem: schema.roles.isSystem })
    .from(schema.userRoles)
    .innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
    .where(eq(schema.userRoles.userId, userId));
  if (rows.length === 0) return { roles: [], permissions: [], isSystemAdmin: false };
  const perms = await db
    .select({ roleId: schema.rolePermissions.roleId, code: schema.rolePermissions.permissionCode })
    .from(schema.rolePermissions)
    .where(inArray(schema.rolePermissions.roleId, rows.map((r) => r.roleId)));
  const byRole = new Map<string, string[]>();
  for (const p of perms) byRole.set(p.roleId, [...(byRole.get(p.roleId) ?? []), p.code]);
  const roles: RoleRow[] = rows.map((r) => ({ name: r.name, isSystem: r.isSystem, permissionCodes: byRole.get(r.roleId) ?? [] }));
  const permissionSet = new Set(resolvePermissions(roles));
  const directReports = await countActiveDirectReports(db, userId);
  applyManagerImplicitPerms(permissionSet, directReports > 0);
  return {
    roles: roles.map((r) => r.name),
    permissions: [...permissionSet],
    isSystemAdmin: roles.some((r) => r.isSystem && r.name === SYSTEM_ADMIN_ROLE),
  };
}

/** Identity check for "super admin only" controls — never a permission code (any code can be granted to a custom role). */
export async function isSystemAdmin(db: Db, userId: string): Promise<boolean> {
  const row = await db
    .select({ id: schema.roles.id })
    .from(schema.userRoles)
    .innerJoin(schema.roles, eq(schema.roles.id, schema.userRoles.roleId))
    .where(and(eq(schema.userRoles.userId, userId), eq(schema.roles.isSystem, true), eq(schema.roles.name, SYSTEM_ADMIN_ROLE)))
    .limit(1);
  return row.length > 0;
}
