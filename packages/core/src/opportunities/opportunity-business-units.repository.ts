import { and, asc, eq, inArray } from "drizzle-orm";
import type { Db, DbTransaction } from "@nexora/db";
import { schema } from "@nexora/db";
import {
  OPPORTUNITY_STAGES,
  type OpportunityStage,
  STAGE_PROBABILITY_DEFAULTS,
} from "@nexora/contracts/modules/opportunities/opportunities.constants";
import {
  type BusinessUnitProgress,
  computeOpportunityRollup,
} from "../crm-shared/opportunity-rollup";
import {
  type DealFieldPatch,
  planDealFieldPushDown,
  type PushDownOptions,
} from "../crm-shared/opportunity-push-down";
import { createCuid } from "../lib/id";

type DbLike = Db | DbTransaction;

const CODE_STAGE_SORT_ORDER: Record<OpportunityStage, number> = {
  qualified: 10,
  proposal: 20,
  negotiation: 30,
  closed_won: 40,
  live: 45,
  closed_lost: 50,
};

type StageCatalogEntry = { sortOrder: number; probability: number };

async function stageCatalog(db: DbLike): Promise<Map<string, StageCatalogEntry>> {
  const catalog = new Map<string, StageCatalogEntry>(
    OPPORTUNITY_STAGES.map((key) => [
      key,
      {
        sortOrder: CODE_STAGE_SORT_ORDER[key],
        probability: STAGE_PROBABILITY_DEFAULTS[key],
      },
    ]),
  );

  const rows = await db
    .select({
      key: schema.opportunityStageConfig.key,
      sortOrder: schema.opportunityStageConfig.sortOrder,
      probability: schema.opportunityStageConfig.probability,
    })
    .from(schema.opportunityStageConfig);

  for (const row of rows) {
    catalog.set(row.key, {
      sortOrder: row.sortOrder,
      probability: row.probability,
    });
  }
  return catalog;
}

async function stageSortOrder(db: DbLike): Promise<Map<string, number>> {
  const catalog = await stageCatalog(db);
  return new Map([...catalog].map(([key, entry]) => [key, entry.sortOrder]));
}

export async function stageProbability(db: DbLike, stage: string): Promise<number | undefined> {
  const catalog = await stageCatalog(db);
  return catalog.get(stage)?.probability;
}

async function firstStage(db: DbLike) {
  const catalog = await stageCatalog(db);
  const [key, entry] = [...catalog.entries()].sort((a, b) => a[1].sortOrder - b[1].sortOrder)[0]!;
  return { stage: key, probability: entry.probability };
}

const CHILD_SELECT = {
  businessUnit: schema.crmOpportunityBusinessUnits.businessUnit,
  stage: schema.crmOpportunityBusinessUnits.stage,
  probability: schema.crmOpportunityBusinessUnits.probability,
  probabilityCustom: schema.crmOpportunityBusinessUnits.probabilityCustom,
  value: schema.crmOpportunityBusinessUnits.value,
  closeDate: schema.crmOpportunityBusinessUnits.closeDate,
  launchDate: schema.crmOpportunityBusinessUnits.launchDate,
  revenueLaunchDate: schema.crmOpportunityBusinessUnits.revenueLaunchDate,
  lostReason: schema.crmOpportunityBusinessUnits.lostReason,
  sortOrderWithinStage: schema.crmOpportunityBusinessUnits.sortOrderWithinStage,
} as const;

function buildSeedRows(deal: {
  id: string;
  businessUnits: string[] | null;
  stage: string;
  probability: number;
  probabilityCustom: boolean;
  value: string;
  closeDate: string | null;
  launchDate: string | null;
  revenueLaunchDate: string | null;
  lostReason: string | null;
  sortOrderWithinStage: number;
}) {
  const now = new Date().toISOString();
  return [...new Set(deal.businessUnits ?? [])].map((businessUnit, index) => ({
    id: createCuid(),
    opportunityId: deal.id,
    businessUnit,
    stage: deal.stage,
    probability: deal.probability,
    probabilityCustom: deal.probabilityCustom,
    value: index === 0 ? deal.value : "0",
    closeDate: deal.closeDate,
    launchDate: deal.launchDate,
    revenueLaunchDate: deal.revenueLaunchDate,
    lostReason: deal.lostReason,
    sortOrderWithinStage: deal.sortOrderWithinStage,
    updatedAt: now,
  }));
}

