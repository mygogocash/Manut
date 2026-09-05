import type {
  CreateInvestorAccountInput,
  ListInvestorAccountsQuery,
  UpdateInvestorAccountInput,
} from "@nexora/contracts/modules/investor-accounts/investor-accounts.validation";
import type { Db } from "@nexora/db";
import { NotFoundException } from "../http-exception";
import { resolveFundraisingEntityKey } from "../fundraising-entities/fundraising-entities.service";
import { canReadAllInvestors, investorOwnerScope } from "../investors/investor-rbac";
import * as repo from "./investor-accounts.repository";

async function getOwned(db: Db, id: string, userId: string, permissions: string[]) {
  const row = await repo.findById(db, id);
  if (!row) throw new NotFoundException("Account not found");
  if (!canReadAllInvestors(permissions) && row.ownerId !== userId) {
    throw new NotFoundException("Account not found");
  }
  return row;
}

export async function list(db: Db, userId: string, permissions: string[], query: ListInvestorAccountsQuery) {
  const { page, limit, ...filters } = query;
  const ownerScope = investorOwnerScope(userId, permissions);
  const { data, total } = await repo.findMany(db, { ...filters, ownerScope }, page, limit);
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
}

export async function getById(db: Db, id: string, userId: string, permissions: string[]) {
  return getOwned(db, id, userId, permissions);
}

export async function create(db: Db, ownerId: string, input: CreateInvestorAccountInput) {
  const fundraisingEntity = await resolveFundraisingEntityKey(db, input.fundraisingEntity);
  return repo.create(db, {
    name: input.name,
    type: input.type ?? null,
    website: input.website ?? null,
    location: input.location ?? null,
    region: input.region ?? null,
    notes: input.notes ?? null,
    fundraisingEntity,
    ownerId,
  });
}

export async function update(db: Db, id: string, userId: string, permissions: string[], input: UpdateInvestorAccountInput) {
  await getOwned(db, id, userId, permissions);
  return repo.update(db, id, {
    ...(input.name !== undefined && { name: input.name }),
    ...(input.type !== undefined && { type: input.type }),
    ...(input.website !== undefined && { website: input.website }),
    ...(input.location !== undefined && { location: input.location }),
    ...(input.region !== undefined && { region: input.region }),
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
