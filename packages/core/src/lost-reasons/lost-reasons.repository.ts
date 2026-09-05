import { asc, eq } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";
import { createCuid } from "../lib/id";

export async function list(db: Db, includeInactive: boolean) {
  const q = db.select().from(schema.crmLostReasons);
  const rows = includeInactive
    ? await q.orderBy(asc(schema.crmLostReasons.sortOrder), asc(schema.crmLostReasons.label))
    : await q
        .where(eq(schema.crmLostReasons.isActive, true))
        .orderBy(asc(schema.crmLostReasons.sortOrder), asc(schema.crmLostReasons.label));
  return rows;
}

export async function findById(db: Db, id: string) {
  const [row] = await db
    .select()
    .from(schema.crmLostReasons)
    .where(eq(schema.crmLostReasons.id, id))
    .limit(1);
  return row ?? null;
}

export async function findByCode(db: Db, code: string) {
  const [row] = await db
    .select()
    .from(schema.crmLostReasons)
    .where(eq(schema.crmLostReasons.code, code))
    .limit(1);
  return row ?? null;
}

export async function create(db: Db, data: { code: string; label: string; sortOrder: number }) {
  const id = createCuid();
  const now = new Date().toISOString();
  await db.insert(schema.crmLostReasons).values({
    id,
    code: data.code,
    label: data.label,
    sortOrder: data.sortOrder,
    isSystem: false,
    isActive: true,
    updatedAt: now,
  });
  return findById(db, id);
}

export async function update(
  db: Db,
  id: string,
  data: Partial<{ label: string; sortOrder: number; isActive: boolean }>,
) {
  const now = new Date().toISOString();
  await db
    .update(schema.crmLostReasons)
    .set({ ...data, updatedAt: now })
    .where(eq(schema.crmLostReasons.id, id));
  return findById(db, id);
}

export async function remove(db: Db, id: string) {
  await db.delete(schema.crmLostReasons).where(eq(schema.crmLostReasons.id, id));
}
