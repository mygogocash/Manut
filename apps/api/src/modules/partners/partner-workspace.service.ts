import {
  ConflictException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import type {
  CreatePartnerColumnInput,
  CreatePartnerTaskCommentInput,
  CreatePartnerTaskInput,
  CreatePartnerTaskResourceInput,
  ManagePartnerMembersInput,
  ManagePartnerTaskAssigneesInput,
  UpdatePartnerColumnInput,
  UpdatePartnerTaskInput,
} from "@/modules/partners/partner-workspace.validation";
import { syncWorkspaceFromLinkedMarketingProjects } from "@/modules/partners/partner-workspace-sync";

// Phase 2 of the Partner ↔ Project decouple (Marketing incident,
// 2026-05-26). All reads + writes target the new `partner_*` tables
// added in Phase 1 (#603). The legacy redirect-shim still points
// callers at `/projects/<primary_project_id>` for now — Phase 3
// moves the UI to the new endpoints, then Phase 4 retires the
// shim.

const DEFAULT_COLUMNS = [
  { key: "backlog", label: "Backlog", color: "bg-zinc-500", sortOrder: 0 },
  { key: "todo", label: "To Do", color: "bg-blue-500", sortOrder: 1 },
  {
    key: "in_progress",
    label: "In Progress",
    color: "bg-amber-500",
    sortOrder: 2,
  },
  {
    key: "in_review",
    label: "In Review",
    color: "bg-purple-500",
    sortOrder: 3,
  },
  { key: "done", label: "Done", color: "bg-emerald-500", sortOrder: 4 },
];

async function requirePartner(idOrSlug: string) {
  const partner = await prisma.partner.findFirst({
    where: { OR: [{ id: idOrSlug }, { slug: idOrSlug }] },
    select: { id: true, slug: true, company: true, ownerId: true },
  });
  if (!partner) throw new NotFoundException("Partner not found");
  return partner;
}

export class PartnerWorkspaceService {
  /**
   * Hydrates the entire Partner board in a single round-trip:
   * columns + tasks (with assignees + owner) + members. Mirrors the
   * shape the project detail page used to fetch from `/projects/:id`.
   *
   * If the partner has no columns yet (legacy rows imported before
   * Phase 1 ran, or fresh Partner row created without a workspace),
   * seeds the default 5-column set so the UI always has something to
   * render.
   */
  async getBoard(partnerId: string) {
    const partner = await requirePartner(partnerId);

    // Marketing may still track work on the linked Project CRM board;
    // merge any project tasks not yet mirrored onto `partner_tasks`.
    await syncWorkspaceFromLinkedMarketingProjects(partner.id);

    const columns = await prisma.partnerColumn.findMany({
      where: { partnerId: partner.id },
      orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
    });
    if (columns.length === 0) {
      await prisma.partnerColumn.createMany({
        data: DEFAULT_COLUMNS.map((c) => ({ partnerId: partner.id, ...c })),
        skipDuplicates: true,
      });
    }

    const [tasks, members] = await Promise.all([
      prisma.partnerTask.findMany({
        where: { partnerId: partner.id },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          owner: { select: { id: true, name: true, email: true } },
          assignees: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          resources: { orderBy: { createdAt: "asc" } },
        },
      }),
      prisma.partnerMember.findMany({
        where: { partnerId: partner.id },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
    ]);

    const refreshedColumns =
      columns.length > 0
        ? columns
        : await prisma.partnerColumn.findMany({
            where: { partnerId: partner.id },
            orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
          });

    return {
      partner: {
        id: partner.id,
        slug: partner.slug,
        company: partner.company,
        ownerId: partner.ownerId,
      },
      columns: refreshedColumns,
      tasks,
      members,
    };
  }

  // ─── Tasks ────────────────────────────────────────────────────

  async createTask(
    idOrSlug: string,
    input: CreatePartnerTaskInput,
    actorId: string,
  ) {
    const partnerId = (await requirePartner(idOrSlug)).id;
    // Drop-in `parentTaskId` validation: the parent (if supplied)
    // must already live on the same partner so subtasks can't
    // straddle workspaces.
    if (input.parentTaskId) {
      const parent = await prisma.partnerTask.findUnique({
        where: { id: input.parentTaskId },
        select: { id: true, partnerId: true },
      });
      if (!parent || parent.partnerId !== partnerId) {
        throw new ConflictException(
          "Parent task does not belong to this partner",
        );
      }
    }
    const { assigneeIds, ...taskFields } = input;
    return prisma.$transaction(async (tx) => {
      const task = await tx.partnerTask.create({
        data: {
          partnerId,
          parentTaskId: taskFields.parentTaskId,
          title: taskFields.title,
          description: taskFields.description,
          status: taskFields.status,
          priority: taskFields.priority,
          ownerId: taskFields.ownerId ?? actorId,
          startDate: taskFields.startDate
            ? new Date(taskFields.startDate)
            : null,
          endDate: taskFields.endDate ? new Date(taskFields.endDate) : null,
          sortOrder: taskFields.sortOrder,
        },
      });
      if (assigneeIds && assigneeIds.length > 0) {
        await tx.partnerTaskAssignee.createMany({
          data: assigneeIds.map((userId) => ({
            taskId: task.id,
            userId,
          })),
          skipDuplicates: true,
        });
      }
      return tx.partnerTask.findUniqueOrThrow({
        where: { id: task.id },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          assignees: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          resources: { orderBy: { createdAt: "asc" } },
        },
      });
    });
  }

  async updateTask(
    idOrSlug: string,
    taskId: string,
    input: UpdatePartnerTaskInput,
  ) {
    const partnerId = (await requirePartner(idOrSlug)).id;
    const existing = await prisma.partnerTask.findUnique({
      where: { id: taskId },
      select: { id: true, partnerId: true },
    });
    if (!existing || existing.partnerId !== partnerId) {
      throw new NotFoundException("Task not found");
    }
    const { assigneeIds, ...taskFields } = input;
    return prisma.$transaction(async (tx) => {
      await tx.partnerTask.update({
        where: { id: taskId },
        data: {
          ...(taskFields.title !== undefined && { title: taskFields.title }),
          ...(taskFields.description !== undefined && {
            description: taskFields.description,
          }),
          ...(taskFields.status !== undefined && { status: taskFields.status }),
          ...(taskFields.priority !== undefined && {
            priority: taskFields.priority,
          }),
          ...(taskFields.ownerId !== undefined && {
            ownerId: taskFields.ownerId || null,
          }),
          ...(taskFields.startDate !== undefined && {
            startDate: taskFields.startDate
              ? new Date(taskFields.startDate)
              : null,
          }),
          ...(taskFields.endDate !== undefined && {
            endDate: taskFields.endDate ? new Date(taskFields.endDate) : null,
          }),
          ...(taskFields.sortOrder !== undefined && {
            sortOrder: taskFields.sortOrder,
          }),
        },
      });
      if (assigneeIds !== undefined) {
        await tx.partnerTaskAssignee.deleteMany({
          where: { taskId },
        });
        if (assigneeIds.length > 0) {
          await tx.partnerTaskAssignee.createMany({
            data: assigneeIds.map((userId) => ({
              taskId,
              userId,
            })),
            skipDuplicates: true,
          });
        }
      }
      return tx.partnerTask.findUniqueOrThrow({
        where: { id: taskId },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          assignees: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
          resources: { orderBy: { createdAt: "asc" } },
        },
      });
    });
  }

  async deleteTask(idOrSlug: string, taskId: string) {
    const partnerId = (await requirePartner(idOrSlug)).id;
    const existing = await prisma.partnerTask.findUnique({
      where: { id: taskId },
      select: { id: true, partnerId: true },
    });
    if (!existing || existing.partnerId !== partnerId) {
      throw new NotFoundException("Task not found");
    }
    await prisma.partnerTask.delete({ where: { id: taskId } });
    return { success: true };
  }

  // ─── Columns ──────────────────────────────────────────────────

  async createColumn(idOrSlug: string, input: CreatePartnerColumnInput) {
    const partnerId = (await requirePartner(idOrSlug)).id;
    return prisma.partnerColumn.create({
      data: {
        partnerId,
        key: input.key,
        label: input.label,
        color: input.color ?? "bg-zinc-500",
        sortOrder: input.sortOrder,
      },
    });
  }

  async updateColumn(
    idOrSlug: string,
    columnId: string,
    input: UpdatePartnerColumnInput,
  ) {
    const partnerId = (await requirePartner(idOrSlug)).id;
    const existing = await prisma.partnerColumn.findUnique({
      where: { id: columnId },
      select: { id: true, partnerId: true },
    });
    if (!existing || existing.partnerId !== partnerId) {
      throw new NotFoundException("Column not found");
    }
    return prisma.partnerColumn.update({
      where: { id: columnId },
      data: {
        ...(input.label !== undefined && { label: input.label }),
        ...(input.color !== undefined && { color: input.color }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
      },
    });
  }

  async deleteColumn(idOrSlug: string, columnId: string) {
    const partnerId = (await requirePartner(idOrSlug)).id;
    const existing = await prisma.partnerColumn.findUnique({
      where: { id: columnId },
      select: { id: true, partnerId: true, key: true },
    });
    if (!existing || existing.partnerId !== partnerId) {
      throw new NotFoundException("Column not found");
    }
    // Tasks in this column survive — only the column wrapper is
    // removed. Callers can either re-bucket via the task update
    // endpoint or recreate the column with the same key later.
    await prisma.partnerColumn.delete({ where: { id: columnId } });
    return { success: true };
  }

  // ─── Members ──────────────────────────────────────────────────

  async listMembers(idOrSlug: string) {
    const partnerId = (await requirePartner(idOrSlug)).id;
    return prisma.partnerMember.findMany({
      where: { partnerId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  /**
   * Replace-style set membership — caller submits the desired roster
   * and the service diff-applies. Same semantics as
   * `projectService.setMembers`.
   */
  async setMembers(idOrSlug: string, input: ManagePartnerMembersInput) {
    const partnerId = (await requirePartner(idOrSlug)).id;
    const targetIds = new Set(input.userIds);
    return prisma.$transaction(async (tx) => {
      const current = await tx.partnerMember.findMany({
        where: { partnerId },
        select: { userId: true },
      });
      const currentIds = new Set(current.map((m) => m.userId));
      const toAdd = [...targetIds].filter((id) => !currentIds.has(id));
      const toRemove = [...currentIds].filter((id) => !targetIds.has(id));
      if (toRemove.length > 0) {
        await tx.partnerMember.deleteMany({
          where: { partnerId, userId: { in: toRemove } },
        });
      }
      if (toAdd.length > 0) {
        await tx.partnerMember.createMany({
          data: toAdd.map((userId) => ({ partnerId, userId })),
          skipDuplicates: true,
        });
      }
      return tx.partnerMember.findMany({
        where: { partnerId },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      });
    });
  }

  // ─── Comments ─────────────────────────────────────────────────

  async createTaskComment(
    idOrSlug: string,
    taskId: string,
    input: CreatePartnerTaskCommentInput,
    actorId: string,
  ) {
    const partnerId = (await requirePartner(idOrSlug)).id;
    const existing = await prisma.partnerTask.findUnique({
      where: { id: taskId },
      select: { id: true, partnerId: true },
    });
    if (!existing || existing.partnerId !== partnerId) {
      throw new NotFoundException("Task not found");
    }
    return prisma.partnerTaskComment.create({
      data: {
        taskId,
        authorId: actorId,
        body: input.body,
      },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });
  }

  // ─── Resources (attachments) ──────────────────────────────────

  async listTaskResources(idOrSlug: string, taskId: string) {
    const partnerId = (await requirePartner(idOrSlug)).id;
    await this.assertTaskInPartner(taskId, partnerId);
    return prisma.partnerTaskResource.findMany({
      where: { taskId },
      orderBy: { createdAt: "asc" },
    });
  }

  async addTaskResource(
    idOrSlug: string,
    taskId: string,
    input: CreatePartnerTaskResourceInput,
    actorId: string,
  ) {
    const partnerId = (await requirePartner(idOrSlug)).id;
    await this.assertTaskInPartner(taskId, partnerId);
    return prisma.partnerTaskResource.create({
      data: {
        taskId,
        kind: input.kind,
        label: input.label,
        url: input.url,
        createdBy: actorId,
      },
    });
  }

  async removeTaskResource(
    idOrSlug: string,
    taskId: string,
    resourceId: string,
  ) {
    const partnerId = (await requirePartner(idOrSlug)).id;
    await this.assertTaskInPartner(taskId, partnerId);
    const resource = await prisma.partnerTaskResource.findUnique({
      where: { id: resourceId },
    });
    if (!resource || resource.taskId !== taskId) {
      throw new NotFoundException("Resource not found");
    }
    await prisma.partnerTaskResource.delete({ where: { id: resourceId } });
    return { success: true as const };
  }

  private async assertTaskInPartner(taskId: string, partnerId: string) {
    const existing = await prisma.partnerTask.findUnique({
      where: { id: taskId },
      select: { id: true, partnerId: true },
    });
    if (!existing || existing.partnerId !== partnerId) {
      throw new NotFoundException("Task not found");
    }
  }

  // ─── Assignees ────────────────────────────────────────────────

  async setTaskAssignees(
    idOrSlug: string,
    taskId: string,
    input: ManagePartnerTaskAssigneesInput,
  ) {
    const partnerId = (await requirePartner(idOrSlug)).id;
    const existing = await prisma.partnerTask.findUnique({
      where: { id: taskId },
      select: { id: true, partnerId: true },
    });
    if (!existing || existing.partnerId !== partnerId) {
      throw new NotFoundException("Task not found");
    }
    return prisma.$transaction(async (tx) => {
      await tx.partnerTaskAssignee.deleteMany({ where: { taskId } });
      if (input.assignees.length > 0) {
        await tx.partnerTaskAssignee.createMany({
          data: input.assignees.map((a) => ({
            taskId,
            userId: a.userId,
            allocationPct: a.allocationPct ?? null,
          })),
          skipDuplicates: true,
        });
      }
      return tx.partnerTaskAssignee.findMany({
        where: { taskId },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
    });
  }
}

export const partnerWorkspaceService = new PartnerWorkspaceService();
