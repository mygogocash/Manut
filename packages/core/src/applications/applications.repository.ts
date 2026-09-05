import { and, count, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";

async function withJob(db: Db, row: typeof schema.applications.$inferSelect) {
  const [job] = await db
    .select({
      id: schema.jobs.id,
      title: schema.jobs.title,
      department: schema.jobs.department,
      location: schema.jobs.location,
    })
    .from(schema.jobs)
    .where(eq(schema.jobs.id, row.jobId))
    .limit(1);
  return {
    ...row,
    job: job ?? { id: row.jobId, title: "", department: "", location: "" },
  };
}

function buildWhere(filters: { jobId?: string; search?: string }): SQL | undefined {
  const parts: SQL[] = [];
  if (filters.jobId) parts.push(eq(schema.applications.jobId, filters.jobId));
  if (filters.search) {
    const q = `%${filters.search}%`;
    parts.push(
      or(
        ilike(schema.applications.name, q),
        ilike(schema.applications.email, q),
        ilike(schema.jobs.title, q),
      )!,
    );
  }
  return parts.length ? and(...parts) : undefined;
}

export async function findApplications(
  db: Db,
  filters: { jobId?: string; search?: string },
  page: number,
  limit: number,
) {
  const offset = (page - 1) * limit;
  const where = buildWhere(filters);
  const base = db
    .select({ app: schema.applications })
    .from(schema.applications)
    .leftJoin(schema.jobs, eq(schema.jobs.id, schema.applications.jobId))
    .where(where)
    .orderBy(desc(schema.applications.createdAt));

  const rows = await base.limit(limit).offset(offset);
  const [totalRow] = await db
    .select({ n: count() })
    .from(schema.applications)
    .leftJoin(schema.jobs, eq(schema.jobs.id, schema.applications.jobId))
    .where(where);

  const data = await Promise.all(rows.map((r) => withJob(db, r.app)));
  return { data, total: Number(totalRow?.n ?? 0) };
}

export async function findApplicationById(db: Db, id: string) {
  const [row] = await db.select().from(schema.applications).where(eq(schema.applications.id, id)).limit(1);
  if (!row) return null;
  return withJob(db, row);
}

export async function deleteApplication(db: Db, id: string) {
  await db.delete(schema.applications).where(eq(schema.applications.id, id));
}

export async function findAllForExport(db: Db, filters: { jobId?: string; search?: string }) {
  const where = buildWhere(filters);
  const rows = await db
    .select({ app: schema.applications })
    .from(schema.applications)
    .leftJoin(schema.jobs, eq(schema.jobs.id, schema.applications.jobId))
    .where(where)
    .orderBy(desc(schema.applications.createdAt));
  return Promise.all(rows.map((r) => withJob(db, r.app)));
}
