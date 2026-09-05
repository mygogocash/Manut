import { and, desc, eq, ilike, or } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";

export async function listConversations(db: Db, userId: string) {
  return db
    .select({
      id: schema.ariaConversations.id,
      title: schema.ariaConversations.title,
      createdAt: schema.ariaConversations.createdAt,
      updatedAt: schema.ariaConversations.updatedAt,
    })
    .from(schema.ariaConversations)
    .where(eq(schema.ariaConversations.userId, userId))
    .orderBy(desc(schema.ariaConversations.updatedAt));
}

export async function findConversation(db: Db, userId: string, id: string) {
  const [row] = await db
    .select()
    .from(schema.ariaConversations)
    .where(and(eq(schema.ariaConversations.id, id), eq(schema.ariaConversations.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function createConversation(db: Db, userId: string, title: string | null) {
  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  await db.insert(schema.ariaConversations).values({ id, userId, title, createdAt: now, updatedAt: now });
  return { id, userId, title, createdAt: now, updatedAt: now };
}

export async function deleteConversation(db: Db, userId: string, id: string) {
  await db
    .delete(schema.ariaConversations)
    .where(and(eq(schema.ariaConversations.id, id), eq(schema.ariaConversations.userId, userId)));
}

export async function listMessages(db: Db, conversationId: string) {
  return db
    .select()
    .from(schema.ariaMessages)
    .where(eq(schema.ariaMessages.conversationId, conversationId))
    .orderBy(schema.ariaMessages.createdAt);
}

export async function listKnowledge(db: Db, query: { category?: string; isActive?: boolean; search?: string }) {
  const conditions = [];
  if (query.category) conditions.push(eq(schema.ariaKnowledgeArticles.category, query.category));
  if (query.isActive !== undefined) conditions.push(eq(schema.ariaKnowledgeArticles.isActive, query.isActive));
  if (query.search?.trim()) {
    const q = `%${query.search.trim()}%`;
    conditions.push(or(ilike(schema.ariaKnowledgeArticles.title, q), ilike(schema.ariaKnowledgeArticles.slug, q))!);
  }
  const where = conditions.length ? and(...conditions) : undefined;
  return db
    .select()
    .from(schema.ariaKnowledgeArticles)
    .where(where)
    .orderBy(desc(schema.ariaKnowledgeArticles.updatedAt));
}

export async function findKnowledgeById(db: Db, id: string) {
  const [row] = await db.select().from(schema.ariaKnowledgeArticles).where(eq(schema.ariaKnowledgeArticles.id, id)).limit(1);
  return row ?? null;
}

export async function findKnowledgeBySlug(db: Db, slug: string) {
  const [row] = await db.select().from(schema.ariaKnowledgeArticles).where(eq(schema.ariaKnowledgeArticles.slug, slug)).limit(1);
  return row ?? null;
}

export async function createKnowledge(
  db: Db,
  input: {
    id: string;
    category: string;
    title: string;
    slug: string;
    body: string;
    keywords: string[];
    tags: string[];
    requiredPermissions: string[];
    isActive: boolean;
    createdById: string | null;
  },
) {
  const now = new Date().toISOString();
  await db.insert(schema.ariaKnowledgeArticles).values({
    id: input.id,
    category: input.category,
    title: input.title,
    slug: input.slug,
    body: input.body,
    keywords: input.keywords,
    tags: input.tags,
    requiredPermissions: input.requiredPermissions,
    isActive: input.isActive,
    createdById: input.createdById,
    createdAt: now,
    updatedAt: now,
  });
  return findKnowledgeById(db, input.id);
}

export async function updateKnowledge(db: Db, id: string, patch: Record<string, unknown>) {
  const now = new Date().toISOString();
  await db.update(schema.ariaKnowledgeArticles).set({ ...patch, updatedAt: now }).where(eq(schema.ariaKnowledgeArticles.id, id));
  return findKnowledgeById(db, id);
}

export async function deleteKnowledge(db: Db, id: string) {
  await db.delete(schema.ariaKnowledgeArticles).where(eq(schema.ariaKnowledgeArticles.id, id));
}
