import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
  or,
  type SQL,
} from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";

const userPick = {
  id: schema.users.id,
  name: schema.users.name,
  email: schema.users.email,
};

export type WikiPageListRow = {
  id: string;
  title: string;
  parentId: string | null;
  position: number;
  folder: string | null;
  slug: string | null;
  isPublished: boolean;
  isRestricted: boolean;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string; email: string };
  updatedBy: { id: string; name: string; email: string };
};

async function loadUser(db: Db, id: string) {
  const [row] = await db.select(userPick).from(schema.users).where(eq(schema.users.id, id)).limit(1);
  return row ?? { id, name: "", email: "" };
}

async function hydrateListRow(
  db: Db,
  row: typeof schema.wikiPages.$inferSelect,
): Promise<WikiPageListRow> {
  const [createdBy, updatedBy] = await Promise.all([
    loadUser(db, row.createdById),
    loadUser(db, row.updatedById),
  ]);
  return {
    id: row.id,
    title: row.title,
    parentId: row.parentId,
    position: row.position,
    folder: row.folder,
    slug: row.slug,
    isPublished: row.isPublished,
    isRestricted: row.isRestricted,
    createdById: row.createdById,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    createdBy,
    updatedBy,
  };
}

async function hydrateFullPage(db: Db, row: typeof schema.wikiPages.$inferSelect) {
  const [createdBy, updatedBy] = await Promise.all([
    loadUser(db, row.createdById),
    loadUser(db, row.updatedById),
  ]);
  return { ...row, createdBy, updatedBy };
}

function listWhere(filters: {
  includeUnpublished?: boolean;
  folder?: string;
  search?: string;
}): SQL | undefined {
  const parts: SQL[] = [];
  if (!filters.includeUnpublished) parts.push(eq(schema.wikiPages.isPublished, true));
  if (filters.folder) parts.push(eq(schema.wikiPages.folder, filters.folder));
  if (filters.search) {
    parts.push(
      or(
        ilike(schema.wikiPages.title, `%${filters.search}%`),
        ilike(schema.wikiPages.body, `%${filters.search}%`),
      )!,
    );
  }
  return parts.length ? and(...parts) : undefined;
}

export async function findManyForList(
  db: Db,
  filters: { includeUnpublished?: boolean; folder?: string; search?: string },
  page: number,
  limit: number,
) {
  const where = listWhere(filters);
  const offset = (page - 1) * limit;
  const [totalRow] = await db.select({ n: count() }).from(schema.wikiPages).where(where);
  const rows = await db
    .select()
    .from(schema.wikiPages)
    .where(where)
    .orderBy(asc(schema.wikiPages.folder), asc(schema.wikiPages.position), asc(schema.wikiPages.title))
    .limit(limit)
    .offset(offset);
  const data = await Promise.all(rows.map((r) => hydrateListRow(db, r)));
  return { data, total: Number(totalRow?.n ?? 0) };
}

export async function findAllForTree(db: Db, includeUnpublished: boolean) {
  const where = includeUnpublished ? undefined : eq(schema.wikiPages.isPublished, true);
  const rows = await db
    .select()
    .from(schema.wikiPages)
    .where(where)
    .orderBy(asc(schema.wikiPages.position), asc(schema.wikiPages.title));
  return Promise.all(rows.map((r) => hydrateListRow(db, r)));
}

export async function findAllowedPageIds(db: Db, pageIds: string[], userId: string) {
  if (pageIds.length === 0) return new Set<string>();
  const rows = await db
    .select({ pageId: schema.wikiPagePermissions.pageId })
    .from(schema.wikiPagePermissions)
    .where(and(inArray(schema.wikiPagePermissions.pageId, pageIds), eq(schema.wikiPagePermissions.userId, userId)));
  return new Set(rows.map((r) => r.pageId));
}

export async function findPageById(db: Db, id: string) {
  const [row] = await db.select().from(schema.wikiPages).where(eq(schema.wikiPages.id, id)).limit(1);
  return row ?? null;
}

export async function findPageByIdOrSlug(db: Db, idOrSlug: string) {
  const [row] = await db
    .select()
    .from(schema.wikiPages)
    .where(or(eq(schema.wikiPages.id, idOrSlug), eq(schema.wikiPages.slug, idOrSlug)))
    .limit(1);
  if (!row) return null;
  return hydrateFullPage(db, row);
}

export async function findPageAccessMeta(db: Db, id: string) {
  const [row] = await db
    .select({
      id: schema.wikiPages.id,
      isRestricted: schema.wikiPages.isRestricted,
      createdById: schema.wikiPages.createdById,
    })
    .from(schema.wikiPages)
    .where(eq(schema.wikiPages.id, id))
    .limit(1);
  return row ?? null;
}

export async function findPageBySlug(db: Db, slug: string) {
  const [row] = await db.select({ id: schema.wikiPages.id }).from(schema.wikiPages).where(eq(schema.wikiPages.slug, slug)).limit(1);
  return row ?? null;
}

export async function findParentId(db: Db, parentId: string) {
  const [row] = await db
    .select({ id: schema.wikiPages.id })
    .from(schema.wikiPages)
    .where(eq(schema.wikiPages.id, parentId))
    .limit(1);
  return row ?? null;
}

export async function findLastPosition(db: Db, parentId: string | null) {
  const where = parentId ? eq(schema.wikiPages.parentId, parentId) : isNull(schema.wikiPages.parentId);
  const [row] = await db
    .select({ position: schema.wikiPages.position })
    .from(schema.wikiPages)
    .where(where)
    .orderBy(desc(schema.wikiPages.position))
    .limit(1);
  return row?.position ?? -1;
}