export async function seedBusinessUnitRowsFromDeal(
  db: DbLike,
  opportunityId: string,
): Promise<string[]> {
  const [deal] = await db
    .select({
      id: schema.crmOpportunities.id,
      businessUnits: schema.crmOpportunities.businessUnits,
      stage: schema.crmOpportunities.stage,
      probability: schema.crmOpportunities.probability,
      probabilityCustom: schema.crmOpportunities.probabilityCustom,
      value: schema.crmOpportunities.value,
      closeDate: schema.crmOpportunities.closeDate,
      launchDate: schema.crmOpportunities.launchDate,
      revenueLaunchDate: schema.crmOpportunities.revenueLaunchDate,
      lostReason: schema.crmOpportunities.lostReason,
      sortOrderWithinStage: schema.crmOpportunities.sortOrderWithinStage,
    })
    .from(schema.crmOpportunities)
    .where(eq(schema.crmOpportunities.id, opportunityId))
    .limit(1);
  if (!deal) return [];

  const rows = buildSeedRows(deal);
  if (rows.length === 0) return [];

  await db
    .insert(schema.crmOpportunityBusinessUnits)
    .values(rows)
    .onConflictDoNothing({
      target: [
        schema.crmOpportunityBusinessUnits.opportunityId,
        schema.crmOpportunityBusinessUnits.businessUnit,
      ],
    });
  return rows.map((row) => row.businessUnit);
}

export async function syncBusinessUnitRows(
  db: DbLike,
  opportunityId: string,
  tagOrder: readonly string[],
): Promise<void> {
  const existing = await db
    .select({ businessUnit: schema.crmOpportunityBusinessUnits.businessUnit })
    .from(schema.crmOpportunityBusinessUnits)
    .where(eq(schema.crmOpportunityBusinessUnits.opportunityId, opportunityId));

  const have = new Set(existing.map((r) => r.businessUnit));
  const want = new Set(tagOrder);
  const toAdd = tagOrder.filter((code) => !have.has(code));
  const toRemove = [...have].filter((code) => !want.has(code));

  if (toAdd.length > 0) {
    const { stage, probability } = await firstStage(db);
    const now = new Date().toISOString();
    await db
      .insert(schema.crmOpportunityBusinessUnits)
      .values(
        toAdd.map((businessUnit) => ({
          id: createCuid(),
          opportunityId,
          businessUnit,
          stage,
          probability,
          value: "0",
          updatedAt: now,
        })),
      )
      .onConflictDoNothing({
        target: [
          schema.crmOpportunityBusinessUnits.opportunityId,
          schema.crmOpportunityBusinessUnits.businessUnit,
        ],
      });
  }

  if (toRemove.length > 0) {
    await db
      .delete(schema.crmOpportunityBusinessUnits)
      .where(
        and(
          eq(schema.crmOpportunityBusinessUnits.opportunityId, opportunityId),
          inArray(schema.crmOpportunityBusinessUnits.businessUnit, toRemove),
        ),
      );
  }
}

export async function listBusinessUnitRows(db: DbLike, opportunityId: string) {
  return db
    .select({
      businessUnit: schema.crmOpportunityBusinessUnits.businessUnit,
      stage: schema.crmOpportunityBusinessUnits.stage,
      probability: schema.crmOpportunityBusinessUnits.probability,
      probabilityCustom: schema.crmOpportunityBusinessUnits.probabilityCustom,
      value: schema.crmOpportunityBusinessUnits.value,
      closeDate: schema.crmOpportunityBusinessUnits.closeDate,
      launchDate: schema.crmOpportunityBusinessUnits.launchDate,
      revenueLaunchDate: schema.crmOpportunityBusinessUnits.revenueLaunchDate,
      lostReason: schema.crmOpportunityBusinessUnits.lostReason,
      sortOrderWithinStage: schema.crmOpportunityBusinessUnits.sortOrderWithinStage,
    })
    .from(schema.crmOpportunityBusinessUnits)
    .where(eq(schema.crmOpportunityBusinessUnits.opportunityId, opportunityId))
    .orderBy(asc(schema.crmOpportunityBusinessUnits.businessUnit));
}

