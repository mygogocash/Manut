import type { BusinessUnitProgress } from "./opportunity-rollup";

const LOST_STAGE = "closed_lost";
const UNKNOWN_STAGE_ORDER = -1;
const VALUE_SCALE = 2;

export interface DealFieldPatch {
  stage?: string;
  probability?: number;
  probabilityCustom?: boolean;
  value?: string;
  closeDate?: string | null;
  launchDate?: string | null;
  revenueLaunchDate?: string | null;
  lostReason?: string | null;
}

export interface PushDownOptions {
  stageAppliesToEveryUnit?: boolean;
}

export interface BusinessUnitPatch {
  businessUnit: string;
  data: {
    stage?: string;
    probability?: number;
    probabilityCustom?: boolean;
    value?: string;
    closeDate?: string | null;
    launchDate?: string | null;
    revenueLaunchDate?: string | null;
    lostReason?: string | null;
  };
}

function parseDecimal(v: string): number {
  return Number(v);
}

function formatDecimal(n: number): string {
  return n.toFixed(VALUE_SCALE);
}

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

  const stageTargets = options.stageAppliesToEveryUnit
    ? children.map((row) => row.businessUnit)
    : [leastAdvanced.businessUnit];

  if (patch.stage !== undefined) {
    for (const code of stageTargets) put(code, { stage: patch.stage });
  }
  if (patch.probability !== undefined) {
    for (const code of stageTargets) put(code, { probability: patch.probability });
  }
  if (patch.probabilityCustom !== undefined) {
    for (const code of stageTargets) put(code, { probabilityCustom: patch.probabilityCustom });
  }

  if (patch.value !== undefined) {
    const target = parseDecimal(patch.value);
    const currentSum = children.reduce((sum, row) => sum + parseDecimal(row.value), 0);

    if (target === 0 || currentSum === 0) {
      ordered.forEach((row, index) => {
        put(row.businessUnit, {
          value: index === 0 ? formatDecimal(target) : "0.00",
        });
      });
    } else {
      let allocated = 0;
      ordered.forEach((row, index) => {
        const isLast = index === ordered.length - 1;
        const share = isLast
          ? target - allocated
          : Number(((parseDecimal(row.value) / currentSum) * target).toFixed(VALUE_SCALE));
        allocated += share;
        put(row.businessUnit, { value: formatDecimal(share) });
      });
    }
  }

  const pushDate = (
    field: "closeDate" | "launchDate" | "revenueLaunchDate",
    next: string | null | undefined,
    aggregate: "max" | "min",
  ) => {
    if (next === undefined) return;

    if (next === null) {
      for (const row of children) {
        if (row[field] !== null) put(row.businessUnit, { [field]: null });
      }
      return;
    }

    const held = children.filter((row) => row[field] !== null);
    if (held.length === 0) {
      put(leastAdvanced.businessUnit, { [field]: next });
      return;
    }

    const holder = held.reduce((best, row) =>
      aggregate === "max"
        ? (row[field]! > best[field]! ? row : best)
        : row[field]! < best[field]!
          ? row
          : best,
    );
    put(holder.businessUnit, { [field]: next });

    for (const row of held) {
      if (row.businessUnit === holder.businessUnit) continue;
      const beyond = aggregate === "max" ? row[field]! > next : row[field]! < next;
      if (beyond) put(row.businessUnit, { [field]: next });
    }
  };

  pushDate("closeDate", patch.closeDate, "max");
  pushDate("launchDate", patch.launchDate, "min");
  pushDate("revenueLaunchDate", patch.revenueLaunchDate, "min");

  if (patch.lostReason !== undefined) {
    if (patch.lostReason === null) {
      for (const row of children) {
        if (row.lostReason !== null) put(row.businessUnit, { lostReason: null });
      }
    } else {
      const first = ordered.find((row) => row.stage === LOST_STAGE) ?? ordered[0];
      put(first!.businessUnit, { lostReason: patch.lostReason });
    }
  }

  return [...patches.entries()].map(([businessUnit, data]) => ({ businessUnit, data }));
}
