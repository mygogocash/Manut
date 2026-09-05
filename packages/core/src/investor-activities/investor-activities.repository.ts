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

export interface ActivityFilters extends OwnerScopedFilter {
  type?: string;
  investorId?: string;
  ownerId?: string;
  fundraisingEntity?: string;
}

function buildWhere(filters: ActivityFilters): SQL | undefined {
  const parts: SQL[] = [];
  if (filters.ids !== undefined) {
    if (filters.ids.length === 0) parts.push(sql`false`);
    else parts.push(inArray(schema.investorActivities.id, filters.ids));
  }
  if (filters.type) parts.push(eq(schema.investorActivities.type, filters.type));
  if (filters.investorId) parts.push(eq(schema.investorActivities.investorId, filters.investorId));
  if (filters.ownerId) parts.push(eq(schema.investorActivities.ownerId, filters.ownerId));
  if (filters.ownerScope?.length) parts.push(inArray(schema.investorActivities.ownerId, filters.ownerScope));
  return parts.length ? and(...parts) : undefined;
}

export async function findMany(db: Db, filters: ActivityFilters, page: number, limit: number) {
  const where = buildWhere(filters);
  const offset = (page - 1) * limit;
  const base = db.select().from(schema.investorActivities);
  const rows = await (where ? base.where(where) : base).orderBy(desc(schema.investorActivities.occurredAt)).limit(limit).offset(offset);
  const [totalRow] = await db.select({ n: count() }).from(schema.investorActivities).where(where ?? sql`true`);
  return { data: rows, total: Number(totalRow?.n ?? 0) };
}

export async function findById(db: Db, id: string) {
  const [row] = await db.select().from(schema.investorActivities).where(eq(schema.investorActivities.id, id)).limit(1);
  return row ?? null;
}

export async function create(db: Db, data: Omit<typeof schema.investorActivities.$inferInsert, "id" | "createdAt">) {
  const id = createCuid();
  const now = new Date().toISOString();
  await db.insert(schema.investorActivities).values({ id, ...data, createdAt: now });
  return findById(db, id);
}

export async function update(db: Db, id: string, data: Partial<typeof schema.investorActivities.$inferInsert>) {
  await db.update(schema.investorActivities).set(data).where(eq(schema.investorActivities.id, id));
  return findById(db, id);
}

export async function remove(db: Db, id: string) {
  await db.delete(schema.investorActivities).where(eq(schema.investorActivities.id, id));
}
