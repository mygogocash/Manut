// Vesting math shared by the ESOP pool summary and the per-employee
// breakdown. Sheet-aligned (see Shahab's Equity Summary Report):
//   Grand Total          = Σ all shares
//   Vested               = Σ shares of instruments with NO vesting schedule
//   Vesting              = Σ full shares of scheduled instruments
//   Total Vesting to date = Σ vested-so-far of the scheduled instruments
// A grant is "scheduled" when it has a vesting period; otherwise it is
// immediate (owned outright, counts as Vested).

export interface VestingGrant {
  shares: number;
  grantDate: Date;
  vestingMonths: number | null;
  cliffMonths: number | null;
  allocationStartMonth?: Date | null;
  // When set, this pins "vested so far" for a scheduled grant instead of
  // the linear computation (HR's spreadsheet sometimes shows a figure the
  // formula can't reproduce). Ignored for outright grants.
  vestedToDateOverride?: number | null;
}

export function isScheduled(g: { vestingMonths: number | null }): boolean {
  return (g.vestingMonths ?? 0) > 0;
}

// Whole months between two dates (UTC so a @db.Date doesn't drift across
// timezones). A partial month doesn't count yet.
export function monthsElapsed(from: Date, to: Date): number {
  let m =
    (to.getUTCFullYear() - from.getUTCFullYear()) * 12 +
    (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) m -= 1;
  return Math.max(0, m);
}

// Shares vested as of `now`. Immediate grants (no vesting period) are fully
// vested. Scheduled grants vest linearly by whole months from the vesting
// start (allocationStartMonth ?? grantDate), nothing before the cliff,
// capped at the full grant. Rounded up to match the reference sheet.
export function vestedSharesToDate(g: VestingGrant, now: Date): number {
  if (g.shares <= 0) return 0;
  const vm = g.vestingMonths ?? 0;
  if (vm <= 0) return g.shares;
  const start = g.allocationStartMonth ?? g.grantDate;
  const elapsed = monthsElapsed(start, now);
  if (elapsed < (g.cliffMonths ?? 0)) return 0;
  return Math.ceil(g.shares * (Math.min(elapsed, vm) / vm));
}

// Months a vesting schedule spans, counted INCLUSIVELY from the start
// month to the end month: Jan-25 → Dec-27 = 36 (not 35), matching the
// Equity Summary Report. Same month — or end before start — means there
// is no schedule (0), i.e. granted outright / immediately vested.
export function monthsBetweenInclusive(start: Date, end: Date): number {
  const diff =
    (end.getUTCFullYear() - start.getUTCFullYear()) * 12 +
    (end.getUTCMonth() - start.getUTCMonth());
  return diff <= 0 ? 0 : diff + 1;
}

// The vested-so-far figure shown per row and summed into the pool KPI.
// A manual override wins for scheduled grants; otherwise scheduled grants
// vest linearly and outright grants count their full share total.
export function effectiveVestedToDate(g: VestingGrant, now: Date): number {
  if (!isScheduled(g)) return g.shares;
  return g.vestedToDateOverride ?? vestedSharesToDate(g, now);
}

export interface EsopRollup {
  grandTotal: number;
  vesting: number;
  vested: number;
  vestedToDate: number;
}

// Roll a set of grants into the four sheet-aligned KPIs.
export function rollupGrants(grants: VestingGrant[], now: Date): EsopRollup {
  const r: EsopRollup = {
    grandTotal: 0,
    vesting: 0,
    vested: 0,
    vestedToDate: 0,
  };
  for (const g of grants) {
    r.grandTotal += g.shares;
    if (isScheduled(g)) {
      r.vesting += g.shares;
      r.vestedToDate += effectiveVestedToDate(g, now);
    } else {
      r.vested += g.shares;
    }
  }
  return r;
}
