import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";
import { createCuid } from "../lib/id";
import type { OwnerScopedFilter } from "../crm-shared/bulk-selection";

export interface ContactFilters extends OwnerScopedFilter {
  search?: string;
  accountId?: string;
  ownerId?: string;
  fundraisingEntity?: string;
  archived?: boolean;
}

function buildWhere(filters: ContactFilters): SQL | undefined {
  const parts: SQL[] = [];
  if (filters.ids !== undefined) {
    if (filters.ids.length === 0) parts.push(sql`false`);
    else parts.push(inArray(schema.investorContacts.id, filters.ids));
  }
  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    parts.push(or(ilike(schema.investorContacts.firstName, term), ilike(schema.investorContacts.lastName, term))!);
  }
  if (filters.accountId) parts.push(eq(schema.investorContacts.accountId, filters.accountId));
  if (filters.ownerId) parts.push(eq(schema.investorContacts.ownerId, filters.ownerId));
  if (filters.ownerScope?.length) parts.push(inArray(schema.investorContacts.ownerId, filters.ownerScope));
  if (filters.fundraisingEntity) parts.push(eq(schema.investorContacts.fundraisingEntity, filters.fundraisingEntity));
  parts.push(filters.archived ? isNotNull(schema.investorContacts.archivedAt) : isNull(schema.investorContacts.archivedAt));
  return parts.length ? and(...parts) : undefined;
}

export async function findMany(db: Db, filters: ContactFilters, page: number, limit: number) {
  const where = buildWhere(filters);
  const offset = (page - 1) * limit;
  const base = db.select().from(schema.investorContacts);
  const rows = await (where ? base.where(where) : base).orderBy(desc(schema.investorContacts.createdAt)).limit(limit).offset(offset);
  const [totalRow] = await db.select({ n: count() }).from(schema.investorContacts).where(where ?? sql`true`);
  return { data: rows, total: Number(totalRow?.n ?? 0) };
}

export async function findById(db: Db, id: string) {
  const [row] = await db.select().from(schema.investorContacts).where(eq(schema.investorContacts.id, id)).limit(1);
  return row ?? null;
}

export async function create(db: Db, data: Omit<typeof schema.investorContacts.$inferInsert, "id" | "createdAt" | "updatedAt">) {
  const id = createCuid();
  const now = new Date().toISOString();
  await db.insert(schema.investorContacts).values({ id, ...data, createdAt: now, updatedAt: now });
  return findById(db, id);
}

export async function update(db: Db, id: string, data: Partial<typeof schema.investorContacts.$inferInsert>) {
  const now = new Date().toISOString();
  await db.update(schema.investorContacts).set({ ...data, updatedAt: now }).where(eq(schema.investorContacts.id, id));
  return findById(db, id);
}

export async function remove(db: Db, id: string) {
  await db.delete(schema.investorContacts).where(eq(schema.investorContacts.id, id));
}
