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

export interface ListAccountsFilters extends OwnerScopedFilter {
  search?: string;
  industry?: string;
  country?: string;
  region?: string;
  ownerId?: string;
  partnerId?: string;
  stage?: string;
  archived?: boolean;
  businessUnit?: string;
}

export function buildAccountWhere(filters: ListAccountsFilters): SQL | undefined {
  const parts: SQL[] = [];

  if (filters.ids !== undefined) {
    if (filters.ids.length === 0) parts.push(sql`false`);
    else parts.push(inArray(schema.crmAccounts.id, filters.ids));
  }

  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    parts.push(
      or(
        ilike(schema.crmAccounts.name, term),
        ilike(schema.crmAccounts.domain, term),
      )!,
    );
  }
  if (filters.industry) parts.push(eq(schema.crmAccounts.industry, filters.industry));
  if (filters.country) parts.push(eq(schema.crmAccounts.country, filters.country));
  if (filters.region) parts.push(eq(schema.crmAccounts.region, filters.region));
  if (filters.ownerId) parts.push(eq(schema.crmAccounts.ownerId, filters.ownerId));
  if (filters.partnerId) parts.push(eq(schema.crmAccounts.partnerId, filters.partnerId));
  if (filters.ownerScope?.length) {
    parts.push(inArray(schema.crmAccounts.ownerId, filters.ownerScope));
  }
  if (filters.stage) {
    parts.push(
      sql`EXISTS (
        SELECT 1 FROM ${schema.crmOpportunities}
        WHERE ${schema.crmOpportunities.accountId} = ${schema.crmAccounts.id}
          AND ${schema.crmOpportunities.stage} = ${filters.stage}
        LIMIT 1
      )`,
    );
  }
  if (filters.businessUnit === BUSINESS_UNIT_UNASSIGNED) {
    parts.push(sql`cardinality(${schema.crmAccounts.businessUnits}) = 0`);
  } else if (filters.businessUnit) {
    parts.push(sql`${filters.businessUnit} = ANY(${schema.crmAccounts.businessUnits})`);
  }

  parts.push(filters.archived ? isNotNull(schema.crmAccounts.archivedAt) : isNull(schema.crmAccounts.archivedAt));

  return parts.length ? and(...parts) : undefined;
}

async function withRelations(db: DbLike, row: typeof schema.crmAccounts.$inferSelect) {
  const [owner] = await db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, row.ownerId))
    .limit(1);

  let partner: { id: string; company: string | null } | null = null;
  if (row.partnerId) {
    const [p] = await db
      .select({ id: schema.partners.id, company: schema.partners.company })
      .from(schema.partners)
      .where(eq(schema.partners.id, row.partnerId))
      .limit(1);
    partner = p ?? null;
  }

  const [contactCount] = await db
    .select({ n: count() })
    .from(schema.crmContacts)
    .where(eq(schema.crmContacts.accountId, row.id));

  const [oppCount] = await db
    .select({ n: count() })
    .from(schema.crmOpportunities)
    .where(eq(schema.crmOpportunities.accountId, row.id));

  const opportunities = await db
    .select({
      id: schema.crmOpportunities.id,
      stage: schema.crmOpportunities.stage,
      probability: schema.crmOpportunities.probability,
      value: schema.crmOpportunities.value,
      currency: schema.crmOpportunities.currency,
      launchDate: schema.crmOpportunities.launchDate,
      revenueLaunchDate: schema.crmOpportunities.revenueLaunchDate,
    })
    .from(schema.crmOpportunities)
    .where(eq(schema.crmOpportunities.accountId, row.id))
    .orderBy(desc(schema.crmOpportunities.updatedAt))
    .limit(1);

  return {
    ...row,
    owner: owner ?? null,
    partner,
    _count: {
      contacts: Number(contactCount?.n ?? 0),
      opportunities: Number(oppCount?.n ?? 0),
    },
    opportunities,
  };
}

export async function findMany(
  db: Db,
  filters: ListAccountsFilters,
  page: number,
  limit: number,
) {
  const where = buildAccountWhere(filters);
  const offset = (page - 1) * limit;

  const [totalRow] = await db.select({ n: count() }).from(schema.crmAccounts).where(where);
  const rows = await db
    .select()
    .from(schema.crmAccounts)
    .where(where)
    .orderBy(asc(schema.crmAccounts.sortOrder), desc(schema.crmAccounts.createdAt))
    .limit(limit)
    .offset(offset);

  const data = await Promise.all(rows.map((row) => withRelations(db, row)));
  return { data, total: Number(totalRow?.n ?? 0) };
}

export async function findById(db: DbLike, id: string) {
  const [row] = await db.select().from(schema.crmAccounts).where(eq(schema.crmAccounts.id, id)).limit(1);
  if (!row) return null;
  return withRelations(db, row);
}

