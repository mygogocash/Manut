import { and, count, desc, eq, isNull, or } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";

const createdByCols = { id: schema.users.id, name: schema.users.name };

async function withCreatedBy(db: Db, row: typeof schema.visaKnowledgeArticles.$inferSelect) {
  let createdBy: { id: string; name: string } | null = null;
  if (row.createdById) {
    const [u] = await db.select(createdByCols).from(schema.users).where(eq(schema.users.id, row.createdById)).limit(1);
    createdBy = u ?? null;
  }
  return { ...row, createdBy };
}

export async function findMany(
  db: Db,
  filters: { country?: string; visaType?: string; includeInactive?: boolean },
  page: number,
  limit: number,
) {
  const parts = [];
  if (!filters.includeInactive) parts.push(eq(schema.visaKnowledgeArticles.isActive, true));
  if (filters.country) parts.push(eq(schema.visaKnowledgeArticles.country, filters.country));
  if (filters.visaType) parts.push(eq(schema.visaKnowledgeArticles.visaType, filters.visaType));
  const where = parts.length ? and(...parts) : undefined;
  const offset = (page - 1) * limit;
  const [totalRow] = await db.select({ n: count() }).from(schema.visaKnowledgeArticles).where(where);
  const rows = await db
    .select()
    .from(schema.visaKnowledgeArticles)
    .where(where)
    .orderBy(desc(schema.visaKnowledgeArticles.updatedAt))
    .limit(limit)
    .offset(offset);
  const data = await Promise.all(rows.map((r) => withCreatedBy(db, r)));
  return { data, total: Number(totalRow?.n ?? 0) };
}

export async function findById(db: Db, id: string) {
  const [row] = await db.select().from(schema.visaKnowledgeArticles).where(eq(schema.visaKnowledgeArticles.id, id)).limit(1);
  return row ? withCreatedBy(db, row) : null;
}

export async function slugExists(db: Db, slug: string) {
  const [row] = await db
    .select({ id: schema.visaKnowledgeArticles.id })
    .from(schema.visaKnowledgeArticles)
    .where(eq(schema.visaKnowledgeArticles.slug, slug))
    .limit(1);
  return !!row;
}

export async function create(
  db: Db,
  data: Omit<typeof schema.visaKnowledgeArticles.$inferInsert, "id" | "createdAt" | "updatedAt">,
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.visaKnowledgeArticles).values({ id, ...data, createdAt: now, updatedAt: now });
  return findById(db, id);
}

export async function update(db: Db, id: string, data: Partial<typeof schema.visaKnowledgeArticles.$inferInsert>) {
  await db.update(schema.visaKnowledgeArticles).set({ ...data, updatedAt: new Date().toISOString() }).where(eq(schema.visaKnowledgeArticles.id, id));
  return findById(db, id);
}

export async function findForRecord(db: Db, country?: string, visaType?: string) {
  const countryClause = country
    ? or(isNull(schema.visaKnowledgeArticles.country), eq(schema.visaKnowledgeArticles.country, country))
    : or(isNull(schema.visaKnowledgeArticles.country));
  const visaClause = visaType
    ? or(isNull(schema.visaKnowledgeArticles.visaType), eq(schema.visaKnowledgeArticles.visaType, visaType))
    : or(isNull(schema.visaKnowledgeArticles.visaType));
  const rows = await db
    .select()
    .from(schema.visaKnowledgeArticles)
    .where(and(eq(schema.visaKnowledgeArticles.isActive, true), countryClause!, visaClause!))
    .orderBy(desc(schema.visaKnowledgeArticles.updatedAt));
  return Promise.all(rows.map((r) => withCreatedBy(db, r)));
}
