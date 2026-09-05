import type {
  CreateInvestorLeadInput,
  ListInvestorLeadsQuery,
  UpdateInvestorLeadInput,
} from "@nexora/contracts/modules/investor-leads/investor-leads.validation";
import type { Db } from "@nexora/db";
import { NotFoundException } from "../http-exception";
import { resolveFundraisingEntityKey } from "../fundraising-entities/fundraising-entities.service";
import { canReadAllInvestors, investorOwnerScope } from "../investors/investor-rbac";
import * as repo from "./investor-leads.repository";

export async function list(db: Db, userId: string, permissions: string[], query: ListInvestorLeadsQuery) {
  const { page, limit, ...filters } = query;
  const ownerScope = investorOwnerScope(userId, permissions);
  const { data, total } = await repo.findMany(db, { ...filters, ownerScope }, page, limit);
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
}

async function getOwned(db: Db, id: string, userId: string, permissions: string[]) {
  const row = await repo.findById(db, id);
  if (!row) throw new NotFoundException("Lead not found");
  if (!canReadAllInvestors(permissions) && row.ownerId !== userId) {
    throw new NotFoundException("Lead not found");
  }
  return row;
}

export async function getById(db: Db, id: string, userId: string, permissions: string[]) {
  return getOwned(db, id, userId, permissions);
}

export async function create(db: Db, ownerId: string, input: CreateInvestorLeadInput) {
  const fundraisingEntity = await resolveFundraisingEntityKey(db, input.fundraisingEntity);
  return repo.create(db, {
    name: input.name,
    company: input.company ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    source: input.source ?? null,
    status: input.status,
    notes: input.notes ?? null,
    fundraisingEntity,
    ownerId,
  });
}

export async function update(db: Db, id: string, userId: string, permissions: string[], input: UpdateInvestorLeadInput) {
  await getOwned(db, id, userId, permissions);
  return repo.update(db, id, {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.company !== undefined && { company: input.company }),
    ...(input.email !== undefined && { email: input.email }),
    ...(input.phone !== undefined && { phone: input.phone }),
    ...(input.source !== undefined && { source: input.source }),
    ...(input.status !== undefined && { status: input.status }),
    ...(input.notes !== undefined && { notes: input.notes }),
    ...(input.fundraisingEntity !== undefined && {
      fundraisingEntity: await resolveFundraisingEntityKey(db, input.fundraisingEntity),
    }),
  });
}

export async function archive(db: Db, id: string, userId: string, permissions: string[]) {
  const existing = await getOwned(db, id, userId, permissions);
  return repo.update(db, id, { archivedAt: existing.archivedAt ?? new Date().toISOString() });
}

export async function unarchive(db: Db, id: string, userId: string, permissions: string[]) {
  await getOwned(db, id, userId, permissions);
  return repo.update(db, id, { archivedAt: null });
}

export async function remove(db: Db, id: string, userId: string, permissions: string[]) {
  await getOwned(db, id, userId, permissions);
  await repo.remove(db, id);
}
