import { asc, count, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";

export type WallPostRow = {
  id: string;
  authorId: string;
  content: string;
  type: string;
  reactions: unknown;
  attachments: unknown;
  linkUrl: string | null;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string; avatarUrl: string | null; jobTitle: string | null };
  comments: Array<{
    id: string;
    postId: string;
    authorId: string;
    content: string;
    createdAt: string;
    author: { id: string; name: string; avatarUrl: string | null };
  }>;
};

async function hydratePosts(db: Db, rows: Array<typeof schema.wallPosts.$inferSelect>): Promise<WallPostRow[]> {
  if (rows.length === 0) return [];
  const authorIds = [...new Set(rows.map((r) => r.authorId))];
  const postIds = rows.map((r) => r.id);

  const authors = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      avatarUrl: schema.users.avatarUrl,
      jobTitle: schema.users.jobTitle,
    })
    .from(schema.users)
    .where(inArray(schema.users.id, authorIds));
  const authorById = new Map(authors.map((a) => [a.id, a]));

  const comments = await db
    .select({
      id: schema.wallComments.id,
      postId: schema.wallComments.postId,
      authorId: schema.wallComments.authorId,
      content: schema.wallComments.content,
      createdAt: schema.wallComments.createdAt,
      authorName: schema.users.name,
      authorAvatarUrl: schema.users.avatarUrl,
    })
    .from(schema.wallComments)
    .innerJoin(schema.users, eq(schema.users.id, schema.wallComments.authorId))
    .where(inArray(schema.wallComments.postId, postIds))
    .orderBy(asc(schema.wallComments.createdAt));

  const commentsByPost = new Map<string, WallPostRow["comments"]>();
  for (const c of comments) {
    const list = commentsByPost.get(c.postId) ?? [];
    list.push({
      id: c.id,
      postId: c.postId,
      authorId: c.authorId,
      content: c.content,
      createdAt: c.createdAt,
      author: { id: c.authorId, name: c.authorName, avatarUrl: c.authorAvatarUrl },
    });
    commentsByPost.set(c.postId, list);
  }

  return rows.map((r) => {
    const author = authorById.get(r.authorId) ?? {
      id: r.authorId,
      name: "",
      avatarUrl: null,
      jobTitle: null,
    };
    return {
      id: r.id,
      authorId: r.authorId,
      content: r.content,
      type: r.type,
      reactions: r.reactions,
      attachments: r.attachments,
      linkUrl: r.linkUrl,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      author,
      comments: commentsByPost.get(r.id) ?? [],
    };
  });
}

export async function findAllPosts(db: Db, page: number, limit: number) {
  const offset = (page - 1) * limit;
  const [totalRow] = await db.select({ n: count() }).from(schema.wallPosts);
  const rows = await db
    .select()
    .from(schema.wallPosts)
    .orderBy(desc(schema.wallPosts.createdAt))
    .limit(limit)
    .offset(offset);
  return { data: await hydratePosts(db, rows), total: Number(totalRow?.n ?? 0) };
}

export async function findPostById(db: Db, id: string) {
  const [row] = await db.select().from(schema.wallPosts).where(eq(schema.wallPosts.id, id)).limit(1);
  if (!row) return null;
  const [hydrated] = await hydratePosts(db, [row]);
  return hydrated ?? null;
}

export async function createPost(
  db: Db,
  input: { authorId: string; content: string; type: string; attachments?: unknown },
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.wallPosts).values({
    id,
    authorId: input.authorId,
    content: input.content,
    type: input.type,
    attachments: input.attachments ?? null,
    createdAt: now,
    updatedAt: now,
  });
  return findPostById(db, id);
}

export async function updatePost(db: Db, id: string, content: string) {
  await db
    .update(schema.wallPosts)
    .set({ content, updatedAt: new Date().toISOString() })
    .where(eq(schema.wallPosts.id, id));
  return findPostById(db, id);
}

export async function updateReactions(db: Db, id: string, reactions: Record<string, string[]>) {
  await db
    .update(schema.wallPosts)
    .set({ reactions, updatedAt: new Date().toISOString() })
    .where(eq(schema.wallPosts.id, id));
  return findPostById(db, id);
}

export async function addComment(
  db: Db,
  input: { postId: string; authorId: string; content: string },
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.wallComments).values({
    id,
    postId: input.postId,
    authorId: input.authorId,
    content: input.content,
    createdAt: now,
  });
  const [author] = await db
    .select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl })
    .from(schema.users)
    .where(eq(schema.users.id, input.authorId))
    .limit(1);
  return {
    id,
    postId: input.postId,
    authorId: input.authorId,
    content: input.content,
    createdAt: now,
    author: author ?? { id: input.authorId, name: "", avatarUrl: null },
  };
}

export async function deletePost(db: Db, id: string) {
  await db.delete(schema.wallPosts).where(eq(schema.wallPosts.id, id));
}
