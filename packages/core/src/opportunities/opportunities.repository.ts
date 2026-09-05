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
  notInArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { Db, DbTransaction } from "@nexora/db";
import { schema } from "@nexora/db";
import { BUSINESS_UNIT_UNASSIGNED } from "@nexora/contracts/modules/business-units/business-units.validation";
import { dealUnitStages, type DealUnitStage } from "../crm-shared/deal-unit-stages";
import { BadRequestException, NotFoundException } from "../http-exception";
import { createCuid } from "../lib/id";
import type { OwnerScopedFilter } from "../crm-shared/bulk-selection";

type DbLike = Db | DbTransaction;

export interface ListOpportunitiesFilters extends OwnerScopedFilter {
  search?: string;
  stage?: string;
  accountId?: string;
  ownerId?: string;
  country?: string;
  region?: string;
  archived?: boolean;
  businessUnit?: string;
}

export type PipelineSummaryFilters = Pick<
  ListOpportunitiesFilters,
  "ownerId" | "country" | "region" | "businessUnit"
>;

export function buildOpportunityWhere(filters: ListOpportunitiesFilters): SQL | undefined {
  const parts: SQL[] = [];

  if (filters.ids !== undefined) {
    if (filters.ids.length === 0) parts.push(sql`false`);
    else parts.push(inArray(schema.crmOpportunities.id, filters.ids));
  }

  if (filters.search?.trim()) {
    const term = `%${filters.search.trim()}%`;
    parts.push(
      or(
        ilike(schema.crmOpportunities.name, term),
        sql`EXISTS (
          SELECT 1 FROM ${schema.crmAccounts}
          WHERE ${schema.crmAccounts.id} = ${schema.crmOpportunities.accountId}
            AND ${schema.crmAccounts.name} ILIKE ${term}
        )`,
      )!,
    );
  }
  if (filters.stage) parts.push(eq(schema.crmOpportunities.stage, filters.stage));
  if (filters.accountId) parts.push(eq(schema.crmOpportunities.accountId, filters.accountId));
  if (filters.ownerId) parts.push(eq(schema.crmOpportunities.ownerId, filters.ownerId));
  if (filters.ownerScope?.length) {
    parts.push(inArray(schema.crmOpportunities.ownerId, filters.ownerScope));
  }

  if (filters.country || filters.region) {
    const accountParts: SQL[] = [
      sql`${schema.crmAccounts.id} = ${schema.crmOpportunities.accountId}`,
    ];
    if (filters.country) accountParts.push(eq(schema.crmAccounts.country, filters.country));
    if (filters.region) accountParts.push(eq(schema.crmAccounts.region, filters.region));
    parts.push(
      sql`EXISTS (
        SELECT 1 FROM ${schema.crmAccounts}
        WHERE ${and(...accountParts)}
      )`,
    );
  }

  if (filters.businessUnit === BUSINESS_UNIT_UNASSIGNED) {
    parts.push(sql`cardinality(${schema.crmOpportunities.businessUnits}) = 0`);
  } else if (filters.businessUnit) {
    parts.push(sql`${filters.businessUnit} = ANY(${schema.crmOpportunities.businessUnits})`);
  }

  parts.push(
    filters.archived
      ? isNotNull(schema.crmOpportunities.archivedAt)
      : isNull(schema.crmOpportunities.archivedAt),
  );

  return parts.length ? and(...parts) : undefined;
}

type OppRow = typeof schema.crmOpportunities.$inferSelect;

async function loadBusinessUnitProgress(db: DbLike, opportunityId: string) {
  return db
    .select({
      businessUnit: schema.crmOpportunityBusinessUnits.businessUnit,
      stage: schema.crmOpportunityBusinessUnits.stage,
    })
    .from(schema.crmOpportunityBusinessUnits)
    .where(eq(schema.crmOpportunityBusinessUnits.opportunityId, opportunityId))
    .orderBy(asc(schema.crmOpportunityBusinessUnits.businessUnit));
}

function withUnits<T extends OppRow & { businessUnitProgress: { businessUnit: string; stage: string }[] }>(
  row: T,
): T & { units: DealUnitStage[] } {
  return {
    ...row,
    units: dealUnitStages(row.businessUnits ?? [], row.businessUnitProgress, row.stage),
  };
}

