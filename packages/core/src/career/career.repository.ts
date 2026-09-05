import { and, asc, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";

async function withCount(db: Db, row: typeof schema.jobs.$inferSelect) {
  const [c] = await db
    .select({ n: count() })
    .from(schema.applications)
    .where(eq(schema.applications.jobId, row.id));
  return { ...row, _count: { applications: Number(c?.n ?? 0) } };
}

function buildWhere(filters: {
  department?: string;
  type?: string;
  active?: boolean;
  search?: string;
}): SQL | undefined {
  const parts: SQL[] = [];
  if (filters.department) parts.push(eq(schema.jobs.department, filters.department));
  if (filters.type) parts.push(eq(schema.jobs.type, filters.type));
  if (filters.active !== undefined) parts.push(eq(schema.jobs.active, filters.active));
  if (filters.search) {
    const q = `%${filters.search}%`;
    parts.push(
      or(ilike(schema.jobs.title, q), ilike(schema.jobs.department, q), ilike(schema.jobs.location, q))!,
    );
  }
  return parts.length ? and(...parts) : undefined;
}

export async function findJobs(
  db: Db,
  filters: { department?: string; type?: string; active?: boolean; search?: string },
  page: number,
  limit: number,
) {
  const offset = (page - 1) * limit;
  const where = buildWhere(filters);
  const [totalRow] = await db.select({ n: count() }).from(schema.jobs).where(where);
  const rows = await db
    .select()
    .from(schema.jobs)
    .where(where)
    .orderBy(desc(schema.jobs.createdAt))
    .limit(limit)
    .offset(offset);
  const data = await Promise.all(rows.map((r) => withCount(db, r)));
  return { data, total: Number(totalRow?.n ?? 0) };
}

export async function findJobById(db: Db, id: string) {
  const [row] = await db.select().from(schema.jobs).where(eq(schema.jobs.id, id)).limit(1);
  if (!row) return null;
  return withCount(db, row);
}

export async function createJob(
  db: Db,
  data: {
    title: string;
    slug?: string;
    type: string;
    location: string;
    department: string;
    description: string;
    active?: boolean;
  },
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.jobs).values({
    id,
    title: data.title,
    slug: data.slug ?? null,
    type: data.type,
    location: data.location,
    department: data.department,
    description: data.description,
    active: data.active ?? true,
    createdAt: now,
    updatedAt: now,
  });
  return findJobById(db, id);
}

export async function updateJob(
  db: Db,
  id: string,
  data: Partial<{
    title: string;
    slug: string;
    type: string;
    location: string;
    department: string;
    description: string;
    active: boolean;
  }>,
) {
  await db
    .update(schema.jobs)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.jobs.id, id));
  return findJobById(db, id);
}

export async function deleteJob(db: Db, id: string) {
  await db.delete(schema.jobs).where(eq(schema.jobs.id, id));
}

export async function findJobTitles(db: Db) {
  return db
    .select({ id: schema.jobs.id, title: schema.jobs.title, department: schema.jobs.department })
    .from(schema.jobs)
    .where(eq(schema.jobs.active, true))
    .orderBy(asc(schema.jobs.title));
}

export async function findAllForExport(db: Db, search?: string) {
  const where = buildWhere({ search });
  const rows = await db.select().from(schema.jobs).where(where).orderBy(desc(schema.jobs.createdAt));
  return Promise.all(rows.map((r) => withCount(db, r)));
}
