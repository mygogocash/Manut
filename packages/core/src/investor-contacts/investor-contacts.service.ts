import type {
  CreateInvestorContactInput,
  ListInvestorContactsQuery,
  UpdateInvestorContactInput,
} from "@nexora/contracts/modules/investor-contacts/investor-contacts.validation";
import type { Db } from "@nexora/db";
import { NotFoundException } from "../http-exception";
import { resolveFundraisingEntityKey } from "../fundraising-entities/fundraising-entities.service";
import { canReadAllInvestors, investorOwnerScope } from "../investors/investor-rbac";
import * as repo from "./investor-contacts.repository";

async function getOwned(db: Db, id: string, userId: string, permissions: string[]) {
  const row = await repo.findById(db, id);
  if (!row) throw new NotFoundException("Contact not found");
  if (!canReadAllInvestors(permissions) && row.ownerId !== userId) throw new NotFoundException("Contact not found");
  return row;
}

export async function list(db: Db, userId: string, permissions: string[], query: ListInvestorContactsQuery) {
  const { page, limit, ...filters } = query;
  const { data, total } = await repo.findMany(db, { ...filters, ownerScope: investorOwnerScope(userId, permissions) }, page, limit);
  return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 } };
}

export async function getById(db: Db, id: string, userId: string, permissions: string[]) {
  return getOwned(db, id, userId, permissions);
}

export async function create(db: Db, ownerId: string, input: CreateInvestorContactInput) {
  return repo.create(db, {
    firstName: input.firstName,
    lastName: input.lastName ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    title: input.title ?? null,
    accountId: input.accountId ?? null,
    fundraisingEntity: await resolveFundraisingEntityKey(db, input.fundraisingEntity),
    ownerId,
  });
}

export async function update(db: Db, id: string, userId: string, permissions: string[], input: UpdateInvestorContactInput) {
  await getOwned(db, id, userId, permissions);
  return repo.update(db, id, {
    ...(input.firstName !== undefined && { firstName: input.firstName }),
    ...(input.lastName !== undefined && { lastName: input.lastName }),
    ...(input.email !== undefined && { email: input.email }),
    ...(input.phone !== undefined && { phone: input.phone }),
    ...(input.title !== undefined && { title: input.title }),
    ...(input.accountId !== undefined && { accountId: input.accountId }),
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
