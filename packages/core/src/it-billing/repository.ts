import { and, asc, count, desc, eq, gte, ilike, isNotNull, lte, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";

const vendors = schema.itVendors;
const subscriptions = schema.itSubscriptions;
const records = schema.itBillingRecords;
const ownerUser = alias(schema.users, "it_sub_owner");

function nowIso() {
  return new Date().toISOString();
}

export async function listVendors(db: Db) {
  const rows = await db.select().from(vendors).orderBy(asc(vendors.name));
  const counts = await db
    .select({ vendorId: subscriptions.vendorId, n: count() })
    .from(subscriptions)
    .groupBy(subscriptions.vendorId);
  const countMap = new Map(counts.map((r) => [r.vendorId, Number(r.n)]));
  return rows.map((v) => ({ ...v, subscriptionCount: countMap.get(v.id) ?? 0 }));
}

export async function findVendor(db: Db, id: string) {
  const [row] = await db.select().from(vendors).where(eq(vendors.id, id)).limit(1);
  if (!row) return null;
  const [c] = await db
    .select({ n: count() })
    .from(subscriptions)
    .where(eq(subscriptions.vendorId, id));
  return { ...row, subscriptionCount: Number(c?.n ?? 0) };
}

export async function createVendor(
  db: Db,
  data: Omit<typeof vendors.$inferInsert, "id" | "createdAt" | "updatedAt">,
) {
  const ts = nowIso();
  const id = crypto.randomUUID();
  const [row] = await db
    .insert(vendors)
    .values({ ...data, id, createdAt: ts, updatedAt: ts })
    .returning();
  return { ...row!, subscriptionCount: 0 };
}

export async function updateVendor(db: Db, id: string, patch: Partial<typeof vendors.$inferInsert>) {
  const ts = nowIso();
  const [row] = await db
    .update(vendors)
    .set({ ...patch, updatedAt: ts })
    .where(eq(vendors.id, id))
    .returning();
  return findVendor(db, id);
}

export async function deleteVendor(db: Db, id: string) {
  await db.delete(vendors).where(eq(vendors.id, id));
}

export type SubscriptionFilters = {
  search?: string;
  status?: string;
  paymentStatus?: string;
  vendorId?: string;
};

function subscriptionWhere(filters: SubscriptionFilters) {
  const parts = [];
  if (filters.status) parts.push(eq(subscriptions.status, filters.status));
  if (filters.paymentStatus) parts.push(eq(subscriptions.paymentStatus, filters.paymentStatus));
  if (filters.vendorId) parts.push(eq(subscriptions.vendorId, filters.vendorId));
  if (filters.search?.trim()) {
    const q = `%${filters.search.trim()}%`;
    parts.push(or(ilike(subscriptions.productName, q), ilike(vendors.name, q)));
  }
  return parts.length ? and(...parts) : undefined;
}

export async function listSubscriptions(db: Db, filters: SubscriptionFilters, page: number, limit: number) {
  const where = subscriptionWhere(filters);
  const offset = (page - 1) * limit;
  const rows = await db
    .select({
      sub: subscriptions,
      vendorId: vendors.id,
      vendorName: vendors.name,
      ownerId: ownerUser.id,
      ownerName: ownerUser.name,
      ownerEmail: ownerUser.email,
    })
    .from(subscriptions)
    .innerJoin(vendors, eq(subscriptions.vendorId, vendors.id))
    .leftJoin(ownerUser, eq(subscriptions.ownerUserId, ownerUser.id))
    .where(where)
    .orderBy(asc(subscriptions.renewalDate))
    .limit(limit)
    .offset(offset);

  const [totalRow] = await db
    .select({ n: count() })
    .from(subscriptions)
    .innerJoin(vendors, eq(subscriptions.vendorId, vendors.id))
    .where(where);

  return {
    rows: rows.map((r) => ({
      ...r.sub,
      vendor: { id: r.vendorId, name: r.vendorName },
      owner: r.ownerId ? { id: r.ownerId, name: r.ownerName!, email: r.ownerEmail! } : null,
    })),
    total: Number(totalRow?.n ?? 0),
  };
}

export async function findSubscription(db: Db, id: string) {
  const [r] = await db
    .select({
      sub: subscriptions,
      vendorId: vendors.id,
      vendorName: vendors.name,
      ownerId: ownerUser.id,
      ownerName: ownerUser.name,
      ownerEmail: ownerUser.email,
    })
    .from(subscriptions)
    .innerJoin(vendors, eq(subscriptions.vendorId, vendors.id))
    .leftJoin(ownerUser, eq(subscriptions.ownerUserId, ownerUser.id))
    .where(eq(subscriptions.id, id))
    .limit(1);
  if (!r) return null;
  return {
    ...r.sub,
    vendor: { id: r.vendorId, name: r.vendorName },
    owner: r.ownerId ? { id: r.ownerId, name: r.ownerName!, email: r.ownerEmail! } : null,
  };
}

export async function createSubscription(
  db: Db,
  data: Omit<typeof subscriptions.$inferInsert, "id" | "createdAt" | "updatedAt">,
) {
  const ts = nowIso();
  const id = crypto.randomUUID();
  await db.insert(subscriptions).values({ ...data, id, createdAt: ts, updatedAt: ts });
  return findSubscription(db, id);
}

export async function updateSubscription(
  db: Db,
  id: string,
  patch: Partial<typeof subscriptions.$inferInsert>,
) {
  const ts = nowIso();
  await db.update(subscriptions).set({ ...patch, updatedAt: ts }).where(eq(subscriptions.id, id));
  return findSubscription(db, id);
}

export async function deleteSubscription(db: Db, id: string) {
  await db.delete(subscriptions).where(eq(subscriptions.id, id));
}

export async function subscriptionsForMonthlySeries(db: Db) {
  return db
    .select({
      sub: subscriptions,
      vendorId: vendors.id,
      vendorName: vendors.name,
    })
    .from(subscriptions)
    .innerJoin(vendors, eq(subscriptions.vendorId, vendors.id))
    .orderBy(asc(subscriptions.productName));
}

export async function listBillingRecords(db: Db, subscriptionId: string) {
  return db
    .select()
    .from(records)
    .where(eq(records.subscriptionId, subscriptionId))
    .orderBy(desc(records.periodStart));
}


export async function activeSubscriptions(db: Db) {
  const rows = await db
    .select({
      sub: subscriptions,
      vendorId: vendors.id,
      vendorName: vendors.name,
    })
    .from(subscriptions)
    .innerJoin(vendors, eq(subscriptions.vendorId, vendors.id))
    .where(ne(subscriptions.status, "cancelled"))
    .orderBy(asc(subscriptions.productName));
  return rows.map((r) => ({
    ...r.sub,
    vendor: { id: r.vendorId, name: r.vendorName },
  }));
}

export async function upcomingRenewals(db: Db, withinIso: string) {
  const today = new Date().toISOString().slice(0, 10);
  const rows = await db
    .select({
      sub: subscriptions,
      vendorId: vendors.id,
      vendorName: vendors.name,
    })
    .from(subscriptions)
    .innerJoin(vendors, eq(subscriptions.vendorId, vendors.id))
    .where(
      and(
        ne(subscriptions.status, "cancelled"),
        isNotNull(subscriptions.renewalDate),
        lte(subscriptions.renewalDate, withinIso),
        gte(subscriptions.renewalDate, today),
      ),
    )
    .orderBy(asc(subscriptions.renewalDate));
  return rows.map((r) => ({
    ...r.sub,
    vendor: { id: r.vendorId, name: r.vendorName },
  }));
}

const alerts = schema.itBillingAlerts;

export async function listAlerts(db: Db, onlyOpen: boolean) {
  const rows = await db
    .select({
      alert: alerts,
      productName: subscriptions.productName,
    })
    .from(alerts)
    .innerJoin(subscriptions, eq(alerts.subscriptionId, subscriptions.id))
    .where(onlyOpen ? eq(alerts.acknowledged, false) : undefined)
    .orderBy(desc(alerts.createdAt))
    .limit(100);
  return rows.map((r) => ({
    ...r.alert,
    subscription: { id: r.alert.subscriptionId, productName: r.productName },
  }));
}

export async function acknowledgeAlert(db: Db, id: string, userId: string) {
  const ts = nowIso();
  const [row] = await db
    .update(alerts)
    .set({ acknowledged: true, acknowledgedBy: userId, acknowledgedAt: ts })
    .where(eq(alerts.id, id))
    .returning();
  return row!;
}
