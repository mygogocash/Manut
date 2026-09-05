import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  inArray,
  isNull,
  lte,
  type SQL,
} from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";
import { createCuid } from "../lib/id";

export interface ListCrmTasksFilters {
  status?: string;
  ownerId?: string;
  leadId?: string;
  opportunityId?: string;
  ownerScope?: string[];
  dueDateGte?: string;
  dueDateLte?: string;
}

function buildWhere(filters: ListCrmTasksFilters): SQL | undefined {
  const parts: SQL[] = [];
  if (filters.status) parts.push(eq(schema.crmTasks.status, filters.status));
  if (filters.ownerId) parts.push(eq(schema.crmTasks.ownerId, filters.ownerId));
  if (filters.ownerScope?.length) parts.push(inArray(schema.crmTasks.ownerId, filters.ownerScope));
  if (filters.leadId) parts.push(eq(schema.crmTasks.leadId, filters.leadId));
  if (filters.opportunityId) parts.push(eq(schema.crmTasks.opportunityId, filters.opportunityId));
  if (filters.dueDateGte) parts.push(gte(schema.crmTasks.dueDate, filters.dueDateGte));
  if (filters.dueDateLte) parts.push(lte(schema.crmTasks.dueDate, filters.dueDateLte));
  return parts.length ? and(...parts) : undefined;
}

async function withRelations(db: Db, row: typeof schema.crmTasks.$inferSelect) {
  const [owner] = await db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, row.ownerId))
    .limit(1);

  let lead: { id: string; company: string } | null = null;
  if (row.leadId) {
    const [l] = await db
      .select({ id: schema.crmLeads.id, company: schema.crmLeads.company })
      .from(schema.crmLeads)
      .where(eq(schema.crmLeads.id, row.leadId))
      .limit(1);
    lead = l ?? null;
  }

  let opportunity: { id: string; name: string } | null = null;
  if (row.opportunityId) {
    const [o] = await db
      .select({ id: schema.crmOpportunities.id, name: schema.crmOpportunities.name })
      .from(schema.crmOpportunities)
      .where(eq(schema.crmOpportunities.id, row.opportunityId))
      .limit(1);
    opportunity = o ?? null;
  }

  return { ...row, owner: owner ?? null, lead, opportunity };
}

export async function findMany(db: Db, filters: ListCrmTasksFilters, page: number, limit: number) {
  const where = buildWhere(filters);
  const offset = (page - 1) * limit;

  const [totalRow] = await db.select({ n: count() }).from(schema.crmTasks).where(where);
  const rows = await db
    .select()
    .from(schema.crmTasks)
    .where(where)
    .orderBy(asc(schema.crmTasks.dueDate), desc(schema.crmTasks.createdAt))
    .limit(limit)
    .offset(offset);

  const data = await Promise.all(rows.map((row) => withRelations(db, row)));
  return { data, total: Number(totalRow?.n ?? 0) };
}

export async function findById(db: Db, id: string) {
  const [row] = await db.select().from(schema.crmTasks).where(eq(schema.crmTasks.id, id)).limit(1);
  if (!row) return null;
  return withRelations(db, row);
}

export async function create(
  db: Db,
  data: Omit<typeof schema.crmTasks.$inferInsert, "id" | "createdAt" | "updatedAt">,
) {
  const id = createCuid();
  const now = new Date().toISOString();
  await db.insert(schema.crmTasks).values({ id, ...data, createdAt: now, updatedAt: now });
  return findById(db, id);
}

export async function update(
  db: Db,
  id: string,
  data: Partial<typeof schema.crmTasks.$inferInsert>,
) {
  const now = new Date().toISOString();
  await db.update(schema.crmTasks).set({ ...data, updatedAt: now }).where(eq(schema.crmTasks.id, id));
  return findById(db, id);
}

export async function remove(db: Db, id: string) {
  await db.delete(schema.crmTasks).where(eq(schema.crmTasks.id, id));
}

export async function findAssignableUser(db: Db, userId: string) {
  const [user] = await db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
    .from(schema.users)
    .where(
      and(
        eq(schema.users.id, userId),
        eq(schema.users.isActive, true),
        isNull(schema.users.deletedAt),
      ),
    )
    .limit(1);
  return user ?? null;
}
