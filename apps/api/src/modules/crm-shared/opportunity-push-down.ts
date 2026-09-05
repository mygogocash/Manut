import { Prisma } from "@nexora/database";

import type { BusinessUnitProgress } from "@/modules/crm-shared/opportunity-rollup";

/**
 * A deal-level edit, as submitted. Only the fields the roll-up derives
 * from the child rows appear here — a name or currency change needs no
 * push-down.
 *
 * `undefined` means "not edited"; `null` means "cleared".
 */
export interface DealFieldPatch {
  stage?: string;
  probability?: number;
  probabilityCustom?: boolean;
  value?: Prisma.Decimal;
  closeDate?: Date | null;
  launchDate?: Date | null;
  revenueLaunchDate?: Date | null;
  lostReason?: string | null;
}

/** One child row's share of a deal-level edit. */
export interface BusinessUnitPatch {
  businessUnit: string;
  data: Partial<Omit<BusinessUnitProgress, "businessUnit">>;
}

export interface PushDownOptions {
  /**
   * Apply a stage change to EVERY unit rather than the least-advanced one.
   *
   * For an ordinary edit, the least-advanced unit is the right target: it
   * is the row the deal reports, and dragging an advanced sibling
   * backwards would destroy the disagreement this feature exists to show.
   *
   * `closeLost` and `reopen` are not ordinary edits — they settle the
   * whole deal. Marking only the least-advanced unit lost would leave a
   * sibling at an earlier stage, and since `closed_lost` sorts last the
   * roll-up would report THAT sibling instead: the action would silently
   * not take. The spec's rule that a lost reason surfaces only when every
   * unit is lost assumes the same thing.
   */
  stageAppliesToEveryUnit?: boolean;
}

const LOST_STAGE = "closed_lost";
const UNKNOWN_STAGE_ORDER = -1;
const VALUE_SCALE = 2;

/**
 * Split a deal-level edit across the child rows so a following recompute
 * reproduces exactly what was submitted.
 *
 * The deal's fields are DERIVED, so an edit cannot simply be stored: the
 * next recompute would read the untouched child rows and overwrite it with
 * a stale roll-up. That is the failure that got PR1's write-path wiring
 * reverted. Each field is therefore pushed onto whichever row the roll-up
 * rule READS for it:
 *
 * - `stage` / `probability` / `probabilityCustom` — the least-advanced
 *   unit, which is the row the deal reports. An advanced sibling is never
 *   dragged backwards; units disagreeing is the point of the feature.
 * - `value` — re-split across every unit in proportion to the split that
 *   is already there, so a rep's deliberate allocation survives a total
 *   being corrected. Rounding is absorbed on the last unit so the sum is
 *   exact to the cent.
 * - `closeDate` (MAX) — onto the unit holding the latest date, with any
 *   sibling ABOVE the new date clamped down; otherwise pulling a deal's
 *   close date earlier would leave a sibling holding the maximum and the
 *   edit would silently not take.
 * - `launchDate` / `revenueLaunchDate` (MIN of non-nulls) — the mirror
 *   image: onto the earliest holder, with any sibling BELOW raised.
 * - `lostReason` — onto the first unit in tag order, where the roll-up
 *   looks for it once every unit is lost.
 * - Clearing a date, or zeroing the value, applies to EVERY unit. MIN and
 *   MAX ignore nulls, so one unit left behind would resurrect its value as
 *   the deal's.
 *
 * Pure: no Prisma client, no I/O. Returns one entry per affected unit,
 * carrying only the fields that unit must change.
 */
