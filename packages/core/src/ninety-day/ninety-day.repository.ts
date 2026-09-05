import { and, asc, count, eq, ilike, inArray } from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";

const employeeCols = {
  id: schema.users.id,
  name: schema.users.name,
  email: schema.users.email,
  department: schema.users.department,
};
const entityCols = { id: schema.entities.id, name: schema.entities.name, code: schema.entities.code };

async function withRelations(db: Db, row: typeof schema.ninetyDayNotifications.$inferSelect) {
  const [employee] = await db
    .select(employeeCols)
    .from(schema.users)
    .where(eq(schema.users.id, row.employeeId))
    .limit(1);
  let entity: { id: string; name: string; code: string } | null = null;
  if (row.entityId) {
    const [e] = await db.select(entityCols).from(schema.entities).where(eq(schema.entities.id, row.entityId)).limit(1);
    entity = e ?? null;
  }
  return { ...row, employee: employee!, entity };
}

export async function findMany(
  db: Db,
  filters: { employeeId?: string; status?: string; search?: string; entityId?: string },
  page: number,
  limit: number,
) {
  const parts = [];
  if (filters.employeeId) parts.push(eq(schema.ninetyDayNotifications.employeeId, filters.employeeId));
  if (filters.status) parts.push(eq(schema.ninetyDayNotifications.status, filters.status));
  if (filters.entityId) parts.push(eq(schema.ninetyDayNotifications.entityId, filters.entityId));
  if (filters.search?.trim()) {
    parts.push(ilike(schema.users.name, `%${filters.search.trim()}%`));
  }
  const where = parts.length ? and(...parts) : undefined;
  const offset = (page - 1) * limit;

  const base = db
    .select({ row: schema.ninetyDayNotifications })
    .from(schema.ninetyDayNotifications)
    .innerJoin(schema.users, eq(schema.ninetyDayNotifications.employeeId, schema.users.id));

  const [totalRow] = await db
    .select({ n: count() })
    .from(schema.ninetyDayNotifications)
    .innerJoin(schema.users, eq(schema.ninetyDayNotifications.employeeId, schema.users.id))
    .where(where);

  const rows = await base.where(where).orderBy(asc(schema.ninetyDayNotifications.dueDate)).limit(limit).offset(offset);
  const data = await Promise.all(rows.map((r) => withRelations(db, r.row)));
  return { data, total: Number(totalRow?.n ?? 0) };
}

export async function findById(db: Db, id: string) {
  const [row] = await db.select().from(schema.ninetyDayNotifications).where(eq(schema.ninetyDayNotifications.id, id)).limit(1);
  return row ? withRelations(db, row) : null;
}

export async function create(
  db: Db,
  data: Omit<typeof schema.ninetyDayNotifications.$inferInsert, "id" | "createdAt" | "updatedAt">,
) {
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  await db.insert(schema.ninetyDayNotifications).values({ id, ...data, createdAt: now, updatedAt: now });
  return findById(db, id);
}

export async function update(db: Db, id: string, data: Partial<typeof schema.ninetyDayNotifications.$inferInsert>) {
  await db
    .update(schema.ninetyDayNotifications)
    .set({ ...data, updatedAt: new Date().toISOString() })
    .where(eq(schema.ninetyDayNotifications.id, id));
  return findById(db, id);
}

export async function remove(db: Db, id: string) {
  await db.delete(schema.ninetyDayNotifications).where(eq(schema.ninetyDayNotifications.id, id));
}

export async function findUsersByIds(db: Db, ids: string[]) {
  if (!ids.length) return [];
  return db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, employeeId: schema.users.employeeId })
    .from(schema.users)
    .where(inArray(schema.users.id, ids));
}

export async function findUsersByEmails(db: Db, emails: string[]) {
  if (!emails.length) return [];
  return db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, employeeId: schema.users.employeeId })
    .from(schema.users)
    .where(inArray(schema.users.email, emails));
}

export async function findUsersByEmployeeCodes(db: Db, codes: string[]) {
  if (!codes.length) return [];
  return db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, employeeId: schema.users.employeeId })
    .from(schema.users)
    .where(inArray(schema.users.employeeId, codes));
}

export async function findActiveUsersForBulkMatch(db: Db) {
  return db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email, employeeId: schema.users.employeeId })
    .from(schema.users)
    .where(eq(schema.users.isActive, true));
}
