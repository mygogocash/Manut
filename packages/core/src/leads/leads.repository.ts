import {
  and,
  asc,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNotNull,
  isNull,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { Db, DbTransaction } from "@nexora/db";

import { schema } from "@nexora/db";
import { BUSINESS_UNIT_UNASSIGNED } from "@nexora/contracts/modules/business-units/business-units.validation";
import { createCuid } from "../lib/id";
import type { OwnerScopedFilter } from "../crm-shared/bulk-selection";

type DbLike = Db | DbTransaction;

export interface ListLeadsFilters extends OwnerScopedFilter {
  search?: string;
  status?: string;
  source?: string;
  ownerId?: string;
  archived?: boolean;
  businessUnit?: string;
}

export interface ListStaleLeadsFilters {
  search?: string;
  ownerId?: string;
  ownerScope?: string[];
  cutoff: string;
}

export function buildLeadWhere(filters: ListLeadsFilters): SQL | undefined {
  const parts: SQL[] = [];

  if (filters.ids !== undefined) {
    if (filters.ids.length === 0) parts.push(sql`false`);
    else parts.push(inArray(schema.crmLeads.id, filters.ids));
  }

  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    parts.push(
      or(
        ilike(schema.crmLeads.company, term),
        ilike(schema.crmLeads.firstName, term),
        ilike(schema.crmLeads.lastName, term),
        ilike(schema.crmLeads.email, term),
      )!,
    );
  }
  if (filters.status) parts.push(eq(schema.crmLeads.status, filters.status));
  if (filters.source) parts.push(eq(schema.crmLeads.source, filters.source));
  if (filters.ownerId) parts.push(eq(schema.crmLeads.ownerId, filters.ownerId));
  if (filters.ownerScope?.length) {
    parts.push(inArray(schema.crmLeads.ownerId, filters.ownerScope));
  }
  if (filters.businessUnit === BUSINESS_UNIT_UNASSIGNED) {
    parts.push(sql`cardinality(${schema.crmLeads.businessUnits}) = 0`);
  } else if (filters.businessUnit) {
    parts.push(sql`${filters.businessUnit} = ANY(${schema.crmLeads.businessUnits})`);
  }

  parts.push(filters.archived ? isNotNull(schema.crmLeads.archivedAt) : isNull(schema.crmLeads.archivedAt));

  return parts.length ? and(...parts) : undefined;
}

async function withRelations(db: DbLike, row: typeof schema.crmLeads.$inferSelect) {
  const [owner] = await db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, row.ownerId))
    .limit(1);

  let convertedOpportunity: { id: string; name: string; stage: string } | null = null;
  if (row.convertedOpportunityId) {
    const [opp] = await db
      .select({
        id: schema.crmOpportunities.id,
        name: schema.crmOpportunities.name,
        stage: schema.crmOpportunities.stage,
      })
      .from(schema.crmOpportunities)
      .where(eq(schema.crmOpportunities.id, row.convertedOpportunityId))
      .limit(1);
    convertedOpportunity = opp ?? null;
  }

  return { ...row, owner: owner ?? null, convertedOpportunity };
}

export async function findIdsForFieldSet(db: Db, filters: ListLeadsFilters, take: number) {
  const where = buildLeadWhere(filters);
  return db
    .select({
      id: schema.crmLeads.id,
      ownerId: schema.crmLeads.ownerId,
      archivedAt: schema.crmLeads.archivedAt,
      status: schema.crmLeads.status,
    })
    .from(schema.crmLeads)
    .where(where)
    .limit(take);
}

export async function findIdsAndUnits(db: Db, filters: ListLeadsFilters, take: number) {
  const where = buildLeadWhere(filters);
  return db
    .select({ id: schema.crmLeads.id, businessUnits: schema.crmLeads.businessUnits })
    .from(schema.crmLeads)
    .where(where)
    .limit(take);
}

export async function findMany(db: Db, filters: ListLeadsFilters, page: number, limit: number) {
  const where = buildLeadWhere(filters);
  const offset = (page - 1) * limit;

  const [totalRow] = await db.select({ n: count() }).from(schema.crmLeads).where(where);
  const rows = await db
    .select()
    .from(schema.crmLeads)
    .where(where)
    .orderBy(desc(schema.crmLeads.createdAt))
    .limit(limit)
    .offset(offset);

  const data = await Promise.all(rows.map((row) => withRelations(db, row)));
  return { data, total: Number(totalRow?.n ?? 0) };
}

export async function findStale(
  db: Db,
  filters: ListStaleLeadsFilters,
  page: number,
  limit: number,
) {
  const parts: SQL[] = [
    inArray(schema.crmLeads.status, ["new", "contacted"]),
    sql`${schema.crmLeads.createdAt} < ${filters.cutoff}`,
    isNull(schema.crmLeads.archivedAt),
    sql`NOT EXISTS (
      SELECT 1 FROM ${schema.crmActivities}
      WHERE ${schema.crmActivities.leadId} = ${schema.crmLeads.id}
        AND ${schema.crmActivities.occurredAt} >= ${filters.cutoff}
    )`,
  ];

  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    parts.push(
      or(
        ilike(schema.crmLeads.company, term),
        ilike(schema.crmLeads.firstName, term),
        ilike(schema.crmLeads.lastName, term),
        ilike(schema.crmLeads.email, term),
      )!,
    );
  }
  if (filters.ownerId) parts.push(eq(schema.crmLeads.ownerId, filters.ownerId));
  if (filters.ownerScope?.length) {
    parts.push(inArray(schema.crmLeads.ownerId, filters.ownerScope));
  }

  const where = and(...parts);
  const offset = (page - 1) * limit;

  const [totalRow] = await db.select({ n: count() }).from(schema.crmLeads).where(where);
  const rows = await db
    .select()
    .from(schema.crmLeads)
    .where(where)
    .orderBy(asc(schema.crmLeads.createdAt))
    .limit(limit)
    .offset(offset);

  const data = await Promise.all(rows.map((row) => withRelations(db, row)));
  return { data, total: Number(totalRow?.n ?? 0) };
}

export async function findById(db: DbLike, id: string) {
  const [row] = await db.select().from(schema.crmLeads).where(eq(schema.crmLeads.id, id)).limit(1);
  if (!row) return null;
  return withRelations(db, row);
}

export async function create(
  db: DbLike,
  data: Omit<typeof schema.crmLeads.$inferInsert, "id" | "createdAt" | "updatedAt">,
) {
  const id = createCuid();
  const now = new Date().toISOString();
  await db.insert(schema.crmLeads).values({ id, ...data, createdAt: now, updatedAt: now });
  return findById(db, id);
}

export async function update(
  db: DbLike,
  id: string,
  data: Partial<typeof schema.crmLeads.$inferInsert>,
) {
  const now = new Date().toISOString();
  await db.update(schema.crmLeads).set({ ...data, updatedAt: now }).where(eq(schema.crmLeads.id, id));
  return findById(db, id);
}

export async function remove(db: Db, id: string) {
  await db.delete(schema.crmLeads).where(eq(schema.crmLeads.id, id));
}
