import { and, count, desc, eq, ilike, type SQL } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";
import { createCuid } from "../lib/id";

export async function findModules(
  db: Db,
  filters: { category?: string; isMandatory?: boolean; search?: string },
  page: number,
  limit: number,
) {
  const offset = (page - 1) * limit;
  const parts: SQL[] = [eq(schema.trainingModules.isActive, true)];
  if (filters.category) parts.push(eq(schema.trainingModules.category, filters.category));
  if (filters.isMandatory !== undefined) parts.push(eq(schema.trainingModules.isMandatory, filters.isMandatory));
  if (filters.search) parts.push(ilike(schema.trainingModules.title, `%${filters.search}%`));
  const where = and(...parts);

  const [totalRow] = await db.select({ n: count() }).from(schema.trainingModules).where(where);
  const rows = await db
    .select()
    .from(schema.trainingModules)
    .where(where)
    .orderBy(desc(schema.trainingModules.createdAt))
    .limit(limit)
    .offset(offset);

  const data = await Promise.all(
    rows.map(async (row) => {
      const [c] = await db
        .select({ n: count() })
        .from(schema.trainingCompletions)
        .where(eq(schema.trainingCompletions.moduleId, row.id));
      return { ...row, _count: { completions: Number(c?.n ?? 0) } };
    }),
  );
  return { data, total: Number(totalRow?.n ?? 0) };
}

export async function findModuleById(db: Db, id: string) {
  const [row] = await db.select().from(schema.trainingModules).where(eq(schema.trainingModules.id, id)).limit(1);
  return row ?? null;
}

export async function createModule(
  db: Db,
  data: {
    title: string;
    description?: string;
    category: string;
    duration?: number;
    url?: string;
    fileUrl?: string;
    fileName?: string;
    isMandatory?: boolean;
    isActive?: boolean;
  },
) {
  const id = createCuid();
  const now = new Date().toISOString();
  await db.insert(schema.trainingModules).values({
    id,
    title: data.title,
    description: data.description ?? null,
    category: data.category,
    duration: data.duration ?? null,
    url: data.url ?? null,
    fileUrl: data.fileUrl ?? null,
    fileName: data.fileName ?? null,
    isMandatory: data.isMandatory ?? false,
    isActive: data.isActive ?? true,
    createdAt: now,
  });
  return findModuleById(db, id);
}

export async function updateModule(
  db: Db,
  id: string,
  data: Partial<{
    title: string;
    description: string | null;
    category: string;
    duration: number | null;
    url: string | null;
    fileUrl: string | null;
    fileName: string | null;
    isMandatory: boolean;
    isActive: boolean;
  }>,
) {
  await db.update(schema.trainingModules).set(data).where(eq(schema.trainingModules.id, id));
  return findModuleById(db, id);
}

export async function findCompletions(
  db: Db,
  filters: { employeeId?: string; moduleId?: string },
  page: number,
  limit: number,
) {
  const offset = (page - 1) * limit;
  const parts: SQL[] = [];
  if (filters.employeeId) parts.push(eq(schema.trainingCompletions.employeeId, filters.employeeId));
  if (filters.moduleId) parts.push(eq(schema.trainingCompletions.moduleId, filters.moduleId));
  const where = parts.length ? and(...parts) : undefined;

  const [totalRow] = await db.select({ n: count() }).from(schema.trainingCompletions).where(where);
  const rows = await db
    .select({
      employeeId: schema.trainingCompletions.employeeId,
      moduleId: schema.trainingCompletions.moduleId,
      completedAt: schema.trainingCompletions.completedAt,
      score: schema.trainingCompletions.score,
      employeeName: schema.users.name,
      employeeEmail: schema.users.email,
      employeeDepartment: schema.users.department,
      moduleTitle: schema.trainingModules.title,
      moduleCategory: schema.trainingModules.category,
    })
    .from(schema.trainingCompletions)
    .innerJoin(schema.users, eq(schema.users.id, schema.trainingCompletions.employeeId))
    .innerJoin(schema.trainingModules, eq(schema.trainingModules.id, schema.trainingCompletions.moduleId))
    .where(where)
    .orderBy(desc(schema.trainingCompletions.completedAt))
    .limit(limit)
    .offset(offset);

  return {
    data: rows.map((r) => ({
      employeeId: r.employeeId,
      moduleId: r.moduleId,
      completedAt: r.completedAt,
      score: r.score,
      employee: {
        id: r.employeeId,
        name: r.employeeName,
        email: r.employeeEmail,
        department: r.employeeDepartment,
      },
      module: { id: r.moduleId, title: r.moduleTitle, category: r.moduleCategory },
    })),
    total: Number(totalRow?.n ?? 0),
  };
}

export async function findCompletion(db: Db, employeeId: string, moduleId: string) {
  const [row] = await db
    .select()
    .from(schema.trainingCompletions)
    .where(
      and(
        eq(schema.trainingCompletions.employeeId, employeeId),
        eq(schema.trainingCompletions.moduleId, moduleId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function createCompletion(
  db: Db,
  data: { employeeId: string; moduleId: string; score?: number },
) {
  const now = new Date().toISOString();
  await db.insert(schema.trainingCompletions).values({
    employeeId: data.employeeId,
    moduleId: data.moduleId,
    score: data.score ?? null,
    completedAt: now,
  });
  const [row] = await db
    .select({
      employeeId: schema.trainingCompletions.employeeId,
      moduleId: schema.trainingCompletions.moduleId,
      completedAt: schema.trainingCompletions.completedAt,
      score: schema.trainingCompletions.score,
      employeeName: schema.users.name,
      employeeEmail: schema.users.email,
      moduleTitle: schema.trainingModules.title,
      moduleCategory: schema.trainingModules.category,
    })
    .from(schema.trainingCompletions)
    .innerJoin(schema.users, eq(schema.users.id, schema.trainingCompletions.employeeId))
    .innerJoin(schema.trainingModules, eq(schema.trainingModules.id, schema.trainingCompletions.moduleId))
    .where(
      and(
        eq(schema.trainingCompletions.employeeId, data.employeeId),
        eq(schema.trainingCompletions.moduleId, data.moduleId),
      ),
    )
    .limit(1);
  if (!row) return null;
  return {
    employeeId: row.employeeId,
    moduleId: row.moduleId,
    completedAt: row.completedAt,
    score: row.score,
    employee: { id: row.employeeId, name: row.employeeName, email: row.employeeEmail },
    module: { id: row.moduleId, title: row.moduleTitle, category: row.moduleCategory },
  };
}
