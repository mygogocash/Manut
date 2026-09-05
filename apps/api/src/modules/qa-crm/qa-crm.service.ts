import { PERMISSIONS } from "@/common/constants/permissions";
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import { PORTAL_URL } from "@/lib/portal-url";
import {
  type CrmTaskPerson,
  notifyCrmTaskEvent,
} from "@/modules/crm-shared/crm-notifications";
import type {
  CreateQaProjectColumnInput,
  CreateQaProjectInput,
  CreateQaProjectTaskCommentInput,
  CreateQaProjectTaskInput,
  ManageQaProjectMembersInput,
  ManageQaProjectTaskAssigneesInput,
  QaProjectQuery,
  ReorderQaProjectsInput,
  UpdateQaProjectColumnInput,
  UpdateQaProjectInput,
  UpdateQaProjectTaskInput,
} from "@/modules/qa-crm/qa-crm.validation";

// Phase 2 of the QA CRM standalone workspace. All reads / writes
// target the `qa_*` tables (Phase 1 = #612). Default columns match
// the team's Excel status enum: open / clarified / exception /
// closed.

const DEFAULT_COLUMNS = [
  { key: "open", label: "Open", color: "bg-blue-500", sortOrder: 0 },
  {
    key: "clarified",
    label: "Clarified",
    color: "bg-amber-500",
    sortOrder: 1,
  },
  {
    key: "exception",
    label: "Exception",
    color: "bg-purple-500",
    sortOrder: 2,
  },
  {
    key: "closed",
    label: "Closed",
    color: "bg-emerald-500",
    sortOrder: 3,
  },
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
    const existing = await prisma.qaProject.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing) return slug;
    counter += 1;
    slug = `${base}-${counter}`;
  }
}

// Auto-assign default (Phase C pt3). QA is a pure-native workspace, so the
// default lives on qa_projects and is resolved here (not in the shared
// projects.service). A "user" mode id is validated as an active, non-deleted
// account before applying — mirrors projectRepository.resolveDefaultAssignee.
async function resolveQaDefaultOwner(
  projectId: string,
  actorId: string,
): Promise<string | null> {
  const p = await prisma.qaProject.findUnique({
    where: { id: projectId },
    select: {
      defaultAssigneeMode: true,
      defaultAssigneeId: true,
      ownerId: true,
    },
  });
  if (!p) return null;
  switch (p.defaultAssigneeMode) {
    case "creator":
      return actorId;
    case "owner":
      return p.ownerId;
    case "user": {
      if (!p.defaultAssigneeId) return null;
      const user = await prisma.user.findFirst({
        where: { id: p.defaultAssigneeId, isActive: true, deletedAt: null },
        select: { id: true },
      });
      return user?.id ?? null;
    }
    default:
      return null;
  }
}

// Native notify adapter (Phase C pt3): QA tasks live only in qa_project_tasks,
// so the shared notifier can't look their people up — pass the already-loaded
// owner + assignees and a deep-link to the native /qa-crm board instead.
function notifyQaTaskEvent(input: {
  type: "task_status" | "task_assigned" | "task_comment";
  projectId: string;
  projectName: string;
  taskId: string;
  taskTitle: string;
  actorId: string;
  summary: string;
  owner: CrmTaskPerson | null;
  assignees: CrmTaskPerson[];
}): void {
  void notifyCrmTaskEvent({
    module: "qa",
    type: input.type,
    projectId: input.projectId,
    projectName: input.projectName,
    taskId: input.taskId,
    taskTitle: input.taskTitle,
    actorId: input.actorId,
    summary: input.summary,
    people: { owner: input.owner, assignees: input.assignees },
    link: `${PORTAL_URL}/qa-crm/${input.projectId}`,
  });
}

