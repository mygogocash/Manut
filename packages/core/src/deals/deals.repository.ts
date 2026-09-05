import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  sql,
  type SQL,
} from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";
import { createCuid } from "../lib/id";

export interface ListDealsFilters {
  search?: string;
  stage?: string;
  type?: string;
  ownerId?: string;
  ownerScope?: string[];
}

function buildWhere(filters: ListDealsFilters): SQL | undefined {
  const parts: SQL[] = [];
  if (filters.search?.trim()) {
    parts.push(ilike(schema.deals.company, `%${filters.search.trim()}%`));
  }
  if (filters.stage) parts.push(eq(schema.deals.stage, filters.stage));
  if (filters.type) parts.push(eq(schema.deals.type, filters.type));
  if (filters.ownerId) parts.push(eq(schema.deals.ownerId, filters.ownerId));
  if (filters.ownerScope?.length) parts.push(inArray(schema.deals.ownerId, filters.ownerScope));
  return parts.length ? and(...parts) : undefined;
}

async function withRelations(db: Db, row: typeof schema.deals.$inferSelect) {
  const [owner] = await db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, row.ownerId))
    .limit(1);

  let partner: { id: string; company: string | null } | null = null;
  if (row.partnerId) {
    const [p] = await db
      .select({ id: schema.partners.id, company: schema.partners.company })
      .from(schema.partners)
      .where(eq(schema.partners.id, row.partnerId))
      .limit(1);
    partner = p ?? null;
  }

  return { ...row, owner: owner ?? null, partner };
}

export async function findMany(db: Db, filters: ListDealsFilters, page: number, limit: number) {
  const where = buildWhere(filters);
  const offset = (page - 1) * limit;

  const [totalRow] = await db.select({ n: count() }).from(schema.deals).where(where);
  const rows = await db
    .select()
    .from(schema.deals)
    .where(where)
    .orderBy(desc(schema.deals.createdAt))
    .limit(limit)
    .offset(offset);

  const data = await Promise.all(rows.map((row) => withRelations(db, row)));
  return { data, total: Number(totalRow?.n ?? 0) };
}

export async function findById(db: Db, id: string) {
  const [row] = await db.select().from(schema.deals).where(eq(schema.deals.id, id)).limit(1);
  if (!row) return null;
  return withRelations(db, row);
}

export async function create(
  db: Db,
  data: Omit<typeof schema.deals.$inferInsert, "id" | "createdAt" | "updatedAt">,
) {
  const id = createCuid();
  const now = new Date().toISOString();
  await db.insert(schema.deals).values({ id, ...data, createdAt: now, updatedAt: now });
  return findById(db, id);
}

export async function update(
  db: Db,
  id: string,
  data: Partial<typeof schema.deals.$inferInsert>,
) {
  const now = new Date().toISOString();
  await db.update(schema.deals).set({ ...data, updatedAt: now }).where(eq(schema.deals.id, id));
  return findById(db, id);
}

export async function remove(db: Db, id: string) {
  await db.delete(schema.deals).where(eq(schema.deals.id, id));
}

export async function pipelineSummary(db: Db, ownerScope?: string[]) {
  const where = ownerScope?.length ? inArray(schema.deals.ownerId, ownerScope) : undefined;
  const rows = await db
    .select({
      stage: schema.deals.stage,
      count: count(),
      totalValue: sql<string>`coalesce(sum(${schema.deals.value}), 0)`,
    })
    .from(schema.deals)
    .where(where)
    .groupBy(schema.deals.stage);

  return rows.map((row) => ({
    stage: row.stage,
    count: Number(row.count),
    totalValue: Number(row.totalValue),
  }));
}
