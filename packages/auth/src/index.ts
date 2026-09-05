export { createAuth, kvSecondaryStorage, parseMagicLinkAllowedRoles } from "./server";
export type { Auth, AuthEnv, AuthEmailSender, SecondaryStorage, SessionUser } from "./server";
export { createAuthClientForApp } from "./client";
export type { AuthClient, AuthClientOptions } from "./client";
export {
  resolvePermissions,
  loadUserPermissions,
  countActiveDirectReports,
  isSystemAdmin,
  SYSTEM_ADMIN_ROLE,
} from "./rbac";
export type { RoleRow } from "./rbac";
export { isMagicLinkEligible } from "./magic-link";
export type { MagicLinkRole } from "./magic-link";
export { applyManagerImplicitPerms, MANAGER_IMPLICIT_PERMS } from "./manager-implicit-perms";
