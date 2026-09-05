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

export interface LeadFilters extends OwnerScopedFilter {
  search?: string;
  status?: string;
  ownerId?: string;
  fundraisingEntity?: string;
  archived?: boolean;
}

function buildWhere(filters: LeadFilters): SQL | undefined {
  const parts: SQL[] = [];
  if (filters.ids !== undefined) {
    if (filters.ids.length === 0) parts.push(sql`false`);
    else parts.push(inArray(schema.investorLeads.id, filters.ids));
  }
  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    parts.push(or(ilike(schema.investorLeads.name, term), ilike(schema.investorLeads.company, term))!);
  }
  if (filters.status) parts.push(eq(schema.investorLeads.status, filters.status));
  if (filters.ownerId) parts.push(eq(schema.investorLeads.ownerId, filters.ownerId));
  if (filters.ownerScope?.length) parts.push(inArray(schema.investorLeads.ownerId, filters.ownerScope));
  if (filters.fundraisingEntity) parts.push(eq(schema.investorLeads.fundraisingEntity, filters.fundraisingEntity));
  parts.push(filters.archived ? isNotNull(schema.investorLeads.archivedAt) : isNull(schema.investorLeads.archivedAt));
  return parts.length ? and(...parts) : undefined;
}

export async function findMany(db: Db, filters: LeadFilters, page: number, limit: number) {
  const where = buildWhere(filters);
  const offset = (page - 1) * limit;
  const base = db.select().from(schema.investorLeads);
  const rows = await (where ? base.where(where) : base)
    .orderBy(desc(schema.investorLeads.createdAt))
    .limit(limit)
    .offset(offset);
  const [totalRow] = await db.select({ n: count() }).from(schema.investorLeads).where(where ?? sql`true`);
  return { data: rows, total: Number(totalRow?.n ?? 0) };
}

export async function findById(db: Db, id: string) {
  const [row] = await db.select().from(schema.investorLeads).where(eq(schema.investorLeads.id, id)).limit(1);
  return row ?? null;
}

export async function create(db: Db, data: Omit<typeof schema.investorLeads.$inferInsert, "id" | "createdAt" | "updatedAt">) {
  const id = createCuid();
  const now = new Date().toISOString();
  await db.insert(schema.investorLeads).values({ id, ...data, createdAt: now, updatedAt: now });
  return findById(db, id);
}

export async function update(db: Db, id: string, data: Partial<typeof schema.investorLeads.$inferInsert>) {
  const now = new Date().toISOString();
  await db.update(schema.investorLeads).set({ ...data, updatedAt: now }).where(eq(schema.investorLeads.id, id));
  return findById(db, id);
}

export async function remove(db: Db, id: string) {
  await db.delete(schema.investorLeads).where(eq(schema.investorLeads.id, id));
}
