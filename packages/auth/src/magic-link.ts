import { SYSTEM_ADMIN_ROLE } from "./rbac";

export type MagicLinkRole = { name: string; isSystem: boolean };

/**
 * Pure gate for magic-link eligibility (port of auth.service requestEmailAuthLink).
 * System Admin always bypasses; otherwise the user must hold at least one role
 * named in `allowedRoles`. Empty allowed list = feature disabled for everyone
 * except Admin.
 */
export function isMagicLinkEligible(
  roles: readonly MagicLinkRole[],
  allowedRoles: readonly string[],
): boolean {
  const isAdmin = roles.some((r) => r.isSystem && r.name === SYSTEM_ADMIN_ROLE);
  if (isAdmin) return true;
  if (allowedRoles.length === 0) return false;
  return roles.some((r) => allowedRoles.includes(r.name));
}
