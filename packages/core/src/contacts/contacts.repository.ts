import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { Db, DbTransaction } from "@nexora/db";
import { schema } from "@nexora/db";
import { createCuid } from "../lib/id";

type DbLike = Db | DbTransaction;

export interface ListContactsFilters {
  search?: string;
  accountId?: string;
  accountOwnerScope?: string[];
  archived?: boolean;
}

function buildWhere(filters: ListContactsFilters): SQL | undefined {
  const parts: SQL[] = [];

  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    parts.push(
      or(
        ilike(schema.crmContacts.firstName, term),
        ilike(schema.crmContacts.lastName, term),
        ilike(schema.crmContacts.email, term),
      )!,
    );
  }
  if (filters.accountId) parts.push(eq(schema.crmContacts.accountId, filters.accountId));
  if (filters.accountOwnerScope?.length) {
    parts.push(
      sql`EXISTS (
        SELECT 1 FROM ${schema.crmAccounts}
        WHERE ${schema.crmAccounts.id} = ${schema.crmContacts.accountId}
          AND ${schema.crmAccounts.ownerId} IN (${sql.join(
            filters.accountOwnerScope.map((id) => sql`${id}`),
            sql`, `,
          )})
      )`,
    );
  }
  parts.push(filters.archived ? isNotNull(schema.crmContacts.archivedAt) : isNull(schema.crmContacts.archivedAt));

  return parts.length ? and(...parts) : undefined;
}

async function withAccount(db: DbLike, row: typeof schema.crmContacts.$inferSelect) {
  const [account] = await db
    .select({ id: schema.crmAccounts.id, name: schema.crmAccounts.name, ownerId: schema.crmAccounts.ownerId })
    .from(schema.crmAccounts)
    .where(eq(schema.crmAccounts.id, row.accountId))
    .limit(1);
  return { ...row, account: account ?? null };
}

export async function findMany(db: Db, filters: ListContactsFilters, page: number, limit: number) {
  const where = buildWhere(filters);
  const offset = (page - 1) * limit;

  const [totalRow] = await db.select({ n: count() }).from(schema.crmContacts).where(where);
  const rows = await db
    .select()
    .from(schema.crmContacts)
    .where(where)
    .orderBy(desc(schema.crmContacts.createdAt))
    .limit(limit)
    .offset(offset);

  const data = await Promise.all(rows.map((row) => withAccount(db, row)));
  return { data, total: Number(totalRow?.n ?? 0) };
}

export async function findById(db: DbLike, id: string) {
  const [row] = await db.select().from(schema.crmContacts).where(eq(schema.crmContacts.id, id)).limit(1);
  if (!row) return null;
  return withAccount(db, row);
}

export async function countForAccount(db: DbLike, accountId: string) {
  const [row] = await db
    .select({ n: count() })
    .from(schema.crmContacts)
    .where(eq(schema.crmContacts.accountId, accountId));
  return Number(row?.n ?? 0);
}

export async function create(
  db: DbLike,
  data: Omit<typeof schema.crmContacts.$inferInsert, "id" | "createdAt" | "updatedAt">,
) {
  const id = createCuid();
  const now = new Date().toISOString();
  await db.insert(schema.crmContacts).values({ id, ...data, createdAt: now, updatedAt: now });
  return findById(db, id);
}

export async function update(
  db: Db,
  id: string,
  data: Partial<typeof schema.crmContacts.$inferInsert>,
) {
  const now = new Date().toISOString();
  await db.update(schema.crmContacts).set({ ...data, updatedAt: now }).where(eq(schema.crmContacts.id, id));
  return findById(db, id);
}

export async function clearPrimaryForAccount(tx: DbTransaction, accountId: string, keepContactId: string) {
  await tx
    .update(schema.crmContacts)
    .set({ isPrimary: false, updatedAt: new Date().toISOString() })
    .where(
      and(
        eq(schema.crmContacts.accountId, accountId),
        sql`${schema.crmContacts.id} <> ${keepContactId}`,
        eq(schema.crmContacts.isPrimary, true),
      ),
    );
}

export async function remove(db: Db, id: string) {
  await db.delete(schema.crmContacts).where(eq(schema.crmContacts.id, id));
}
