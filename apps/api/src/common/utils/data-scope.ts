import type { Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";

export type DataScope = "all" | "team" | "self";

/**
 * Resolve the data scope for a user: admin/HR-level roles get "all",
 * managers with direct reports get "team", everyone else gets "self".
 */
export async function resolveDataScope(
  userId: string,
  permissions: string[],
): Promise<DataScope> {
  const permSet = new Set(permissions);
  const hasAdminRead = permSet.has("admin:read") || permSet.has("admin:manage");

  if (hasAdminRead) return "all";

  const reportCount = await prisma.user.count({
    where: { reportingTo: userId, isActive: true },
  });
  if (reportCount > 0) return "team";

  return "self";
}

/**
 * Build a Prisma `where` filter for userId-scoped queries.
 * - "all" -> no filter
 * - "team" -> userId in [self + direct reports]
 * - "self" -> userId = actorId
 */
export async function buildUserScopeFilter(
  actorId: string,
  scope: DataScope,
  userIdField: string = "userId",
): Promise<Prisma.JsonObject> {
  if (scope === "all") return {};

  if (scope === "self") {
    return { [userIdField]: actorId } as unknown as Prisma.JsonObject;
  }

  const directReports = await prisma.user.findMany({
    where: { reportingTo: actorId, isActive: true },
    select: { id: true },
  });

  const teamIds = [actorId, ...directReports.map((u) => u.id)];
  return { [userIdField]: { in: teamIds } } as unknown as Prisma.JsonObject;
}