export async function findByDomain(db: DbLike, domain: string) {
  const [row] = await db
    .select({ id: schema.crmAccounts.id, name: schema.crmAccounts.name, domain: schema.crmAccounts.domain })
    .from(schema.crmAccounts)
    .where(eq(schema.crmAccounts.domain, domain))
    .limit(1);
  return row ?? null;
}

export async function findByNameInsensitive(db: DbLike, name: string) {
  const [row] = await db
    .select({ id: schema.crmAccounts.id, name: schema.crmAccounts.name, domain: schema.crmAccounts.domain })
    .from(schema.crmAccounts)
    .where(sql`lower(${schema.crmAccounts.name}) = lower(${name})`)
    .limit(1);
  return row ?? null;
}

export async function create(
  db: DbLike,
  data: {
    name: string;
    domain?: string | null;
    industry?: string | null;
    size?: string | null;
    country?: string | null;
    region?: string | null;
    website?: string | null;
    notes?: string | null;
    totalUsers?: number | null;
    appUsers?: number | null;
    picName?: string | null;
    designation?: string | null;
    department?: string | null;
    lastFollowUpDate?: string | null;
    agreementSignedDate?: string | null;
    engagementType?: string | null;
    uatStartDate?: string | null;
    uatEndDate?: string | null;
    blocker?: string | null;
    remarks?: string | null;
    ownerId: string;
    partnerId?: string | null;
    businessUnits?: string[];
  },
) {
  const id = createCuid();
  const now = new Date().toISOString();
  await db.insert(schema.crmAccounts).values({
    id,
    name: data.name,
    domain: data.domain ?? null,
    industry: data.industry ?? null,
    size: data.size ?? null,
    country: data.country ?? null,
    region: data.region ?? null,
    website: data.website ?? null,
    notes: data.notes ?? null,
    totalUsers: data.totalUsers ?? null,
    appUsers: data.appUsers ?? null,
    picName: data.picName ?? null,
    designation: data.designation ?? null,
    department: data.department ?? null,
    lastFollowUpDate: data.lastFollowUpDate ?? null,
    agreementSignedDate: data.agreementSignedDate ?? null,
    engagementType: data.engagementType ?? null,
    uatStartDate: data.uatStartDate ?? null,
    uatEndDate: data.uatEndDate ?? null,
    blocker: data.blocker ?? null,
    remarks: data.remarks ?? null,
    ownerId: data.ownerId,
    partnerId: data.partnerId ?? null,
    businessUnits: data.businessUnits ?? ["RAY"],
    updatedAt: now,
  });
  return findById(db, id);
}

export async function update(
  db: Db,
  id: string,
  data: Partial<{
    name: string;
    domain: string | null;
    industry: string | null;
    size: string | null;
    country: string | null;
    region: string | null;
    website: string | null;
    notes: string | null;
    totalUsers: number | null;
    appUsers: number | null;
    picName: string | null;
    designation: string | null;
    department: string | null;
    lastFollowUpDate: string | null;
    agreementSignedDate: string | null;
    engagementType: string | null;
    uatStartDate: string | null;
    uatEndDate: string | null;
    blocker: string | null;
    remarks: string | null;
    ownerId: string;
    partnerId: string | null;
    businessUnits: string[];
    archivedAt: string | null;
  }>,
) {
  const now = new Date().toISOString();
  await db.update(schema.crmAccounts).set({ ...data, updatedAt: now }).where(eq(schema.crmAccounts.id, id));
  return findById(db, id);
}

export async function remove(db: Db, id: string) {
  await db.delete(schema.crmAccounts).where(eq(schema.crmAccounts.id, id));
}

export async function reorder(db: Db, orderedIds: string[]) {
  const now = new Date().toISOString();
  for (let index = 0; index < orderedIds.length; index++) {
    await db
      .update(schema.crmAccounts)
      .set({ sortOrder: index, updatedAt: now })
      .where(eq(schema.crmAccounts.id, orderedIds[index]!));
  }
}

export async function findIdsByOwner(db: Db, ids: string[], ownerId: string) {
  if (ids.length === 0) return [];
  return db
    .select({ id: schema.crmAccounts.id })
    .from(schema.crmAccounts)
    .where(and(inArray(schema.crmAccounts.id, ids), eq(schema.crmAccounts.ownerId, ownerId)));
}

export async function findIdsAndUnits(db: Db, filters: ListAccountsFilters, take: number) {
  const where = buildAccountWhere(filters);
  return db
    .select({ id: schema.crmAccounts.id, businessUnits: schema.crmAccounts.businessUnits })
    .from(schema.crmAccounts)
    .where(where)
    .limit(take);
}

export async function findIdsForFieldSet(db: Db, filters: ListAccountsFilters, take: number) {
  const where = buildAccountWhere(filters);
  return db
    .select({
      id: schema.crmAccounts.id,
      ownerId: schema.crmAccounts.ownerId,
      archivedAt: schema.crmAccounts.archivedAt,
    })
    .from(schema.crmAccounts)
    .where(where)
    .limit(take);
}
