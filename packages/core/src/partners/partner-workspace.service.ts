import type {
  CreatePartnerColumnInput,
  CreatePartnerTaskCommentInput,
  CreatePartnerTaskInput,
  CreatePartnerTaskResourceInput,
  ManagePartnerMembersInput,
  ManagePartnerTaskAssigneesInput,
  UpdatePartnerColumnInput,
  UpdatePartnerTaskInput,
} from "@nexora/contracts/modules/partners/partner-workspace.validation";
import type { Db } from "@nexora/db";
import { ConflictException, NotFoundException } from "../http-exception";
import { syncWorkspaceFromLinkedMarketingProjects } from "./partner-workspace-sync";
import * as wsRepo from "./partner-workspace.repository";

async function requirePartnerId(db: Db, idOrSlug: string) {
  const partner = await wsRepo.requirePartner(db, idOrSlug);
  if (!partner) throw new NotFoundException("Partner not found");
  return partner.id;
}

export async function getBoard(db: Db, partnerIdOrSlug: string) {
  const partner = await wsRepo.requirePartner(db, partnerIdOrSlug);
  if (!partner) throw new NotFoundException("Partner not found");

  await syncWorkspaceFromLinkedMarketingProjects(db, partner.id);

  let columns = await wsRepo.listColumns(db, partner.id);
  if (columns.length === 0) {
    await wsRepo.seedDefaultColumns(db, partner.id);
    columns = await wsRepo.listColumns(db, partner.id);
  }

  const [tasks, members] = await Promise.all([
    wsRepo.listTasksWithRelations(db, partner.id),
    wsRepo.listMembers(db, partner.id),
  ]);

  return {
    partner: {
      id: partner.id,
      slug: partner.slug,
      company: partner.company,
      ownerId: partner.ownerId,
    },
    columns,
    tasks,
    members,
  };
}

export async function createTask(
  db: Db,
  idOrSlug: string,
  input: CreatePartnerTaskInput,
  actorId: string,
) {
  const partnerId = await requirePartnerId(db, idOrSlug);
  if (input.parentTaskId) {
    const parent = await wsRepo.findParentTask(db, input.parentTaskId);
    if (!parent || parent.partnerId !== partnerId) {
      throw new ConflictException("Parent task does not belong to this partner");
    }
  }
  const { assigneeIds, columnKey: _columnKey, ...taskFields } = input;
  return wsRepo.createTask(db, partnerId, {
    parentTaskId: taskFields.parentTaskId,
    title: taskFields.title,
    description: taskFields.description ?? null,
    status: taskFields.status,
    priority: taskFields.priority,
    ownerId: taskFields.ownerId ?? actorId,
    startDate: taskFields.startDate ?? null,
    endDate: taskFields.endDate ?? null,
    sortOrder: taskFields.sortOrder,
    assigneeIds,
  });
}

export async function updateTask(db: Db, idOrSlug: string, taskId: string, input: UpdatePartnerTaskInput) {
  const partnerId = await requirePartnerId(db, idOrSlug);
  const existing = await wsRepo.findTask(db, taskId, partnerId);
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

export async function deleteTask(db: Db, idOrSlug: string, taskId: string) {
  const partnerId = await requirePartnerId(db, idOrSlug);
  const existing = await wsRepo.findTask(db, taskId, partnerId);
  if (!existing) throw new NotFoundException("Task not found");
  await wsRepo.deleteTask(db, taskId);
  return { success: true as const };
}

export async function createColumn(db: Db, idOrSlug: string, input: CreatePartnerColumnInput) {
  const partnerId = await requirePartnerId(db, idOrSlug);
  return wsRepo.createColumn(db, partnerId, {
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
  input: UpdatePartnerColumnInput,
) {
  const partnerId = await requirePartnerId(db, idOrSlug);
  const existing = await wsRepo.findColumn(db, columnId, partnerId);
  if (!existing) throw new NotFoundException("Column not found");
  return wsRepo.updateColumn(db, columnId, {
    ...(input.label !== undefined && { label: input.label }),
    ...(input.color !== undefined && { color: input.color }),
    ...(input.sortOrder !== undefined && { sortOrder: input.sortOrder }),
  });
}

export async function deleteColumn(db: Db, idOrSlug: string, columnId: string) {
  const partnerId = await requirePartnerId(db, idOrSlug);
  const existing = await wsRepo.findColumn(db, columnId, partnerId);
  if (!existing) throw new NotFoundException("Column not found");
  await wsRepo.deleteColumn(db, columnId);
  return { success: true as const };
}

export async function listMembers(db: Db, idOrSlug: string) {
  const partnerId = await requirePartnerId(db, idOrSlug);
  return wsRepo.listMembers(db, partnerId);
}

export async function setMembers(db: Db, idOrSlug: string, input: ManagePartnerMembersInput) {
  const partnerId = await requirePartnerId(db, idOrSlug);
  return wsRepo.setMembers(db, partnerId, input.userIds);
}

export async function createTaskComment(
  db: Db,
  idOrSlug: string,
  taskId: string,
  input: CreatePartnerTaskCommentInput,
  actorId: string,
) {
  const partnerId = await requirePartnerId(db, idOrSlug);
  const existing = await wsRepo.findTask(db, taskId, partnerId);
  if (!existing) throw new NotFoundException("Task not found");
  return wsRepo.createTaskComment(db, taskId, actorId, input.body);
}

export async function listTaskResources(db: Db, idOrSlug: string, taskId: string) {
  const partnerId = await requirePartnerId(db, idOrSlug);
  const existing = await wsRepo.findTask(db, taskId, partnerId);
  if (!existing) throw new NotFoundException("Task not found");
  return wsRepo.listTaskResources(db, taskId);
}

export async function addTaskResource(
  db: Db,
  idOrSlug: string,
  taskId: string,
  input: CreatePartnerTaskResourceInput,
  actorId: string,
) {
  const partnerId = await requirePartnerId(db, idOrSlug);
  const existing = await wsRepo.findTask(db, taskId, partnerId);
  if (!existing) throw new NotFoundException("Task not found");
  return wsRepo.addTaskResource(db, taskId, {
    kind: input.kind,
    label: input.label,
    url: input.url,
    createdBy: actorId,
  });
}

export async function removeTaskResource(
  db: Db,
  idOrSlug: string,
  taskId: string,
  resourceId: string,
) {
  const partnerId = await requirePartnerId(db, idOrSlug);
  const existing = await wsRepo.findTask(db, taskId, partnerId);
  if (!existing) throw new NotFoundException("Task not found");
  const resource = await wsRepo.findTaskResource(db, resourceId);
  if (!resource || resource.taskId !== taskId) {
    throw new NotFoundException("Resource not found");
  }
  await wsRepo.removeTaskResource(db, resourceId);
  return { success: true as const };
}

export async function setTaskAssignees(
  db: Db,
  idOrSlug: string,
  taskId: string,
  input: ManagePartnerTaskAssigneesInput,
) {
  const partnerId = await requirePartnerId(db, idOrSlug);
  const existing = await wsRepo.findTask(db, taskId, partnerId);
  if (!existing) throw new NotFoundException("Task not found");
  return wsRepo.setTaskAssignees(db, taskId, input.assignees);
}
