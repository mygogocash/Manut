import { PERMISSIONS } from "@/common/constants/permissions";
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import type {
  AccountingProjectQuery,
  CreateAccountingProjectColumnInput,
  CreateAccountingProjectInput,
  CreateAccountingProjectTaskCommentInput,
  CreateAccountingProjectTaskInput,
  ManageAccountingProjectMembersInput,
  ManageAccountingProjectTaskAssigneesInput,
  ReorderAccountingProjectsInput,
  UpdateAccountingProjectColumnInput,
  UpdateAccountingProjectInput,
  UpdateAccountingProjectTaskInput,
} from "@/modules/accounting-crm/accounting-crm.validation";

// Phase 2 of the Accounting CRM standalone workspace. All reads / writes
// target the `accounting_*` tables (Phase 1 = #609). Phase 3 wires the
// frontend `/accounting-crm` page off the existing shared-Project routes
// and onto this module.

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

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  let counter = 0;

  while (true) {
    const existing = await prisma.accountingProject.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) return slug;
    counter += 1;
    slug = `${base}-${counter}`;
  }
}

async function requireMembership(
  projectId: string,
  userId: string,
  perms: string[],
): Promise<"owner" | "member" | "admin"> {
  if (perms.includes(PERMISSIONS.ACCOUNTING_CRM_READ_ALL)) return "admin";
  const project = await prisma.accountingProject.findUnique({
    where: { id: projectId },
    select: { id: true, ownerId: true },
  });
  if (!project) throw new NotFoundException("Accounting project not found");
  if (project.ownerId === userId) return "owner";
  const member = await prisma.accountingProjectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { id: true },
  });
  if (member) return "member";
  throw new ForbiddenException("You do not have access to this project");
}

function requireOwnerOrManage(
  role: "owner" | "member" | "admin",
  perms: string[],
): void {
  if (role === "owner" || role === "admin") return;
  if (perms.includes(PERMISSIONS.ACCOUNTING_CRM_MANAGE)) return;
  throw new ForbiddenException(
    "Only the project owner or an Accounting CRM manager can do this",
  );
}

export class AccountingCrmService {
  // ─── Project CRUD ─────────────────────────────────────────────

