import type {
  CreateInvestorTaskInput,
  ListInvestorTasksQuery,
  UpdateInvestorTaskInput,
} from "@nexora/contracts/modules/investor-tasks/investor-tasks.validation";
import type { Db } from "@nexora/db";
import { NotFoundException } from "../http-exception";
import { canReadAllInvestors, investorOwnerScope } from "../investors/investor-rbac";
import * as repo from "./investor-tasks.repository";

async function getOwned(db: Db, id: string, userId: string, permissions: string[]) {
  const row = await repo.findById(db, id);
  if (!row) throw new NotFoundException("Task not found");
  if (!canReadAllInvestors(permissions) && row.ownerId !== userId) throw new NotFoundException("Task not found");
  return row;
}

export async function list(db: Db, userId: string, permissions: string[], query: ListInvestorTasksQuery) {
  const { page, limit, ...filters } = query;
  const { data, total } = await repo.findMany(db, { ...filters, ownerScope: investorOwnerScope(userId, permissions) }, page, limit);
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
}

export async function getById(db: Db, id: string, userId: string, permissions: string[]) {
  return getOwned(db, id, userId, permissions);
}

export async function create(db: Db, ownerId: string, permissions: string[], input: CreateInvestorTaskInput) {
  return repo.create(db, {
    subject: input.subject,
    dueDate: input.dueDate,
    investorId: input.investorId,
    ownerId,
    status: "open",
  });
}

export async function update(db: Db, id: string, userId: string, permissions: string[], input: UpdateInvestorTaskInput) {
  await getOwned(db, id, userId, permissions);
  return repo.update(db, id, {
    ...(input.subject !== undefined && { subject: input.subject }),
    ...(input.dueDate !== undefined && { dueDate: input.dueDate }),
    ...(input.status !== undefined && { status: input.status }),
  });
}

export async function complete(db: Db, id: string, userId: string, permissions: string[]) {
  await getOwned(db, id, userId, permissions);
  return repo.update(db, id, { status: "done", completedAt: new Date().toISOString() });
}

export async function remove(db: Db, id: string, userId: string, permissions: string[]) {
  await getOwned(db, id, userId, permissions);
  await repo.remove(db, id);
}
