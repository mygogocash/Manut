import { and, count, desc, eq, ilike, sql, sum, type SQL } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";

async function withUploader(db: Db, row: typeof schema.dataRoomDocuments.$inferSelect) {
  const [uploader] = await db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, row.uploadedBy))
    .limit(1);
  return { ...row, uploader: uploader ?? null };
}

function buildWhere(filters: { category?: string; search?: string }): SQL | undefined {
  const parts: SQL[] = [];
  if (filters.search) parts.push(ilike(schema.dataRoomDocuments.name, `%${filters.search}%`));
  if (filters.category) parts.push(eq(schema.dataRoomDocuments.category, filters.category));
  return parts.length ? and(...parts) : undefined;
}

export async function findMany(
  db: Db,
  filters: { category?: string; search?: string },
  page: number,
  limit: number,
) {
  const where = buildWhere(filters);
  const offset = (page - 1) * limit;
  const base = db.select().from(schema.dataRoomDocuments).orderBy(desc(schema.dataRoomDocuments.uploadedAt));
  const rows = await (where ? base.where(where) : base).limit(limit).offset(offset);
  const [totalRow] = await db
    .select({ n: count() })
    .from(schema.dataRoomDocuments)
    .where(where ?? sql`true`);
  const data = await Promise.all(rows.map((row) => withUploader(db, row)));
  return { data, total: Number(totalRow?.n ?? 0) };
}

export async function findById(db: Db, id: string) {
  const [row] = await db.select().from(schema.dataRoomDocuments).where(eq(schema.dataRoomDocuments.id, id)).limit(1);
  return row ? withUploader(db, row) : null;
}

export async function create(
  db: Db,
  data: {
    name: string;
    description?: string | null;
    category: string;
    fileUrl: string;
    fileSize?: number | null;
    mimeType?: string | null;
    uploadedBy: string;
  },
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.dataRoomDocuments).values({
    id,
    name: data.name,
    description: data.description ?? null,
    category: data.category,
    fileUrl: data.fileUrl,
    fileSize: data.fileSize ?? null,
    mimeType: data.mimeType ?? null,
    uploadedBy: data.uploadedBy,
    uploadedAt: now,
  });
  return findById(db, id);
}

export async function update(
  db: Db,
  id: string,
  data: Partial<{ name: string; description: string | null; category: string }>,
) {
  await db.update(schema.dataRoomDocuments).set(data).where(eq(schema.dataRoomDocuments.id, id));
  return findById(db, id);
}

export async function remove(db: Db, id: string) {
  await db.delete(schema.dataRoomDocuments).where(eq(schema.dataRoomDocuments.id, id));
}

export async function getCategorySummary(db: Db) {
  const rows = await db
    .select({
      category: schema.dataRoomDocuments.category,
      count: count(),
      totalSize: sum(schema.dataRoomDocuments.fileSize),
    })
    .from(schema.dataRoomDocuments)
    .groupBy(schema.dataRoomDocuments.category);
  return rows.map((row) => ({
    category: row.category,
    count: Number(row.count),
    totalSize: Number(row.totalSize ?? 0),
  }));
}