export async function findParentChainStep(db: Db, id: string) {
  const [row] = await db
    .select({ parentId: schema.wikiPages.parentId })
    .from(schema.wikiPages)
    .where(eq(schema.wikiPages.id, id))
    .limit(1);
  return row?.parentId ?? null;
}

export async function createPage(
  db: Db,
  input: {
    title: string;
    body: string;
    parentId: string | null;
    position: number;
    folder: string | null;
    slug: string | null;
    isPublished: boolean;
    isRestricted: boolean;
    attachments: unknown;
    createdById: string;
    updatedById: string;
  },
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.wikiPages).values({
    id,
    title: input.title,
    body: input.body,
    parentId: input.parentId,
    position: input.position,
    folder: input.folder,
    slug: input.slug,
    isPublished: input.isPublished,
    isRestricted: input.isRestricted,
    attachments: input.attachments,
    createdById: input.createdById,
    updatedById: input.updatedById,
    createdAt: now,
    updatedAt: now,
  });
  const page = await findPageById(db, id);
  return page ? hydrateFullPage(db, page) : null;
}

export async function updatePage(
  db: Db,
  id: string,
  data: Partial<{
    title: string;
    body: string;
    parentId: string | null;
    position: number;
    folder: string | null;
    slug: string | null;
    isPublished: boolean;
    isRestricted: boolean;
    attachments: unknown;
    updatedById: string;
  }>,
) {
  await db
    .update(schema.wikiPages)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.wikiPages.id, id));
  const page = await findPageById(db, id);
  return page ? hydrateFullPage(db, page) : null;
}

export async function deletePage(db: Db, id: string) {
  await db.delete(schema.wikiPages).where(eq(schema.wikiPages.id, id));
}

export async function findLastVersionNumber(db: Db, pageId: string) {
  const [row] = await db
    .select({ version: schema.wikiPageVersions.version })
    .from(schema.wikiPageVersions)
    .where(eq(schema.wikiPageVersions.pageId, pageId))
    .orderBy(desc(schema.wikiPageVersions.version))
    .limit(1);
  return row?.version ?? 0;
}

export async function createVersion(
  db: Db,
  input: { pageId: string; version: number; title: string; body: string; createdById: string },
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.wikiPageVersions).values({
    id,
    pageId: input.pageId,
    version: input.version,
    title: input.title,
    body: input.body,
    createdById: input.createdById,
    createdAt: now,
  });
}

export async function findVersions(db: Db, pageId: string) {
  const rows = await db
    .select({
      id: schema.wikiPageVersions.id,
      version: schema.wikiPageVersions.version,
      title: schema.wikiPageVersions.title,
      createdAt: schema.wikiPageVersions.createdAt,
      createdById: schema.wikiPageVersions.createdById,
    })
    .from(schema.wikiPageVersions)
    .where(eq(schema.wikiPageVersions.pageId, pageId))
    .orderBy(desc(schema.wikiPageVersions.version));
  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      version: row.version,
      title: row.title,
      createdAt: row.createdAt,
      createdBy: await loadUser(db, row.createdById),
    })),
  );
}

export async function findVersionById(db: Db, pageId: string, versionId: string) {
  const [row] = await db
    .select()
    .from(schema.wikiPageVersions)
    .where(and(eq(schema.wikiPageVersions.id, versionId), eq(schema.wikiPageVersions.pageId, pageId)))
    .limit(1);
  if (!row) return null;
  return { ...row, createdBy: await loadUser(db, row.createdById) };
}

export async function findPermissions(db: Db, pageId: string) {
  const rows = await db
    .select()
    .from(schema.wikiPagePermissions)
    .where(eq(schema.wikiPagePermissions.pageId, pageId))
    .orderBy(asc(schema.wikiPagePermissions.createdAt));
  return Promise.all(
    rows.map(async (row) => ({
      ...row,
      user: await loadUser(db, row.userId),
    })),
  );
}

export async function findPagePermission(db: Db, pageId: string, userId: string) {
  const [row] = await db
    .select({ level: schema.wikiPagePermissions.level })
    .from(schema.wikiPagePermissions)
    .where(and(eq(schema.wikiPagePermissions.pageId, pageId), eq(schema.wikiPagePermissions.userId, userId)))
    .limit(1);
  return row ?? null;
}

export async function upsertPagePermission(
  db: Db,
  pageId: string,
  userId: string,
  level: string,
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db
    .insert(schema.wikiPagePermissions)
    .values({ id, pageId, userId, level, createdAt: now })
    .onConflictDoUpdate({
      target: [schema.wikiPagePermissions.pageId, schema.wikiPagePermissions.userId],
      set: { level },
    });
  const [row] = await db
    .select()
    .from(schema.wikiPagePermissions)
    .where(and(eq(schema.wikiPagePermissions.pageId, pageId), eq(schema.wikiPagePermissions.userId, userId)))
    .limit(1);
  if (!row) return null;
  return { ...row, user: await loadUser(db, row.userId) };
}

export async function findPermissionById(db: Db, pageId: string, permissionId: string) {
  const [row] = await db
    .select({ id: schema.wikiPagePermissions.id })
    .from(schema.wikiPagePermissions)
    .where(and(eq(schema.wikiPagePermissions.id, permissionId), eq(schema.wikiPagePermissions.pageId, pageId)))
    .limit(1);
  return row ?? null;
}

export async function deletePermission(db: Db, permissionId: string) {
  await db.delete(schema.wikiPagePermissions).where(eq(schema.wikiPagePermissions.id, permissionId));
}

export async function findUserById(db: Db, userId: string) {
  const [row] = await db.select({ id: schema.users.id }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
  return row ?? null;
}
