import { prisma } from "@/infrastructure/database/prisma";

/**
 * Permissions a user receives implicitly when they are listed as the
 * `reportingTo` for at least one active employee — i.e. they are a
 * de-facto line manager regardless of which role(s) the admin assigned
 * them.
 *
 * Why these specific codes?
 *   - `leave:approve`, `expense:approve`, `travel:approve`,
 *     `performance:manager-review` are all gated by the service-layer
 *     `assertCanApprove…` checks, each of which independently verifies
 *     `submitter.reportingTo === approver.id`. The role-level perm is
 *     just a coarse pre-filter so the API surfaces the "Approve" button
 *     in the UI; the fine-grained authority sits in the service.
 *
 * Granting these implicitly to direct managers closes the common
 * onboarding gap where a manager is added in the org chart but Admin
 * forgets to also assign the Manager role.
 */
export const MANAGER_IMPLICIT_PERMS = [
  "leave:approve",
  "expense:approve",
  "travel:approve",
  "performance:manager-review",
] as const;

/**
 * Count of active direct reports for a user. Indexed lookup on
 * `users.reporting_to` (FK). Cheap enough to run on every authenticated
 * request without caching for current org size.
 */
export async function countActiveDirectReports(
  userId: string,
): Promise<number> {
  return prisma.user.count({
    where: { reportingTo: userId, isActive: true },
  });
}

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
