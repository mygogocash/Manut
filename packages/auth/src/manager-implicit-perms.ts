/**
 * Permissions a user receives implicitly when they are listed as the
 * `reportingTo` for at least one active employee — i.e. they are a
 * de-facto line manager regardless of which role(s) the admin assigned
 * them.
 *
 * Port of apps/api/src/modules/auth/manager-implicit-perms.ts (pure half).
 * The DB count lives in `countActiveDirectReports` so Workers stay free of
 * Prisma.
 */
export const MANAGER_IMPLICIT_PERMS = [
  "leave:approve",
  "expense:approve",
  "travel:approve",
  "performance:manager-review",
] as const;

/**
 * Mutates `permissions` in place, adding the implicit manager perms
 * when `hasDirectReports` is true. No-op otherwise so non-managers are
 * unaffected.
 */
export function applyManagerImplicitPerms(
  permissions: Set<string>,
  hasDirectReports: boolean,
): void {
  if (!hasDirectReports) return;
  for (const code of MANAGER_IMPLICIT_PERMS) {
    permissions.add(code);
  }
}
