import { and, asc, count, desc, eq, gt, inArray, isNull, ne, or, sql } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";

const creatorSelect = {
  id: schema.users.id,
  name: schema.users.name,
  avatarUrl: schema.users.avatarUrl,
};

export function directChannelName(userIds: string[]) {
  return `dm:${[...userIds].sort().join(":")}`;
}

async function loadChannel(db: Db, id: string) {
  const [conv] = await db.select().from(schema.conversations).where(eq(schema.conversations.id, id)).limit(1);
  if (!conv) return null;
  const members = await db
    .select({ userId: schema.conversationMembers.userId, role: schema.conversationMembers.role })
    .from(schema.conversationMembers)
    .where(eq(schema.conversationMembers.conversationId, id));
  const [creator] = await db.select(creatorSelect).from(schema.users).where(eq(schema.users.id, conv.createdBy)).limit(1);
  const [countRow] = await db.select({ n: count() }).from(schema.messages).where(eq(schema.messages.conversationId, id));
  return { ...conv, creator: creator ?? null, members, _count: { messages: Number(countRow?.n ?? 0) } };
}

export async function findAllChannels(db: Db) {
  const rows = await db.select().from(schema.conversations).orderBy(desc(schema.conversations.updatedAt));
  return Promise.all(rows.map((r) => loadChannel(db, r.id))).then((x) => x.filter(Boolean));
}

export async function findChannelById(db: Db, id: string) {
  return loadChannel(db, id);
}

export async function createChannel(db: Db, data: {
  name: string;
  isPrivate: boolean;
  members?: string[];
  createdBy: string;
  type?: string;
}) {
  const conversationType = data.type === "dm" ? "direct" : data.isPrivate ? "private" : "group";
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.conversations).values({
    id,
    title: data.name,
    directKey: conversationType === "direct" ? data.name : null,
    type: conversationType,
    createdBy: data.createdBy,
    createdAt: now,
    updatedAt: now,
  });
  const memberIds = new Set([data.createdBy, ...(data.members ?? [])]);
  for (const userId of memberIds) {
    await db.insert(schema.conversationMembers).values({
      conversationId: id,
      userId,
      role: userId === data.createdBy ? "admin" : "member",
      joinedAt: now,
    });
  }
  return loadChannel(db, id);
}

export async function findDirectChannel(db: Db, userIds: string[]) {
  const key = directChannelName(userIds);
  const [row] = await db.select().from(schema.conversations).where(eq(schema.conversations.directKey, key)).limit(1);
  if (!row) return null;
  return loadChannel(db, row.id);
}

export async function listChannelsForUser(db: Db, userId: string, options: { includePrivateChannels?: boolean } = {}) {
  const memberships = await db
    .select({ conversationId: schema.conversationMembers.conversationId })
    .from(schema.conversationMembers)
    .where(and(eq(schema.conversationMembers.userId, userId), isNull(schema.conversationMembers.leftAt)));
  const ids = memberships.map((m) => m.conversationId);
  if (ids.length === 0) return [];
  const rows = await db
    .select()
    .from(schema.conversations)
    .where(
      and(
        inArray(schema.conversations.id, ids),
        options.includePrivateChannels
          ? undefined
          : or(
              eq(schema.conversations.type, "group"),
              eq(schema.conversations.type, "direct"),
              and(eq(schema.conversations.type, "private"), inArray(schema.conversations.id, ids)),
            ),
      ),
    )
    .orderBy(desc(schema.conversations.updatedAt));
  return Promise.all(rows.map((r) => loadChannel(db, r.id))).then((x) => x.filter(Boolean));
}

export async function updateChannel(db: Db, id: string, data: { name?: string }) {
  const now = new Date().toISOString();
  if (data.name !== undefined) {
    await db.update(schema.conversations).set({ title: data.name, updatedAt: now }).where(eq(schema.conversations.id, id));
  }
  return loadChannel(db, id);
}

export async function deleteChannel(db: Db, id: string) {
  await db.delete(schema.messages).where(eq(schema.messages.conversationId, id));
  await db.delete(schema.conversationMembers).where(eq(schema.conversationMembers.conversationId, id));
  await db.delete(schema.conversations).where(eq(schema.conversations.id, id));
}

export async function hideConversationForUser(db: Db, userId: string, channelId: string) {
  const now = new Date().toISOString();
  await db
    .update(schema.conversationMembers)
    .set({ leftAt: now })
    .where(and(eq(schema.conversationMembers.conversationId, channelId), eq(schema.conversationMembers.userId, userId)));
}

export async function restoreConversationMembership(db: Db, userId: string, channelId: string) {
  await db
    .update(schema.conversationMembers)
    .set({ leftAt: null })
    .where(and(eq(schema.conversationMembers.conversationId, channelId), eq(schema.conversationMembers.userId, userId)));
}

export async function allMembersHaveLeft(db: Db, channelId: string) {
  const members = await db
    .select({ leftAt: schema.conversationMembers.leftAt })
    .from(schema.conversationMembers)
    .where(eq(schema.conversationMembers.conversationId, channelId));
  return members.length > 0 && members.every((m) => m.leftAt != null);
}

