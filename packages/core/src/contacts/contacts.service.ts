import { eq } from "drizzle-orm";
import { PERMISSIONS } from "@nexora/contracts";
import type {
  CreateContactInput,
  ListContactsQuery,
  UpdateContactInput,
} from "@nexora/contracts/modules/contacts/contacts.validation";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";
import { NotFoundException } from "../http-exception";
import { createCuid } from "../lib/id";
import * as accountsRepo from "../accounts/accounts.repository";
import * as repo from "./contacts.repository";

export async function list(db: Db, userId: string, permissions: string[], query: ListContactsQuery) {
  const { page, limit, ...filters } = query;
  const canSeeAll = permissions.includes(PERMISSIONS.CRM_TEAM_READ);
  const accountOwnerScope = canSeeAll ? undefined : [userId];

  const { data, total } = await repo.findMany(db, { ...filters, accountOwnerScope }, page, limit);
  return {
    data,
    meta: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
  };
}

export async function getById(db: Db, id: string, userId: string, permissions: string[]) {
  const contact = await repo.findById(db, id);
  if (!contact) throw new NotFoundException("Contact not found");

  const canSeeAll = permissions.includes(PERMISSIONS.CRM_TEAM_READ);
  if (!canSeeAll && contact.account?.ownerId !== userId) {
    throw new NotFoundException("Contact not found");
  }
  return contact;
}

export async function create(db: Db, userId: string, permissions: string[], input: CreateContactInput) {
  const canSeeAll = permissions.includes(PERMISSIONS.CRM_TEAM_READ);
  const account = await accountsRepo.findById(db, input.accountId);
  if (!account || (!canSeeAll && account.ownerId !== userId)) {
    throw new NotFoundException("Account not found");
  }

  const existingCount = await repo.countForAccount(db, input.accountId);
  const promote = input.isPrimary === true || existingCount === 0;

  if (promote) {
    return db.transaction(async (tx) => {
      const id = createCuid();
      const now = new Date().toISOString();
      await tx.insert(schema.crmContacts).values({
        id,
        accountId: input.accountId,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email ?? null,
        phone: input.phone ?? null,
        title: input.title ?? null,
        notes: input.notes ?? null,
        isPrimary: true,
        createdAt: now,
        updatedAt: now,
      });
      await repo.clearPrimaryForAccount(tx, input.accountId, id);
      return repo.findById(db, id);
    });
  }

  return repo.create(db, {
    accountId: input.accountId,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email ?? null,
    phone: input.phone ?? null,
    title: input.title ?? null,
    notes: input.notes ?? null,
    isPrimary: false,
  });
}

export async function update(
  db: Db,
  id: string,
  userId: string,
  permissions: string[],
  input: UpdateContactInput,
) {
  const existing = await getById(db, id, userId, permissions);
  const promoting = input.isPrimary === true && !existing.isPrimary;

  const patch = {
    ...(input.firstName !== undefined && { firstName: input.firstName }),
    ...(input.lastName !== undefined && { lastName: input.lastName }),
    ...(input.email !== undefined && { email: input.email || null }),
    ...(input.phone !== undefined && { phone: input.phone || null }),
    ...(input.title !== undefined && { title: input.title || null }),
    ...(input.notes !== undefined && { notes: input.notes || null }),
    ...(input.isPrimary !== undefined && { isPrimary: input.isPrimary }),
  };

  if (promoting && existing.account) {
    return db.transaction(async (tx) => {
      await tx
        .update(schema.crmContacts)
        .set({ ...patch, updatedAt: new Date().toISOString() })
        .where(eq(schema.crmContacts.id, id));
      await repo.clearPrimaryForAccount(tx, existing.account!.id, id);
      return repo.findById(db, id);
    });
  }

  return repo.update(db, id, patch);
}

export async function remove(db: Db, id: string, userId: string, permissions: string[]) {
  await getById(db, id, userId, permissions);
  await repo.remove(db, id);
}

export async function archive(db: Db, id: string, userId: string, permissions: string[]) {
  const existing = await getById(db, id, userId, permissions);
  return repo.update(db, id, {
    archivedAt: existing.archivedAt ?? new Date().toISOString(),
  });
}

export async function unarchive(db: Db, id: string, userId: string, permissions: string[]) {
  await getById(db, id, userId, permissions);
  return repo.update(db, id, { archivedAt: null });
}
