import { Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";
import {
  type DealFieldPatch,
  planDealFieldPushDown,
  type PushDownOptions,
} from "@/modules/crm-shared/opportunity-push-down";
import {
  type BusinessUnitProgress,
  computeOpportunityRollup,
} from "@/modules/crm-shared/opportunity-rollup";
import {
  OPPORTUNITY_STAGES,
  type OpportunityStage,
  STAGE_PROBABILITY_DEFAULTS,
} from "@/modules/opportunities/opportunities.constants";

type Db = Prisma.TransactionClient | typeof prisma;
const client = (tx?: Prisma.TransactionClient): Db => tx ?? prisma;

type StageCatalogEntry = { sortOrder: number; probability: number };

/**
 * Code-constant sort order for the canonical stages, mirroring the
 * `sort_order` values the migrations seed into `opportunity_stage_config`
 * (`20260630000000_opportunity_stage_config` plus Live at 45 from
 * `20261020000000_opportunity_live_stage_and_sort_order`).
 *
 * It has to mirror the seed rather than pick its own scale, because the
 * catalog rows OVERLAY this map key by key: a code-derived stage sitting
 * on a different scale from a catalog-derived one would rank against it
 * arbitrarily. Revenue CRM seeds Live at 50 and Closed Lost at 60, so its
 * mirror of this constant differs — that divergence is deliberate.
 */
const CODE_STAGE_SORT_ORDER: Record<OpportunityStage, number> = {
  qualified: 10,
  proposal: 20,
  negotiation: 30,
  closed_won: 40,
  live: 45,
  closed_lost: 50,
};

/**
 * Stage key → { sortOrder, probability }, code constants overlaid by the
 * admin-tunable catalog.
 *
 * The code constants are the BASE and catalog rows overwrite them per key,
 * so a stage missing from a *partially populated* catalog still resolves.
 * Gating the whole fallback on an empty table (the obvious shape) breaks
 * the moment one row exists: staging starts with an empty catalog because
 * `db:push` never runs the migration INSERT, so a single admin save flips
 * it from "empty → every stage safe" to "1 row → 5 stages unknown", and
 * `computeOpportunityRollup` ranks every unknown stage as least-advanced.
 *
 * Per-key precedence also matches `OpportunityService.getStageProbability`,
 * which reads the catalog row for one stage and falls back to
 * `STAGE_PROBABILITY_DEFAULTS` only when that row is missing.
 */
async function stageCatalog(
  tx?: Prisma.TransactionClient,
): Promise<Map<string, StageCatalogEntry>> {
  const catalog = new Map<string, StageCatalogEntry>(
    OPPORTUNITY_STAGES.map((key) => [
      key,
      {
        sortOrder: CODE_STAGE_SORT_ORDER[key],
        probability: STAGE_PROBABILITY_DEFAULTS[key],
      },
    ]),
  );

  const rows = await client(tx).opportunityStageConfig.findMany({
    select: { key: true, sortOrder: true, probability: true },
  });
  for (const row of rows) {
    catalog.set(row.key, {
      sortOrder: row.sortOrder,
      probability: row.probability,
    });
  }
  return catalog;
}

/** Stage key → sort order. Feeds the roll-up's stage ranking. */
async function stageSortOrder(
  tx?: Prisma.TransactionClient,
): Promise<Map<string, number>> {
  const catalog = await stageCatalog(tx);
  return new Map([...catalog].map(([key, entry]) => [key, entry.sortOrder]));
}

/**
 * The probability a given stage implies, with the same precedence the rest
 * of the module uses: the admin-tuned catalog row for that stage, falling
 * back to the code default only when the catalog has no row for it.
 *
 * Exported for the per-unit board's stage move, which has to snap a card's
 * probability exactly the way a deal-level stage change does — otherwise
 * dragging a card and editing a deal would disagree about what Proposal
 * means.
 */
export async function stageProbability(
  stage: string,
  tx?: Prisma.TransactionClient,
): Promise<number | undefined> {
  const catalog = await stageCatalog(tx);
  return catalog.get(stage)?.probability;
}

/**
 * The stage a newly tagged unit starts at — the lowest in the order.
 *
 * Probability comes from the same entry, so the precedence mirrors
 * `OpportunityService.getStageProbability`: the catalog's admin-tuned
 * value for the chosen stage, falling back to the code default only when
 * the catalog has no row for it. A newly tagged unit therefore lands on
 * the probability a stage move would have given it.
 *
 * `stageCatalog` always covers every canonical stage, so the sort always
 * has an entry to return.
 */
async function firstStage(tx?: Prisma.TransactionClient) {
  const catalog = await stageCatalog(tx);
  const [key, entry] = [...catalog.entries()].sort(
    (a, b) => a[1].sortOrder - b[1].sortOrder,
  )[0];
  return { stage: key, probability: entry.probability };
}

/** The deal columns a first set of child rows is reproduced from. */
const DEAL_SEED_SELECT = {
  id: true,
  businessUnits: true,
  stage: true,
  probability: true,
  probabilityCustom: true,
  value: true,
  closeDate: true,
  launchDate: true,
  revenueLaunchDate: true,
  lostReason: true,
  sortOrderWithinStage: true,
} as const;

type DealSeedSource = {
  id: string;
  businessUnits: string[];
  stage: string;
  probability: number;
  probabilityCustom: boolean;
  value: Prisma.Decimal;
  closeDate: Date | null;
  launchDate: Date | null;
  revenueLaunchDate: Date | null;
  lostReason: string | null;
  sortOrderWithinStage: number;
};

/**
 * A deal's first set of child rows, reproducing the deal exactly.
 *
 * The whole value goes on the FIRST tag and 0 on the rest, so the roll-up
 * SUM comes back to the deal's own figure and no pipeline total moves.
 * This is a reproduction, not a reset — the distinction the reverted
 * wiring lost.
 *
 * Deduped defensively: nothing stopped a duplicate tag being stored before
 * the validators started collapsing them, and two rows for one unit would
 * make `businessUnits.length` disagree with the child row count the board's
 * column headers are built from.
 */
function buildSeedRows(deal: DealSeedSource) {
  return [...new Set(deal.businessUnits)].map((businessUnit, index) => ({
    opportunityId: deal.id,
    businessUnit,
    stage: deal.stage,
    probability: deal.probability,
    probabilityCustom: deal.probabilityCustom,
    value: index === 0 ? deal.value : new Prisma.Decimal(0),
    closeDate: deal.closeDate,
    launchDate: deal.launchDate,
    revenueLaunchDate: deal.revenueLaunchDate,
    lostReason: deal.lostReason,
    sortOrderWithinStage: deal.sortOrderWithinStage,
  }));
}

/**
 * Seed ONE deal's first child rows from the deal itself.
 *
 * Use only when the deal has no child rows yet. For a tag arriving on a
 * deal that already carries rows, use `syncBusinessUnitRows` — that unit
 * genuinely has not done the work its siblings have. Conflating the two
 * is what blanked freshly created deals and got PR1's wiring reverted;
 * `ensureBusinessUnitRows` picks between them so callers do not have to.
 *
 * Idempotent via `skipDuplicates`. Returns the unit codes written.
 */
export async function seedBusinessUnitRowsFromDeal(
  opportunityId: string,
  tx?: Prisma.TransactionClient,
): Promise<string[]> {
  const db = client(tx);
  const deal = await db.opportunity.findUnique({
    where: { id: opportunityId },
    select: DEAL_SEED_SELECT,
  });
  if (!deal) return [];

  const rows = buildSeedRows(deal);
  if (rows.length === 0) return [];

  await db.opportunityBusinessUnit.createMany({
    data: rows,
    skipDuplicates: true,
  });
  return rows.map((row) => row.businessUnit);
}

/**
 * Create rows for newly tagged units and delete rows for untagged ones,
 * so the child rows always match `Opportunity.businessUnits`.
 *
 * A new unit starts at the first stage with value 0 rather than
 * inheriting the deal's stage: it has not done the work its siblings
 * have, and claiming otherwise would hide that from the roll-up.
 *
 * That rule holds ONLY for a deal that already carries child rows. A deal
 * with none is not gaining units, it is being seeded for the first time —
 * see `seedBusinessUnitRowsFromDeal`. Prefer `ensureBusinessUnitRows`,
 * which reads the row count and picks.
 */
export async function syncBusinessUnitRows(
  opportunityId: string,
  tagOrder: readonly string[],
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const db = client(tx);
  const existing = await db.opportunityBusinessUnit.findMany({
    where: { opportunityId },
    select: { businessUnit: true },
  });
  const have = new Set(existing.map((r) => r.businessUnit));
  const want = new Set(tagOrder);

  const toAdd = tagOrder.filter((code) => !have.has(code));
  const toRemove = [...have].filter((code) => !want.has(code));

  if (toAdd.length > 0) {
    const { stage, probability } = await firstStage(tx);
    await db.opportunityBusinessUnit.createMany({
      data: toAdd.map((businessUnit) => ({
        opportunityId,
        businessUnit,
        stage,
        probability,
        value: new Prisma.Decimal(0),
      })),
      skipDuplicates: true,
    });
  }

  if (toRemove.length > 0) {
    await db.opportunityBusinessUnit.deleteMany({
      where: { opportunityId, businessUnit: { in: toRemove } },
    });
  }
}

/**
 * One deal's per-unit rows, in tag order where possible.
 *
 * The edit form needs this to populate a stage control per unit; every other
 * read either aggregates (the board) or writes (the move endpoint). Ordered by
 * unit code so the form's row order is stable across reloads rather than
 * following DB row order.
 */
export async function listBusinessUnitRows(
  opportunityId: string,
  tx?: Prisma.TransactionClient,
) {
  return client(tx).opportunityBusinessUnit.findMany({
    where: { opportunityId },
    orderBy: { businessUnit: "asc" },
    select: {
      businessUnit: true,
      stage: true,
      probability: true,
      probabilityCustom: true,
      value: true,
      closeDate: true,
      launchDate: true,
      revenueLaunchDate: true,
      lostReason: true,
      sortOrderWithinStage: true,
    },
  });
}

/** Which rule `ensureBusinessUnitRows` applied, and what it touched. */
export interface EnsureBusinessUnitRowsResult {
  /**
   * `seeded` — the deal had no child rows and its first set was reproduced
   * FROM the deal. `synced` — rows already existed (or there are no tags),
   * so new tags started at the first stage with value 0.
   */
  mode: "seeded" | "synced";
  added: string[];
  removed: string[];
}

/**
 * Bring a deal's child rows in line with its tags, choosing the right rule.
 *
 * Two rules look alike and are not:
 *
 * - A deal with NO child rows is being seeded for the first time. Its
 *   rows reproduce the deal (`seedBusinessUnitRowsFromDeal`), because the
 *   deal's own stage and value are the only truth that exists yet.
 * - A tag arriving on a deal that ALREADY has rows is a genuinely new
 *   unit. It starts at the first stage with value 0
 *   (`syncBusinessUnitRows`), because it has not done the work its
 *   siblings have.
 *
 * Applying the second rule to the first case is what blanked freshly
 * created deals — a deal submitted at `negotiation` for 500000 persisted
 * as `qualified` / 0 / null — and got PR1's write-path wiring reverted.
 * The branch lives here, once, and the result says which way it went so a
 * caller never has to re-derive it.
 *
 * A deal with no rows AND no tags is neither case: it has no units at all
 * and must keep its stored values, so nothing is written.
 */
export async function ensureBusinessUnitRows(
  opportunityId: string,
  tagOrder: readonly string[],
  tx?: Prisma.TransactionClient,
): Promise<EnsureBusinessUnitRowsResult> {
  const db = client(tx);
  const existing = await db.opportunityBusinessUnit.findMany({
    where: { opportunityId },
    select: { businessUnit: true },
  });

  if (existing.length === 0) {
    if (tagOrder.length === 0) {
      return { mode: "synced", added: [], removed: [] };
    }
    const added = await seedBusinessUnitRowsFromDeal(opportunityId, tx);
    return { mode: "seeded", added, removed: [] };
  }

  const have = new Set(existing.map((row) => row.businessUnit));
  const want = new Set(tagOrder);
  const added = [...new Set(tagOrder)].filter((code) => !have.has(code));
  const removed = [...have].filter((code) => !want.has(code));

  await syncBusinessUnitRows(opportunityId, tagOrder, tx);
  return { mode: "synced", added, removed };
}

/**
 * Write a deal-level edit DOWN onto the existing child rows.
 *
 * Must run BEFORE `recomputeOpportunityRollup`. The deal's fields are
 * derived, so storing an edit is not enough: the recompute would read the
 * untouched child rows and overwrite the edit with a stale roll-up. That
 * is the second half of the corruption the revert documented — "nothing
 * writes the deal-level change DOWN onto the child rows first."
 *
 * Which row each field lands on follows the roll-up rule that reads it;
 * see `planDealFieldPushDown`.
 */
export async function pushDealFieldsToBusinessUnits(
  opportunityId: string,
  patch: DealFieldPatch,
  options: PushDownOptions = {},
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const db = client(tx);
  const deal = await db.opportunity.findUnique({
    where: { id: opportunityId },
    select: { id: true, businessUnits: true },
  });
  if (!deal) return;

  const children: BusinessUnitProgress[] =
    await db.opportunityBusinessUnit.findMany({
      where: { opportunityId },
      orderBy: { businessUnit: "asc" },
      select: {
        businessUnit: true,
        stage: true,
        probability: true,
        probabilityCustom: true,
        value: true,
        closeDate: true,
        launchDate: true,
        revenueLaunchDate: true,
        lostReason: true,
        sortOrderWithinStage: true,
      },
    });
  if (children.length === 0) return;

  const plan = planDealFieldPushDown(
    children,
    await stageSortOrder(tx),
    deal.businessUnits,
    patch,
    options,
  );

  for (const entry of plan) {
    await db.opportunityBusinessUnit.update({
      where: {
        opportunityId_businessUnit: {
          opportunityId,
          businessUnit: entry.businessUnit,
        },
      },
      data: entry.data,
    });
  }
}

/**
 * The ONLY place the derived deal fields are written.
 *
 * A deal with no child rows keeps its stored values — see the null
 * contract on computeOpportunityRollup. Resetting them here would wipe
 * every untagged deal back to qualified / 0.
 */
export async function recomputeOpportunityRollup(
  opportunityId: string,
  tx?: Prisma.TransactionClient,
): Promise<void> {
  const db = client(tx);
  const deal = await db.opportunity.findUnique({
    where: { id: opportunityId },
    select: { id: true, businessUnits: true },
  });
  if (!deal) return;

  // No `as BusinessUnitProgress[]` cast: an assertion would let this
  // select drift out of sync with the interface silently — adding a field
  // to BusinessUnitProgress would leave it `undefined` here, and Prisma
  // skips undefined keys, so the new column would simply never be
  // maintained. Structural assignability is the check.
  const children: BusinessUnitProgress[] =
    await db.opportunityBusinessUnit.findMany({
      where: { opportunityId },
      // Stable input. computeOpportunityRollup breaks a full tie on the unit
      // code, but an unordered read would still make the Decimal sum's
      // operand order vary between runs.
      orderBy: { businessUnit: "asc" },
      select: {
        businessUnit: true,
        stage: true,
        probability: true,
        probabilityCustom: true,
        value: true,
        closeDate: true,
        launchDate: true,
        revenueLaunchDate: true,
        lostReason: true,
        sortOrderWithinStage: true,
      },
    });

  const rollup = computeOpportunityRollup(
    children,
    await stageSortOrder(tx),
    deal.businessUnits,
  );
  if (rollup === null) return;

  await db.opportunity.update({
    where: { id: opportunityId },
    data: rollup,
  });
}
