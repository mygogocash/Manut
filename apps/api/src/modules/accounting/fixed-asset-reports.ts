/**
 * Fixed Asset reports — pure roll-up builders (no DB, no engine).
 *
 * The service computes each asset's depreciation figures with the depreciation
 * engine as at the report date, then feeds plain numbers here for grouping,
 * sub-totals and the statutory "asset using / not using" splits. Keeping these
 * pure makes them unit-testable and keeps every total server-side over the FULL
 * set (never a paginated page — CLAUDE.md paginated-aggregate rule).
 */

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const sum = (xs: number[]) => round2(xs.reduce((s, x) => s + x, 0));

// active / idle / pending_disposal = "asset using"; the rest = "not using".
export const USING_STATUSES = new Set(["active", "idle", "pending_disposal"]);

export interface RegisterLine {
  assetNo: string;
  name: string;
  categoryCode: string;
  status: string;
  quantity: number;
  cost: number;
  accumulatedDepreciation: number;
  netBookValue: number;
}

export interface RegisterTotals {
  cost: number;
  accumulatedDepreciation: number;
  netBookValue: number;
}

export interface RegisterGroup {
  categoryCode: string;
  rows: RegisterLine[];
  subtotal: RegisterTotals;
}

const totalsOf = (rows: RegisterLine[]): RegisterTotals => ({
  cost: sum(rows.map((r) => r.cost)),
  accumulatedDepreciation: sum(rows.map((r) => r.accumulatedDepreciation)),
  netBookValue: sum(rows.map((r) => r.netBookValue)),
});

/**
 * Fixed Asset Report: rows grouped by category (with sub-totals), then the
 * "Total asset using" / "Total asset not using" bands and a grand total.
 */
export function buildFixedAssetRegisterReport(lines: RegisterLine[]): {
  groups: RegisterGroup[];
  usingTotal: RegisterTotals;
  notUsingTotal: RegisterTotals;
  grandTotal: RegisterTotals;
} {
  const byCategory = new Map<string, RegisterLine[]>();
  for (const line of lines) {
    const list = byCategory.get(line.categoryCode) ?? [];
    list.push(line);
    byCategory.set(line.categoryCode, list);
  }
  const groups: RegisterGroup[] = [...byCategory.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((categoryCode) => {
      const rows = byCategory
        .get(categoryCode)!
        .slice()
        .sort((a, b) => a.assetNo.localeCompare(b.assetNo));
      return { categoryCode, rows, subtotal: totalsOf(rows) };
    });

  return {
    groups,
    usingTotal: totalsOf(lines.filter((l) => USING_STATUSES.has(l.status))),
    notUsingTotal: totalsOf(lines.filter((l) => !USING_STATUSES.has(l.status))),
    grandTotal: totalsOf(lines),
  };
}

export interface ScheduleLine {
  assetNo: string;
  name: string;
  categoryCode: string;
  openingNbv: number;
  depreciation: number;
  closingNbv: number;
}

export interface ScheduleTotals {
  openingNbv: number;
  depreciation: number;
  closingNbv: number;
}

/**
 * Monthly depreciation schedule: opening NBV, depreciation for the period and
 * closing NBV per asset, with per-category sub-totals + a grand total. The
 * period's total depreciation is what the accountant posts manually (Phase 1).
 */
export function buildDepreciationSchedule(lines: ScheduleLine[]): {
  groups: {
    categoryCode: string;
    rows: ScheduleLine[];
    subtotal: ScheduleTotals;
  }[];
  total: ScheduleTotals;
} {
  const scheduleTotals = (rows: ScheduleLine[]): ScheduleTotals => ({
    openingNbv: sum(rows.map((r) => r.openingNbv)),
    depreciation: sum(rows.map((r) => r.depreciation)),
    closingNbv: sum(rows.map((r) => r.closingNbv)),
  });
  const byCategory = new Map<string, ScheduleLine[]>();
  for (const line of lines) {
    const list = byCategory.get(line.categoryCode) ?? [];
    list.push(line);
    byCategory.set(line.categoryCode, list);
  }
  const groups = [...byCategory.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((categoryCode) => {
      const rows = byCategory
        .get(categoryCode)!
        .slice()
        .sort((a, b) => a.assetNo.localeCompare(b.assetNo));
      return { categoryCode, rows, subtotal: scheduleTotals(rows) };
    });
  return { groups, total: scheduleTotals(lines) };
}

export interface DisposalLine {
  assetNo: string;
  name: string;
  disposalDate: string;
  disposalType: string;
  proceeds: number;
  nbvDisposed: number;
  gainLoss: number;
}

/** Disposal / write-off report: approved disposals in the window + totals. */
export function buildDisposalReport(lines: DisposalLine[]): {
  rows: DisposalLine[];
  total: { proceeds: number; nbvDisposed: number; gainLoss: number };
} {
  const rows = lines
    .slice()
    .sort((a, b) => a.disposalDate.localeCompare(b.disposalDate));
  return {
    rows,
    total: {
      proceeds: sum(rows.map((r) => r.proceeds)),
      nbvDisposed: sum(rows.map((r) => r.nbvDisposed)),
      gainLoss: sum(rows.map((r) => r.gainLoss)),
    },
  };
}

export interface MovementContribution {
  categoryCode: string;
  opening: number;
  additions: number;
  disposals: number;
  depreciation: number;
  closing: number;
}

export interface MovementRow {
  categoryCode: string;
  opening: number;
  additions: number;
  disposals: number;
  depreciation: number;
  closing: number;
}

/**
 * Movement (PPE note) report: opening NBV, additions (cost of assets acquired
 * in the window), disposals (NBV disposed), depreciation for the window, and
 * closing NBV — grouped by category with a grand total.
 */
export function buildMovementReport(lines: MovementContribution[]): {
  rows: MovementRow[];
  total: MovementRow;
} {
  const byCategory = new Map<string, MovementContribution[]>();
  for (const line of lines) {
    const list = byCategory.get(line.categoryCode) ?? [];
    list.push(line);
    byCategory.set(line.categoryCode, list);
  }
  const rollup = (
    categoryCode: string,
    xs: MovementContribution[],
  ): MovementRow => ({
    categoryCode,
    opening: sum(xs.map((x) => x.opening)),
    additions: sum(xs.map((x) => x.additions)),
    disposals: sum(xs.map((x) => x.disposals)),
    depreciation: sum(xs.map((x) => x.depreciation)),
    closing: sum(xs.map((x) => x.closing)),
  });
  const rows = [...byCategory.keys()]
    .sort((a, b) => a.localeCompare(b))
    .map((code) => rollup(code, byCategory.get(code)!));
  return { rows, total: rollup("", lines) };
}
