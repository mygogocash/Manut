import { PERMISSIONS } from "@nexora/contracts";
import type {
  CreateColumnInput,
  CreateProjectInput,
  CreateTaskInput,
  ManageMembersInput,
  ProjectQuery,
  ReorderProjectsInput,
  ReorderTasksInput,
  UpdateColumnInput,
  UpdateProjectInput,
  UpdateTaskInput,
} from "@nexora/contracts/modules/projects/projects.validation";
import type { Db } from "@nexora/db";
import { ForbiddenException, NotFoundException } from "../http-exception";
import { assertWorkStarted, departmentWrite } from "./workflow-guards";
import * as repo from "./projects.repository";

async function requireParticipant(
  db: Db,
  userId: string,
  projectId: string,
  userPermissions: string[],
  team: string,
): Promise<"owner" | "member" | "admin"> {
  if (userPermissions.includes(PERMISSIONS.PROJECTS_READ_ALL)) return "admin";
  if (
    team === "it" &&
    (userPermissions.includes(PERMISSIONS.IT_READ_ALL) ||
      userPermissions.includes(PERMISSIONS.IT_CRM_READ_ALL))
  ) {
    return "admin";
  }
  if (team === "product" && userPermissions.includes(PERMISSIONS.PRODUCT_CRM_READ_ALL)) {
    return "admin";
  }
  if (team === "legal" && userPermissions.includes(PERMISSIONS.LEGAL_CRM_READ_ALL)) {
    return "admin";
  }
  if (team === "accounting" && userPermissions.includes(PERMISSIONS.ACCOUNTING_CRM_READ_ALL)) {
    return "admin";
  }
  if (team === "hr" && userPermissions.includes(PERMISSIONS.HR_CRM_READ_ALL)) {
    return "admin";
  }
  const role = await repo.findParticipantRole(db, projectId, userId);
  if (!role) throw new ForbiddenException("You do not have access to this project");
  return role;
}

export async function list(db: Db, userId: string, userPermissions: string[], query: ProjectQuery) {
  const { page, limit, archived, ...rest } = query;
  const canSeeAll = userPermissions.includes(PERMISSIONS.PROJECTS_READ_ALL);
  const canSeeAllIt =
    rest.team === "it" &&
    (userPermissions.includes(PERMISSIONS.IT_READ_ALL) ||
      userPermissions.includes(PERMISSIONS.IT_CRM_READ_ALL));
  const canSeeAllProduct =
    rest.team === "product" && userPermissions.includes(PERMISSIONS.PRODUCT_CRM_READ_ALL);
  const canSeeAllLegal =
    rest.team === "legal" && userPermissions.includes(PERMISSIONS.LEGAL_CRM_READ_ALL);
  const canSeeAllAccounting =
    rest.team === "accounting" && userPermissions.includes(PERMISSIONS.ACCOUNTING_CRM_READ_ALL);
  const canSeeAllHr = rest.team === "hr" && userPermissions.includes(PERMISSIONS.HR_CRM_READ_ALL);

  const { data, total } = await repo.findMany(
    db,
    {
      ...rest,
      archived: archived ?? false,
      accessibleByUserId:
        canSeeAll ||
        canSeeAllIt ||
        canSeeAllProduct ||
        canSeeAllLegal ||
        canSeeAllAccounting ||
        canSeeAllHr
          ? undefined
          : userId,
    },
    page,
    limit,
  );

  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
}

export async function getById(
  db: Db,
  userId: string,
  userPermissions: string[],
  idOrSlug: string,
) {
  let project = await repo.findById(db, idOrSlug);
  if (!project) project = await repo.findBySlug(db, idOrSlug);
  if (!project) {
    const mirrored = await repo.mirrorNativeProjectIfNeeded(db, idOrSlug);
    if (mirrored) {
      project =
        (await repo.findById(db, idOrSlug)) ?? (await repo.findBySlug(db, idOrSlug));
    }
  }
  if (!project) throw new NotFoundException("Project not found");
  await requireParticipant(db, userId, project.id, userPermissions, project.team);
  return project;
}


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

async function uniqueSlug(db: Db, base: string): Promise<string> {
  let slug = base;
  let counter = 0;
  while (await repo.slugExists(db, slug)) {
    counter++;
    slug = `${base}-${counter}`;
  }
  return slug;
}

function requireOwner(role: "owner" | "member" | "admin" | null): void {
  if (role !== "owner") {
    throw new ForbiddenException("Only the project owner can do this");
  }
}