export interface EnsureBusinessUnitRowsResult {
  mode: "seeded" | "synced";
  added: string[];
  removed: string[];
}

export async function ensureBusinessUnitRows(
  db: DbLike,
  opportunityId: string,
  tagOrder: readonly string[],
): Promise<EnsureBusinessUnitRowsResult> {
  const existing = await db
    .select({ businessUnit: schema.crmOpportunityBusinessUnits.businessUnit })
    .from(schema.crmOpportunityBusinessUnits)
    .where(eq(schema.crmOpportunityBusinessUnits.opportunityId, opportunityId));

  if (existing.length === 0) {
    if (tagOrder.length === 0) {
      return { mode: "synced", added: [], removed: [] };
    }
    const added = await seedBusinessUnitRowsFromDeal(db, opportunityId);
    return { mode: "seeded", added, removed: [] };
  }

  const have = new Set(existing.map((row) => row.businessUnit));
  const want = new Set(tagOrder);
  const added = [...new Set(tagOrder)].filter((code) => !have.has(code));
  const removed = [...have].filter((code) => !want.has(code));

  await syncBusinessUnitRows(db, opportunityId, tagOrder);
  return { mode: "synced", added, removed };
}

export async function pushDealFieldsToBusinessUnits(
  db: DbLike,
  opportunityId: string,
  patch: DealFieldPatch,
  options: PushDownOptions = {},
): Promise<void> {
  const [deal] = await db
    .select({
      id: schema.crmOpportunities.id,
      businessUnits: schema.crmOpportunities.businessUnits,
    })
    .from(schema.crmOpportunities)
    .where(eq(schema.crmOpportunities.id, opportunityId))
    .limit(1);
  if (!deal) return;

  const children: BusinessUnitProgress[] = await db
    .select(CHILD_SELECT)
    .from(schema.crmOpportunityBusinessUnits)
    .where(eq(schema.crmOpportunityBusinessUnits.opportunityId, opportunityId))
    .orderBy(asc(schema.crmOpportunityBusinessUnits.businessUnit));

  if (children.length === 0) return;

  const plan = planDealFieldPushDown(
    children,
    await stageSortOrder(db),
    deal.businessUnits ?? [],
    patch,
    options,
  );

  const now = new Date().toISOString();
  for (const entry of plan) {
    await db
      .update(schema.crmOpportunityBusinessUnits)
      .set({ ...entry.data, updatedAt: now })
      .where(
        and(
          eq(schema.crmOpportunityBusinessUnits.opportunityId, opportunityId),
          eq(schema.crmOpportunityBusinessUnits.businessUnit, entry.businessUnit),
        ),
      );
  }
}

/** The ONLY place derived deal fields are written for Sales CRM opportunities. */
export async function recomputeOpportunityRollup(
  db: DbLike,
  opportunityId: string,
): Promise<void> {
  const [deal] = await db
    .select({
      id: schema.crmOpportunities.id,
      businessUnits: schema.crmOpportunities.businessUnits,
    })
    .from(schema.crmOpportunities)
    .where(eq(schema.crmOpportunities.id, opportunityId))
    .limit(1);
  if (!deal) return;

  const children: BusinessUnitProgress[] = await db
    .select(CHILD_SELECT)
    .from(schema.crmOpportunityBusinessUnits)
    .where(eq(schema.crmOpportunityBusinessUnits.opportunityId, opportunityId))
    .orderBy(asc(schema.crmOpportunityBusinessUnits.businessUnit));

  const rollup = computeOpportunityRollup(
    children,
    await stageSortOrder(db),
    deal.businessUnits ?? [],
  );
  if (rollup === null) return;

  const now = new Date().toISOString();
  await db
    .update(schema.crmOpportunities)
    .set({ ...rollup, updatedAt: now })
    .where(eq(schema.crmOpportunities.id, opportunityId));
}
