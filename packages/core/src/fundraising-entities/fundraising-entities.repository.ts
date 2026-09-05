import { asc, eq, sql } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";
import { planSortOrderCompaction, planSortOrderPark } from "../lib/catalog-reorder";

export async function findAll(db: Db) {
  return db
    .select()
    .from(schema.fundraisingEntities)
    .orderBy(asc(schema.fundraisingEntities.sortOrder), asc(schema.fundraisingEntities.key));
}

export async function findByKey(db: Db, key: string) {
  const [row] = await db
    .select()
    .from(schema.fundraisingEntities)
    .where(eq(schema.fundraisingEntities.key, key))
    .limit(1);
  return row ?? null;
}

export async function maxSortOrder(db: Db) {
  const [row] = await db
    .select({ sortOrder: schema.fundraisingEntities.sortOrder })
    .from(schema.fundraisingEntities)
    .orderBy(sql`${schema.fundraisingEntities.sortOrder} desc`)
    .limit(1);
  return row?.sortOrder ?? -1;
}

export async function createManyIfMissing(
  db: Db,
  rows: { key: string; label: string; sortOrder: number }[],
) {
  const now = new Date().toISOString();
  for (const row of rows) {
    await db
      .insert(schema.fundraisingEntities)
      .values({ ...row, createdAt: now, updatedAt: now })
      .onConflictDoNothing({ target: schema.fundraisingEntities.key });
  }
}

export async function create(db: Db, data: { key: string; label: string; sortOrder: number }) {
  const now = new Date().toISOString();
  await db.insert(schema.fundraisingEntities).values({ ...data, createdAt: now, updatedAt: now });
  return findByKey(db, data.key);
}

export async function update(db: Db, key: string, data: { label: string }) {
  const now = new Date().toISOString();
  await db
    .update(schema.fundraisingEntities)
    .set({ ...data, updatedAt: now })
    .where(eq(schema.fundraisingEntities.key, key));
  return findByKey(db, key);
}

export async function deleteAndReassign(db: Db, key: string, reassignTo: string) {
  await db.transaction(async (tx) => {
    await tx.update(schema.investors).set({ fundraisingEntity: reassignTo }).where(eq(schema.investors.fundraisingEntity, key));
    await tx.update(schema.investorLeads).set({ fundraisingEntity: reassignTo }).where(eq(schema.investorLeads.fundraisingEntity, key));
    await tx.update(schema.investorAccounts).set({ fundraisingEntity: reassignTo }).where(eq(schema.investorAccounts.fundraisingEntity, key));
    await tx.update(schema.investorContacts).set({ fundraisingEntity: reassignTo }).where(eq(schema.investorContacts.fundraisingEntity, key));
    await tx.delete(schema.fundraisingEntities).where(eq(schema.fundraisingEntities.key, key));
  });
}

export async function applySortOrder(db: Db, orderedKeys: string[]) {
  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    for (const { key, sortOrder } of planSortOrderPark(orderedKeys)) {
      await tx
        .update(schema.fundraisingEntities)
        .set({ sortOrder, updatedAt: now })
        .where(eq(schema.fundraisingEntities.key, key));
    }
    for (const { key, sortOrder } of planSortOrderCompaction(orderedKeys)) {
      await tx
        .update(schema.fundraisingEntities)
        .set({ sortOrder, updatedAt: now })
        .where(eq(schema.fundraisingEntities.key, key));
    }
  });
}
