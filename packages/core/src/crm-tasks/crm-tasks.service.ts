import { PERMISSIONS } from "@nexora/contracts";
import type {
  CreateCrmTaskInput,
  ListCrmTasksQuery,
  UpdateCrmTaskInput,
} from "@nexora/contracts/modules/crm-tasks/crm-tasks.validation";
import type { Db } from "@nexora/db";
import { BadRequestException, NotFoundException } from "../http-exception";
import * as repo from "./crm-tasks.repository";

function formatUtcDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function bucketToRange(bucket: "overdue" | "today" | "soon", now: Date) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const todayStr = formatUtcDate(today);

  if (bucket === "overdue") {
    const yesterday = new Date(today);
    yesterday.setUTCDate(today.getUTCDate() - 1);
    return { dueDateLte: formatUtcDate(yesterday) };
  }
  if (bucket === "today") {
    return { dueDateGte: todayStr, dueDateLte: todayStr };
  }
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(today.getUTCDate() + 1);
  const inSevenDays = new Date(today);
  inSevenDays.setUTCDate(today.getUTCDate() + 7);
  return { dueDateGte: formatUtcDate(tomorrow), dueDateLte: formatUtcDate(inSevenDays) };
}

async function requireAssignableUser(db: Db, userId: string) {
  const user = await repo.findAssignableUser(db, userId);
  if (!user) throw new BadRequestException("Assignee is not an active user.");
  return user;
}

export async function list(db: Db, userId: string, permissions: string[], query: ListCrmTasksQuery) {
  const { page, limit, bucket, ...filters } = query;
  const canSeeAll = permissions.includes(PERMISSIONS.CRM_TEAM_READ);
  const ownerScope = canSeeAll ? undefined : [userId];
  const range = bucket ? bucketToRange(bucket, new Date()) : {};

  const { data, total } = await repo.findMany(db, { ...filters, ...range, ownerScope }, page, limit);
  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
}

export async function getById(db: Db, id: string, userId: string, permissions: string[]) {
  const task = await repo.findById(db, id);
  if (!task) throw new NotFoundException("Task not found");

  const canSeeAll = permissions.includes(PERMISSIONS.CRM_TEAM_READ);
  if (!canSeeAll && task.ownerId !== userId) {
    throw new NotFoundException("Task not found");
  }
  return task;
}

export async function create(db: Db, creatorId: string, input: CreateCrmTaskInput) {
  let ownerId = creatorId;
  if (input.ownerId && input.ownerId !== creatorId) {
    await requireAssignableUser(db, input.ownerId);
    ownerId = input.ownerId;
  }

  return repo.create(db, {
    subject: input.subject,
    dueDate: input.dueDate,
    status: "open",
    ownerId,
    leadId: input.leadId ?? null,
    opportunityId: input.opportunityId ?? null,
    remindersSent: [],
  });
}

export async function update(
  db: Db,
  id: string,
  userId: string,
  permissions: string[],
  input: UpdateCrmTaskInput,
) {
  const existing = await getById(db, id, userId, permissions);

  if (existing.status === "cancelled") {
    throw new BadRequestException("Cannot edit a cancelled task. Recreate it instead.");
  }

  let completedAt: string | null | undefined;
  if (input.status === "done") {
    completedAt = existing.completedAt ?? new Date().toISOString();
  } else if (input.status !== undefined && existing.status === "done") {
    completedAt = null;
  }

  const ownerChanged = input.ownerId !== undefined && input.ownerId !== existing.ownerId;
  if (ownerChanged) {
    await requireAssignableUser(db, input.ownerId as string);
  }

  return repo.update(db, id, {
    ...(input.subject !== undefined && { subject: input.subject }),
    ...(input.dueDate !== undefined && {
      dueDate: input.dueDate,
      remindersSent: [],
      lastReminderSentAt: null,
    }),
    ...(ownerChanged && { ownerId: input.ownerId }),
    ...(input.status !== undefined && { status: input.status }),
    ...(completedAt !== undefined && { completedAt }),
  });
}

export async function complete(db: Db, id: string, userId: string, permissions: string[]) {
  const existing = await getById(db, id, userId, permissions);

  if (existing.status === "cancelled") {
    throw new BadRequestException("Cannot complete a cancelled task.");
  }
  if (existing.status === "done") {
    return existing;
  }

  return repo.update(db, id, {
    status: "done",
    completedAt: new Date().toISOString(),
  });
}

export async function remove(db: Db, id: string, userId: string, permissions: string[]) {
  await getById(db, id, userId, permissions);
  await repo.remove(db, id);
}