export function planDealFieldPushDown(
  children: readonly BusinessUnitProgress[],
  stageSortOrder: ReadonlyMap<string, number>,
  tagOrder: readonly string[],
  patch: DealFieldPatch,
  options: PushDownOptions = {},
): BusinessUnitPatch[] {
  if (children.length === 0) return [];

  const tagIndex = (code: string) => {
    const i = tagOrder.indexOf(code);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };

  // Same three-key ranking as computeOpportunityRollup, so the row this
  // writes to is the row that reads back.
  const rank = (row: BusinessUnitProgress) => ({
    stage: stageSortOrder.get(row.stage) ?? UNKNOWN_STAGE_ORDER,
    tag: tagIndex(row.businessUnit),
    code: row.businessUnit,
  });

  const leastAdvanced = children.reduce((best, row) => {
    const a = rank(row);
    const b = rank(best);
    if (a.stage !== b.stage) return a.stage < b.stage ? row : best;
    if (a.tag !== b.tag) return a.tag < b.tag ? row : best;
    return a.code < b.code ? row : best;
  });

  const ordered = [...children].sort((a, b) => {
    const ta = tagIndex(a.businessUnit);
    const tb = tagIndex(b.businessUnit);
    if (ta !== tb) return ta - tb;
    return a.businessUnit < b.businessUnit ? -1 : 1;
  });

  const patches = new Map<string, BusinessUnitPatch["data"]>();
  const put = (code: string, data: BusinessUnitPatch["data"]) => {
    patches.set(code, { ...patches.get(code), ...data });
  };

  // A whole-deal settle (closeLost / reopen) moves every unit; an ordinary
  // edit moves only the one the deal reports.
  const stageTargets = options.stageAppliesToEveryUnit
    ? children.map((row) => row.businessUnit)
    : [leastAdvanced.businessUnit];

  if (patch.stage !== undefined) {
    for (const code of stageTargets) put(code, { stage: patch.stage });
  }
  if (patch.probability !== undefined) {
    for (const code of stageTargets) {
      put(code, { probability: patch.probability });
    }
  }
  if (patch.probabilityCustom !== undefined) {
    for (const code of stageTargets) {
      put(code, { probabilityCustom: patch.probabilityCustom });
    }
  }

  if (patch.value !== undefined) {
    const target = patch.value;
    const currentSum = children.reduce(
      (sum, row) => sum.add(row.value),
      new Prisma.Decimal(0),
    );

    if (target.isZero() || currentSum.isZero()) {
      // No ratio to preserve. Zeroing hits every unit; otherwise fall back
      // to the backfill's rule — whole value on the first tag — rather
      // than inventing an even split nobody asked for.
      ordered.forEach((row, index) => {
        put(row.businessUnit, {
          value: index === 0 ? target : new Prisma.Decimal(0),
        });
      });
    } else {
      let allocated = new Prisma.Decimal(0);
      ordered.forEach((row, index) => {
        const isLast = index === ordered.length - 1;
        // The last unit absorbs the rounding remainder, so the units sum
        // to the submitted total to the cent instead of drifting.
        const share = isLast
          ? target.sub(allocated)
          : row.value.div(currentSum).mul(target).toDecimalPlaces(VALUE_SCALE);
        allocated = allocated.add(share);
        put(row.businessUnit, { value: share });
      });
    }
  }

  const pushDate = (
    field: "closeDate" | "launchDate" | "revenueLaunchDate",
    next: Date | null | undefined,
    aggregate: "max" | "min",
  ) => {
    if (next === undefined) return;

    if (next === null) {
      for (const row of children) {
        if (row[field] !== null) put(row.businessUnit, { [field]: null });
      }
      return;
    }

    const held = children.filter(
      (row): row is BusinessUnitProgress & { [K in typeof field]: Date } =>
        row[field] !== null,
    );
    if (held.length === 0) {
      put(leastAdvanced.businessUnit, { [field]: next });
      return;
    }

    const holder = held.reduce((best, row) =>
      aggregate === "max"
        ? row[field].getTime() > best[field].getTime()
          ? row
          : best
        : row[field].getTime() < best[field].getTime()
          ? row
          : best,
    );
    put(holder.businessUnit, { [field]: next });

    // Anything on the far side of the new date would keep defining the
    // aggregate, so the edit would not take. Pull those to the new date.
    for (const row of held) {
      if (row.businessUnit === holder.businessUnit) continue;
      const beyond =
        aggregate === "max"
          ? row[field].getTime() > next.getTime()
          : row[field].getTime() < next.getTime();
      if (beyond) put(row.businessUnit, { [field]: next });
    }
  };

  pushDate("closeDate", patch.closeDate, "max");
  pushDate("launchDate", patch.launchDate, "min");
  pushDate("revenueLaunchDate", patch.revenueLaunchDate, "min");

  if (patch.lostReason !== undefined) {
    if (patch.lostReason === null) {
      for (const row of children) {
        if (row.lostReason !== null) {
          put(row.businessUnit, { lostReason: null });
        }
      }
    } else {
      // Where the roll-up looks once every unit is lost. Written even when
      // the units are not all lost yet, so the reason is already in place
      // when the last one closes.
      const first =
        ordered.find((row) => row.stage === LOST_STAGE) ?? ordered[0];
      put(first.businessUnit, { lostReason: patch.lostReason });
    }
  }

  return [...patches.entries()].map(([businessUnit, data]) => ({
    businessUnit,
    data,
  }));
}