async function withRelations(db: DbLike, row: OppRow) {
  const [account] = await db
    .select({
      id: schema.crmAccounts.id,
      name: schema.crmAccounts.name,
      ownerId: schema.crmAccounts.ownerId,
      country: schema.crmAccounts.country,
      region: schema.crmAccounts.region,
    })
    .from(schema.crmAccounts)
    .where(eq(schema.crmAccounts.id, row.accountId))
    .limit(1);

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

  const [owner] = await db
    .select({ id: schema.users.id, name: schema.users.name, email: schema.users.email })
    .from(schema.users)
    .where(eq(schema.users.id, row.ownerId))
    .limit(1);

  const businessUnitProgress = await loadBusinessUnitProgress(db, row.id);
  return withUnits({ ...row, account: account ?? null, contact, owner: owner ?? null, businessUnitProgress });
}

export async function findIdsForFieldSet(db: Db, filters: ListOpportunitiesFilters, take: number) {
  const where = buildOpportunityWhere(filters);
  return db
    .select({
      id: schema.crmOpportunities.id,
      ownerId: schema.crmOpportunities.ownerId,
      archivedAt: schema.crmOpportunities.archivedAt,
      stage: schema.crmOpportunities.stage,
    })
    .from(schema.crmOpportunities)
    .where(where)
    .limit(take);
}

export async function findIdsAndUnits(db: Db, filters: ListOpportunitiesFilters, take: number) {
  const where = buildOpportunityWhere(filters);
  return db
    .select({
      id: schema.crmOpportunities.id,
      businessUnits: schema.crmOpportunities.businessUnits,
    })
    .from(schema.crmOpportunities)
    .where(where)
    .limit(take);
}

export async function findMany(
  db: Db,
  filters: ListOpportunitiesFilters,
  page: number,
  limit: number,
) {
  const where = buildOpportunityWhere(filters);
  const offset = (page - 1) * limit;

  const [totalRow] = await db.select({ n: count() }).from(schema.crmOpportunities).where(where);
  const rows = await db
    .select()
    .from(schema.crmOpportunities)
    .where(where)
    .orderBy(
      asc(schema.crmOpportunities.sortOrderWithinStage),
      desc(schema.crmOpportunities.createdAt),
    )
    .limit(limit)
    .offset(offset);

  const data = await Promise.all(rows.map((row) => withRelations(db, row)));
  return { data, total: Number(totalRow?.n ?? 0) };
}

export async function findById(db: DbLike, id: string) {
  const [row] = await db
    .select()
    .from(schema.crmOpportunities)
    .where(eq(schema.crmOpportunities.id, id))
    .limit(1);
  if (!row) return null;
  return withRelations(db, row);
}

export async function findLatestByAccountId(db: Db, accountId: string) {
  const [row] = await db
    .select()
    .from(schema.crmOpportunities)
    .where(eq(schema.crmOpportunities.accountId, accountId))
    .orderBy(desc(schema.crmOpportunities.updatedAt))
    .limit(1);
  if (!row) return null;
  return withRelations(db, row);
}

export async function create(
  db: DbLike,
  data: {
    name: string;
    accountId: string;
    contactId?: string | null;
    ownerId: string;
    stage: string;
    value: string;
    currency: string;
    probability: number;
    probabilityCustom?: boolean;
    closeDate?: string | null;
    launchDate?: string | null;
    revenueLaunchDate?: string | null;
    type?: string | null;
    notes?: string | null;
    businessUnits?: string[];
    legacyDealId?: string | null;
    sortOrderWithinStage?: number;
    lostReason?: string | null;
  },
) {
  const id = createCuid();
  const now = new Date().toISOString();
  await db.insert(schema.crmOpportunities).values({
    id,
    name: data.name,
    accountId: data.accountId,
    contactId: data.contactId ?? null,
    ownerId: data.ownerId,
    stage: data.stage,
    value: data.value,
    currency: data.currency,
    probability: data.probability,
    probabilityCustom: data.probabilityCustom ?? false,
    closeDate: data.closeDate ?? null,
    launchDate: data.launchDate ?? null,
    revenueLaunchDate: data.revenueLaunchDate ?? null,
    type: data.type ?? null,
    notes: data.notes ?? null,
    businessUnits: data.businessUnits ?? [],
    legacyDealId: data.legacyDealId ?? null,
    sortOrderWithinStage: data.sortOrderWithinStage ?? 0,
    lostReason: data.lostReason ?? null,
    updatedAt: now,
  });
  return findById(db, id);
}

