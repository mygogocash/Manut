import { asc, desc, eq, sql } from "drizzle-orm";
import type { Db, DbTransaction } from "@nexora/db";
import { schema } from "@nexora/db";
import { createCuid } from "../lib/id";
import { recomputeOpportunityRollup } from "../opportunities/opportunity-business-units.repository";

/** Tables carrying a `business_units` text[] — literal names only (never caller input). */
export const BUSINESS_UNIT_TABLES = [
  "crm_opportunities",
  "crm_leads",
  "crm_accounts",
  "revenue_opportunities",
  "revenue_leads",
  "revenue_accounts",
] as const;

export async function list(db: Db, includeInactive: boolean) {
  const q = db.select().from(schema.crmBusinessUnits);
  const rows = includeInactive
    ? await q.orderBy(asc(schema.crmBusinessUnits.sortOrder), asc(schema.crmBusinessUnits.label))
    : await q
        .where(eq(schema.crmBusinessUnits.isActive, true))
        .orderBy(asc(schema.crmBusinessUnits.sortOrder), asc(schema.crmBusinessUnits.label));
  return rows;
}

export async function findById(db: Db, id: string) {
  const [row] = await db
    .select()
    .from(schema.crmBusinessUnits)
    .where(eq(schema.crmBusinessUnits.id, id))
    .limit(1);
  return row ?? null;
}

export async function findByCode(db: Db, code: string) {
  const [row] = await db
    .select()
    .from(schema.crmBusinessUnits)
    .where(eq(schema.crmBusinessUnits.code, code))
    .limit(1);
  return row ?? null;
}

export async function maxSortOrder(db: Db) {
  const [row] = await db
    .select({ sortOrder: schema.crmBusinessUnits.sortOrder })
    .from(schema.crmBusinessUnits)
    .orderBy(desc(schema.crmBusinessUnits.sortOrder))
    .limit(1);
  return row?.sortOrder ?? null;
}

export async function create(
  db: Db,
  data: { code: string; label: string; color: string; sortOrder: number },
) {
  const id = createCuid();
  const now = new Date().toISOString();
  await db.insert(schema.crmBusinessUnits).values({
    id,
    code: data.code,
    label: data.label,
    color: data.color,
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
  data: Partial<{ label: string; color: string; sortOrder: number; isActive: boolean }>,
) {
  const now = new Date().toISOString();
  await db
    .update(schema.crmBusinessUnits)
    .set({ ...data, updatedAt: now })
    .where(eq(schema.crmBusinessUnits.id, id));
  return findById(db, id);
}

export async function reorder(db: Db, orderedIds: string[]) {
  const now = new Date().toISOString();
  await db.transaction(async (tx) => {
    for (let idx = 0; idx < orderedIds.length; idx++) {
      await tx
        .update(schema.crmBusinessUnits)
        .set({ sortOrder: idx, updatedAt: now })
        .where(eq(schema.crmBusinessUnits.id, orderedIds[idx]!));
    }
  });
}

async function findSalesDealsWithCode(tx: DbTransaction, code: string) {
  return tx
    .select({ id: schema.crmOpportunities.id })
    .from(schema.crmOpportunities)
    .where(sql`${code} = ANY(${schema.crmOpportunities.businessUnits})`);
}

async function findRevenueDealsWithCode(tx: DbTransaction, code: string) {
  return tx
    .select({ id: schema.revenueOpportunities.id })
    .from(schema.revenueOpportunities)
    .where(sql`${code} = ANY(${schema.revenueOpportunities.businessUnits})`);
}

export async function remove(db: Db, id: string, code: string) {
  await db.transaction(async (tx) => {
    const [salesDeals] = await Promise.all([
      findSalesDealsWithCode(tx, code),
      findRevenueDealsWithCode(tx, code),
    ]);

    for (const table of BUSINESS_UNIT_TABLES) {
      await tx.execute(
        sql`UPDATE ${sql.raw(`"${table}"`)} SET "business_units" = array_remove("business_units", ${code})`,
      );
    }

    await Promise.all([
      tx
        .delete(schema.crmOpportunityBusinessUnits)
        .where(eq(schema.crmOpportunityBusinessUnits.businessUnit, code)),
      tx
        .delete(schema.revenueOpportunityBusinessUnits)
        .where(eq(schema.revenueOpportunityBusinessUnits.businessUnit, code)),
    ]);

    for (const deal of salesDeals) {
      await recomputeOpportunityRollup(tx, deal.id);
    }

    await tx.delete(schema.crmBusinessUnits).where(eq(schema.crmBusinessUnits.id, id));
  });
}
