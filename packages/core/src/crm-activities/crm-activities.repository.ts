import {
  and,
  count,
  desc,
  eq,
  inArray,
  sql,
  type SQL,
} from "drizzle-orm";
import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";
import { createCuid } from "../lib/id";

export interface ListCrmActivitiesFilters {
  type?: string;
  leadId?: string;
  opportunityId?: string;
  contactId?: string;
  accountId?: string;
  ownerId?: string;
  ownerScope?: string[];
}

function buildWhere(filters: ListCrmActivitiesFilters): SQL | undefined {
  const parts: SQL[] = [];
  if (filters.type) parts.push(eq(schema.crmActivities.type, filters.type));
  if (filters.leadId) parts.push(eq(schema.crmActivities.leadId, filters.leadId));
  if (filters.opportunityId) parts.push(eq(schema.crmActivities.opportunityId, filters.opportunityId));
  if (filters.contactId) parts.push(eq(schema.crmActivities.contactId, filters.contactId));
  if (filters.accountId) parts.push(eq(schema.crmActivities.accountId, filters.accountId));
  if (filters.ownerId) parts.push(eq(schema.crmActivities.ownerId, filters.ownerId));
  if (filters.ownerScope?.length) parts.push(inArray(schema.crmActivities.ownerId, filters.ownerScope));
  return parts.length ? and(...parts) : undefined;
}

async function withRelations(db: Db, row: typeof schema.crmActivities.$inferSelect) {
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

  let contact: { id: string; firstName: string; lastName: string } | null = null;
  if (row.contactId) {
    const [c] = await db
      .select({
        id: schema.crmContacts.id,
        firstName: schema.crmContacts.firstName,
        lastName: schema.crmContacts.lastName,
      })
      .from(schema.crmContacts)
      .where(eq(schema.crmContacts.id, row.contactId))
      .limit(1);
    contact = c ?? null;
  }

  let account: { id: string; name: string } | null = null;
  if (row.accountId) {
    const [a] = await db
      .select({ id: schema.crmAccounts.id, name: schema.crmAccounts.name })
      .from(schema.crmAccounts)
      .where(eq(schema.crmAccounts.id, row.accountId))
      .limit(1);
    account = a ?? null;
  }

  return { ...row, owner: owner ?? null, lead, opportunity, contact, account };
}

export async function findMany(db: Db, filters: ListCrmActivitiesFilters, page: number, limit: number) {
  const where = buildWhere(filters);
  const offset = (page - 1) * limit;

  const [totalRow] = await db.select({ n: count() }).from(schema.crmActivities).where(where);
  const rows = await db
    .select()
    .from(schema.crmActivities)
    .where(where)
    .orderBy(desc(schema.crmActivities.occurredAt))
    .limit(limit)
    .offset(offset);

  const data = await Promise.all(rows.map((row) => withRelations(db, row)));
  return { data, total: Number(totalRow?.n ?? 0) };
}

export async function findById(db: Db, id: string) {
  const [row] = await db.select().from(schema.crmActivities).where(eq(schema.crmActivities.id, id)).limit(1);
  if (!row) return null;
  return withRelations(db, row);
}

export async function create(
  db: Db,
  data: Omit<typeof schema.crmActivities.$inferInsert, "id" | "createdAt">,
) {
  const id = createCuid();
  await db.insert(schema.crmActivities).values({ id, ...data });
  return findById(db, id);
}

export async function update(
  db: Db,
  id: string,
  data: Partial<typeof schema.crmActivities.$inferInsert>,
) {
  await db.update(schema.crmActivities).set(data).where(eq(schema.crmActivities.id, id));
  return findById(db, id);
}

export async function remove(db: Db, id: string) {
  await db.delete(schema.crmActivities).where(eq(schema.crmActivities.id, id));
}