function requireOwnerOrManage(
  role: "owner" | "member" | "admin" | null,
  perms: string[],
  team: string = "general",
): void {
  if (role === "owner" || role === "admin") return;
  if (perms.includes(PERMISSIONS.PROJECTS_MANAGE)) return;
  if (team === "it" && perms.includes(PERMISSIONS.IT_CRM_MANAGE)) return;
  if (team === "product" && perms.includes(PERMISSIONS.PRODUCT_CRM_MANAGE)) return;
  if (team === "legal" && perms.includes(PERMISSIONS.LEGAL_CRM_MANAGE)) return;
  if (team === "accounting" && perms.includes(PERMISSIONS.ACCOUNTING_CRM_MANAGE)) return;
  if (team === "hr" && perms.includes(PERMISSIONS.HR_CRM_MANAGE)) return;
  throw new ForbiddenException("Only the project owner or a project manager can do this");
}

export async function create(db: Db, ownerId: string, input: CreateProjectInput) {
  const slug = await uniqueSlug(db, generateSlug(input.name));
  const projectOwnerId = input.ownerId ?? ownerId;
  const id = await repo.createProject(db, {
    name: input.name,
    slug,
    ownerId: projectOwnerId,
    description: input.description,
    status: input.status,
    team: input.team,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    budget: input.budget != null ? String(input.budget) : null,
    customFields: input.customFields,
    productionLiveDate: input.productionLiveDate ?? null,
    goLiveDate: input.goLiveDate ?? null,
    revisedGoLiveDate: input.revisedGoLiveDate ?? null,
    agreement: input.agreement ?? null,
    dependency: input.dependency ?? null,
    comment: input.comment ?? null,
    ...departmentWrite(input),
    workstream: input.workstream ?? null,
    details: input.details ?? null,
    taskType: input.taskType ?? null,
    assignedTeam: input.assignedTeam ?? null,
    defaultAssigneeMode: input.defaultAssigneeMode,
    defaultAssigneeId: input.defaultAssigneeId ?? null,
    partnerId: input.partnerId ?? null,
  });
  const memberIds = input.memberIds?.length
    ? [...new Set([projectOwnerId, ...input.memberIds])]
    : [projectOwnerId];
  await repo.setMembers(db, id, memberIds);
  return getById(db, ownerId, [], id);
}

export async function update(
  db: Db,
  userId: string,
  userPermissions: string[],
  id: string,
  input: UpdateProjectInput,
) {
  const existing = await getById(db, userId, userPermissions, id);
  const role = await repo.findParticipantRole(db, existing.id, userId);
  requireOwnerOrManage(role, userPermissions, existing.team);

  const patch: Record<string, unknown> = { ...departmentWrite(input) };
  if (input.name !== undefined && input.name !== existing.name) {
    patch.name = input.name;
    patch.slug = await uniqueSlug(db, generateSlug(input.name));
  }
  if (input.description !== undefined) patch.description = input.description;
  if (input.status !== undefined) patch.status = input.status;
  if (input.team !== undefined) patch.team = input.team;
  if (input.startDate !== undefined) patch.startDate = input.startDate ?? null;
  if (input.endDate !== undefined) patch.endDate = input.endDate ?? null;
  if (input.budget !== undefined) patch.budget = input.budget != null ? String(input.budget) : null;
  if (input.progress !== undefined) patch.progress = input.progress;
  if (input.customFields !== undefined) patch.customFields = input.customFields;
  if (input.productionLiveDate !== undefined) patch.productionLiveDate = input.productionLiveDate ?? null;
  if (input.goLiveDate !== undefined) {
    patch.goLiveDate = input.goLiveDate ?? null;
    patch.remindersSent = [];
    patch.lastReminderSentAt = null;
  }
  if (input.revisedGoLiveDate !== undefined) {
    patch.revisedGoLiveDate = input.revisedGoLiveDate ?? null;
    patch.remindersSent = [];
    patch.lastReminderSentAt = null;
  }
  if (input.agreement !== undefined) patch.agreement = input.agreement;
  if (input.dependency !== undefined) patch.dependency = input.dependency;
  if (input.comment !== undefined) patch.comment = input.comment;
  if (input.workstream !== undefined) patch.workstream = input.workstream || null;
  if (input.details !== undefined) patch.details = input.details || null;
  if (input.taskType !== undefined) patch.taskType = input.taskType || null;
  if (input.assignedTeam !== undefined) patch.assignedTeam = input.assignedTeam || null;
  if (input.defaultAssigneeMode !== undefined) {
    patch.defaultAssigneeMode = input.defaultAssigneeMode;
    patch.defaultAssigneeId =
      input.defaultAssigneeMode === "user" ? input.defaultAssigneeId ?? null : null;
  } else if (input.defaultAssigneeId !== undefined) {
    patch.defaultAssigneeId = input.defaultAssigneeId;
  }
  if (input.ownerId !== undefined) patch.ownerId = input.ownerId;
  if (input.partnerId !== undefined) patch.partnerId = input.partnerId ?? null;

  await repo.updateProject(db, existing.id, patch);
  if (input.memberIds !== undefined) await repo.setMembers(db, existing.id, input.memberIds);
  return getById(db, userId, userPermissions, existing.id);
}

