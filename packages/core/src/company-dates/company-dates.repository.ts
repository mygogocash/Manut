import { and, asc, count, eq, gte } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";

function todayUtcDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function findUpcoming(db: Db, page: number, limit: number) {
  const offset = (page - 1) * limit;
  const today = todayUtcDate();
  const where = gte(schema.companyDates.date, today);

  const [totalRow] = await db.select({ n: count() }).from(schema.companyDates).where(where);
  const rows = await db
    .select({
      id: schema.companyDates.id,
      title: schema.companyDates.title,
      date: schema.companyDates.date,
      type: schema.companyDates.type,
      location: schema.companyDates.location,
      attachments: schema.companyDates.attachments,
      linkUrl: schema.companyDates.linkUrl,
      addedBy: schema.companyDates.addedBy,
      createdAt: schema.companyDates.createdAt,
      adderName: schema.users.name,
      adderAvatarUrl: schema.users.avatarUrl,
    })
    .from(schema.companyDates)
    .innerJoin(schema.users, eq(schema.users.id, schema.companyDates.addedBy))
    .where(where)
    .orderBy(asc(schema.companyDates.date))
    .limit(limit)
    .offset(offset);

  return {
    data: rows.map((r) => ({
      id: r.id,
      title: r.title,
      date: r.date,
      type: r.type,
      location: r.location,
      attachments: r.attachments,
      linkUrl: r.linkUrl,
      addedBy: r.addedBy,
      createdAt: r.createdAt,
      adder: { id: r.addedBy, name: r.adderName, avatarUrl: r.adderAvatarUrl },
    })),
    total: Number(totalRow?.n ?? 0),
  };
}

export async function findById(db: Db, id: string) {
  const [row] = await db
    .select({
      id: schema.companyDates.id,
      title: schema.companyDates.title,
      date: schema.companyDates.date,
      type: schema.companyDates.type,
      location: schema.companyDates.location,
      attachments: schema.companyDates.attachments,
      linkUrl: schema.companyDates.linkUrl,
      addedBy: schema.companyDates.addedBy,
      createdAt: schema.companyDates.createdAt,
      adderName: schema.users.name,
      adderAvatarUrl: schema.users.avatarUrl,
    })
    .from(schema.companyDates)
    .innerJoin(schema.users, eq(schema.users.id, schema.companyDates.addedBy))
    .where(eq(schema.companyDates.id, id))
    .limit(1);
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    date: row.date,
    type: row.type,
    location: row.location,
    attachments: row.attachments,
    linkUrl: row.linkUrl,
    addedBy: row.addedBy,
    createdAt: row.createdAt,
    adder: { id: row.addedBy, name: row.adderName, avatarUrl: row.adderAvatarUrl },
  };
}

export async function create(
  db: Db,
  input: {
    title: string;
    date: string;
    type: string;
    location?: string;
    addedBy: string;
    attachments?: unknown;
  },
) {
  const id = crypto.randomUUID();
  await db.insert(schema.companyDates).values({
    id,
    title: input.title,
    date: input.date.slice(0, 10),
    type: input.type,
    location: input.location ?? null,
    attachments: input.attachments ?? null,
    addedBy: input.addedBy,
  });
  return findById(db, id);
}

export async function update(
  db: Db,
  id: string,
  input: Partial<{ title: string; date: string; type: string; location: string }>,
) {
  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) patch.title = input.title;
  if (input.date !== undefined) patch.date = input.date.slice(0, 10);
  if (input.type !== undefined) patch.type = input.type;
  if (input.location !== undefined) patch.location = input.location;
  if (Object.keys(patch).length > 0) {
    await db.update(schema.companyDates).set(patch).where(eq(schema.companyDates.id, id));
  }
  return findById(db, id);
}

export async function remove(db: Db, id: string) {
  await db.delete(schema.companyDates).where(eq(schema.companyDates.id, id));
}
