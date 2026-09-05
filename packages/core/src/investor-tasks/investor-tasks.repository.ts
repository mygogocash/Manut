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

export interface TaskFilters extends OwnerScopedFilter {
  status?: string;
  investorId?: string;
  ownerId?: string;
  fundraisingEntity?: string;
  bucket?: "overdue" | "today" | "soon";
}

function buildWhere(filters: TaskFilters): SQL | undefined {
  const parts: SQL[] = [];
  if (filters.ids !== undefined) {
    if (filters.ids.length === 0) parts.push(sql`false`);
    else parts.push(inArray(schema.investorTasks.id, filters.ids));
  }
  if (filters.status) parts.push(eq(schema.investorTasks.status, filters.status));
  if (filters.investorId) parts.push(eq(schema.investorTasks.investorId, filters.investorId));
  if (filters.ownerId) parts.push(eq(schema.investorTasks.ownerId, filters.ownerId));
  if (filters.ownerScope?.length) parts.push(inArray(schema.investorTasks.ownerId, filters.ownerScope));
  return parts.length ? and(...parts) : undefined;
}

export async function findMany(db: Db, filters: TaskFilters, page: number, limit: number) {
  const where = buildWhere(filters);
  const offset = (page - 1) * limit;
  const base = db.select().from(schema.investorTasks);
  const rows = await (where ? base.where(where) : base).orderBy(asc(schema.investorTasks.dueDate)).limit(limit).offset(offset);
  const [totalRow] = await db.select({ n: count() }).from(schema.investorTasks).where(where ?? sql`true`);
  return { data: rows, total: Number(totalRow?.n ?? 0) };
}

export async function findById(db: Db, id: string) {
  const [row] = await db.select().from(schema.investorTasks).where(eq(schema.investorTasks.id, id)).limit(1);
  return row ?? null;
}

export async function create(db: Db, data: Omit<typeof schema.investorTasks.$inferInsert, "id" | "createdAt" | "updatedAt">) {
  const id = createCuid();
  const now = new Date().toISOString();
  await db.insert(schema.investorTasks).values({ id, ...data, createdAt: now, updatedAt: now });
  return findById(db, id);
}

export async function update(db: Db, id: string, data: Partial<typeof schema.investorTasks.$inferInsert>) {
  const now = new Date().toISOString();
  await db.update(schema.investorTasks).set({ ...data, updatedAt: now }).where(eq(schema.investorTasks.id, id));
  return findById(db, id);
}

export async function remove(db: Db, id: string) {
  await db.delete(schema.investorTasks).where(eq(schema.investorTasks.id, id));
}
