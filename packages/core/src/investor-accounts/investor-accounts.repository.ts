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

export interface AccountFilters extends OwnerScopedFilter {
  search?: string;
  region?: string;
  ownerId?: string;
  fundraisingEntity?: string;
  archived?: boolean;
}

function buildWhere(filters: AccountFilters): SQL | undefined {
  const parts: SQL[] = [];
  if (filters.ids !== undefined) {
    if (filters.ids.length === 0) parts.push(sql`false`);
    else parts.push(inArray(schema.investorAccounts.id, filters.ids));
  }
  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    parts.push(ilike(schema.investorAccounts.name, term));
  }
  if (filters.region) parts.push(eq(schema.investorAccounts.region, filters.region));
  if (filters.ownerId) parts.push(eq(schema.investorAccounts.ownerId, filters.ownerId));
  if (filters.ownerScope?.length) parts.push(inArray(schema.investorAccounts.ownerId, filters.ownerScope));
  if (filters.fundraisingEntity) parts.push(eq(schema.investorAccounts.fundraisingEntity, filters.fundraisingEntity));
  parts.push(filters.archived ? isNotNull(schema.investorAccounts.archivedAt) : isNull(schema.investorAccounts.archivedAt));
  return parts.length ? and(...parts) : undefined;
}

export async function findMany(db: Db, filters: AccountFilters, page: number, limit: number) {
  const where = buildWhere(filters);
  const offset = (page - 1) * limit;
  const base = db.select().from(schema.investorAccounts);
  const rows = await (where ? base.where(where) : base)
    .orderBy(desc(schema.investorAccounts.createdAt))
    .limit(limit)
    .offset(offset);
  const [totalRow] = await db.select({ n: count() }).from(schema.investorAccounts).where(where ?? sql`true`);
  return { data: rows, total: Number(totalRow?.n ?? 0) };
}

export async function findById(db: Db, id: string) {
  const [row] = await db.select().from(schema.investorAccounts).where(eq(schema.investorAccounts.id, id)).limit(1);
  return row ?? null;
}

export async function create(db: Db, data: Omit<typeof schema.investorAccounts.$inferInsert, "id" | "createdAt" | "updatedAt">) {
  const id = createCuid();
  const now = new Date().toISOString();
  await db.insert(schema.investorAccounts).values({ id, ...data, createdAt: now, updatedAt: now });
  return findById(db, id);
}

export async function update(db: Db, id: string, data: Partial<typeof schema.investorAccounts.$inferInsert>) {
  const now = new Date().toISOString();
  await db.update(schema.investorAccounts).set({ ...data, updatedAt: now }).where(eq(schema.investorAccounts.id, id));
  return findById(db, id);
}

export async function remove(db: Db, id: string) {
  await db.delete(schema.investorAccounts).where(eq(schema.investorAccounts.id, id));
}
