import { count, desc, eq, ilike } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";

async function withAuthor(db: Db, row: typeof schema.blogs.$inferSelect) {
  const [author] = await db
    .select({ id: schema.users.id, name: schema.users.name })
    .from(schema.users)
    .where(eq(schema.users.id, row.authorId))
    .limit(1);
  return { ...row, author: author ?? { id: row.authorId, name: "" } };
}

export async function findAll(
  db: Db,
  params: { search?: string; page: number; limit: number },
) {
  const offset = (params.page - 1) * params.limit;
  const where = params.search ? ilike(schema.blogs.title, `%${params.search}%`) : undefined;
  const [totalRow] = await db.select({ n: count() }).from(schema.blogs).where(where);
  const rows = await db
    .select()
    .from(schema.blogs)
    .where(where)
    .orderBy(desc(schema.blogs.createdAt))
    .limit(params.limit)
    .offset(offset);
  const data = await Promise.all(rows.map((r) => withAuthor(db, r)));
  return { data, total: Number(totalRow?.n ?? 0) };
}

export async function findAllForExport(db: Db, search?: string) {
  const where = search ? ilike(schema.blogs.title, `%${search}%`) : undefined;
  const rows = await db.select().from(schema.blogs).where(where).orderBy(desc(schema.blogs.createdAt));
  return Promise.all(rows.map((r) => withAuthor(db, r)));
}

export async function findById(db: Db, id: string) {
  const [row] = await db.select().from(schema.blogs).where(eq(schema.blogs.id, id)).limit(1);
  if (!row) return null;
  return withAuthor(db, row);
}

export async function create(
  db: Db,
  input: {
    title: string;
    content: string;
    coverImage: string;
    slug?: string;
    active: boolean;
    authorId: string;
  },
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.blogs).values({
    id,
    title: input.title,
    content: input.content,
    coverImage: input.coverImage,
    slug: input.slug ?? null,
    active: input.active,
    authorId: input.authorId,
    createdAt: now,
    updatedAt: now,
  });
  return findById(db, id);
}

export async function update(
  db: Db,
  id: string,
  input: Partial<{
    title: string;
    content: string;
    coverImage: string;
    slug: string | null;
    active: boolean;
  }>,
) {
  await db
    .update(schema.blogs)
    .set({ ...input, updatedAt: new Date().toISOString() })
    .where(eq(schema.blogs.id, id));
  return findById(db, id);
}

export async function remove(db: Db, id: string) {
  await db.delete(schema.blogs).where(eq(schema.blogs.id, id));
}
