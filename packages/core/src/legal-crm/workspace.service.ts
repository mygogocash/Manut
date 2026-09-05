import type {
  CreateLegalProjectColumnInput,
  CreateLegalProjectTaskCommentInput,
  CreateLegalProjectTaskInput,
  ManageLegalProjectMembersInput,
  ManageLegalProjectTaskAssigneesInput,
  UpdateLegalProjectColumnInput,
  UpdateLegalProjectTaskInput,
} from "@nexora/contracts/modules/legal-crm/legal-crm.validation";
import type { Db } from "@nexora/db";
import { ConflictException, NotFoundException } from "../http-exception";
import { requireMembership, requireOwnerOrManage } from "./access";
import * as wsRepo from "./repository";

async function requireProjectId(
  db: Db,
  idOrSlug: string,
  userId: string,
  perms: string[],
) {
  const { projectId, role } = await requireMembership(db, idOrSlug, userId, perms);
  return { projectId, role };
}

export async function getBoard(db: Db, idOrSlug: string, userId: string, perms: string[]) {
  const { projectId } = await requireProjectId(db, idOrSlug, userId, perms);
  const project = await wsRepo.requireProject(db, projectId);
  if (!project) throw new NotFoundException("Project not found");

  let columns = await wsRepo.listColumns(db, projectId);
  if (columns.length === 0) {
    await wsRepo.seedDefaultColumns(db, projectId);
    columns = await wsRepo.listColumns(db, projectId);
  }

  const [tasks, members] = await Promise.all([
    wsRepo.listTasksWithRelations(db, projectId),
    wsRepo.listMembers(db, projectId),
  ]);

  return {
    project: {
      id: project.id,
      slug: project.slug,
      name: project.name,
      ownerId: project.ownerId,
    },
    columns,
    tasks,
    members,
  };
}

export async function createTask(
  db: Db,
  idOrSlug: string,
  userId: string,
  perms: string[],
  input: CreateLegalProjectTaskInput,
) {
  const { projectId, role } = await requireProjectId(db, idOrSlug, userId, perms);
  requireOwnerOrManage(role, perms);
  if (input.parentTaskId) {
    const parent = await wsRepo.findParentTask(db, input.parentTaskId);
    if (!parent || parent.projectId !== projectId) {
      throw new ConflictException("Parent task does not belong to this project");
    }
  }
  const { assigneeIds, columnKey: _columnKey, ...taskFields } = input;
  return wsRepo.createTask(db, projectId, {
    parentTaskId: taskFields.parentTaskId,
    title: taskFields.title,
    description: taskFields.description ?? null,
    status: taskFields.status,
    priority: taskFields.priority,
    ownerId: taskFields.ownerId ?? userId,
    startDate: taskFields.startDate ?? null,
    endDate: taskFields.endDate ?? null,
    sortOrder: taskFields.sortOrder,
    assigneeIds,
  });
}

export async function updateTask(
  db: Db,
  idOrSlug: string,
  taskId: string,
  userId: string,
  perms: string[],
  input: UpdateLegalProjectTaskInput,
) {
  const { projectId, role } = await requireProjectId(db, idOrSlug, userId, perms);
  requireOwnerOrManage(role, perms);
  const existing = await wsRepo.findTask(db, taskId, projectId);
  if (!existing) throw new NotFoundException("Task not found");
  const { assigneeIds, columnKey: _columnKey, ...taskFields } = input;
  return wsRepo.updateTask(db, taskId, {
    ...(taskFields.title !== undefined && { title: taskFields.title }),
    ...(taskFields.description !== undefined && { description: taskFields.description }),
    ...(taskFields.status !== undefined && { status: taskFields.status }),
    ...(taskFields.priority !== undefined && { priority: taskFields.priority }),
    ...(taskFields.ownerId !== undefined && { ownerId: taskFields.ownerId || null }),
    ...(taskFields.startDate !== undefined && { startDate: taskFields.startDate ?? null }),
    ...(taskFields.endDate !== undefined && { endDate: taskFields.endDate ?? null }),
    ...(taskFields.sortOrder !== undefined && { sortOrder: taskFields.sortOrder }),
    ...(assigneeIds !== undefined && { assigneeIds }),
  });
}

