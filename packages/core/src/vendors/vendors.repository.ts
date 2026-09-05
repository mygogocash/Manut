import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";
import type { VendorSortField } from "@nexora/contracts/modules/vendors/vendors.validation";

const entityCols = { id: schema.entities.id, name: schema.entities.name, code: schema.entities.code };
const mergedCols = { id: schema.vendors.id, name: schema.vendors.name, contactId: schema.vendors.contactId };

function buildOrder(sortBy: VendorSortField | undefined, sortOrder: "asc" | "desc") {
  const dir = sortOrder === "desc" ? desc : asc;
  switch (sortBy) {
    case "name":
      return [dir(schema.vendors.name)];
    case "contactType":
      return [dir(schema.vendors.contactType), asc(schema.vendors.name)];
    case "businessType":
      return [dir(schema.vendors.businessType), asc(schema.vendors.name)];
    case "businessLocation":
      return [dir(schema.vendors.businessLocation), asc(schema.vendors.name)];
    case "taxId":
      return [dir(schema.vendors.taxId), asc(schema.vendors.name)];
    case "branch":
      return [dir(schema.vendors.branchCode), dir(schema.vendors.branch), asc(schema.vendors.name)];
    case "contactName":
      return [dir(schema.vendors.contactName), asc(schema.vendors.name)];
    case "phone":
      return [dir(schema.vendors.phone), dir(schema.vendors.mobile), asc(schema.vendors.name)];
    case "creditDays":
      return [dir(schema.vendors.creditDays), asc(schema.vendors.name)];
    case "entity":
      return [dir(schema.entities.code), asc(schema.vendors.name)];
    default:
      return [asc(schema.vendors.name)];
  }
}

function buildWhere(filters: {
  entityId?: string;
  contactType?: string;
  businessType?: string;
  isActive?: boolean;
  search?: string;
}) {
  const parts: SQL[] = [isNull(schema.vendors.deletedAt)];
  if (filters.entityId) parts.push(eq(schema.vendors.entityId, filters.entityId));
  if (filters.contactType) parts.push(eq(schema.vendors.contactType, filters.contactType));
  if (filters.businessType) parts.push(eq(schema.vendors.businessType, filters.businessType));
  if (filters.isActive !== undefined) parts.push(eq(schema.vendors.isActive, filters.isActive));
  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    parts.push(
      or(
        ilike(schema.vendors.name, term),
        ilike(schema.vendors.contactId, term),
        ilike(schema.vendors.taxId, term),
        ilike(schema.vendors.email, term),
        ilike(schema.vendors.contactName, term),
      )!,
    );
  }
  return and(...parts);
}

async function withRelations(db: Db, row: typeof schema.vendors.$inferSelect) {
  const [entity] = await db
    .select(entityCols)
    .from(schema.entities)
    .where(eq(schema.entities.id, row.entityId))
    .limit(1);
  let mergedInto: { id: string; name: string; contactId: string | null } | null = null;
  if (row.mergedIntoId) {
    const [m] = await db
      .select(mergedCols)
      .from(schema.vendors)
      .where(eq(schema.vendors.id, row.mergedIntoId))
      .limit(1);
    mergedInto = m ?? null;
  }
  return { ...row, entity: entity ?? null, mergedInto };
}

export async function findMany(
  db: Db,
  filters: {
    entityId?: string;
    contactType?: string;
    businessType?: string;
    isActive?: boolean;
    search?: string;
    sortBy?: VendorSortField;
    sortOrder?: "asc" | "desc";
  },
  page: number,
  limit: number,
) {
  const where = buildWhere(filters);
  const offset = (page - 1) * limit;
  const order = buildOrder(filters.sortBy, filters.sortOrder ?? "asc");

  const [totalRow] = await db.select({ n: count() }).from(schema.vendors).where(where);

  const rows = await db
    .select({ vendor: schema.vendors })
    .from(schema.vendors)
    .leftJoin(schema.entities, eq(schema.vendors.entityId, schema.entities.id))
    .where(where)
    .orderBy(...order)
    .limit(limit)
    .offset(offset);

  const data = await Promise.all(rows.map((r) => withRelations(db, r.vendor)));
  return { data, total: Number(totalRow?.n ?? 0) };
}

export async function findById(db: Db, id: string) {
  const [row] = await db
    .select()
    .from(schema.vendors)
    .where(and(eq(schema.vendors.id, id), isNull(schema.vendors.deletedAt)))
    .limit(1);
  return row ? withRelations(db, row) : null;
}

export async function findByIdIncludingDeleted(db: Db, id: string) {
  const [row] = await db.select().from(schema.vendors).where(eq(schema.vendors.id, id)).limit(1);
  return row ? withRelations(db, row) : null;
}

