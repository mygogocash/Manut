import { and, count, desc, eq, sql, type SQL } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";

async function withSender(db: Db, row: typeof schema.investorUpdates.$inferSelect) {
  const [sender] = row.sentBy
    ? await db
        .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
        .from(schema.users)
        .where(eq(schema.users.id, row.sentBy))
        .limit(1)
    : [null];
  return { ...row, sender: sender ?? null };
}

function buildWhere(filters: { status?: string }): SQL | undefined {
  if (!filters.status) return undefined;
  return eq(schema.investorUpdates.status, filters.status);
}

export async function findMany(db: Db, filters: { status?: string }, page: number, limit: number) {
  const where = buildWhere(filters);
  const offset = (page - 1) * limit;
  const base = db.select().from(schema.investorUpdates).orderBy(desc(schema.investorUpdates.createdAt));
  const rows = await (where ? base.where(where) : base).limit(limit).offset(offset);
  const [totalRow] = await db
    .select({ n: count() })
    .from(schema.investorUpdates)
    .where(where ?? sql`true`);
  const data = await Promise.all(rows.map((row) => withSender(db, row)));
  return { data, total: Number(totalRow?.n ?? 0) };
}

export async function findById(db: Db, id: string) {
  const [row] = await db.select().from(schema.investorUpdates).where(eq(schema.investorUpdates.id, id)).limit(1);
  return row ? withSender(db, row) : null;
}

export async function create(
  db: Db,
  data: { title: string; content: string; period: string; status: string },
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.investorUpdates).values({
    id,
    title: data.title,
    content: data.content,
    period: data.period,
    status: data.status,
    createdAt: now,
    updatedAt: now,
  });
  return findById(db, id);
}

export async function update(
  db: Db,
  id: string,
  data: Partial<{ title: string; content: string; period: string; status: string }>,
) {
  const now = new Date().toISOString();
  await db.update(schema.investorUpdates).set({ ...data, updatedAt: now }).where(eq(schema.investorUpdates.id, id));
  return findById(db, id);
}

export async function remove(db: Db, id: string) {
  await db.delete(schema.investorUpdates).where(eq(schema.investorUpdates.id, id));
}

export async function markAsSent(db: Db, id: string, sentBy: string) {
  const now = new Date().toISOString();
  await db
    .update(schema.investorUpdates)
    .set({ status: "sent", sentAt: now, sentBy, updatedAt: now })
    .where(eq(schema.investorUpdates.id, id));
  return findById(db, id);
}