export async function remove(db: Db, userId: string, userPermissions: string[], id: string) {
  const project = await getById(db, userId, userPermissions, id);
  const role = await repo.findParticipantRole(db, project.id, userId);
  requireOwnerOrManage(role, userPermissions, project.team);
  await repo.deleteProject(db, project.id);
}

export async function archive(db: Db, userId: string, userPermissions: string[], id: string) {
  const project = await repo.findProjectMeta(db, id);
  if (!project) throw new NotFoundException("Project not found");
  const role = await repo.findParticipantRole(db, project.id, userId);
  requireOwnerOrManage(role, userPermissions, project.team);
  await repo.updateProject(db, project.id, {
    archivedAt: project.archivedAt ?? new Date().toISOString(),
  });
  return getById(db, userId, userPermissions, project.id);
}

export async function unarchive(db: Db, userId: string, userPermissions: string[], id: string) {
  const project = await repo.findProjectMeta(db, id);
  if (!project) throw new NotFoundException("Project not found");
  const role = await repo.findParticipantRole(db, project.id, userId);
  requireOwnerOrManage(role, userPermissions, project.team);
  await repo.updateProject(db, project.id, { archivedAt: null });
  return getById(db, userId, userPermissions, project.id);
}

export async function reorder(
  db: Db,
  userId: string,
  userPermissions: string[],
  input: ReorderProjectsInput,
) {
  const canSeeAll = userPermissions.includes(PERMISSIONS.PROJECTS_READ_ALL);
  const accessible = canSeeAll
    ? input.orderedIds
    : await repo.filterAccessibleIds(db, userId, input.orderedIds);
  const items = accessible.map((id, idx) => ({ id, sortOrder: idx }));
  await repo.applySortOrder(db, items);
  return { updated: items.length };
}

export async function setMembers(
  db: Db,
  userId: string,
  userPermissions: string[],
  projectId: string,
  input: ManageMembersInput,
) {
  const project = await getById(db, userId, userPermissions, projectId);
  const role = await repo.findParticipantRole(db, project.id, userId);
  requireOwner(role);
  return repo.setMembers(db, project.id, input.memberIds);
}

export async function getMembers(
  db: Db,
  userId: string,
  userPermissions: string[],
  projectId: string,
) {
  const project = await getById(db, userId, userPermissions, projectId);
  return repo.getMembers(db, project.id);
}

export async function addColumn(
  db: Db,
  userId: string,
  userPermissions: string[],
  projectId: string,
  input: CreateColumnInput,
) {
  const project = await getById(db, userId, userPermissions, projectId);
  const role = await repo.findParticipantRole(db, project.id, userId);
  requireOwner(role);
  return repo.createColumn(db, {
    projectId: project.id,
    key: input.key,
    label: input.label,
    color: input.color,
    sortOrder: input.sortOrder,
  });
}

export async function updateColumn(
  db: Db,
  userId: string,
  userPermissions: string[],
  projectId: string,
  columnId: string,
  input: UpdateColumnInput,
) {
  const project = await getById(db, userId, userPermissions, projectId);
  const role = await repo.findParticipantRole(db, project.id, userId);
  requireOwner(role);
  const patch: Record<string, unknown> = {};
  if (input.label !== undefined) patch.label = input.label;
  if (input.color !== undefined) patch.color = input.color;
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;
  return repo.updateColumn(db, columnId, patch);
}

export async function deleteColumn(
  db: Db,
  userId: string,
  userPermissions: string[],
  projectId: string,
  columnId: string,
) {
  const project = await getById(db, userId, userPermissions, projectId);
  const role = await repo.findParticipantRole(db, project.id, userId);
  requireOwner(role);
  await repo.deleteColumn(db, columnId);
}

