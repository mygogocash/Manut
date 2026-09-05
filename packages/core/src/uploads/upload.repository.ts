import { and, count, desc, eq, inArray, isNull } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";

export async function findAll(db: Db, userId: string, page: number, limit: number) {
  const where = and(eq(schema.fileUploads.uploadedBy, userId), isNull(schema.fileUploads.deletedAt));
  const [data, countRows] = await Promise.all([
    db.select().from(schema.fileUploads).where(where).orderBy(desc(schema.fileUploads.createdAt)).offset((page - 1) * limit).limit(limit),
    db.select({ total: count() }).from(schema.fileUploads).where(where),
  ]);
  return { data, total: Number(countRows[0]?.total ?? 0) };
}

export async function findById(db: Db, id: string) {
  const [row] = await db.select().from(schema.fileUploads).where(eq(schema.fileUploads.id, id)).limit(1);
  return row ?? null;
}

export async function create(db: Db, data: {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  path: string;
  bucket: string;
  uploadedBy: string;
  purpose?: string | null;
  linkedTo?: string | null;
  linkedId?: string | null;
}) {
  const now = new Date().toISOString();
  const [row] = await db.insert(schema.fileUploads).values({
    id: data.id,
    filename: data.filename,
    originalName: data.originalName,
    mimeType: data.mimeType,
    size: data.size,
    path: data.path,
    bucket: data.bucket,
    uploadedBy: data.uploadedBy,
    purpose: data.purpose ?? null,
    linkedTo: data.linkedTo ?? null,
    linkedId: data.linkedId ?? null,
    createdAt: now,
  }).returning();
  return row!;
}

export async function remove(db: Db, id: string) {
  await db.delete(schema.fileUploads).where(eq(schema.fileUploads.id, id));
}

export async function softRemove(db: Db, id: string, deletedBy: string) {
  const now = new Date().toISOString();
  await db.update(schema.fileUploads).set({ deletedAt: now, deletedBy }).where(eq(schema.fileUploads.id, id));
}

export async function linkToMessage(db: Db, uploadIds: string[], messageId: string, ownerId: string) {
  if (uploadIds.length === 0) return [];
  await db.update(schema.fileUploads)
    .set({ linkedTo: "message", linkedId: messageId })
    .where(and(inArray(schema.fileUploads.id, uploadIds), eq(schema.fileUploads.uploadedBy, ownerId)));
  return db.select().from(schema.fileUploads).where(inArray(schema.fileUploads.id, uploadIds));
}

export async function findAttachmentsForMessages(db: Db, messageIds: string[]) {
  if (messageIds.length === 0) return [];
  return db.select().from(schema.fileUploads)
    .where(and(eq(schema.fileUploads.linkedTo, "message"), inArray(schema.fileUploads.linkedId, messageIds)))
    .orderBy(schema.fileUploads.createdAt);
}
