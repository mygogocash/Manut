import { asc, eq } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";
import { createCuid } from "../lib/id";

export async function list(db: Db, includeInactive: boolean) {
  const q = db.select().from(schema.crmLeadSources);
  const rows = includeInactive
    ? await q.orderBy(asc(schema.crmLeadSources.sortOrder), asc(schema.crmLeadSources.label))
    : await q.where(eq(schema.crmLeadSources.isActive, true)).orderBy(
        asc(schema.crmLeadSources.sortOrder),
        asc(schema.crmLeadSources.label),
      );
  return rows;
}

export async function findById(db: Db, id: string) {
  const [row] = await db.select().from(schema.crmLeadSources).where(eq(schema.crmLeadSources.id, id)).limit(1);
  return row ?? null;
}

export async function findByCode(db: Db, code: string) {
  const [row] = await db.select().from(schema.crmLeadSources).where(eq(schema.crmLeadSources.code, code)).limit(1);
  return row ?? null;
}

export async function create(db: Db, data: { code: string; label: string; sortOrder: number }) {
  const id = createCuid();
  const now = new Date().toISOString();
  await db.insert(schema.crmLeadSources).values({
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
  await db.update(schema.crmLeadSources).set({ ...data, updatedAt: now }).where(eq(schema.crmLeadSources.id, id));
  return findById(db, id);
}

export async function remove(db: Db, id: string) {
  await db.delete(schema.crmLeadSources).where(eq(schema.crmLeadSources.id, id));
}

export async function countLeadsBySource(db: Db, code: string) {
  const rows = await db
    .select({ id: schema.crmLeads.id })
    .from(schema.crmLeads)
    .where(eq(schema.crmLeads.source, code));
  return rows.length;
}
