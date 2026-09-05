import { Prisma } from "@nexora/database";

/**
 * One business unit's progress on a deal. Mirrors a row of
 * `crm_opportunity_business_units` / `revenue_opportunity_business_units`,
 * narrowed to the fields the roll-up reads.
 *
 * No `currency`: a deal has exactly one currency and every unit's `value`
 * is denominated in it. Summing across currencies would produce a total
 * that means nothing, and Sales CRM v2 has no FX by design.
 */
export interface BusinessUnitProgress {
  businessUnit: string;
  stage: string;
  probability: number;
  probabilityCustom: boolean;
  value: Prisma.Decimal;
  closeDate: Date | null;
  launchDate: Date | null;
  revenueLaunchDate: Date | null;
  lostReason: string | null;
  sortOrderWithinStage: number;
}

/**
 * The deal-level fields derived from the units.
 *
 * This object is handed to Prisma as a `data` payload verbatim, so its key
 * set IS the set of deal columns a recompute overwrites. Anything absent
 * here keeps whatever the deal already stored — which is why
 * `probabilityCustom` belongs in it: deriving `probability` while leaving a
 * stale `probabilityCustom: true` behind makes the deal claim a rep typed a
 * number the roll-up actually computed.
 */
export interface OpportunityRollup {
  stage: string;
  probability: number;
  probabilityCustom: boolean;
  value: Prisma.Decimal;
  closeDate: Date | null;
  launchDate: Date | null;
  revenueLaunchDate: Date | null;
  lostReason: string | null;
  sortOrderWithinStage: number;
}

const LOST_STAGE = "closed_lost";

/**
 * A stage the catalog no longer knows sorts FIRST, i.e. least advanced.
 * The alternative — treating it as most advanced — would let a row whose
 * stage an admin deleted quietly stop holding the deal back.
 */
const UNKNOWN_STAGE_ORDER = -1;

/**
 * Derive the deal-level fields from its business units.
 *
 * Returns `null` when the deal has no units. Callers MUST then leave the
 * deal's stored values untouched: rolling up to defaults would silently
 * reset every untagged deal to `qualified` / 0.
 *
 * @param tagOrder `Opportunity.businessUnits`, used to break ties
 *   deterministically so repeated recomputes cannot flap.
 */
export function computeOpportunityRollup(
  children: readonly BusinessUnitProgress[],
  stageSortOrder: ReadonlyMap<string, number>,
  tagOrder: readonly string[],
): OpportunityRollup | null {
  if (children.length === 0) return null;

  const rank = (row: BusinessUnitProgress) => {
    const stage = stageSortOrder.get(row.stage) ?? UNKNOWN_STAGE_ORDER;
    const tag = tagOrder.indexOf(row.businessUnit);
    return {
      stage,
      tag: tag === -1 ? Number.MAX_SAFE_INTEGER : tag,
      code: row.businessUnit,
    };
  };

  // Three keys, because two are not enough to be total: units sharing a
  // stage and BOTH absent from `tagOrder` collide on MAX_SAFE_INTEGER, and
  // the rows arrive from an unordered findMany — so without the code as a
  // final tie-break the roll-up would depend on DB row order and flap
  // between otherwise identical recomputes.
  const leastAdvanced = children.reduce((best, row) => {
    const a = rank(row);
    const b = rank(best);
    if (a.stage !== b.stage) return a.stage < b.stage ? row : best;
    if (a.tag !== b.tag) return a.tag < b.tag ? row : best;
    return a.code < b.code ? row : best;
  });

  const value = children.reduce(
    (sum, row) => sum.add(row.value),
    new Prisma.Decimal(0),
  );

  const dates = (pick: (row: BusinessUnitProgress) => Date | null) =>
    children.map(pick).filter((d): d is Date => d !== null);

  const closeDates = dates((r) => r.closeDate);
  const launchDates = dates((r) => r.launchDate);
  const revenueLaunchDates = dates((r) => r.revenueLaunchDate);

  const max = (ds: Date[]) =>
    ds.length ? new Date(Math.max(...ds.map((d) => d.getTime()))) : null;
  const min = (ds: Date[]) =>
    ds.length ? new Date(Math.min(...ds.map((d) => d.getTime()))) : null;

  // A single lost unit does not lose the deal. Only when every unit is
  // lost does the deal carry a reason, and it takes the first one in tag
  // order so the result is stable across runs.
  const allLost = children.every((row) => row.stage === LOST_STAGE);
  const lostReason = allLost
    ? ([...children]
        .sort((a, b) => rank(a).tag - rank(b).tag)
        .find((row) => row.lostReason !== null)?.lostReason ?? null)
    : null;

  return {
    stage: leastAdvanced.stage,
    probability: leastAdvanced.probability,
    probabilityCustom: leastAdvanced.probabilityCustom,
    value,
    closeDate: max(closeDates),
    launchDate: min(launchDates),
    revenueLaunchDate: min(revenueLaunchDates),
    lostReason,
    // Tracks the unit whose stage the deal reports, so the deal sorts
    // where that unit's card sits. The legacy deal-level list ordering
    // still reads this column.
    sortOrderWithinStage: leastAdvanced.sortOrderWithinStage,
  };
}