/** Lead convert path — skips per-unit child rows / rollup recompute on edge. */
export async function createForLeadConvert(
  db: DbLike,
  data: Parameters<typeof create>[1],
) {
  return create(db, data);
}

export async function update(
  db: Db,
  id: string,
  data: Partial<{
    name: string;
    contactId: string | null;
    stage: string;
    sortOrderWithinStage: number;
    value: string;
    currency: string;
    probability: number;
    probabilityCustom: boolean;
    closeDate: string | null;
    launchDate: string | null;
    revenueLaunchDate: string | null;
    type: string | null;
    notes: string | null;
    ownerId: string;
    legacyDealId: string | null;
    businessUnits: string[];
    lostReason: string | null;
    archivedAt: string | null;
    remindersSent: unknown[];
    lastReminderSentAt: string | null;
  }>,
) {
  const now = new Date().toISOString();
  await db
    .update(schema.crmOpportunities)
    .set({ ...data, updatedAt: now })
    .where(eq(schema.crmOpportunities.id, id));
  return findById(db, id);
}

export async function remove(db: Db, id: string) {
  await db.delete(schema.crmOpportunities).where(eq(schema.crmOpportunities.id, id));
}

export async function reorderWithinStage(db: Db, stageKey: string, ids: readonly string[]) {
  if (ids.length === 0) return { success: true as const, reordered: 0 };

  const rows = await db
    .select({ id: schema.crmOpportunities.id, stage: schema.crmOpportunities.stage })
    .from(schema.crmOpportunities)
    .where(inArray(schema.crmOpportunities.id, [...ids]));

  const stageById = new Map(rows.map((row) => [row.id, row.stage]));
  for (const id of ids) {
    const stage = stageById.get(id);
    if (stage === undefined) {
      throw new NotFoundException(`Opportunity ${id} was not found`);
    }
    if (stage !== stageKey) {
      throw new BadRequestException(`Opportunity ${id} is not in stage ${stageKey}`);
    }
  }

  await db.transaction(async (tx) => {
    for (const [index, id] of ids.entries()) {
      await tx
        .update(schema.crmOpportunities)
        .set({ sortOrderWithinStage: index, updatedAt: new Date().toISOString() })
        .where(eq(schema.crmOpportunities.id, id));
    }
  });

  return { success: true as const, reordered: ids.length };
}

export async function findManyByIds(db: Db, ids: string[], ownerId?: string) {
  if (ids.length === 0) return [];
  const parts: SQL[] = [inArray(schema.crmOpportunities.id, ids)];
  if (ownerId) parts.push(eq(schema.crmOpportunities.ownerId, ownerId));
  return db
    .select({
      id: schema.crmOpportunities.id,
      stage: schema.crmOpportunities.stage,
      ownerId: schema.crmOpportunities.ownerId,
    })
    .from(schema.crmOpportunities)
    .where(and(...parts));
}

export async function forecastRows(db: Db, scope: { ownerScope?: string[] }) {
  const parts: SQL[] = [
    notInArray(schema.crmOpportunities.stage, ["closed_won", "closed_lost", "live"]),
    isNull(schema.crmOpportunities.archivedAt),
  ];
  if (scope.ownerScope?.length) {
    parts.push(inArray(schema.crmOpportunities.ownerId, scope.ownerScope));
  }
  return db
    .select({
      id: schema.crmOpportunities.id,
      stage: schema.crmOpportunities.stage,
      currency: schema.crmOpportunities.currency,
      value: schema.crmOpportunities.value,
      probability: schema.crmOpportunities.probability,
    })
    .from(schema.crmOpportunities)
    .where(and(...parts));
}

