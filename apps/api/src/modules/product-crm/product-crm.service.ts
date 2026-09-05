import { PERMISSIONS } from "@/common/constants/permissions";
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import type {
  CreateProductProjectColumnInput,
  CreateProductProjectInput,
  CreateProductProjectTaskCommentInput,
  CreateProductProjectTaskInput,
  ManageProductProjectMembersInput,
  ManageProductProjectTaskAssigneesInput,
  ProductProjectQuery,
  ReorderProductProjectsInput,
  UpdateProductProjectColumnInput,
  UpdateProductProjectInput,
  UpdateProductProjectTaskInput,
} from "@/modules/product-crm/product-crm.validation";

// Phase 2 of the Product CRM standalone workspace. All reads / writes
// target the `product_*` tables (Phase 1 = #609). Phase 3 wires the
// frontend `/product-crm` page off the existing shared-Project routes
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
    const existing = await prisma.productProject.findUnique({
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
  if (perms.includes(PERMISSIONS.PRODUCT_CRM_READ_ALL)) return "admin";
  const project = await prisma.productProject.findUnique({
    where: { id: projectId },
    select: { id: true, ownerId: true },
  });
  if (!project) throw new NotFoundException("Product project not found");
  if (project.ownerId === userId) return "owner";
  const member = await prisma.productProjectMember.findUnique({
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
  if (perms.includes(PERMISSIONS.PRODUCT_CRM_MANAGE)) return;
  throw new ForbiddenException(
    "Only the project owner or an Product CRM manager can do this",
  );
}

export class ProductCrmService {
  // ─── Project CRUD ─────────────────────────────────────────────

  async list(userId: string, perms: string[], query: ProductProjectQuery) {
    const { page, limit, search, status, department, archived } = query;
    const canSeeAll =
      perms.includes(PERMISSIONS.PRODUCT_CRM_READ_ALL) ||
      perms.includes(PERMISSIONS.PROJECTS_READ_ALL);

    const where: Parameters<typeof prisma.productProject.findMany>[0] extends
      | { where?: infer W }
      | undefined
      ? W
      : never = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { slug: { contains: search, mode: "insensitive" } },
      ];
    }
    if (status) where.status = status;
    if (department) where.department = department;
    // Archive is orthogonal to status: default view shows active projects
    // only; the Archived tab (archived=true) shows the archived ones. Applied
    // to both findMany and count so pagination totals match the view.
    where.archivedAt = archived ? { not: null } : null;
    if (!canSeeAll) {
      where.OR = [
        ...(where.OR ?? []),
        { ownerId: userId },
        { members: { some: { userId } } },
      ];
    }

    const [data, total] = await Promise.all([
      prisma.productProject.findMany({
        where,
        include: {
          owner: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.productProject.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async create(userId: string, input: CreateProductProjectInput) {
    const slug = await uniqueSlug(generateSlug(input.name));
    const ownerId = input.ownerId ?? userId;
    const project = await prisma.productProject.create({
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
        sortOrder: input.sortOrder,
        // Auto-assign default (Phase C pt3) — a non-`user` mode never keeps a
        // stale specific-user id. Mirrors legal-crm.service.create.
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

  async importRows(userId: string, rows: CreateProductProjectInput[]) {
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
    const project = await prisma.productProject.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });
    if (!project) throw new NotFoundException("Product project not found");
    return { ...project, role };
  }

  async update(
    id: string,
    userId: string,
    perms: string[],
    input: UpdateProductProjectInput,
  ) {
    const role = await requireMembership(id, userId, perms);
    requireOwnerOrManage(role, perms);
    let slugUpdate = {};
    if (input.name) {
      const existing = await prisma.productProject.findUnique({
        where: { id },
        select: { name: true },
      });
      if (existing && existing.name !== input.name) {
        slugUpdate = { slug: await uniqueSlug(generateSlug(input.name)) };
      }
    }
    // Normalize the auto-assign default (a non-`user` mode clears any stale
    // specific-user id) and re-arm the reminder ladder on a go-live edit (fired
    // "golive-*" markers were tied to the old date). Mirrors
    // legal-crm.service.update.
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
    return prisma.productProject.update({
      where: { id },
      data: {
        ...slugUpdate,
        ...defaultAssigneeUpdate,
        ...(goLiveEdited && { remindersSent: [], lastReminderSentAt: null }),
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
    await prisma.productProject.delete({ where: { id } });
    return { success: true };
  }

  // Reversible hide. Owner-or-manage enforced in the SERVICE (not just the
  // route) so a plain product-crm:update holder can't archive another team's
  // project — same IDOR guard as delete/update. Idempotent: re-archiving keeps
  // the original archive time.
  async archive(id: string, userId: string, perms: string[]) {
    const role = await requireMembership(id, userId, perms);
    requireOwnerOrManage(role, perms);
    const existing = await prisma.productProject.findUnique({
      where: { id },
      select: { archivedAt: true },
    });
    if (!existing) throw new NotFoundException("Product project not found");
    return prisma.productProject.update({
      where: { id },
      data: { archivedAt: existing.archivedAt ?? new Date() },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async unarchive(id: string, userId: string, perms: string[]) {
    const role = await requireMembership(id, userId, perms);
    requireOwnerOrManage(role, perms);
    const existing = await prisma.productProject.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException("Product project not found");
    return prisma.productProject.update({
      where: { id },
      data: { archivedAt: null },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async reorder(input: ReorderProductProjectsInput) {
    await prisma.$transaction(
      input.orderedIds.map((id, index) =>
        prisma.productProject.update({
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
    const columns = await prisma.productProjectColumn.findMany({
      where: { projectId: id },
      orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
    });
    if (columns.length === 0) {
      await prisma.productProjectColumn.createMany({
        data: DEFAULT_COLUMNS.map((c) => ({ projectId: id, ...c })),
        skipDuplicates: true,
      });
    }
    const [tasks, members, refreshedColumns] = await Promise.all([
      prisma.productProjectTask.findMany({
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
      prisma.productProjectMember.findMany({
        where: { projectId: id },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      columns.length > 0
        ? Promise.resolve(columns)
        : prisma.productProjectColumn.findMany({
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
    input: CreateProductProjectTaskInput,
  ) {
    const role = await requireMembership(projectId, userId, perms);
    requireOwnerOrManage(role, perms);
    if (input.parentTaskId) {
      const parent = await prisma.productProjectTask.findUnique({
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
      const task = await tx.productProjectTask.create({
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
        await tx.productProjectTaskAssignee.createMany({
          data: assigneeIds.map((uid) => ({ taskId: task.id, userId: uid })),
          skipDuplicates: true,
        });
      }
      return tx.productProjectTask.findUniqueOrThrow({
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
    input: UpdateProductProjectTaskInput,
  ) {
    const role = await requireMembership(projectId, userId, perms);
    requireOwnerOrManage(role, perms);
    const existing = await prisma.productProjectTask.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true },
    });
    if (!existing || existing.projectId !== projectId) {
      throw new NotFoundException("Task not found");
    }
    const { assigneeIds, ...taskFields } = input;
    return prisma.$transaction(async (tx) => {
      await tx.productProjectTask.update({
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
        await tx.productProjectTaskAssignee.deleteMany({ where: { taskId } });
        if (assigneeIds.length > 0) {
          await tx.productProjectTaskAssignee.createMany({
            data: assigneeIds.map((uid) => ({ taskId, userId: uid })),
            skipDuplicates: true,
          });
        }
      }
      return tx.productProjectTask.findUniqueOrThrow({
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
    const existing = await prisma.productProjectTask.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true },
    });
    if (!existing || existing.projectId !== projectId) {
      throw new NotFoundException("Task not found");
    }
    await prisma.productProjectTask.delete({ where: { id: taskId } });
    return { success: true };
  }

  // ─── Columns ──────────────────────────────────────────────────

  async createColumn(
    projectId: string,
    userId: string,
    perms: string[],
    input: CreateProductProjectColumnInput,
  ) {
    const role = await requireMembership(projectId, userId, perms);
    requireOwnerOrManage(role, perms);
    return prisma.productProjectColumn.create({
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
    input: UpdateProductProjectColumnInput,
  ) {
    const role = await requireMembership(projectId, userId, perms);
    requireOwnerOrManage(role, perms);
    const existing = await prisma.productProjectColumn.findUnique({
      where: { id: columnId },
      select: { id: true, projectId: true },
    });
    if (!existing || existing.projectId !== projectId) {
      throw new NotFoundException("Column not found");
    }
    return prisma.productProjectColumn.update({
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
    const existing = await prisma.productProjectColumn.findUnique({
      where: { id: columnId },
      select: { id: true, projectId: true },
    });
    if (!existing || existing.projectId !== projectId) {
      throw new NotFoundException("Column not found");
    }
    await prisma.productProjectColumn.delete({ where: { id: columnId } });
    return { success: true };
  }

  // ─── Members ──────────────────────────────────────────────────

  async listMembers(projectId: string, userId: string, perms: string[]) {
    await requireMembership(projectId, userId, perms);
    return prisma.productProjectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  async setMembers(
    projectId: string,
    userId: string,
    perms: string[],
    input: ManageProductProjectMembersInput,
  ) {
    const role = await requireMembership(projectId, userId, perms);
    requireOwnerOrManage(role, perms);
    const targetIds = new Set(input.userIds);
    return prisma.$transaction(async (tx) => {
      const current = await tx.productProjectMember.findMany({
        where: { projectId },
        select: { userId: true },
      });
      const currentIds = new Set(current.map((m) => m.userId));
      const toAdd = [...targetIds].filter((id) => !currentIds.has(id));
      const toRemove = [...currentIds].filter((id) => !targetIds.has(id));
      if (toRemove.length > 0) {
        await tx.productProjectMember.deleteMany({
          where: { projectId, userId: { in: toRemove } },
        });
      }
      if (toAdd.length > 0) {
        await tx.productProjectMember.createMany({
          data: toAdd.map((uid) => ({ projectId, userId: uid })),
          skipDuplicates: true,
        });
      }
      return tx.productProjectMember.findMany({
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
    input: CreateProductProjectTaskCommentInput,
  ) {
    const role = await requireMembership(projectId, userId, perms);
    requireOwnerOrManage(role, perms);
    const existing = await prisma.productProjectTask.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true },
    });
    if (!existing || existing.projectId !== projectId) {
      throw new NotFoundException("Task not found");
    }
    return prisma.productProjectTaskComment.create({
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
    input: ManageProductProjectTaskAssigneesInput,
  ) {
    const role = await requireMembership(projectId, userId, perms);
    requireOwnerOrManage(role, perms);
    const existing = await prisma.productProjectTask.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true },
    });
    if (!existing || existing.projectId !== projectId) {
      throw new NotFoundException("Task not found");
    }
    return prisma.$transaction(async (tx) => {
      await tx.productProjectTaskAssignee.deleteMany({ where: { taskId } });
      if (input.assignees.length > 0) {
        await tx.productProjectTaskAssignee.createMany({
          data: input.assignees.map((a) => ({
            taskId,
            userId: a.userId,
            allocationPct: a.allocationPct ?? null,
          })),
          skipDuplicates: true,
        });
      }
      return tx.productProjectTaskAssignee.findMany({
        where: { taskId },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
    });
  }
}

export const productCrmService = new ProductCrmService();
