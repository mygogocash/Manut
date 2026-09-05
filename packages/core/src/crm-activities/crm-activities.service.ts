import { PERMISSIONS } from "@nexora/contracts";
import type {
  CreateCrmActivityInput,
  ListCrmActivitiesQuery,
  UpdateCrmActivityInput,
} from "@nexora/contracts/modules/crm-activities/crm-activities.validation";
import type { Db } from "@nexora/db";
import { NotFoundException } from "../http-exception";
import * as repo from "./crm-activities.repository";

export async function list(db: Db, userId: string, permissions: string[], query: ListCrmActivitiesQuery) {
  const { page, limit, ...filters } = query;
  const canSeeAll = permissions.includes(PERMISSIONS.CRM_TEAM_READ);
  const ownerScope = canSeeAll ? undefined : [userId];

  const { data, total } = await repo.findMany(db, { ...filters, ownerScope }, page, limit);
  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
}

export async function getById(db: Db, id: string, userId: string, permissions: string[]) {
  const activity = await repo.findById(db, id);
  if (!activity) throw new NotFoundException("Activity not found");

  const canSeeAll = permissions.includes(PERMISSIONS.CRM_TEAM_READ);
  if (!canSeeAll && activity.ownerId !== userId) {
    throw new NotFoundException("Activity not found");
  }
  return activity;
}

export async function create(db: Db, ownerId: string, input: CreateCrmActivityInput) {
  return repo.create(db, {
    type: input.type,
    subject: input.subject,
    body: input.body ?? null,
    occurredAt: input.occurredAt,
    durationMins: input.durationMins ?? null,
    ownerId,
    leadId: input.leadId ?? null,
    opportunityId: input.opportunityId ?? null,
    contactId: input.contactId ?? null,
    accountId: input.accountId ?? null,
  });
}

export async function update(
  db: Db,
  id: string,
  userId: string,
  permissions: string[],
  input: UpdateCrmActivityInput,
) {
  await getById(db, id, userId, permissions);

  return repo.update(db, id, {
    ...(input.type !== undefined && { type: input.type }),
    ...(input.subject !== undefined && { subject: input.subject }),
    ...(input.body !== undefined && { body: input.body || null }),
    ...(input.occurredAt !== undefined && { occurredAt: input.occurredAt }),
    ...(input.durationMins !== undefined && { durationMins: input.durationMins }),
  });
}

export async function remove(db: Db, id: string, userId: string, permissions: string[]) {
  await getById(db, id, userId, permissions);
  await repo.remove(db, id);
}