export async function addTask(
  db: Db,
  userId: string,
  userPermissions: string[],
  projectId: string,
  input: CreateTaskInput,
) {
  const project = await getById(db, userId, userPermissions, projectId);
  assertWorkStarted(project);
  if (input.parentTaskId) {
    const parent = await repo.findTaskById(db, input.parentTaskId);
    if (!parent || parent.projectId !== project.id) {
      throw new NotFoundException("Parent task not found in this project");
    }
  }
  if (input.milestoneId) {
    const ms = await repo.findMilestoneById(db, input.milestoneId);
    if (!ms || ms.projectId !== project.id) {
      throw new NotFoundException("Milestone not found in this project");
    }
  }
  let ownerId = input.ownerId;
  if (!ownerId && !input.assigneeIds?.length) {
    ownerId = (await repo.resolveProjectDefaultAssignee(db, project.id, userId)) ?? undefined;
  }
  const created = await repo.createTask(db, {
    projectId: project.id,
    title: input.title,
    description: input.description,
    status: input.status,
    priority: input.priority,
    ownerId: ownerId ?? null,
    startDate: input.startDate ?? null,
    endDate: input.endDate ?? null,
    milestoneId: input.milestoneId ?? null,
    sortOrder: input.sortOrder,
    parentTaskId: input.parentTaskId ?? null,
  });
  if (input.assigneeIds?.length) {
    await repo.setAssignees(db, created!.id, input.assigneeIds.map((uid) => ({ userId: uid })));
  } else if (ownerId) {
    await repo.setAssignees(db, created!.id, [{ userId: ownerId }]);
  }
  return created;
}

export async function updateTask(
  db: Db,
  userId: string,
  userPermissions: string[],
  projectId: string,
  taskId: string,
  input: UpdateTaskInput,
) {
  const project = await getById(db, userId, userPermissions, projectId);
  assertWorkStarted(project);
  const before = await repo.findTaskById(db, taskId);
  if (!before || before.projectId !== project.id) {
    throw new NotFoundException("Task not found in this project");
  }
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.description !== undefined) patch.description = input.description;
  if (input.status !== undefined) patch.status = input.status;
  if (input.priority !== undefined) patch.priority = input.priority;
  if (input.ownerId !== undefined) patch.ownerId = input.ownerId ?? null;
  if (input.startDate !== undefined) patch.startDate = input.startDate ?? null;
  if (input.endDate !== undefined) {
    patch.endDate = input.endDate ?? null;
    patch.remindersSent = [];
    patch.lastReminderSentAt = null;
  }
  if (input.milestoneId !== undefined) {
    if (input.milestoneId) {
      const ms = await repo.findMilestoneById(db, input.milestoneId);
      if (!ms || ms.projectId !== project.id) {
        throw new NotFoundException("Milestone not found in this project");
      }
    }
    patch.milestoneId = input.milestoneId ?? null;
  }
  if (input.sortOrder !== undefined) patch.sortOrder = input.sortOrder;
  const updated = await repo.updateTask(db, taskId, patch);
  if (input.assigneeIds !== undefined) {
    await repo.setAssignees(db, taskId, input.assigneeIds.map((uid) => ({ userId: uid })));
  }
  return updated;
}

export async function reorderTasks(
  db: Db,
  userId: string,
  userPermissions: string[],
  projectId: string,
  input: ReorderTasksInput,
) {
  const project = await getById(db, userId, userPermissions, projectId);
  assertWorkStarted(project);
  const owned = await repo.findTaskIdsInProject(db, project.id, input.orderedIds);
  if (owned.length !== input.orderedIds.length) {
    throw new NotFoundException("One or more task ids don't belong to this project");
  }
  const items = input.orderedIds.map((id, idx) => ({ id, sortOrder: idx }));
  await repo.applyTaskSortOrder(db, items, input.status);
  return { updated: items.length };
}

export async function deleteTask(
  db: Db,
  userId: string,
  userPermissions: string[],
  projectId: string,
  taskId: string,
) {
  const project = await getById(db, userId, userPermissions, projectId);
  assertWorkStarted(project);
  const task = await repo.findTaskById(db, taskId);
  if (!task || task.projectId !== project.id) {
    throw new NotFoundException("Task not found in this project");
  }
  await repo.deleteTask(db, taskId);
}
