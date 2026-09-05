import { PERMISSIONS } from "@nexora/contracts";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";
import { and, eq } from "drizzle-orm";
import { ForbiddenException, NotFoundException } from "../http-exception";
import * as wsRepo from "./repository";

export type ProjectRole = "owner" | "member" | "admin";

export async function requireMembership(
  db: Db,
  idOrSlug: string,
  userId: string,
  perms: string[],
): Promise<{ projectId: string; role: ProjectRole }> {
  const project = await wsRepo.requireProject(db, idOrSlug);
  if (!project) throw new NotFoundException("IT project not found");

  if (
    perms.includes(PERMISSIONS.IT_CRM_READ_ALL) ||
    perms.includes(PERMISSIONS.PROJECTS_READ_ALL)
  ) {
    return { projectId: project.id, role: "admin" };
  }
  if (project.ownerId === userId) return { projectId: project.id, role: "owner" };

  const [member] = await db
    .select({ id: schema.itProjectMembers.id })
    .from(schema.itProjectMembers)
    .where(
      and(
        eq(schema.itProjectMembers.projectId, project.id),
        eq(schema.itProjectMembers.userId, userId),
      ),
    )
    .limit(1);
  if (member) return { projectId: project.id, role: "member" };

  throw new ForbiddenException("You do not have access to this project");
}

export function requireOwnerOrManage(role: ProjectRole, perms: string[]): void {
  if (role === "owner" || role === "admin") return;
  if (perms.includes(PERMISSIONS.IT_CRM_MANAGE) || perms.includes(PERMISSIONS.PROJECTS_MANAGE)) {
    return;
  }
  throw new ForbiddenException("Only the project owner or an IT CRM manager can do this");
}
