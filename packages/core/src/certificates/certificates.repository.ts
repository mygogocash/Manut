import { and, count, desc, eq, isNotNull, isNull, type SQL } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";

const recipientCols = {
  id: schema.users.id,
  name: schema.users.name,
  email: schema.users.email,
  avatarUrl: schema.users.avatarUrl,
  department: schema.users.department,
};

async function withRelations(db: Db, row: typeof schema.certificates.$inferSelect) {
  const [recipient] = await db
    .select(recipientCols)
    .from(schema.users)
    .where(eq(schema.users.id, row.recipientId))
    .limit(1);
  let issuedBy: { id: string; name: string } | null = null;
  if (row.issuedById) {
    const [issuer] = await db
      .select({ id: schema.users.id, name: schema.users.name })
      .from(schema.users)
      .where(eq(schema.users.id, row.issuedById))
      .limit(1);
    issuedBy = issuer ?? null;
  }
  return { ...row, recipient: recipient ?? null, issuedBy };
}

export async function create(
  db: Db,
  data: {
    recipientId: string;
    recipientName: string;
    recipientEmail: string;
    title: string;
    message: string | null;
    type: string;
    signatories: unknown;
    fileUrl: string | null;
    status: string;
    issuedById: string;
    issuedAt: string;
  },
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.certificates).values({
    id,
    recipientId: data.recipientId,
    recipientName: data.recipientName,
    recipientEmail: data.recipientEmail,
    title: data.title,
    message: data.message,
    type: data.type,
    signatories: data.signatories as never,
    fileUrl: data.fileUrl,
    status: data.status,
    issuedById: data.issuedById,
    issuedAt: data.issuedAt,
    createdAt: now,
    updatedAt: now,
  });
  return findByIdIncludingDeleted(db, id);
}

export async function list(
  db: Db,
  filters: { recipientId?: string; status?: string; view: "active" | "reverted" },
  page: number,
  limit: number,
) {
  const offset = (page - 1) * limit;
  const parts: SQL[] = [
    filters.view === "reverted" ? isNotNull(schema.certificates.deletedAt) : isNull(schema.certificates.deletedAt),
  ];
  if (filters.recipientId) parts.push(eq(schema.certificates.recipientId, filters.recipientId));
  if (filters.status) parts.push(eq(schema.certificates.status, filters.status));
  const where = and(...parts);

  const [totalRow] = await db.select({ n: count() }).from(schema.certificates).where(where);
  const rows = await db
    .select()
    .from(schema.certificates)
    .where(where)
    .orderBy(desc(schema.certificates.createdAt))
    .limit(limit)
    .offset(offset);

  const data = await Promise.all(rows.map((r) => withRelations(db, r)));
  return { data, total: Number(totalRow?.n ?? 0) };
}

export async function findById(db: Db, id: string) {
  const [row] = await db
    .select()
    .from(schema.certificates)
    .where(and(eq(schema.certificates.id, id), isNull(schema.certificates.deletedAt)))
    .limit(1);
  return row ? withRelations(db, row) : null;
}

export async function findByIdIncludingDeleted(db: Db, id: string) {
  const [row] = await db.select().from(schema.certificates).where(eq(schema.certificates.id, id)).limit(1);
  return row ? withRelations(db, row) : null;
}

export async function softDelete(db: Db, id: string) {
  const now = new Date().toISOString();
  await db
    .update(schema.certificates)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(schema.certificates.id, id));
  return findByIdIncludingDeleted(db, id);
}

export async function restore(db: Db, id: string) {
  const now = new Date().toISOString();
  await db
    .update(schema.certificates)
    .set({ deletedAt: null, updatedAt: now })
    .where(eq(schema.certificates.id, id));
  return findByIdIncludingDeleted(db, id);
}

export async function hardDelete(db: Db, id: string) {
  await db.delete(schema.certificates).where(eq(schema.certificates.id, id));
}

export async function updateFileUrl(db: Db, id: string, fileUrl: string) {
  const now = new Date().toISOString();
  await db.update(schema.certificates).set({ fileUrl, updatedAt: now }).where(eq(schema.certificates.id, id));
  return findByIdIncludingDeleted(db, id);
}
