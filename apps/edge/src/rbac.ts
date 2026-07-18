import type { PrismaClient } from "@manut/database";

/**
 * Load effective permission codes for a user (roles + module access grants).
 * When `adminExtras` is provided, system Admin also receives those codes
 * (mirrors deals/messages Hyperdrive stores).
 */
export async function loadUserPermissions(
  client: PrismaClient,
  userId: string,
  adminExtras: readonly string[] = [],
): Promise<Set<string>> {
  const permissions = new Set<string>();
  const userWithRoles = await client.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: {
        include: {
          role: {
            include: { rolePermissions: true },
          },
        },
      },
      moduleAccessGrants: true,
    },
  });
  if (!userWithRoles) return permissions;

  const isSuperAdmin = userWithRoles.userRoles.some(
    (userRole) => userRole.role.isSystem && userRole.role.name === "Admin",
  );
  if (isSuperAdmin) {
    for (const code of adminExtras) {
      permissions.add(code);
    }
  }

  for (const userRole of userWithRoles.userRoles) {
    for (const rolePerm of userRole.role.rolePermissions) {
      permissions.add(rolePerm.permissionCode);
    }
  }

  for (const access of userWithRoles.moduleAccessGrants) {
    if (!access.granted) {
      for (const perm of [...permissions]) {
        if (perm.startsWith(`${access.moduleId}:`)) {
          permissions.delete(perm);
        }
      }
    }
  }

  return permissions;
}
