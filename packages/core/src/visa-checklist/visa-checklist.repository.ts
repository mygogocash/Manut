import { and, asc, count, eq } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";

export async function listTemplates(db: Db, filters: { visaType?: string; includeInactive?: boolean }) {
  const parts = [];
  if (!filters.includeInactive) parts.push(eq(schema.visaChecklistTemplates.isActive, true));
  if (filters.visaType) parts.push(eq(schema.visaChecklistTemplates.visaType, filters.visaType));
  const where = parts.length ? and(...parts) : undefined;
  return db
    .select()
    .from(schema.visaChecklistTemplates)
    .where(where)
    .orderBy(asc(schema.visaChecklistTemplates.visaType), asc(schema.visaChecklistTemplates.name));
}

export async function findTemplateById(db: Db, id: string) {
  const [row] = await db.select().from(schema.visaChecklistTemplates).where(eq(schema.visaChecklistTemplates.id, id)).limit(1);
  return row ?? null;
}

export async function createTemplate(
  db: Db,
  data: Omit<typeof schema.visaChecklistTemplates.$inferInsert, "id" | "createdAt" | "updatedAt">,
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.visaChecklistTemplates).values({ id, ...data, createdAt: now, updatedAt: now });
  return findTemplateById(db, id);
}

export async function updateTemplate(
  db: Db,
  id: string,
  data: Partial<typeof schema.visaChecklistTemplates.$inferInsert>,
) {
  await db
    .update(schema.visaChecklistTemplates)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.visaChecklistTemplates.id, id));
  return findTemplateById(db, id);
}

export async function findMatchingTemplates(db: Db, visaType: string) {
  return db
    .select()
    .from(schema.visaChecklistTemplates)
    .where(and(eq(schema.visaChecklistTemplates.visaType, visaType), eq(schema.visaChecklistTemplates.isActive, true)));
}

export async function createItems(
  db: Db,
  items: Array<Omit<typeof schema.visaChecklistItems.$inferInsert, "id" | "createdAt" | "updatedAt">>,
) {
  if (!items.length) return;
  const now = new Date().toISOString();
  await db.insert(schema.visaChecklistItems).values(
    items.map((it) => ({ id: crypto.randomUUID(), ...it, createdAt: now, updatedAt: now })),
  );
}

export async function listItems(db: Db, visaRecordId: string) {
  return db
    .select()
    .from(schema.visaChecklistItems)
    .where(eq(schema.visaChecklistItems.visaRecordId, visaRecordId))
    .orderBy(asc(schema.visaChecklistItems.sortOrder), asc(schema.visaChecklistItems.createdAt));
}

export async function countItems(db: Db, visaRecordId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(schema.visaChecklistItems)
    .where(eq(schema.visaChecklistItems.visaRecordId, visaRecordId));
  return Number(row?.n ?? 0);
}

export async function findItem(db: Db, id: string) {
  const [row] = await db.select().from(schema.visaChecklistItems).where(eq(schema.visaChecklistItems.id, id)).limit(1);
  return row ?? null;
}

export async function updateItem(
  db: Db,
  id: string,
  data: Partial<typeof schema.visaChecklistItems.$inferInsert>,
) {
  await db
    .update(schema.visaChecklistItems)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.visaChecklistItems.id, id));
  return findItem(db, id);
}