export async function findMessages(db: Db, channelId: string, page: number, limit: number) {
  const where = eq(schema.messages.conversationId, channelId);
  const [data, countRows] = await Promise.all([
    db
      .select({
        id: schema.messages.id,
        conversationId: schema.messages.conversationId,
        authorId: schema.messages.authorId,
        content: schema.messages.content,
        deletedForEveryoneAt: schema.messages.deletedForEveryoneAt,
        createdAt: schema.messages.createdAt,
        updatedAt: schema.messages.updatedAt,
        authorName: schema.users.name,
        authorAvatarUrl: schema.users.avatarUrl,
      })
      .from(schema.messages)
      .innerJoin(schema.users, eq(schema.users.id, schema.messages.authorId))
      .where(where)
      .orderBy(asc(schema.messages.createdAt))
      .offset((page - 1) * limit)
      .limit(limit),
    db.select({ total: count() }).from(schema.messages).where(where),
  ]);
  return {
    data: data.map((m) => ({
      id: m.id,
      conversationId: m.conversationId,
      authorId: m.authorId,
      content: m.content,
      deletedForEveryoneAt: m.deletedForEveryoneAt,
      createdAt: m.createdAt,
      updatedAt: m.updatedAt,
      author: { id: m.authorId, name: m.authorName, avatarUrl: m.authorAvatarUrl },
    })),
    total: Number(countRows[0]?.total ?? 0),
  };
}

export async function createMessage(db: Db, data: { channelId: string; authorId: string; content: string }) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.messages).values({
    id,
    conversationId: data.channelId,
    authorId: data.authorId,
    content: data.content,
    createdAt: now,
    updatedAt: now,
  });
  await db
    .update(schema.conversations)
    .set({ lastMessageAt: now, updatedAt: now })
    .where(eq(schema.conversations.id, data.channelId));
  const [author] = await db.select(creatorSelect).from(schema.users).where(eq(schema.users.id, data.authorId)).limit(1);
  return {
    id,
    conversationId: data.channelId,
    authorId: data.authorId,
    content: data.content,
    createdAt: now,
    updatedAt: now,
    author: author ?? { id: data.authorId, name: "", avatarUrl: null },
  };
}

export async function findMessageById(db: Db, id: string) {
  const [row] = await db.select().from(schema.messages).where(eq(schema.messages.id, id)).limit(1);
  return row ?? null;
}

export async function softDeleteMessage(db: Db, id: string, deletedBy: string) {
  const now = new Date().toISOString();
  await db
    .update(schema.messages)
    .set({ deletedForEveryoneAt: now, deletedBy, content: null, updatedAt: now })
    .where(eq(schema.messages.id, id));
  const [author] = await db
    .select({ authorId: schema.messages.authorId })
    .from(schema.messages)
    .where(eq(schema.messages.id, id))
    .limit(1);
  const authorId = author?.authorId ?? deletedBy;
  const [user] = await db.select(creatorSelect).from(schema.users).where(eq(schema.users.id, authorId)).limit(1);
  const [msg] = await db.select().from(schema.messages).where(eq(schema.messages.id, id)).limit(1);
  return { ...msg!, author: user ?? { id: authorId, name: "", avatarUrl: null } };
}

export async function listActiveUsers(db: Db, _excludeUserId: string) {
  return db
    .select({ id: schema.users.id, name: schema.users.name, avatarUrl: schema.users.avatarUrl })
    .from(schema.users)
    .where(and(eq(schema.users.isActive, true), isNull(schema.users.deletedAt)))
    .orderBy(asc(schema.users.name));
}

export async function markChannelRead(db: Db, userId: string, channelId: string) {
  const now = new Date().toISOString();
  await db
    .update(schema.conversationMembers)
    .set({ lastReadAt: now })
    .where(and(eq(schema.conversationMembers.conversationId, channelId), eq(schema.conversationMembers.userId, userId)));
  return { lastReadAt: now };
}

export async function findChannelReads(db: Db, channelId: string) {
  return db
    .select({ userId: schema.conversationMembers.userId, lastReadAt: schema.conversationMembers.lastReadAt })
    .from(schema.conversationMembers)
    .where(eq(schema.conversationMembers.conversationId, channelId));
}

export async function countUnreadByChannel(db: Db, userId: string, channelIds: string[]): Promise<Record<string, number>> {
  if (channelIds.length === 0) return {};
  const memberships = await db
    .select({ conversationId: schema.conversationMembers.conversationId, lastReadAt: schema.conversationMembers.lastReadAt })
    .from(schema.conversationMembers)
    .where(and(eq(schema.conversationMembers.userId, userId), inArray(schema.conversationMembers.conversationId, channelIds)));
  const readMap = new Map(memberships.map((m) => [m.conversationId, m.lastReadAt]));
  const counts = await Promise.all(
    channelIds.map(async (channelId) => {
      const lastReadAt = readMap.get(channelId);
      const conditions = [eq(schema.messages.conversationId, channelId), ne(schema.messages.authorId, userId)];
      if (lastReadAt) conditions.push(gt(schema.messages.createdAt, lastReadAt));
      const [countRow] = await db.select({ n: count() }).from(schema.messages).where(and(...conditions));
      return [channelId, Number(countRow?.n ?? 0)] as const;
    }),
  );
  return Object.fromEntries(counts);
}
