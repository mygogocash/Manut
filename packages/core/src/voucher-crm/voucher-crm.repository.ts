import { and, asc, count, desc, eq, ilike, isNotNull, isNull, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";

const entries = schema.voucherEntries;
const creator = alias(schema.users, "voucher_creator");

export type VoucherListQuery = {
  page: number;
  limit: number;
  search?: string;
  country?: string;
  archived?: boolean;
};

function buildWhere(query: VoucherListQuery) {
  const parts = [];
  if (query.search?.trim()) {
    const q = `%${query.search.trim()}%`;
    parts.push(or(ilike(entries.partner, q), ilike(entries.country, q)));
  }
  if (query.country?.trim()) parts.push(eq(entries.country, query.country.trim()));
  parts.push(query.archived ? isNotNull(entries.archivedAt) : isNull(entries.archivedAt));
  return parts.length ? and(...parts) : undefined;
}

export async function listEntries(db: Db, query: VoucherListQuery) {
  const where = buildWhere(query);
  const offset = (query.page - 1) * query.limit;
  const [rows, totalRow, totalsRow] = await Promise.all([
    db
      .select({
        entry: entries,
        creatorId: creator.id,
        creatorName: creator.name,
        creatorEmail: creator.email,
      })
      .from(entries)
      .leftJoin(creator, eq(entries.addedBy, creator.id))
      .where(where)
      .orderBy(asc(entries.sortOrder), asc(entries.createdAt))
      .limit(query.limit)
      .offset(offset),
    db.select({ c: count() }).from(entries).where(where),
    db
      .select({
        redeemed: sql<number>`coalesce(sum(${entries.redeemed}), 0)`,
        issued: sql<number>`coalesce(sum(${entries.issued}), 0)`,
        refund: sql<number>`coalesce(sum(${entries.refund}), 0)`,
      })
      .from(entries)
      .where(where),
  ]);
  return {
    rows: rows.map((r) => ({
      ...r.entry,
      creator: r.creatorId ? { id: r.creatorId, name: r.creatorName, email: r.creatorEmail } : null,
    })),
    total: Number(totalRow[0]?.c ?? 0),
    totals: {
      redeemed: Number(totalsRow[0]?.redeemed ?? 0),
      issued: Number(totalsRow[0]?.issued ?? 0),
      refund: Number(totalsRow[0]?.refund ?? 0),
    },
  };
}

export async function getEntry(db: Db, id: string) {
  const [r] = await db
    .select({
      entry: entries,
      creatorId: creator.id,
      creatorName: creator.name,
      creatorEmail: creator.email,
    })
    .from(entries)
    .leftJoin(creator, eq(entries.addedBy, creator.id))
    .where(eq(entries.id, id))
    .limit(1);
  if (!r) return null;
  return {
    ...r.entry,
    creator: r.creatorId ? { id: r.creatorId, name: r.creatorName, email: r.creatorEmail } : null,
  };
}

export async function maxSortOrder(db: Db) {
  const [row] = await db.select({ sortOrder: entries.sortOrder }).from(entries).orderBy(desc(entries.sortOrder)).limit(1);
  return row?.sortOrder ?? 0;
}

export async function createEntry(
  db: Db,
  data: { partner: string; country: string | null; redeemed: number; issued: number; refund: number; sortOrder: number; addedBy: string },
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(entries).values({
    id,
    partner: data.partner,
    country: data.country,
    redeemed: data.redeemed,
    issued: data.issued,
    refund: data.refund,
    sortOrder: data.sortOrder,
    addedBy: data.addedBy,
    createdAt: now,
    updatedAt: now,
  });
  return getEntry(db, id);
}

export async function updateEntry(
  db: Db,
  id: string,
  patch: Partial<{ partner: string; country: string | null; redeemed: number; issued: number; refund: number; archivedAt: string | null }>,
) {
  await db.update(entries).set({ ...patch, updatedAt: new Date().toISOString() }).where(eq(entries.id, id));
  return getEntry(db, id);
}

export async function deleteEntry(db: Db, id: string) {
  await db.delete(entries).where(eq(entries.id, id));
}

export async function reorderEntries(db: Db, orderedIds: string[]) {
  const now = new Date().toISOString();
  for (let idx = 0; idx < orderedIds.length; idx++) {
    await db.update(entries).set({ sortOrder: idx, updatedAt: now }).where(eq(entries.id, orderedIds[idx]!));
  }
}
