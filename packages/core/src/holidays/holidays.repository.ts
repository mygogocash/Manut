import { and, asc, count, eq, gte, lt } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";

type Filters = { entityId?: string; year?: number };

function buildWhere(filters: Filters) {
  const parts = [];
  if (filters.entityId) parts.push(eq(schema.publicHolidays.entityId, filters.entityId));
  if (filters.year) {
    parts.push(gte(schema.publicHolidays.date, `${filters.year}-01-01`));
    parts.push(lt(schema.publicHolidays.date, `${filters.year + 1}-01-01`));
  }
  return parts.length ? and(...parts) : undefined;
}

async function hydrate(db: Db, row: typeof schema.publicHolidays.$inferSelect) {
  const [entity] = await db
    .select({ id: schema.entities.id, name: schema.entities.name, code: schema.entities.code })
    .from(schema.entities)
    .where(eq(schema.entities.id, row.entityId))
    .limit(1);
  return { ...row, entity: entity ?? { id: row.entityId, name: "", code: "" } };
}

export async function findMany(db: Db, filters: Filters, page: number, limit: number) {
  const offset = (page - 1) * limit;
  const where = buildWhere(filters);
  const [totalRow] = await db.select({ n: count() }).from(schema.publicHolidays).where(where);
  const rows = await db
    .select()
    .from(schema.publicHolidays)
    .where(where)
    .orderBy(asc(schema.publicHolidays.date))
    .limit(limit)
    .offset(offset);
  const data = await Promise.all(rows.map((r) => hydrate(db, r)));
  return { data, total: Number(totalRow?.n ?? 0) };
}

export async function findById(db: Db, id: string) {
  const [row] = await db.select().from(schema.publicHolidays).where(eq(schema.publicHolidays.id, id)).limit(1);
  if (!row) return null;
  return hydrate(db, row);
}

export async function create(
  db: Db,
  input: { entityId: string; date: string; name: string; notes?: string | null; isActive: boolean },
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.publicHolidays).values({
    id,
    entityId: input.entityId,
    date: input.date,
    name: input.name,
    notes: input.notes ?? null,
    isActive: input.isActive,
    createdAt: now,
    updatedAt: now,
  });
  return findById(db, id);
}

export async function update(
  db: Db,
  id: string,
  input: Partial<{ date: string; name: string; notes: string | null; isActive: boolean }>,
) {
  await db
    .update(schema.publicHolidays)
    .set({ ...input, updatedAt: new Date().toISOString() })
    .where(eq(schema.publicHolidays.id, id));
  return findById(db, id);
}

export async function remove(db: Db, id: string) {
  await db.delete(schema.publicHolidays).where(eq(schema.publicHolidays.id, id));
}

/** Detect unique (entityId, date) violations without Prisma error codes. */
export function isUniqueViolation(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: string; message?: string };
  return e.code === "23505" || Boolean(e.message?.includes("public_holidays_entity_id_date_key"));
}