function prettyStatus(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

async function requireMembership(
  projectId: string,
  userId: string,
  perms: string[],
): Promise<"owner" | "member" | "admin"> {
  if (perms.includes(PERMISSIONS.QA_CRM_READ_ALL)) return "admin";
  const project = await prisma.qaProject.findUnique({
    where: { id: projectId },
    select: { id: true, ownerId: true },
  });
  if (!project) throw new NotFoundException("QA project not found");
  if (project.ownerId === userId) return "owner";
  const member = await prisma.qaProjectMember.findUnique({
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
  if (perms.includes(PERMISSIONS.QA_CRM_MANAGE)) return;
  throw new ForbiddenException(
    "Only the project owner or a QA CRM manager can do this",
  );
}

export class QaCrmService {
  // ─── Project CRUD ─────────────────────────────────────────────

  async list(userId: string, perms: string[], query: QaProjectQuery) {
    const { page, limit, search, status, department, archived } = query;
    const canSeeAll = perms.includes(PERMISSIONS.QA_CRM_READ_ALL);

    const where: Parameters<typeof prisma.qaProject.findMany>[0] extends
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
      prisma.qaProject.findMany({
        where,
        include: {
          owner: { select: { id: true, name: true, email: true } },
        },
        orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.qaProject.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async create(userId: string, input: CreateQaProjectInput) {
    const slug = await uniqueSlug(generateSlug(input.name));
    const ownerId = input.ownerId ?? userId;
    const project = await prisma.qaProject.create({
      data: {
        name: input.name,
        slug,
        description: input.description,
        status: input.status,
        ownerId,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : undefined,
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

  async getById(id: string, userId: string, perms: string[]) {
    const role = await requireMembership(id, userId, perms);
    const project = await prisma.qaProject.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });
    if (!project) throw new NotFoundException("QA project not found");
    return { ...project, role };
  }

  async update(
    id: string,
    userId: string,
    perms: string[],
    input: UpdateQaProjectInput,
  ) {
    const role = await requireMembership(id, userId, perms);
    requireOwnerOrManage(role, perms);
    let slugUpdate = {};
    if (input.name) {
      const existing = await prisma.qaProject.findUnique({
        where: { id },
        select: { name: true },
      });
      if (existing && existing.name !== input.name) {
        slugUpdate = { slug: await uniqueSlug(generateSlug(input.name)) };
      }
    }
    // Normalize the auto-assign default (a non-`user` mode clears any stale
    // specific-user id) and re-arm the reminder ladder on an endDate edit
    // (QA's project deadline; fired "due-*" markers were tied to the old
    // date). Mirrors legal-crm.service.update.
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
    return prisma.qaProject.update({
      where: { id },
      data: {
        ...slugUpdate,
        ...defaultAssigneeUpdate,
        ...(input.endDate !== undefined && {
          remindersSent: [],
          lastReminderSentAt: null,
        }),
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
    await prisma.qaProject.delete({ where: { id } });
    return { success: true };
  }

  // Reversible hide. Owner-or-manage enforced in the SERVICE (not just the
  // route) so a plain qa-crm:update holder can't archive another team's
  // project — same IDOR guard as delete/update. Idempotent: re-archiving keeps
  // the original archive time.
  async archive(id: string, userId: string, perms: string[]) {
    const role = await requireMembership(id, userId, perms);
    requireOwnerOrManage(role, perms);
    const existing = await prisma.qaProject.findUnique({
      where: { id },
      select: { archivedAt: true },
    });
    if (!existing) throw new NotFoundException("QA project not found");
    return prisma.qaProject.update({
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
    const existing = await prisma.qaProject.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException("QA project not found");
    return prisma.qaProject.update({
      where: { id },
      data: { archivedAt: null },
      include: {
        owner: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async reorder(input: ReorderQaProjectsInput) {
    await prisma.$transaction(
      input.orderedIds.map((id, index) =>
        prisma.qaProject.update({
          where: { id },
          data: { sortOrder: index },
        }),
      ),
    );
    return { success: true };
  }

  // Reorder QA issues within a project. Scoped to the project's own
  // tasks (updateMany `{ id, projectId }`) so a stale / hostile id list
  // can't touch another project's rows.
  async reorderTasks(
    projectId: string,
    userId: string,
    perms: string[],
    orderedIds: string[],
  ) {
    const role = await requireMembership(projectId, userId, perms);
    requireOwnerOrManage(role, perms);
    await prisma.$transaction(
      orderedIds.map((id, index) =>
        prisma.qaProjectTask.updateMany({
          where: { id, projectId },
          data: { sortOrder: index },
        }),
      ),
    );
    return { success: true };
  }

  // ─── Board ────────────────────────────────────────────────────

  async getBoard(id: string, userId: string, perms: string[]) {
    await requireMembership(id, userId, perms);
    const columns = await prisma.qaProjectColumn.findMany({
      where: { projectId: id },
      orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
    });
    if (columns.length === 0) {
      await prisma.qaProjectColumn.createMany({
        data: DEFAULT_COLUMNS.map((c) => ({ projectId: id, ...c })),
        skipDuplicates: true,
      });
    }
    const [tasks, members, refreshedColumns] = await Promise.all([
      prisma.qaProjectTask.findMany({
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
      prisma.qaProjectMember.findMany({
        where: { projectId: id },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
      columns.length > 0
        ? Promise.resolve(columns)
        : prisma.qaProjectColumn.findMany({
            where: { projectId: id },
            orderBy: [{ sortOrder: "asc" }, { key: "asc" }],
          }),
    ]);
    return { columns: refreshedColumns, tasks, members };
  }

  // ─── Tasks (QA issues) ───────────────────────────────────────

  async createTask(
    projectId: string,
    userId: string,
    perms: string[],
    input: CreateQaProjectTaskInput,
  ) {
    const role = await requireMembership(projectId, userId, perms);
    requireOwnerOrManage(role, perms);
    if (input.parentTaskId) {
      const parent = await prisma.qaProjectTask.findUnique({
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
    // CRM auto-assign default: when the creator leaves the owner + assignees
    // blank, fall back to the project's configured default. An explicit owner
    // or any explicit assignees always wins; the final `?? userId` preserves
    // QA's original owner-defaults-to-creator behavior for mode "none".
    let ownerId = taskFields.ownerId;
    if (!ownerId && !assigneeIds?.length) {
      ownerId = (await resolveQaDefaultOwner(projectId, userId)) ?? undefined;
    }
    const created = await prisma.$transaction(async (tx) => {
      const task = await tx.qaProjectTask.create({
        data: {
          projectId,
          parentTaskId: taskFields.parentTaskId,
          title: taskFields.title,
          description: taskFields.description,
          status: taskFields.status,
          priority: taskFields.priority,
          ownerId: ownerId ?? userId,
          startDate: taskFields.startDate
            ? new Date(taskFields.startDate)
            : null,
          endDate: taskFields.endDate ? new Date(taskFields.endDate) : null,
          sortOrder: taskFields.sortOrder,
          // QA template fields
          issueDate: taskFields.issueDate
            ? new Date(taskFields.issueDate)
            : null,
          partner: taskFields.partner ?? null,
          product: taskFields.product ?? null,
          issueType: taskFields.issueType ?? null,
          observation: taskFields.observation ?? null,
          expectation: taskFields.expectation ?? null,
          eta: taskFields.eta ?? null,
          qaComment: taskFields.qaComment ?? null,
        },
      });
      if (assigneeIds && assigneeIds.length > 0) {
        await tx.qaProjectTaskAssignee.createMany({
          data: assigneeIds.map((uid) => ({ taskId: task.id, userId: uid })),
          skipDuplicates: true,
        });
      }
      return tx.qaProjectTask.findUniqueOrThrow({
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

    // No creation notification — matches the shared board (addTask is silent;
    // assignment/status/comment UPDATES notify). Bulk import reuses this
    // method, so a create-path notify would also spam on imports.
    return created;
  }

  async importTasks(
    projectId: string,
    userId: string,
    perms: string[],
    rows: CreateQaProjectTaskInput[],
  ) {
    // Create-new-only bulk import of QA issues. Membership + manage
    // gate is checked once here; createTask re-checks per row (cheap).
    const role = await requireMembership(projectId, userId, perms);
    requireOwnerOrManage(role, perms);
    let created = 0;
    for (const row of rows) {
      await this.createTask(projectId, userId, perms, row);
      created++;
    }
    return { created };
  }

  async updateTask(
    projectId: string,
    taskId: string,
    userId: string,
    perms: string[],
    input: UpdateQaProjectTaskInput,
  ) {
    const role = await requireMembership(projectId, userId, perms);
    requireOwnerOrManage(role, perms);
    const existing = await prisma.qaProjectTask.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        projectId: true,
        title: true,
        status: true,
        ownerId: true,
        project: { select: { name: true } },
        assignees: { select: { userId: true } },
      },
    });
    if (!existing || existing.projectId !== projectId) {
      throw new NotFoundException("Task not found");
    }
    const { assigneeIds, ...taskFields } = input;
    // Set-compare so a dialog that always sends assigneeIds doesn't fire a
    // reassignment notice on every unrelated edit.
    const beforeAssignees = existing.assignees
      .map((a) => a.userId)
      .sort()
      .join(",");
    const assigneeChanged =
      assigneeIds !== undefined &&
      [...assigneeIds].sort().join(",") !== beforeAssignees;
    const updated = await prisma.$transaction(async (tx) => {
      await tx.qaProjectTask.update({
        where: { id: taskId },
        data: {
          // Re-arm the due-date reminder ladder when the deadline moves —
          // fired "due-*" markers were tied to the old date.
          ...(taskFields.endDate !== undefined && {
            remindersSent: [],
            lastReminderSentAt: null,
          }),
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
          ...(taskFields.issueDate !== undefined && {
            issueDate: taskFields.issueDate
              ? new Date(taskFields.issueDate)
              : null,
          }),
          ...(taskFields.partner !== undefined && {
            partner: taskFields.partner,
          }),
          ...(taskFields.product !== undefined && {
            product: taskFields.product,
          }),
          ...(taskFields.issueType !== undefined && {
            issueType: taskFields.issueType,
          }),
          ...(taskFields.observation !== undefined && {
            observation: taskFields.observation,
          }),
          ...(taskFields.expectation !== undefined && {
            expectation: taskFields.expectation,
          }),
          ...(taskFields.eta !== undefined && { eta: taskFields.eta }),
          ...(taskFields.qaComment !== undefined && {
            qaComment: taskFields.qaComment,
          }),
        },
      });
      if (assigneeIds !== undefined) {
        await tx.qaProjectTaskAssignee.deleteMany({ where: { taskId } });
        if (assigneeIds.length > 0) {
          await tx.qaProjectTaskAssignee.createMany({
            data: assigneeIds.map((uid) => ({ taskId, userId: uid })),
            skipDuplicates: true,
          });
        }
      }
      return tx.qaProjectTask.findUniqueOrThrow({
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

    // Post-commit CRM update notifications (bell + email) — the NEW people
    // set is on `updated`, so a fresh assignee is notified about their own
    // assignment while the actor is dropped by the notifier.
    const people = {
      owner: updated.owner,
      assignees: updated.assignees.map((a) => a.user),
    };
    if (
      taskFields.status !== undefined &&
      taskFields.status !== existing.status
    ) {
      notifyQaTaskEvent({
        type: "task_status",
        projectId,
        projectName: existing.project.name,
        taskId,
        taskTitle: existing.title,
        actorId: userId,
        summary: `moved it to ${prettyStatus(taskFields.status)}`,
        ...people,
      });
    }
    const ownerChanged =
      taskFields.ownerId !== undefined &&
      (taskFields.ownerId || null) !== (existing.ownerId ?? null);
    if (ownerChanged || assigneeChanged) {
      notifyQaTaskEvent({
        type: "task_assigned",
        projectId,
        projectName: existing.project.name,
        taskId,
        taskTitle: existing.title,
        actorId: userId,
        summary: "updated the assignees on",
        ...people,
      });
    }

    return updated;
  }

  async deleteTask(
    projectId: string,
    taskId: string,
    userId: string,
    perms: string[],
  ) {
    const role = await requireMembership(projectId, userId, perms);
    requireOwnerOrManage(role, perms);
    const existing = await prisma.qaProjectTask.findUnique({
      where: { id: taskId },
      select: { id: true, projectId: true },
    });
    if (!existing || existing.projectId !== projectId) {
      throw new NotFoundException("Task not found");
    }
    await prisma.qaProjectTask.delete({ where: { id: taskId } });
    return { success: true };
  }

  // ─── Columns ──────────────────────────────────────────────────

  async createColumn(
    projectId: string,
    userId: string,
    perms: string[],
    input: CreateQaProjectColumnInput,
  ) {
    const role = await requireMembership(projectId, userId, perms);
    requireOwnerOrManage(role, perms);
    return prisma.qaProjectColumn.create({
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
    input: UpdateQaProjectColumnInput,
  ) {
    const role = await requireMembership(projectId, userId, perms);
    requireOwnerOrManage(role, perms);
    const existing = await prisma.qaProjectColumn.findUnique({
      where: { id: columnId },
      select: { id: true, projectId: true },
    });
    if (!existing || existing.projectId !== projectId) {
      throw new NotFoundException("Column not found");
    }
    return prisma.qaProjectColumn.update({
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
    const existing = await prisma.qaProjectColumn.findUnique({
      where: { id: columnId },
      select: { id: true, projectId: true },
    });
    if (!existing || existing.projectId !== projectId) {
      throw new NotFoundException("Column not found");
    }
    await prisma.qaProjectColumn.delete({ where: { id: columnId } });
    return { success: true };
  }

  // ─── Members ──────────────────────────────────────────────────

  async listMembers(projectId: string, userId: string, perms: string[]) {
    await requireMembership(projectId, userId, perms);
    return prisma.qaProjectMember.findMany({
      where: { projectId },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  async setMembers(
    projectId: string,
    userId: string,
    perms: string[],
    input: ManageQaProjectMembersInput,
  ) {
    const role = await requireMembership(projectId, userId, perms);
    requireOwnerOrManage(role, perms);
    const targetIds = new Set(input.userIds);
    return prisma.$transaction(async (tx) => {
      const current = await tx.qaProjectMember.findMany({
        where: { projectId },
        select: { userId: true },
      });
      const currentIds = new Set(current.map((m) => m.userId));
      const toAdd = [...targetIds].filter((id) => !currentIds.has(id));
      const toRemove = [...currentIds].filter((id) => !targetIds.has(id));
      if (toRemove.length > 0) {
        await tx.qaProjectMember.deleteMany({
          where: { projectId, userId: { in: toRemove } },
        });
      }
      if (toAdd.length > 0) {
        await tx.qaProjectMember.createMany({
          data: toAdd.map((uid) => ({ projectId, userId: uid })),
          skipDuplicates: true,
        });
      }
      return tx.qaProjectMember.findMany({
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
    input: CreateQaProjectTaskCommentInput,
  ) {
    const role = await requireMembership(projectId, userId, perms);
    requireOwnerOrManage(role, perms);
    const existing = await prisma.qaProjectTask.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        projectId: true,
        title: true,
        project: { select: { name: true } },
        owner: { select: { id: true, name: true, email: true } },
        assignees: {
          select: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });
    if (!existing || existing.projectId !== projectId) {
      throw new NotFoundException("Task not found");
    }
    const comment = await prisma.qaProjectTaskComment.create({
      data: { taskId, authorId: userId, body: input.body },
      include: {
        author: { select: { id: true, name: true, email: true } },
      },
    });

    notifyQaTaskEvent({
      type: "task_comment",
      projectId,
      projectName: existing.project.name,
      taskId,
      taskTitle: existing.title,
      actorId: userId,
      summary: "commented on",
      owner: existing.owner,
      assignees: existing.assignees.map((a) => a.user),
    });

    return comment;
  }

  // ─── Assignees ────────────────────────────────────────────────

  async setTaskAssignees(
    projectId: string,
    taskId: string,
    userId: string,
    perms: string[],
    input: ManageQaProjectTaskAssigneesInput,
  ) {
    const role = await requireMembership(projectId, userId, perms);
    requireOwnerOrManage(role, perms);
    const existing = await prisma.qaProjectTask.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        projectId: true,
        title: true,
        project: { select: { name: true } },
        owner: { select: { id: true, name: true, email: true } },
        assignees: { select: { userId: true } },
      },
    });
    if (!existing || existing.projectId !== projectId) {
      throw new NotFoundException("Task not found");
    }
    const rows = await prisma.$transaction(async (tx) => {
      await tx.qaProjectTaskAssignee.deleteMany({ where: { taskId } });
      if (input.assignees.length > 0) {
        await tx.qaProjectTaskAssignee.createMany({
          data: input.assignees.map((a) => ({
            taskId,
            userId: a.userId,
            allocationPct: a.allocationPct ?? null,
          })),
          skipDuplicates: true,
        });
      }
      return tx.qaProjectTaskAssignee.findMany({
        where: { taskId },
        include: { user: { select: { id: true, name: true, email: true } } },
      });
    });

    // Post-commit reassignment notification against the NEW assignee set, so
    // a freshly-added assignee hears about their own assignment. Skipped when
    // the set is unchanged (set-compare).
    const beforeSet = existing.assignees
      .map((a) => a.userId)
      .sort()
      .join(",");
    const afterSet = rows
      .map((r) => r.userId)
      .sort()
      .join(",");
    if (beforeSet !== afterSet) {
      notifyQaTaskEvent({
        type: "task_assigned",
        projectId,
        projectName: existing.project.name,
        taskId,
        taskTitle: existing.title,
        actorId: userId,
        summary: "updated the assignees on",
        owner: existing.owner,
        assignees: rows.map((r) => r.user),
      });
    }

    return rows;
  }
}

export const qaCrmService = new QaCrmService();