export async function deleteTask(
  db: Db,
  idOrSlug: string,
  taskId: string,
  userId: string,
  perms: string[],
) {
  const { projectId, role } = await requireProjectId(db, idOrSlug, userId, perms);
  requireOwnerOrManage(role, perms);
  const existing = await wsRepo.findTask(db, taskId, projectId);
  if (!existing) throw new NotFoundException("Task not found");
  await wsRepo.deleteTask(db, taskId);
  return { success: true as const };
}

export async function createColumn(
  db: Db,
  idOrSlug: string,
  userId: string,
  perms: string[],
  input: CreateLegalProjectColumnInput,
) {
  const { projectId, role } = await requireProjectId(db, idOrSlug, userId, perms);
  requireOwnerOrManage(role, perms);
  return wsRepo.createColumn(db, projectId, {
    key: input.key,
    label: input.label,
    color: input.color ?? "bg-zinc-500",
    sortOrder: input.sortOrder,
  });
}

export async function updateColumn(
  db: Db,
  idOrSlug: string,
  columnId: string,
  userId: string,
  perms: string[],
  input: UpdateLegalProjectColumnInput,
) {
  const { projectId, role } = await requireProjectId(db, idOrSlug, userId, perms);
  requireOwnerOrManage(role, perms);
  const existing = await wsRepo.findColumn(db, columnId, projectId);
  if (!existing) throw new NotFoundException("Column not found");
  return wsRepo.updateColumn(db, columnId, {
    ...(input.label !== undefined && { label: input.label }),
    ...(input.color !== undefined && { color: input.color }),
    ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
  });
}

export async function deleteColumn(
  db: Db,
  idOrSlug: string,
  columnId: string,
  userId: string,
  perms: string[],
) {
  const { projectId, role } = await requireProjectId(db, idOrSlug, userId, perms);
  requireOwnerOrManage(role, perms);
  const existing = await wsRepo.findColumn(db, columnId, projectId);
  if (!existing) throw new NotFoundException("Column not found");
  await wsRepo.deleteColumn(db, columnId);
  return { success: true as const };
}

export async function listMembers(db: Db, idOrSlug: string, userId: string, perms: string[]) {
  const { projectId } = await requireProjectId(db, idOrSlug, userId, perms);
  return wsRepo.listMembers(db, projectId);
}

export async function setMembers(
  db: Db,
  idOrSlug: string,
  userId: string,
  perms: string[],
  input: ManageLegalProjectMembersInput,
) {
  const { projectId, role } = await requireProjectId(db, idOrSlug, userId, perms);
  requireOwnerOrManage(role, perms);
  return wsRepo.setMembers(db, projectId, input.userIds);
}

export async function createTaskComment(
  db: Db,
  idOrSlug: string,
  taskId: string,
  userId: string,
  perms: string[],
  input: CreateLegalProjectTaskCommentInput,
) {
  const { projectId, role } = await requireProjectId(db, idOrSlug, userId, perms);
  requireOwnerOrManage(role, perms);
  const existing = await wsRepo.findTask(db, taskId, projectId);
  if (!existing) throw new NotFoundException("Task not found");
  return wsRepo.createTaskComment(db, taskId, userId, input.body);
}

export async function setTaskAssignees(
  db: Db,
  idOrSlug: string,
  taskId: string,
  userId: string,
  perms: string[],
  input: ManageLegalProjectTaskAssigneesInput,
) {
  const { projectId, role } = await requireProjectId(db, idOrSlug, userId, perms);
  requireOwnerOrManage(role, perms);
  const existing = await wsRepo.findTask(db, taskId, projectId);
  if (!existing) throw new NotFoundException("Task not found");
  return wsRepo.setTaskAssignees(db, taskId, input.assignees);
}