  async list(userId: string, perms: string[], query: AccountingProjectQuery) {
    const { page, limit, search, status, department } = query;
    const canSeeAll =
      perms.includes(PERMISSIONS.ACCOUNTING_CRM_READ_ALL) ||
      perms.includes(PERMISSIONS.PROJECTS_READ_ALL);

    const where: Parameters<
      typeof prisma.accountingProject.findMany
    >[0] extends { where?: infer W } | undefined
      ? W
      : never = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
        { workstream: { contains: search, mode: "insensitive" } },
      ];
    }
    if (status) where.status = status;
    if (department) where.department = department;
    if (!canSeeAll) {
      where.OR = [
        ...(where.OR ?? []),
        { ownerId: userId },
        { members: { some: { userId } } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.accountingProject.findMany({
        where,
        include: {
          owner: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.accountingProject.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async create(userId: string, input: CreateAccountingProjectInput) {
    const slug = await uniqueSlug(generateSlug(input.name));
    const ownerId = input.ownerId ?? userId;
    const project = await prisma.accountingProject.create({
      data: {
        name: input.name,
        slug,
        description: input.description,
        status: input.status,
        ownerId,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
        productionLiveDate: input.productionLiveDate
          ? new Date(input.productionLiveDate)
          : null,
        goLiveDate: input.goLiveDate ? new Date(input.goLiveDate) : null,
        revisedGoLiveDate: input.revisedGoLiveDate
          ? new Date(input.revisedGoLiveDate)
          : null,
        dependency: input.dependency ?? null,
        comment: input.comment ?? null,
        department: input.department ?? null,
        workstream: input.workstream ?? null,
        details: input.details ?? null,
        priority: input.priority ?? "medium",
        sortOrder: input.sortOrder,
        defaultAssigneeMode: input.defaultAssigneeMode ?? "none",
        defaultAssigneeId:
          input.defaultAssigneeMode === "user"
            ? (input.defaultAssigneeId ?? null)
            : null,
        columns: { createMany: { data: DEFAULT_COLUMNS } },
        members: { create: { userId: ownerId, role: "owner" } },
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });
    return project;
  }

  async importRows(userId: string, rows: CreateAccountingProjectInput[]) {
    // Create-new-only; reuse `create` per row for slug + columns +
    // owner membership. Sequential to keep slug generation race-free.
    let created = 0;
    for (const row of rows) {
      await this.create(userId, row);
      created++;
    }
    return { created };
  }

  async getById(id: string, userId: string, perms: string[]) {
    const role = await requireMembership(id, userId, perms);
    const project = await prisma.accountingProject.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });
    if (!project) throw new NotFoundException("Accounting project not found");
    return { ...project, role };
  }

  async update(
    id: string,
    userId: string,
    perms: string[],
    input: UpdateAccountingProjectInput,
  ) {
    const role = await requireMembership(id, userId, perms);
    requireOwnerOrManage(role, perms);
    let slugUpdate = {};
    if (input.name) {
      const existing = await prisma.accountingProject.findUnique({
        where: { id },
        select: { name: true },
      });
      if (existing && existing.name !== input.name) {
        slugUpdate = { slug: await uniqueSlug(generateSlug(input.name)) };
      }
    }
    // Normalize the auto-assign default (a non-`user` mode clears any stale
    // specific-user id) and re-arm the reminder ladder on a go-live edit (fired
    // "golive-*" markers were tied to the old date). Mirrors the shared
    // ProjectService.update / ItCrmService.update.
    const defaultAssigneeUpdate: {
      defaultAssigneeMode?: string;
      defaultAssigneeId?: string | null;
    } = {};
    if (input.defaultAssigneeMode !== undefined) {
      defaultAssigneeUpdate.defaultAssigneeMode = input.defaultAssigneeMode;
      defaultAssigneeUpdate.defaultAssigneeId =
        input.defaultAssigneeMode === "user"
          ? (input.defaultAssigneeId ?? null)
          : null;
    } else if (input.defaultAssigneeId !== undefined) {
      defaultAssigneeUpdate.defaultAssigneeId = input.defaultAssigneeId;
    }
    const goLiveEdited =
      input.goLiveDate !== undefined || input.revisedGoLiveDate !== undefined;
    return prisma.accountingProject.update({
      where: { id },
      data: {
        ...defaultAssigneeUpdate,
        ...(goLiveEdited && { remindersSent: [], lastReminderSentAt: null }),
        ...slugUpdate,
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && {
          description: input.description,
        }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.ownerId !== undefined && { ownerId: input.ownerId }),
        ...(input.startDate !== undefined && {
          startDate: input.startDate ? new Date(input.startDate) : null,
        }),
        ...(input.endDate !== undefined && {
          endDate: input.endDate ? new Date(input.endDate) : null,
        }),
        ...(input.productionLiveDate !== undefined && {
          productionLiveDate: input.productionLiveDate
            ? new Date(input.productionLiveDate)
            : null,
        }),
        ...(input.goLiveDate !== undefined && {
          goLiveDate: input.goLiveDate ? new Date(input.goLiveDate) : null,
        }),
        ...(input.revisedGoLiveDate !== undefined && {
          revisedGoLiveDate: input.revisedGoLiveDate
            ? new Date(input.revisedGoLiveDate)
            : null,
        }),
        ...(input.dependency !== undefined && { dependency: input.dependency }),
        ...(input.comment !== undefined && { comment: input.comment }),
        ...(input.department !== undefined && { department: input.department }),
        ...(input.workstream !== undefined && { workstream: input.workstream }),
        ...(input.details !== undefined && { details: input.details }),
        ...(input.priority !== undefined && { priority: input.priority }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
      },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async delete(id: string, userId: string, perms: string[]) {
    const role = await requireMembership(id, userId, perms);
    requireOwnerOrManage(role, perms);
    await prisma.accountingProject.delete({ where: { id } });
    return { success: true };
  }

  async reorder(input: ReorderAccountingProjectsInput) {
    await prisma.$transaction(
      input.orderedIds.map((id, index) =>
        prisma.accountingProject.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
    return { success: true };
  }

  // ─── Board ────────────────────────────────────────────────────

  async getBoard(id: string, userId: string, perms: string[]) {
    await requireMembership(id, userId, perms);
    const columns = await prisma.accountingProjectColumn.findMany({
      where: { projectId: id },
      orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
    });
    if (columns.length === 0) {
      await prisma.accountingProjectColumn.createMany({
        data: DEFAULT_COLUMNS.map((c) => ({ projectId: id, ...c })),
        skipDuplicates: true,
      });
    }
    const [tasks, members, refreshedColumns] = await Promise.all([
      prisma.accountingProjectTask.findMany({
        where: { projectId: id },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          owner: { select: { id: true, name: true, email: true } },
          assignees: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      }),
      prisma.accountingProjectMember.findMany({
        where: { projectId: id },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      columns.length > 0
        ? Promise.resolve(columns)
        : prisma.accountingProjectColumn.findMany({
            where: { projectId: id },
            orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
          }),
    ]);
    return { columns: refreshedColumns, tasks, members };
  }

  // ─── Tasks ────────────────────────────────────────────────────

  async createTask(
    projectId: string,
    userId: string,
    perms: string[],
    input: CreateAccountingProjectTaskInput,
  ) {
    const role = await requireMembership(projectId, userId, perms);
    requireOwnerOrManage(role, perms);
    if (input.parentTaskId) {
      const parent = await prisma.accountingProjectTask.findUnique({
        where: { id: input.parentTaskId },
        select: { id: true, projectId: true },
      });
      if (!parent || parent.projectId !== projectId) {
        throw new ConflictException(
          "Parent task does not belong to this project",
        );
      }
    }
    const { assigneeIds, ...taskFields } = input;
    return prisma.$transaction(async (tx) => {
      const task = await tx.accountingProjectTask.create({
        data: {
          projectId,
          parentTaskId: taskFields.parentTaskId,
          title: taskFields.title,
          description: taskFields.description,
          status: taskFields.status,
          priority: taskFields.priority,
          ownerId: taskFields.ownerId ?? userId,
          startDate: taskFields.startDate
            ? new Date(taskFields.startDate)
            : null,
          endDate: taskFields.endDate ? new Date(taskFields.endDate) : null,
          sortOrder: taskFields.sortOrder,
        },
      });
      if (assigneeIds && assigneeIds.length > 0) {
        await tx.accountingProjectTaskAssignee.createMany({
          data: assigneeIds.map((uid) => ({ taskId: task.id, userId: uid })),
          skipDuplicates: true,
        });
      }
      return tx.accountingProjectTask.findUniqueOrThrow({
        where: { id: task.id },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          assignees: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });
    });
  }

  async updateTask(
    projectId: string,
    taskId: string,
    userId: string,
    perms: string[],
    input: UpdateAccountingProjectTaskInput,
  ) {
    const role = await requireMembership(projectId, userId, perms);
    requireOwnerOrManage(role, perms);
    const existing = await prisma.accountingProjectTask.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true },
    });
    if (!existing || existing.projectId !== projectId) {
      throw new NotFoundException("Task not found");
    }
    const { assigneeIds, ...taskFields } = input;
    return prisma.$transaction(async (tx) => {
      await tx.accountingProjectTask.update({
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
        await tx.accountingProjectTaskAssignee.deleteMany({
          where: { taskId },
        });
        if (assigneeIds.length > 0) {
          await tx.accountingProjectTaskAssignee.createMany({
            data: assigneeIds.map((uid) => ({ taskId, userId: uid })),
            skipDuplicates: true,
          });
        }
      }
      return tx.accountingProjectTask.findUniqueOrThrow({
        where: { id: taskId },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          assignees: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      });
    });
  }

  async deleteTask(
    projectId: string,
    taskId: string,
    userId: string,
    perms: string[],
  ) {
    const role = await requireMembership(projectId, userId, perms);
    requireOwnerOrManage(role, perms);
    const existing = await prisma.accountingProjectTask.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true },
    });
    if (!existing || existing.projectId !== projectId) {
      throw new NotFoundException("Task not found");
    }
    await prisma.accountingProjectTask.delete({ where: { id: taskId } });
    return { success: true };
  }

  // ─── Columns ──────────────────────────────────────────────────

  async createColumn(
    projectId: string,
    userId: string,
    perms: string[],
    input: CreateAccountingProjectColumnInput,
  ) {
    const role = await requireMembership(projectId, userId, perms);
    requireOwnerOrManage(role, perms);
    return prisma.accountingProjectColumn.create({
      data: {
        projectId,
        key: input.key,
        label: input.label,
        color: input.color ?? "bg-zinc-500",
        sortOrder: input.sortOrder,
      },
    });
  }

  async updateColumn(
    projectId: string,
    columnId: string,
    userId: string,
    perms: string[],
    input: UpdateAccountingProjectColumnInput,
  ) {
    const role = await requireMembership(projectId, userId, perms);
    requireOwnerOrManage(role, perms);
    const existing = await prisma.accountingProjectColumn.findUnique({
      where: { id: columnId },
      select: { id: true, projectId: true },
    });
    if (!existing || existing.projectId !== projectId) {
      throw new NotFoundException("Column not found");
    }
    return prisma.accountingProjectColumn.update({
      where: { id: columnId },
      data: {
        ...(input.label !== undefined && { label: input.label }),
        ...(input.color !== undefined && { color: input.color }),
        ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
      },
    });
  }

  async deleteColumn(
    projectId: string,
    columnId: string,
    userId: string,
    perms: string[],
  ) {
    const role = await requireMembership(projectId, userId, perms);
    requireOwnerOrManage(role, perms);
    const existing = await prisma.accountingProjectColumn.findUnique({
      where: { id: columnId },
      select: { id: true, projectId: true },
    });
    if (!existing || existing.projectId !== projectId) {
      throw new NotFoundException("Column not found");
    }
    await prisma.accountingProjectColumn.delete({ where: { id: columnId } });
    return { success: true };
  }

  // ─── Members ──────────────────────────────────────────────────

  async listMembers(projectId: string, userId: string, perms: string[]) {
    await requireMembership(projectId, userId, perms);
    return prisma.accountingProjectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  async setMembers(
    projectId: string,
    userId: string,
    perms: string[],
    input: ManageAccountingProjectMembersInput,
  ) {
    const role = await requireMembership(projectId, userId, perms);
    requireOwnerOrManage(role, perms);
    const targetIds = new Set(input.userIds);
    return prisma.$transaction(async (tx) => {
      const current = await tx.accountingProjectMember.findMany({
        where: { projectId },
        select: { userId: true },
      });
      const currentIds = new Set(current.map((m) => m.userId));
      const toAdd = [...targetIds].filter((id) => !currentIds.has(id));
      const toRemove = [...currentIds].filter((id) => !targetIds.has(id));
      if (toRemove.length > 0) {
        await tx.accountingProjectMember.deleteMany({
          where: { projectId, userId: { in: toRemove } },
        });
      }
      if (toAdd.length > 0) {
        await tx.accountingProjectMember.createMany({
          data: toAdd.map((uid) => ({ projectId, userId: uid })),
          skipDuplicates: true,
        });
      }
      return tx.accountingProjectMember.findMany({
        where: { projectId },
        include: { user: { select: { id: true, name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      });
    });
  }

  // ─── Comments ─────────────────────────────────────────────────

  async createTaskComment(
    projectId: string,
    taskId: string,
    userId: string,
    perms: string[],
    input: CreateAccountingProjectTaskCommentInput,
  ) {
    const role = await requireMembership(projectId, userId, perms);
    requireOwnerOrManage(role, perms);
    const existing = await prisma.accountingProjectTask.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true },
    });
    if (!existing || existing.projectId !== projectId) {
      throw new NotFoundException("Task not found");
    }
    return prisma.accountingProjectTaskComment.create({
      data: { taskId, authorId: userId, body: input.body },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });
  }

  // ─── Assignees ────────────────────────────────────────────────

  async setTaskAssignees(
    projectId: string,
    taskId: string,
    userId: string,
    perms: string[],
    input: ManageAccountingProjectTaskAssigneesInput,
  ) {
    const role = await requireMembership(projectId, userId, perms);
    requireOwnerOrManage(role, perms);
    const existing = await prisma.accountingProjectTask.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true },
    });
    if (!existing || existing.projectId !== projectId) {
      throw new NotFoundException("Task not found");
    }
    return prisma.$transaction(async (tx) => {
      await tx.accountingProjectTaskAssignee.deleteMany({ where: { taskId } });
      if (input.assignees.length > 0) {
        await tx.accountingProjectTaskAssignee.createMany({
          data: input.assignees.map((a) => ({
            taskId,
            userId: a.userId,
            allocationPct: a.allocationPct ?? null,
          })),
          skipDuplicates: true,
        });
      }
      return tx.accountingProjectTaskAssignee.findMany({
        where: { taskId },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
    });
  }
}

export const accountingCrmService = new AccountingCrmService();
