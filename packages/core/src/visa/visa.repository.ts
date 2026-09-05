import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  type SQL,
} from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";

async function withRelations(db: Db, row: typeof schema.visaRecords.$inferSelect) {
  const [employee] = await db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      department: schema.users.department,
    })
    .from(schema.users)
    .where(eq(schema.users.id, row.employeeId))
    .limit(1);

  let entity: { id: string; name: string } | null = null;
  if (row.entityId) {
    const [e] = await db
      .select({ id: schema.entities.id, name: schema.entities.name })
      .from(schema.entities)
      .where(eq(schema.entities.id, row.entityId))
      .limit(1);
    entity = e ?? null;
  }

  return { ...row, employee: employee ?? null, entity };
}

export async function findMany(
  db: Db,
  filters: {
    employeeId?: string;
    status?: string;
    country?: string;
    entityId?: string;
  },
  page: number,
  limit: number,
) {
  const parts: SQL[] = [isNull(schema.visaRecords.deletedAt)];
  if (filters.employeeId) parts.push(eq(schema.visaRecords.employeeId, filters.employeeId));
  if (filters.status) parts.push(eq(schema.visaRecords.status, filters.status));
  if (filters.country) parts.push(eq(schema.visaRecords.country, filters.country));
  if (filters.entityId) parts.push(eq(schema.visaRecords.entityId, filters.entityId));
  const where = and(...parts);
  const offset = (page - 1) * limit;

  const [totalRow] = await db.select({ n: count() }).from(schema.visaRecords).where(where);
  const rows = await db
    .select()
    .from(schema.visaRecords)
    .where(where)
    .orderBy(asc(schema.visaRecords.expiryDate))
    .limit(limit)
    .offset(offset);

  const data = await Promise.all(rows.map((r) => withRelations(db, r)));
  return { data, total: Number(totalRow?.n ?? 0) };
}

export async function findById(db: Db, id: string) {
  const [row] = await db
    .select()
    .from(schema.visaRecords)
    .where(and(eq(schema.visaRecords.id, id), isNull(schema.visaRecords.deletedAt)))
    .limit(1);
  return row ? withRelations(db, row) : null;
}

export async function findByIdIncludingDeleted(db: Db, id: string) {
  const [row] = await db.select().from(schema.visaRecords).where(eq(schema.visaRecords.id, id)).limit(1);
  return row ? withRelations(db, row) : null;
}

export async function create(
  db: Db,
  data: {
    employeeId: string;
    holderType?: string;
    holderName?: string | null;
    holderRelationship?: string | null;
    visaType: string;
    country: string;
    nationality?: string | null;
    issueDate?: string | null;
    expiryDate: string;
    workPermitNumber?: string | null;
    workPermitIssueDate?: string | null;
    workPermitExpiryDate?: string | null;
    status?: string;
    documentUrl?: string | null;
    documents?: unknown;
    notes?: string | null;
    entityId?: string | null;
  },
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.visaRecords).values({
    id,
    employeeId: data.employeeId,
    holderType: data.holderType ?? "employee",
    holderName: data.holderName ?? null,
    holderRelationship: data.holderRelationship ?? null,
    visaType: data.visaType,
    country: data.country,
    nationality: data.nationality ?? null,
    issueDate: data.issueDate ?? null,
    expiryDate: data.expiryDate,
    workPermitNumber: data.workPermitNumber ?? null,
    workPermitIssueDate: data.workPermitIssueDate ?? null,
    workPermitExpiryDate: data.workPermitExpiryDate ?? null,
    status: data.status ?? "active",
    documentUrl: data.documentUrl ?? null,
    documents: (data.documents ?? []) as never,
    notes: data.notes ?? null,
    entityId: data.entityId ?? null,
    updatedAt: now,
  });
  return findById(db, id);
}

export async function update(
  db: Db,
  id: string,
  data: Partial<{
    holderType: string;
    holderName: string | null;
    holderRelationship: string | null;
    visaType: string;
    country: string;
    nationality: string | null;
    issueDate: string | null;
    expiryDate: string;
    workPermitNumber: string | null;
    workPermitIssueDate: string | null;
    workPermitExpiryDate: string | null;
    status: string;
    statusChangedAt: string;
    documentUrl: string | null;
    documents: unknown;
    notes: string | null;
    entityId: string | null;
  }>,
) {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { ...data, updatedAt: now };
  if (data.documents !== undefined) patch.documents = data.documents;
  await db.update(schema.visaRecords).set(patch as never).where(eq(schema.visaRecords.id, id));
  return findById(db, id);
}

export async function softDelete(db: Db, id: string) {
  const now = new Date().toISOString();
  await db
    .update(schema.visaRecords)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(schema.visaRecords.id, id));
  return findByIdIncludingDeleted(db, id);
}

export async function restore(db: Db, id: string) {
  const now = new Date().toISOString();
  await db
    .update(schema.visaRecords)
    .set({ deletedAt: null, updatedAt: now })
    .where(eq(schema.visaRecords.id, id));
  return findByIdIncludingDeleted(db, id);
}

export async function permanentDelete(db: Db, id: string) {
  await db.delete(schema.visaRecords).where(eq(schema.visaRecords.id, id));
}

export async function createEventLogs(
  db: Db,
  entries: Array<{
    visaRecordId: string;
    actorId?: string | null;
    actorType?: string;
    kind: string;
    field?: string | null;
    oldValue?: string | null;
    newValue?: string | null;
  }>,
) {
  if (entries.length === 0) return;
  await db.insert(schema.visaEventLogs).values(
    entries.map((e) => ({
      id: crypto.randomUUID(),
      visaRecordId: e.visaRecordId,
      actorId: e.actorId ?? null,
      actorType: e.actorType ?? "user",
      kind: e.kind,
      field: e.field ?? null,
      oldValue: e.oldValue ?? null,
      newValue: e.newValue ?? null,
    })),
  );
}

export async function listEventLogs(db: Db, visaRecordId: string) {
  const rows = await db
    .select()
    .from(schema.visaEventLogs)
    .where(eq(schema.visaEventLogs.visaRecordId, visaRecordId))
    .orderBy(desc(schema.visaEventLogs.createdAt));

  return Promise.all(
    rows.map(async (row) => {
      let actor: { id: string; name: string } | null = null;
      if (row.actorId) {
        const [a] = await db
          .select({ id: schema.users.id, name: schema.users.name })
          .from(schema.users)
          .where(eq(schema.users.id, row.actorId))
          .limit(1);
        actor = a ?? null;
      }
      return { ...row, actor };
    }),
  );
}

export async function findUsersByIds(db: Db, ids: string[]) {
  if (ids.length === 0) return [];
  return db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      employeeId: schema.users.employeeId,
    })
    .from(schema.users)
    .where(inArray(schema.users.id, ids));
}

export async function findUsersByEmails(db: Db, emails: string[]) {
  if (emails.length === 0) return [];
  return db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      employeeId: schema.users.employeeId,
    })
    .from(schema.users)
    .where(inArray(schema.users.email, emails));
}

export async function findUsersByEmployeeCodes(db: Db, codes: string[]) {
  if (codes.length === 0) return [];
  return db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      employeeId: schema.users.employeeId,
    })
    .from(schema.users)
    .where(inArray(schema.users.employeeId, codes));
}

export async function findActiveUsersForBulkMatch(db: Db) {
  return db
    .select({
      id: schema.users.id,
      name: schema.users.name,
      email: schema.users.email,
      employeeId: schema.users.employeeId,
    })
    .from(schema.users)
    .where(eq(schema.users.isActive, true));
}
