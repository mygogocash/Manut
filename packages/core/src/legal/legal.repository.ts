import { and, count, desc, eq, ilike, or, sql } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";
import type {
  CreateLegalDocumentInput,
  LegalQuery,
  UpdateLegalDocumentInput,
} from "@nexora/contracts/modules/legal/legal.validation";

const docs = schema.legalDocuments;
const attachments = schema.legalDocumentAttachments;
const shares = schema.legalDocumentShares;

export async function findMany(db: Db, query: LegalQuery) {
  const { page, limit, kind, status, entityId, ownerId, folder, search, expiringWithinDays } = query;
  const conditions = [];
  if (kind) conditions.push(eq(docs.kind, kind));
  if (status) conditions.push(eq(docs.status, status));
  if (entityId) conditions.push(eq(docs.entityId, entityId));
  if (ownerId) conditions.push(eq(docs.ownerId, ownerId));
  if (folder) conditions.push(eq(docs.folder, folder));
  if (search) {
    const q = `%${search}%`;
    conditions.push(or(ilike(docs.title, q), ilike(docs.reference, q))!);
  }
  if (expiringWithinDays) {
    conditions.push(
      sql`${docs.expiryDate} IS NOT NULL AND ${docs.expiryDate}::date <= (CURRENT_DATE + ${expiringWithinDays}::int)`,
    );
  }
  const where = conditions.length ? and(...conditions) : undefined;
  const [rows, totals] = await Promise.all([
    db.select().from(docs).where(where).orderBy(desc(docs.updatedAt)).limit(limit).offset((page - 1) * limit),
    db.select({ total: count() }).from(docs).where(where),
  ]);
  return { data: rows, total: Number(totals[0]?.total ?? 0) };
}

export async function findById(db: Db, id: string) {
  const [row] = await db.select().from(docs).where(eq(docs.id, id)).limit(1);
  return row ?? null;
}

export async function create(db: Db, input: CreateLegalDocumentInput, actorId: string) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(docs).values({
    id,
    title: input.title,
    kind: input.kind,
    reference: input.reference ?? null,
    parties: input.parties ?? [],
    ownerId: (input.ownerId as string | null | undefined) ?? actorId,
    entityId: input.entityId ?? null,
    effectiveDate: input.effectiveDate ?? null,
    expiryDate: input.expiryDate ?? null,
    renewalLeadDays: input.renewalLeadDays ?? 30,
    status: input.status ?? "active",
    fileUrl: input.fileUrl ?? null,
    fileName: input.fileName ?? null,
    folder: input.folder ?? null,
    alertCategory: input.alertCategory ?? null,
    notes: input.notes ?? null,
    visibility: "private",
    createdAt: now,
    updatedAt: now,
  });
  return findById(db, id);
}

export async function update(db: Db, id: string, input: UpdateLegalDocumentInput) {
  const patch: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) patch[k] = v;
  }
  await db.update(docs).set(patch).where(eq(docs.id, id));
  return findById(db, id);
}

export async function remove(db: Db, id: string) {
  await db.delete(shares).where(eq(shares.documentId, id));
  await db.delete(attachments).where(eq(attachments.documentId, id));
  await db.delete(docs).where(eq(docs.id, id));
}

export async function listAttachments(db: Db, documentId: string) {
  return db
    .select()
    .from(attachments)
    .where(eq(attachments.documentId, documentId))
    .orderBy(desc(attachments.createdAt));
}

export async function listShares(db: Db, documentId: string) {
  return db.select().from(shares).where(eq(shares.documentId, documentId));
}

export async function listFolders(db: Db) {
  const rows = await db
    .selectDistinct({ folder: docs.folder })
    .from(docs)
    .where(sql`${docs.folder} IS NOT NULL`);
  return rows.map((r) => r.folder).filter(Boolean) as string[];
}

export async function createAttachment(
  db: Db,
  documentId: string,
  input: import("@nexora/contracts/modules/legal/legal.validation").CreateLegalAttachmentInput,
  actorId: string,
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(attachments).values({
    id,
    documentId,
    kind: input.kind ?? "other",
    label: input.label ?? null,
    fileUrl: input.fileUrl,
    fileName: input.fileName,
    effectiveDate: input.effectiveDate ?? null,
    expiryDate: input.expiryDate ?? null,
    notes: input.notes ?? null,
    uploadedById: actorId,
    createdAt: now,
  });
  const [row] = await db.select().from(attachments).where(eq(attachments.id, id)).limit(1);
  return row;
}

export async function updateAttachment(
  db: Db,
  documentId: string,
  attachmentId: string,
  input: import("@nexora/contracts/modules/legal/legal.validation").UpdateLegalAttachmentInput,
) {
  const patch: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (v !== undefined) patch[k] = v;
  }
  if (!Object.keys(patch).length) {
    const [row] = await db
      .select()
      .from(attachments)
      .where(and(eq(attachments.id, attachmentId), eq(attachments.documentId, documentId)))
      .limit(1);
    return row ?? null;
  }
  await db
    .update(attachments)
    .set(patch)
    .where(and(eq(attachments.id, attachmentId), eq(attachments.documentId, documentId)));
  const [row] = await db
    .select()
    .from(attachments)
    .where(and(eq(attachments.id, attachmentId), eq(attachments.documentId, documentId)))
    .limit(1);
  return row ?? null;
}

export async function deleteAttachment(db: Db, documentId: string, attachmentId: string) {
  await db
    .delete(attachments)
    .where(and(eq(attachments.id, attachmentId), eq(attachments.documentId, documentId)));
}

export async function createShare(
  db: Db,
  documentId: string,
  input: import("@nexora/contracts/modules/legal/legal.validation").CreateShareInput,
  actorId: string,
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(shares).values({
    id,
    documentId,
    type: input.type,
    userId: input.userId ?? null,
    department: input.department ?? null,
    groupId: input.groupId ?? null,
    createdById: actorId,
    createdAt: now,
  });
  const [row] = await db.select().from(shares).where(eq(shares.id, id)).limit(1);
  return row;
}

export async function deleteShare(db: Db, documentId: string, shareId: string) {
  await db.delete(shares).where(and(eq(shares.id, shareId), eq(shares.documentId, documentId)));
}

export async function setVisibility(db: Db, id: string, visibility: string) {
  await db.update(docs).set({ visibility, updatedAt: new Date().toISOString() }).where(eq(docs.id, id));
  return findById(db, id);
}
