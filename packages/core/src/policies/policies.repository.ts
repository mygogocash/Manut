import { and, asc, desc, eq, ilike, inArray, isNull, or, type SQL } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";

async function hydrate(db: Db, row: typeof schema.companyPolicies.$inferSelect) {
  const [entity, uploadedBy] = await Promise.all([
    row.entityId
      ? db
          .select({ id: schema.entities.id, name: schema.entities.name, code: schema.entities.code })
          .from(schema.entities)
          .where(eq(schema.entities.id, row.entityId))
          .limit(1)
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
    row.uploadedById
      ? db
          .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
          .from(schema.users)
          .where(eq(schema.users.id, row.uploadedById))
          .limit(1)
          .then((r) => r[0] ?? null)
      : Promise.resolve(null),
  ]);
  return { ...row, entity, uploadedBy };
}

export async function findAll(
  db: Db,
  filters: {
    category?: string;
    entityIds?: string[];
    includeInactive?: boolean;
    q?: string;
  },
) {
  const parts: SQL[] = [];
  if (filters.category) parts.push(eq(schema.companyPolicies.category, filters.category));
  if (!filters.includeInactive) parts.push(eq(schema.companyPolicies.isActive, true));
  if (filters.entityIds) {
    parts.push(
      or(isNull(schema.companyPolicies.entityId), inArray(schema.companyPolicies.entityId, filters.entityIds))!,
    );
  }
  const q = filters.q?.trim();
  if (q) {
    parts.push(
      or(
        ilike(schema.companyPolicies.title, `%${q}%`),
        ilike(schema.companyPolicies.description, `%${q}%`),
        ilike(schema.companyPolicies.fileName, `%${q}%`),
      )!,
    );
  }
  const where = parts.length ? and(...parts) : undefined;
  const rows = await db
    .select()
    .from(schema.companyPolicies)
    .where(where)
    .orderBy(asc(schema.companyPolicies.category), desc(schema.companyPolicies.updatedAt));
  return Promise.all(rows.map((r) => hydrate(db, r)));
}

export async function findById(db: Db, id: string) {
  const [row] = await db
    .select()
    .from(schema.companyPolicies)
    .where(eq(schema.companyPolicies.id, id))
    .limit(1);
  if (!row) return null;
  return hydrate(db, row);
}

export async function create(
  db: Db,
  input: {
    title: string;
    category: string;
    description: string | null;
    fileUrl: string;
    fileName: string;
    mimeType: string | null;
    fileSize: number | null;
    version: string | null;
    effectiveDate: string | null;
    entityId: string | null;
    isActive: boolean;
    uploadedById: string;
  },
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.companyPolicies).values({
    id,
    title: input.title,
    category: input.category,
    description: input.description,
    fileUrl: input.fileUrl,
    fileName: input.fileName,
    mimeType: input.mimeType,
    fileSize: input.fileSize,
    version: input.version,
    effectiveDate: input.effectiveDate,
    entityId: input.entityId,
    isActive: input.isActive,
    uploadedById: input.uploadedById,
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
    category: string;
    description: string | null;
    fileUrl: string;
    fileName: string;
    mimeType: string | null;
    fileSize: number | null;
    version: string | null;
    effectiveDate: string | null;
    entityId: string | null;
    isActive: boolean;
  }>,
) {
  await db
    .update(schema.companyPolicies)
    .set({ ...input, updatedAt: new Date().toISOString() })
    .where(eq(schema.companyPolicies.id, id));
  return findById(db, id);
}

export async function remove(db: Db, id: string) {
  await db.delete(schema.companyPolicies).where(eq(schema.companyPolicies.id, id));
}
