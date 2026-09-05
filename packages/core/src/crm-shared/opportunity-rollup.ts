/**
 * Derive deal-level fields from per-business-unit child rows.
 * Ported from apps/api — uses string numerics (Drizzle) instead of Prisma.Decimal.
 */

export interface BusinessUnitProgress {
  businessUnit: string;
  stage: string;
  probability: number;
  probabilityCustom: boolean;
  value: string;
  closeDate: string | null;
  launchDate: string | null;
  revenueLaunchDate: string | null;
  lostReason: string | null;
  sortOrderWithinStage: number;
}

export interface OpportunityRollup {
  stage: string;
  probability: number;
  probabilityCustom: boolean;
  value: string;
  closeDate: string | null;
  launchDate: string | null;
  revenueLaunchDate: string | null;
  lostReason: string | null;
  sortOrderWithinStage: number;
}

const LOST_STAGE = "closed_lost";
const UNKNOWN_STAGE_ORDER = -1;

function sumDecimal(values: string[]): string {
  const total = values.reduce((sum, v) => sum + Number(v), 0);
  return total.toFixed(2);
}

function maxDate(dates: (string | null)[]): string | null {
  const valid = dates.filter((d): d is string => d !== null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => (a > b ? a : b));
}

function minDate(dates: (string | null)[]): string | null {
  const valid = dates.filter((d): d is string => d !== null);
  if (valid.length === 0) return null;
  return valid.reduce((a, b) => (a < b ? a : b));
}

/**
 * Returns `null` when the deal has no units — callers must leave stored values untouched.
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

  const leastAdvanced = children.reduce((best, row) => {
    const a = rank(row);
    const b = rank(best);
    if (a.stage !== b.stage) return a.stage < b.stage ? row : best;
    if (a.tag !== b.tag) return a.tag < b.tag ? row : best;
    return a.code < b.code ? row : best;
  });

  const value = sumDecimal(children.map((row) => row.value));

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
    closeDate: maxDate(children.map((r) => r.closeDate)),
    launchDate: minDate(children.map((r) => r.launchDate)),
    revenueLaunchDate: minDate(children.map((r) => r.revenueLaunchDate)),
    lostReason,
    sortOrderWithinStage: leastAdvanced.sortOrderWithinStage,
  };
}
