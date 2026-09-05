import type { ProjectTask } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";

/** Only Project CRM rows tagged Marketing feed the Partner workspace bridge. */
export const PARTNER_WORKSPACE_SYNC_DEPARTMENT = "Marketing" as const;

export function shouldSyncProjectToPartner(project: {
  partnerId: string | null;
  department: string | null;
}): project is { partnerId: string; department: string } {
  return (
    project.partnerId != null &&
    project.department === PARTNER_WORKSPACE_SYNC_DEPARTMENT
  );
}

function sortTasksParentsFirst<
  T extends { id: string; parentTaskId: string | null },
>(tasks: T[]): T[] {
  const ids = new Set(tasks.map((t) => t.id));
  return [...tasks].sort((a, b) => {
    const aChild = Boolean(a.parentTaskId && ids.has(a.parentTaskId));
    const bChild = Boolean(b.parentTaskId && ids.has(b.parentTaskId));
    if (!aChild && bChild) return -1;
    if (aChild && !bChild) return 1;
    return 0;
  });
}

/**
 * Merges linked Marketing Project CRM data into the native partner board:
 * columns/members via skipDuplicates; tasks only when missing on `partner_tasks`
 * (same id as project task). Fixes split boards where marketing used Project CRM
 * while admin views Partner CRM.
 */
export async function syncWorkspaceFromLinkedMarketingProjects(
  partnerId: string,
): Promise<void> {
  const linkedProjects = await prisma.project.findMany({
    where: { partnerId, department: PARTNER_WORKSPACE_SYNC_DEPARTMENT },
    select: { id: true },
  });
  if (linkedProjects.length === 0) return;

  const projectIds = linkedProjects.map((p) => p.id);

  const existingTaskIds = new Set(
    (
      await prisma.partnerTask.findMany({
        where: { partnerId },
        select: { id: true },
      })
    ).map((t) => t.id),
  );

  await prisma.$transaction(async (tx) => {
    const [projectColumns, projectMembers, projectTasks] = await Promise.all([
      tx.projectColumn.findMany({ where: { projectId: { in: projectIds } } }),
      tx.projectMember.findMany({ where: { projectId: { in: projectIds } } }),
      tx.projectTask.findMany({ where: { projectId: { in: projectIds } } }),
    ]);

    if (projectColumns.length > 0) {
      await tx.partnerColumn.createMany({
        data: projectColumns.map((pc) => ({
          id: pc.id,
          partnerId,
          key: pc.key,
          label: pc.label,
          color: pc.color,
          sortOrder: pc.sortOrder,
        })),
        skipDuplicates: true,
      });
    }

    if (projectMembers.length > 0) {
      await tx.partnerMember.createMany({
        data: projectMembers.map((pm) => ({
          id: pm.id,
          partnerId,
          userId: pm.userId,
          role: pm.role,
          createdAt: pm.createdAt,
        })),
        skipDuplicates: true,
      });
    }

    const missing = projectTasks.filter((pt) => !existingTaskIds.has(pt.id));
    if (missing.length === 0) return;

    const sorted = sortTasksParentsFirst(missing);

    await tx.partnerTask.createMany({
      data: sorted.map((pt) => ({
        id: pt.id,
        partnerId,
        parentTaskId: pt.parentTaskId,
        title: pt.title,
        description: pt.description,
        status: pt.status,
        priority: pt.priority,
        ownerId: pt.ownerId,
        startDate: pt.startDate,
        endDate: pt.endDate,
        sortOrder: pt.sortOrder,
        createdAt: pt.createdAt,
        updatedAt: pt.updatedAt,
      })),
      skipDuplicates: true,
    });

    const taskIds = sorted.map((t) => t.id);

    const [comments, assignees] = await Promise.all([
      tx.projectTaskComment.findMany({ where: { taskId: { in: taskIds } } }),
      tx.projectTaskAssignee.findMany({ where: { taskId: { in: taskIds } } }),
    ]);

    if (comments.length > 0) {
      await tx.partnerTaskComment.createMany({
        data: comments.map((c) => ({
          id: c.id,
          taskId: c.taskId,
          authorId: c.authorId,
          body: c.body,
          createdAt: c.createdAt,
          updatedAt: c.updatedAt,
        })),
        skipDuplicates: true,
      });
    }

    if (assignees.length > 0) {
      await tx.partnerTaskAssignee.createMany({
        data: assignees.map((a) => ({
          id: a.id,
          taskId: a.taskId,
          userId: a.userId,
          allocationPct: a.allocationPct,
          createdAt: a.createdAt,
        })),
        skipDuplicates: true,
      });
    }
  });
}

/** @deprecated — use {@link syncWorkspaceFromLinkedMarketingProjects} */
export async function syncFromLinkedProjectsIfEmpty(
  partnerId: string,
): Promise<void> {
  return syncWorkspaceFromLinkedMarketingProjects(partnerId);
}

/** Keep partner board in sync when work is still tracked on a linked Project. */
export async function mirrorProjectTaskToPartner(
  partnerId: string,
  task: ProjectTask,
  assigneeIds?: string[],
): Promise<void> {
  await prisma.partnerTask.upsert({
    where: { id: task.id },
    create: {
      id: task.id,
      partnerId,
      parentTaskId: task.parentTaskId,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      ownerId: task.ownerId,
      startDate: task.startDate,
      endDate: task.endDate,
      sortOrder: task.sortOrder,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    },
    update: {
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      ownerId: task.ownerId,
      startDate: task.startDate,
      endDate: task.endDate,
      sortOrder: task.sortOrder,
      updatedAt: task.updatedAt,
    },
  });

  if (assigneeIds === undefined) return;

  await prisma.$transaction(async (tx) => {
    await tx.partnerTaskAssignee.deleteMany({ where: { taskId: task.id } });
    if (assigneeIds.length > 0) {
      await tx.partnerTaskAssignee.createMany({
        data: assigneeIds.map((userId) => ({ taskId: task.id, userId })),
        skipDuplicates: true,
      });
    }
  });
}

export async function deleteMirroredPartnerTask(taskId: string): Promise<void> {
  await prisma.partnerTask.deleteMany({ where: { id: taskId } });
}
