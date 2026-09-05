import type {
  CreateInvestorActivityInput,
  ListInvestorActivitiesQuery,
  UpdateInvestorActivityInput,
} from "@nexora/contracts/modules/investor-activities/investor-activities.validation";
import type { Db } from "@nexora/db";
import { NotFoundException } from "../http-exception";
import { canReadAllInvestors, investorOwnerScope } from "../investors/investor-rbac";
import * as repo from "./investor-activities.repository";

async function getOwned(db: Db, id: string, userId: string, permissions: string[]) {
  const row = await repo.findById(db, id);
  if (!row) throw new NotFoundException("Activity not found");
  if (!canReadAllInvestors(permissions) && row.ownerId !== userId) throw new NotFoundException("Activity not found");
  return row;
}

export async function list(db: Db, userId: string, permissions: string[], query: ListInvestorActivitiesQuery) {
  const { page, limit, ...filters } = query;
  const { data, total } = await repo.findMany(db, { ...filters, ownerScope: investorOwnerScope(userId, permissions) }, page, limit);
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
}

export async function getById(db: Db, id: string, userId: string, permissions: string[]) {
  return getOwned(db, id, userId, permissions);
}

export async function create(db: Db, ownerId: string, input: CreateInvestorActivityInput) {
  return repo.create(db, {
    type: input.type,
    subject: input.subject,
    body: input.body ?? null,
    occurredAt: input.occurredAt,
    durationMins: input.durationMins ?? null,
    investorId: input.investorId,
    ownerId,
  });
}

export async function update(db: Db, id: string, userId: string, permissions: string[], input: UpdateInvestorActivityInput) {
  await getOwned(db, id, userId, permissions);
  return repo.update(db, id, {
    ...(input.type !== undefined && { type: input.type }),
    ...(input.subject !== undefined && { subject: input.subject }),
    ...(input.body !== undefined && { body: input.body }),
    ...(input.occurredAt !== undefined && { occurredAt: input.occurredAt }),
    ...(input.durationMins !== undefined && { durationMins: input.durationMins }),
  });
}

export async function remove(db: Db, id: string, userId: string, permissions: string[]) {
  await getOwned(db, id, userId, permissions);
  await repo.remove(db, id);
}