export async function create(
  db: Db,
  data: Omit<typeof schema.vendors.$inferInsert, "id" | "createdAt" | "updatedAt">,
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.vendors).values({ id, ...data, createdAt: now, updatedAt: now });
  return findById(db, id);
}

export async function update(
  db: Db,
  id: string,
  data: Partial<typeof schema.vendors.$inferInsert>,
) {
  const patch = { ...data, updatedAt: new Date().toISOString() };
  await db.update(schema.vendors).set(patch).where(eq(schema.vendors.id, id));
  return findById(db, id);
}

export async function softRemove(db: Db, id: string) {
  const now = new Date().toISOString();
  await db
    .update(schema.vendors)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(schema.vendors.id, id));
  return findByIdIncludingDeleted(db, id);
}

export async function restore(db: Db, id: string) {
  await db
    .update(schema.vendors)
    .set({ deletedAt: null, updatedAt: new Date().toISOString() })
    .where(eq(schema.vendors.id, id));
  return findById(db, id);
}

export async function countReferences(db: Db, id: string) {
  const [[inv], [quo], [po], [cn]] = await Promise.all([
    db.select({ n: count() }).from(schema.invoices).where(eq(schema.invoices.vendorId, id)),
    db.select({ n: count() }).from(schema.quotes).where(eq(schema.quotes.vendorId, id)),
    db.select({ n: count() }).from(schema.purchaseOrders).where(eq(schema.purchaseOrders.vendorId, id)),
    db.select({ n: count() }).from(schema.creditNotes).where(eq(schema.creditNotes.vendorId, id)),
  ]);
  const invoices = Number(inv?.n ?? 0);
  const quotes = Number(quo?.n ?? 0);
  const purchaseOrders = Number(po?.n ?? 0);
  const creditNotes = Number(cn?.n ?? 0);
  return { invoices, quotes, purchaseOrders, creditNotes, total: invoices + quotes + purchaseOrders + creditNotes };
}

export async function findDuplicateByTaxId(
  db: Db,
  entityId: string,
  taxId: string,
  branchCode: string | null,
  excludeId?: string,
) {
  const parts: SQL[] = [
    eq(schema.vendors.entityId, entityId),
    eq(schema.vendors.taxId, taxId),
    branchCode ? eq(schema.vendors.branchCode, branchCode) : isNull(schema.vendors.branchCode),
    isNull(schema.vendors.deletedAt),
  ];
  if (excludeId) parts.push(sql`${schema.vendors.id} <> ${excludeId}`);
  const [row] = await db
    .select({ id: schema.vendors.id, name: schema.vendors.name })
    .from(schema.vendors)
    .where(and(...parts))
    .limit(1);
  return row ?? null;
}

export async function findNameMatches(db: Db, entityId: string, name: string, excludeId?: string) {
  const parts: SQL[] = [
    eq(schema.vendors.entityId, entityId),
    ilike(schema.vendors.name, `${name}%`),
    isNull(schema.vendors.deletedAt),
  ];
  if (excludeId) parts.push(sql`${schema.vendors.id} <> ${excludeId}`);
  return db
    .select({ id: schema.vendors.id, name: schema.vendors.name })
    .from(schema.vendors)
    .where(and(...parts))
    .limit(5);
}

export async function deleteAllForEntity(db: Db, entityId: string) {
  const deleted = await db
    .delete(schema.vendors)
    .where(eq(schema.vendors.entityId, entityId))
    .returning({ id: schema.vendors.id });
  return { count: deleted.length };
}

export async function findExistingForImport(
  db: Db,
  entityId: string,
  contactId: string | null,
  taxId: string | null,
) {
  if (contactId) {
    const [hit] = await db
      .select({ id: schema.vendors.id })
      .from(schema.vendors)
      .where(and(eq(schema.vendors.entityId, entityId), eq(schema.vendors.contactId, contactId), isNull(schema.vendors.deletedAt)))
      .limit(1);
    if (hit) return hit;
  }
  if (taxId) {
    const [hit] = await db
      .select({ id: schema.vendors.id })
      .from(schema.vendors)
      .where(and(eq(schema.vendors.entityId, entityId), eq(schema.vendors.taxId, taxId), isNull(schema.vendors.deletedAt)))
      .limit(1);
    if (hit) return hit;
  }
  return null;
}

export async function entityExists(db: Db, entityId: string) {
  const [row] = await db.select({ id: schema.entities.id }).from(schema.entities).where(eq(schema.entities.id, entityId)).limit(1);
  return !!row;
}
