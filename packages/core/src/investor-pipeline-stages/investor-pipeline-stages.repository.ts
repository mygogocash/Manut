import { asc, eq, sql } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";
import { planSortOrderCompaction, planSortOrderPark } from "../lib/catalog-reorder";

export async function findAll(db: Db) {
  return db
    .select()
    .from(schema.investorPipelineStages)
    .orderBy(asc(schema.investorPipelineStages.sortOrder), asc(schema.investorPipelineStages.key));
}

export async function findByKey(db: Db, key: string) {
  const [row] = await db.select().from(schema.investorPipelineStages).where(eq(schema.investorPipelineStages.key, key)).limit(1);
  return row ?? null;
}

export async function maxSortOrder(db: Db) {
  const [row] = await db
    .select({ sortOrder: schema.investorPipelineStages.sortOrder })
    .from(schema.investorPipelineStages)
    .orderBy(sql`${schema.investorPipelineStages.sortOrder} desc`)
    .limit(1);
  return row?.sortOrder ?? -1;
}

export async function createManyIfMissing(
  db: Db,
  rows: { key: string; label: string; color: string; sortOrder: number }[],
) {
  const now = new Date().toISOString();
  for (const row of rows) {
    await db
      .insert(schema.investorPipelineStages)
      .values({ ...row, createdAt: now, updatedAt: now })
      .onConflictDoNothing({ target: schema.investorPipelineStages.key });
  }
}

export async function create(db: Db, data: { key: string; label: string; color: string; sortOrder: number }) {
  const now = new Date().toISOString();
  await db.insert(schema.investorPipelineStages).values({ ...data, createdAt: now, updatedAt: now });
  return findByKey(db, data.key);
}

export async function update(db: Db, key: string, data: Partial<{ label: string; color: string }>) {
  const now = new Date().toISOString();
  await db.update(schema.investorPipelineStages).set({ ...data, updatedAt: now }).where(eq(schema.investorPipelineStages.key, key));
  return findByKey(db, key);
}

export async function deleteAndReassign(db: Db, key: string, reassignTo: string) {
  await db.transaction(async (tx) => {
    await tx.update(schema.investors).set({ status: reassignTo }).where(eq(schema.investors.status, key));
    await tx.delete(schema.investorPipelineStages).where(eq(schema.investorPipelineStages.key, key));
  });
}

export async function applySortOrder(db: Db, orderedKeys: string[]) {
  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    for (const { key, sortOrder } of planSortOrderPark(orderedKeys)) {
      await tx
        .update(schema.investorPipelineStages)
        .set({ sortOrder, updatedAt: now })
        .where(eq(schema.investorPipelineStages.key, key));
    }
    for (const { key, sortOrder } of planSortOrderCompaction(orderedKeys)) {
      await tx
        .update(schema.investorPipelineStages)
        .set({ sortOrder, updatedAt: now })
        .where(eq(schema.investorPipelineStages.key, key));
    }
  });
}
