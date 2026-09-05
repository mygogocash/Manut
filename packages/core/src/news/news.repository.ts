import { count, desc, eq } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";

export async function findAllNews(db: Db, page: number, limit: number) {
  const offset = (page - 1) * limit;
  const [totalRow] = await db.select({ n: count() }).from(schema.companyNews);
  const rows = await db
    .select({
      id: schema.companyNews.id,
      title: schema.companyNews.title,
      content: schema.companyNews.content,
      category: schema.companyNews.category,
      authorId: schema.companyNews.authorId,
      isPinned: schema.companyNews.isPinned,
      attachments: schema.companyNews.attachments,
      linkUrl: schema.companyNews.linkUrl,
      createdAt: schema.companyNews.createdAt,
      updatedAt: schema.companyNews.updatedAt,
      authorName: schema.users.name,
      authorAvatarUrl: schema.users.avatarUrl,
    })
    .from(schema.companyNews)
    .innerJoin(schema.users, eq(schema.users.id, schema.companyNews.authorId))
    .orderBy(desc(schema.companyNews.isPinned), desc(schema.companyNews.createdAt))
    .limit(limit)
    .offset(offset);

  return {
    data: rows.map((r) => ({
      id: r.id,
      title: r.title,
      content: r.content,
      category: r.category,
      authorId: r.authorId,
      isPinned: r.isPinned,
      attachments: r.attachments,
      linkUrl: r.linkUrl,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      author: { id: r.authorId, name: r.authorName, avatarUrl: r.authorAvatarUrl },
    })),
    total: Number(totalRow?.n ?? 0),
  };
}

export async function findNewsById(db: Db, id: string) {
  const [row] = await db.select().from(schema.companyNews).where(eq(schema.companyNews.id, id)).limit(1);
  if (!row) return null;
  const [author] = await db
    .select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl })
    .from(schema.users)
    .where(eq(schema.users.id, row.authorId))
    .limit(1);
  return {
    ...row,
    author: author ?? { id: row.authorId, name: "", avatarUrl: null },
  };
}

export async function createNews(
  db: Db,
  input: {
    authorId: string;
    title: string;
    content: string;
    category?: string;
    isPinned?: boolean;
    attachments?: unknown;
  },
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.companyNews).values({
    id,
    authorId: input.authorId,
    title: input.title,
    content: input.content,
    category: input.category ?? null,
    isPinned: input.isPinned ?? false,
    attachments: input.attachments ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return findNewsById(db, id);
}

export async function updateNews(
  db: Db,
  id: string,
  input: Partial<{ title: string; content: string; category: string; isPinned: boolean; attachments: unknown }>,
) {
  await db
    .update(schema.companyNews)
    .set({ ...input, updatedAt: new Date().toISOString() })
    .where(eq(schema.companyNews.id, id));
  return findNewsById(db, id);
}

export async function deleteNews(db: Db, id: string) {
  await db.delete(schema.companyNews).where(eq(schema.companyNews.id, id));
}