export async function filterOptions(db: Db, scope: { ownerScope?: string[] }) {
  const oppParts: SQL[] = [
    sql`${schema.crmOpportunities.accountId} = ${schema.crmAccounts.id}`,
  ];
  if (scope.ownerScope?.length) {
    oppParts.push(inArray(schema.crmOpportunities.ownerId, scope.ownerScope));
  }

  const rows = await db
    .select({ country: schema.crmAccounts.country, region: schema.crmAccounts.region })
    .from(schema.crmAccounts)
    .where(
      sql`EXISTS (
        SELECT 1 FROM ${schema.crmOpportunities}
        WHERE ${and(...oppParts)}
      )`,
    );

  const countries = Array.from(
    new Set(rows.map((r) => r.country).filter((v): v is string => !!v)),
  ).sort((a, b) => a.localeCompare(b));
  const regions = Array.from(
    new Set(rows.map((r) => r.region).filter((v): v is string => !!v)),
  ).sort((a, b) => a.localeCompare(b));

  return { countries, regions };
}

export async function dashboardRows(db: Db, scope: { ownerScope?: string[] }) {
  const parts: SQL[] = [isNull(schema.crmOpportunities.archivedAt)];
  if (scope.ownerScope?.length) {
    parts.push(inArray(schema.crmOpportunities.ownerId, scope.ownerScope));
  }

  return db
    .select({
      id: schema.crmOpportunities.id,
      name: schema.crmOpportunities.name,
      stage: schema.crmOpportunities.stage,
      value: schema.crmOpportunities.value,
      currency: schema.crmOpportunities.currency,
      probability: schema.crmOpportunities.probability,
      businessUnits: schema.crmOpportunities.businessUnits,
      launchDate: schema.crmOpportunities.launchDate,
      revenueLaunchDate: schema.crmOpportunities.revenueLaunchDate,
      accountId: schema.crmAccounts.id,
      accountName: schema.crmAccounts.name,
      country: schema.crmAccounts.country,
      region: schema.crmAccounts.region,
      industry: schema.crmAccounts.industry,
      totalUsers: schema.crmAccounts.totalUsers,
      appUsers: schema.crmAccounts.appUsers,
      engagementType: schema.crmAccounts.engagementType,
      ownerName: schema.users.name,
    })
    .from(schema.crmOpportunities)
    .leftJoin(schema.crmAccounts, eq(schema.crmAccounts.id, schema.crmOpportunities.accountId))
    .leftJoin(schema.users, eq(schema.users.id, schema.crmOpportunities.ownerId))
    .where(and(...parts))
    .orderBy(desc(schema.crmOpportunities.createdAt));
}

export async function pipelineSummary(
  db: Db,
  scope: { ownerScope?: string[] },
  filters: PipelineSummaryFilters = {},
) {
  const where = buildOpportunityWhere({
    ...filters,
    ownerScope: scope.ownerScope,
    archived: false,
  });

  const rows = await db
    .select({
      stage: schema.crmOpportunities.stage,
      currency: schema.crmOpportunities.currency,
      count: count(),
      totalValue: sql<string>`coalesce(sum(${schema.crmOpportunities.value}), 0)`,
    })
    .from(schema.crmOpportunities)
    .where(where)
    .groupBy(schema.crmOpportunities.stage, schema.crmOpportunities.currency);

  return rows.map((row) => ({
    stage: row.stage,
    currency: row.currency,
    count: Number(row.count),
    totalValue: Number(row.totalValue),
  }));
}

export async function listStageConfigs(db: Db) {
  return db
    .select()
    .from(schema.opportunityStageConfig)
    .orderBy(asc(schema.opportunityStageConfig.sortOrder));
}

export async function findStageConfig(db: Db, key: string) {
  const [row] = await db
    .select()
    .from(schema.opportunityStageConfig)
    .where(eq(schema.opportunityStageConfig.key, key))
    .limit(1);
  return row ?? null;
}

export async function upsertStageConfig(
  db: Db,
  key: string,
  data: { label: string; probability: number; sortOrder: number; color?: string },
) {
  const now = new Date().toISOString();
  await db
    .insert(schema.opportunityStageConfig)
    .values({
      key,
      label: data.label,
      probability: data.probability,
      sortOrder: data.sortOrder,
      color: data.color ?? "border-t-zinc-500",
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: schema.opportunityStageConfig.key,
      set: {
        label: data.label,
        probability: data.probability,
        sortOrder: data.sortOrder,
        color: data.color ?? "border-t-zinc-500",
        updatedAt: now,
      },
    });
  return findStageConfig(db, key);
}
