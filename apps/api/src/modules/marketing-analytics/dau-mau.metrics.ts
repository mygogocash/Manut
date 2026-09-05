// Marketing Analytics — pure metrics engine (OneWave DAU/MAU).
//
// Every exhibit the workbook computes, reimplemented as pure, deterministic
// functions over `DauPoint[]` + account config. No DB, no `Date.now()` inside
// the maths — callers pass an explicit `asOf` / `forecastDate` so results are
// reproducible and unit-testable against the workbook's known numbers.
//
// THE ONE RULE: a blank day is `dau === null`, NEVER 0. Blanks are ignored by
// every average / sum / percentage — never counted as a zero that drags a mean
// down. Percentages return `null` (not 0) on an empty/zero denominator so the
// UI renders "—".

import {
  FLAT_THRESHOLD_PCT,
  MARKETING_ANALYTICS_POLICY,
  MIN_TICKED_DAYS_FOR_UPLIFT,
  ROLLING_WINDOW_DAYS,
  TREND_LOOKBACK_DAYS,
  WEEKDAY_LOOKBACK_WEEKS,
} from "@/modules/marketing-analytics/dau-mau.constants";

// ── Inputs ──────────────────────────────────────────────────────
export interface DauPoint {
  accountKey: string;
  date: string; // YYYY-MM-DD
  dau: number | null;
  isCampaignDay: boolean;
}
export interface AccountConfig {
  key: string;
  label: string;
  accessibleMau: number | null;
  includeInEstate: boolean;
  sortOrder: number;
}
export interface CampaignRow {
  accountKey: string;
  name: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  placements: string[];
}

/// Reserved account key for the estate total.
///
/// Two things can fill it. BNII may enter its own estate series, which runs
/// LARGER than the sum of the tracked accounts — the gap is "unattributed" —
/// mirroring the workbook. When no such series arrives, the total is the sum of
/// whichever accounts the caller selected. `estateSource` on the payload says
/// which of the two a given response holds, so the page can show the upstream
/// figure alongside the selected total instead of conflating them.
///
/// Either way this key is never itself a selectable account.
export const ESTATE_KEY = "estate";

/// Row label for the estate total. Says "selected" because membership is now
/// the caller's to choose — it named Okara's exclusion when that exclusion was
/// hardcoded, which stopped being true the moment the page could pick a set.
export const TOTAL_LABEL = "TOTAL (selected accounts)";

export type Direction = "up" | "down" | "flat";

// ── Date helpers (UTC, calendar-day exact) ──────────────────────
export function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}
export function toYmd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}
export function addDays(s: string, n: number): string {
  const d = parseYmd(s);
  d.setUTCDate(d.getUTCDate() + n);
  return toYmd(d);
}
export function monthKey(s: string): string {
  return s.slice(0, 7);
}
export function daysInMonth(ym: string): number {
  const [y, m] = ym.split("-").map(Number);
  return new Date(Date.UTC(y ?? 1970, m ?? 1, 0)).getUTCDate();
}
/** Monday=0 … Sunday=6. */
export function weekdayMon0(s: string): number {
  return (parseYmd(s).getUTCDay() + 6) % 7;
}
export function mondayOf(s: string): string {
  return addDays(s, -weekdayMon0(s));
}
/** Same day-of-month one month earlier, clamped to that month's length. */
export function prevMonthSameDate(s: string): string {
  const d = parseYmd(s);
  const day = d.getUTCDate();
  const dim = daysInMonth(
    `${d.getUTCFullYear()}-${String(d.getUTCMonth()).padStart(2, "0")}`,
  );
  const target = new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, Math.min(day, dim || 28)),
  );
  return toYmd(target);
}

// ── Small numeric helpers ───────────────────────────────────────
/** Mean of the present values; null if none (never treats missing as 0). */
export function mean(values: Array<number | null | undefined>): number | null {
  const present = values.filter((v): v is number => typeof v === "number");
  if (present.length === 0) return null;
  return present.reduce((a, b) => a + b, 0) / present.length;
}
/** Sum of present values; null if none present. */
export function sum(values: Array<number | null | undefined>): number | null {
  const present = values.filter((v): v is number => typeof v === "number");
  if (present.length === 0) return null;
  return present.reduce((a, b) => a + b, 0);
}
/** Ratio a/b, or null when b is null/0 — so the UI shows "—", not 0 or ∞. */
export function ratio(a: number | null, b: number | null): number | null {
  if (a === null || b === null || b === 0) return null;
  return a / b;
}
/** Growth (curr/prev − 1), or null when prev is null/0. */
export function growth(
  curr: number | null,
  prev: number | null,
): number | null {
  if (curr === null || prev === null || prev === 0) return null;
  return curr / prev - 1;
}
export function directionOf(pct: number | null): Direction | null {
  if (pct === null) return null;
  if (Math.abs(pct) < FLAT_THRESHOLD_PCT) return "flat";
  return pct > 0 ? "up" : "down";
}

// ── Indexed view of the raw points ──────────────────────────────
export interface DauIndex {
  /** accountKey → (ymd → {dau, tick}) */
  byAccount: Map<string, Map<string, { dau: number | null; tick: boolean }>>;
  /** All calendar dates from the earliest to the latest point, ascending. */
  allDates: string[];
  minDate: string | null;
  maxDate: string | null;
}

export function buildIndex(points: DauPoint[]): DauIndex {
  const byAccount = new Map<
    string,
    Map<string, { dau: number | null; tick: boolean }>
  >();
  let min: string | null = null;
  let max: string | null = null;
  for (const p of points) {
    let m = byAccount.get(p.accountKey);
    if (!m) {
      m = new Map();
      byAccount.set(p.accountKey, m);
    }
    m.set(p.date, { dau: p.dau ?? null, tick: !!p.isCampaignDay });
    if (min === null || p.date < min) min = p.date;
    if (max === null || p.date > max) max = p.date;
  }
  const allDates: string[] = [];
  if (min && max) {
    for (let d = min; d <= max; d = addDays(d, 1)) allDates.push(d);
  }
  return { byAccount, allDates, minDate: min, maxDate: max };
}

function cell(
  idx: DauIndex,
  accountKey: string,
  date: string,
): { dau: number | null; tick: boolean } {
  return idx.byAccount.get(accountKey)?.get(date) ?? { dau: null, tick: false };
}
function dauAt(idx: DauIndex, accountKey: string, date: string): number | null {
  return cell(idx, accountKey, date).dau;
}

/**
 * Whether BNII entered its own estate series, or the total is our sum.
 *
 * Worth stating in the payload rather than inferring in the browser: the two
 * are different quantities. The upstream series counts traffic BNII does not
 * break out per telco, so it exceeds the sum of the accounts and is NOT
 * filterable by a selection. Only when this reads "reported" does it make sense
 * to show the upstream figure next to the selected total; the rest of the time
 * a second row would be permanently blank.
 */
export type EstateSource = "reported" | "sum";

export function estateSourceOf(idx: DauIndex): EstateSource {
  return idx.allDates.some((d) => dauAt(idx, ESTATE_KEY, d) !== null)
    ? "reported"
    : "sum";
}

/** The estate series for a date: the reserved `estate` row if entered, else
 *  the sum of the include-in-estate accounts (never counting blanks as 0). */
function estateDauAt(
  idx: DauIndex,
  estateAccounts: AccountConfig[],
  date: string,
): {
  value: number | null;
  sumOfAccounts: number | null;
  headline: number | null;
} {
  const headline = dauAt(idx, ESTATE_KEY, date);
  const s = sum(estateAccounts.map((a) => dauAt(idx, a.key, date)));
  return { value: headline ?? s, sumOfAccounts: s, headline };
}

// ── Exhibit: Lifetime (per account + estate) ────────────────────
export interface LifetimeRow {
  accountKey: string;
  label: string;
  totalSessions: number | null;
  averageSessions: number | null;
  peakSessions: number | null;
  peakDate: string | null;
  dauOnAsOf: number | null;
  shareOfTotal: number | null;
}

export function lifetime(
  idx: DauIndex,
  accounts: AccountConfig[],
  asOf: string,
): { rows: LifetimeRow[]; estate: LifetimeRow } {
  const estateAccounts = accounts.filter(
    (a) => a.includeInEstate && a.key !== ESTATE_KEY,
  );

  const one = (
    accountKey: string,
    label: string,
    series: string[],
  ): LifetimeRow => {
    const daus = series.map((d) => dauAt(idx, accountKey, d));
    const total = sum(daus);
    let peak: number | null = null;
    let peakDate: string | null = null;
    for (const d of series) {
      const v = dauAt(idx, accountKey, d);
      if (v !== null && (peak === null || v > peak)) {
        peak = v;
        peakDate = d;
      }
    }
    return {
      accountKey,
      label,
      totalSessions: total,
      averageSessions: mean(daus),
      peakSessions: peak,
      peakDate,
      dauOnAsOf: dauAt(idx, accountKey, asOf),
      shareOfTotal: null, // filled after estate total known
    };
  };

  const rows = accounts
    .filter((a) => a.key !== ESTATE_KEY)
    .map((a) => one(a.key, a.label, idx.allDates));

  // Estate headline lifetime: reserved series if present, else sum-of-accounts.
  const headlineTotal = sum(idx.allDates.map((d) => dauAt(idx, ESTATE_KEY, d)));
  const estatePeak = (() => {
    let peak: number | null = null;
    let peakDate: string | null = null;
    for (const d of idx.allDates) {
      const { value } = estateDauAt(idx, estateAccounts, d);
      if (value !== null && (peak === null || value > peak)) {
        peak = value;
        peakDate = d;
      }
    }
    return { peak, peakDate };
  })();
  const estateDaily = idx.allDates.map(
    (d) => estateDauAt(idx, estateAccounts, d).value,
  );
  const estateTotal = headlineTotal ?? sum(estateDaily);
  const estate: LifetimeRow = {
    accountKey: ESTATE_KEY,
    label: TOTAL_LABEL,
    totalSessions: estateTotal,
    averageSessions: mean(estateDaily),
    peakSessions: estatePeak.peak,
    peakDate: estatePeak.peakDate,
    dauOnAsOf: estateDauAt(idx, estateAccounts, asOf).value,
    shareOfTotal: estateTotal ? 1 : null,
  };

  for (const r of rows) r.shareOfTotal = ratio(r.totalSessions, estateTotal);
  return { rows, estate };
}

// ── Exhibit: Rolling 3-day (per account + estate) ───────────────
export interface RollingRow {
  accountKey: string;
  label: string;
  last3Avg: number | null;
  prior3Avg: number | null;
  change: number | null;
  pctChange: number | null;
  direction: Direction | null;
}

function windowSeries(
  getter: (date: string) => number | null,
  endDate: string,
  size: number,
): number[] {
  const out: number[] = [];
  for (let i = 0; i < size; i++) {
    const v = getter(addDays(endDate, -i));
    if (v !== null) out.push(v);
  }
  return out;
}

/**
 * The dates `windowSeries` walks for the same (endDate, size), oldest first.
 * Kept adjacent to it so the window a figure is labelled with can never drift
 * from the window it was computed over.
 */
export function windowDates(endDate: string, size: number): string[] {
  return Array.from({ length: size }, (_, i) =>
    addDays(endDate, -(size - 1 - i)),
  );
}

export function rolling3Day(
  idx: DauIndex,
  accounts: AccountConfig[],
  asOf: string,
): { rows: RollingRow[]; estate: RollingRow } {
  const estateAccounts = accounts.filter(
    (a) => a.includeInEstate && a.key !== ESTATE_KEY,
  );
  const win = ROLLING_WINDOW_DAYS;

  const build = (
    accountKey: string,
    label: string,
    getter: (d: string) => number | null,
  ): RollingRow => {
    const last3 = mean(windowSeries(getter, asOf, win));
    const prior3 = mean(windowSeries(getter, addDays(asOf, -win), win));
    const change = last3 !== null && prior3 !== null ? last3 - prior3 : null;
    const pct = growth(last3, prior3);
    return {
      accountKey,
      label,
      last3Avg: last3,
      prior3Avg: prior3,
      change,
      pctChange: pct,
      direction: directionOf(pct),
    };
  };

  const rows = accounts
    .filter((a) => a.key !== ESTATE_KEY)
    .map((a) => build(a.key, a.label, (d) => dauAt(idx, a.key, d)));
  const estate = build(
    ESTATE_KEY,
    TOTAL_LABEL,
    (d) => estateDauAt(idx, estateAccounts, d).value,
  );
  return { rows, estate };
}

// ── Exhibit: Monthly MAU + capture + month-end forecast ─────────
export interface MonthlyAccountCell {
  accountKey: string;
  label: string;
  mau: number | null;
  daysEntered: number;
  capture: number | null;
  monthEndForecast: number | null;
  forecastCapture: number | null;
}
export interface MonthlyBlock {
  month: string; // YYYY-MM
  daysInMonth: number;
  accounts: MonthlyAccountCell[];
  estate: MonthlyAccountCell;
  sumOfAccounts: number | null;
  unattributed: number | null;
}

export function monthlyRollup(
  idx: DauIndex,
  accounts: AccountConfig[],
): MonthlyBlock[] {
  const estateAccounts = accounts.filter(
    (a) => a.includeInEstate && a.key !== ESTATE_KEY,
  );
  const months = Array.from(new Set(idx.allDates.map(monthKey))).sort();

  return months.map((month) => {
    const dim = daysInMonth(month);
    const monthDates = idx.allDates.filter((d) => monthKey(d) === month);

    const cellFor = (
      accountKey: string,
      label: string,
      base: number | null,
      getter: (d: string) => number | null,
    ): MonthlyAccountCell => {
      const daus = monthDates.map(getter);
      const mau = sum(daus);
      const daysEntered = daus.filter((v) => v !== null).length;
      const monthEndForecast =
        mau !== null && daysEntered > 0 ? (mau / daysEntered) * dim : null;
      return {
        accountKey,
        label,
        mau,
        daysEntered,
        capture: ratio(mau, base),
        monthEndForecast,
        forecastCapture: ratio(monthEndForecast, base),
      };
    };

    const accountCells = accounts
      .filter((a) => a.key !== ESTATE_KEY)
      .map((a) =>
        cellFor(a.key, a.label, a.accessibleMau, (d) => dauAt(idx, a.key, d)),
      );

    const estateBase =
      accounts.find((a) => a.key === ESTATE_KEY)?.accessibleMau ??
      sum(estateAccounts.map((a) => a.accessibleMau));
    const estateCell = cellFor(
      ESTATE_KEY,
      TOTAL_LABEL,
      estateBase,
      (d) => estateDauAt(idx, estateAccounts, d).value,
    );
    const sumOfAccounts = sum(
      accountCells
        .filter((c) => {
          const acc = accounts.find((a) => a.key === c.accountKey);
          return acc?.includeInEstate;
        })
        .map((c) => c.mau),
    );
    const unattributed =
      estateCell.mau !== null && sumOfAccounts !== null
        ? estateCell.mau - sumOfAccounts
        : null;

    return {
      month,
      daysInMonth: dim,
      accounts: accountCells,
      estate: estateCell,
      sumOfAccounts,
      unattributed,
    };
  });
}

// ── Exhibit: Next-day Forecast (baseline × uplift) ──────────────
export interface ForecastRow {
  accountKey: string;
  label: string;
  organicBaseline: number | null;
  tickedDays: number;
  campaignAvg: number | null;
  uplift: number;
  tickedOnForecastDate: boolean;
  forecastDau: number | null;
  basis: string;
}

export function forecast(
  idx: DauIndex,
  accounts: AccountConfig[],
  forecastDate: string,
): { rows: ForecastRow[]; estateForecast: number | null } {
  const build = (a: AccountConfig): ForecastRow => {
    const series = idx.byAccount.get(a.key);
    const unticked: number[] = [];
    const ticked: number[] = [];
    if (series) {
      for (const { dau, tick } of series.values()) {
        if (dau === null) continue;
        (tick ? ticked : unticked).push(dau);
      }
    }
    const baseline = mean(unticked);
    const campaignAvg = mean(ticked);
    const enoughTicks = ticked.length >= MIN_TICKED_DAYS_FOR_UPLIFT;
    const uplift =
      enoughTicks && baseline && campaignAvg !== null
        ? campaignAvg / baseline
        : MARKETING_ANALYTICS_POLICY.heldUplift;
    const tickedOn = cell(idx, a.key, forecastDate).tick;
    const forecastDau =
      baseline === null ? null : tickedOn ? baseline * uplift : baseline;
    const basis =
      baseline === null
        ? "no organic history"
        : !enoughTicks
          ? `too few ticked days, held at ${MARKETING_ANALYTICS_POLICY.heldUplift.toFixed(2)}x`
          : tickedOn
            ? "campaign day, baseline × uplift"
            : "organic day, baseline";
    return {
      accountKey: a.key,
      label: a.label,
      organicBaseline: baseline,
      tickedDays: ticked.length,
      campaignAvg,
      uplift,
      tickedOnForecastDate: tickedOn,
      forecastDau,
      basis,
    };
  };

  const rows = accounts.filter((a) => a.key !== ESTATE_KEY).map(build);
  // Estate forecast is the sum across the include-in-estate accounts (the
  // workbook's "summed across the seven"), never the headline series.
  const estateForecast = sum(
    rows
      .filter((r) => {
        const a = accounts.find((x) => x.key === r.accountKey);
        return a?.includeInEstate;
      })
      .map((r) => r.forecastDau),
  );
  return { rows, estateForecast };
}

// ── Exhibit: Weekly Growth (Mon–Sun) ────────────────────────────
export interface WeeklyAccountCell {
  accountKey: string;
  weeklyDau: number | null;
  vsPrevWeek: number | null;
  campaignDays: number;
}
export interface WeeklyRow {
  weekIndex: number;
  weekStart: string;
  weekEnd: string;
  daysEntered: number;
  accounts: WeeklyAccountCell[];
  estate: { weeklyDau: number | null; vsPrevWeek: number | null };
  campaignAccountDays: number;
  accountsRunning: number;
  whichAccounts: string[];
}

export function weeklyGrowth(
  idx: DauIndex,
  accounts: AccountConfig[],
): WeeklyRow[] {
  if (!idx.minDate || !idx.maxDate) return [];
  const estateAccounts = accounts.filter(
    (a) => a.includeInEstate && a.key !== ESTATE_KEY,
  );
  const trackAccounts = accounts.filter((a) => a.key !== ESTATE_KEY);

  const firstMon = mondayOf(idx.minDate);
  const weeks: string[] = [];
  for (let w = firstMon; w <= idx.maxDate; w = addDays(w, 7)) weeks.push(w);

  const prevWeekTotalFor = new Map<string, number | null>();
  let prevEstate: number | null = null;

  return weeks.map((weekStart, i) => {
    const weekEnd = addDays(weekStart, 6);
    const weekDates = idx.allDates.filter(
      (d) => d >= weekStart && d <= weekEnd,
    );
    const daysEntered = weekDates.filter((d) =>
      trackAccounts.some((a) => dauAt(idx, a.key, d) !== null),
    ).length;

    const accountCells: WeeklyAccountCell[] = trackAccounts.map((a) => {
      const weeklyDau = sum(weekDates.map((d) => dauAt(idx, a.key, d)));
      const prev = prevWeekTotalFor.get(a.key) ?? null;
      prevWeekTotalFor.set(a.key, weeklyDau);
      const campaignDays = weekDates.filter(
        (d) => cell(idx, a.key, d).tick,
      ).length;
      return {
        accountKey: a.key,
        weeklyDau,
        vsPrevWeek: growth(weeklyDau, prev),
        campaignDays,
      };
    });

    const estateWeekly = (() => {
      const headline = sum(weekDates.map((d) => dauAt(idx, ESTATE_KEY, d)));
      const s = sum(
        weekDates.map((d) => estateDauAt(idx, estateAccounts, d).value),
      );
      return headline ?? s;
    })();
    const estateVs = growth(estateWeekly, prevEstate);
    prevEstate = estateWeekly;

    const running = trackAccounts.filter((a) =>
      weekDates.some((d) => cell(idx, a.key, d).tick),
    );

    return {
      weekIndex: i + 1,
      weekStart,
      weekEnd,
      daysEntered,
      accounts: accountCells,
      estate: { weeklyDau: estateWeekly, vsPrevWeek: estateVs },
      campaignAccountDays: accountCells.reduce((n, c) => n + c.campaignDays, 0),
      accountsRunning: running.length,
      whichAccounts: running.map((a) => a.label),
    };
  });
}

// ── Exhibit: per-date explorer + 3-day trends + charts ──────────
export interface ExplorerRow {
  date: string;
  weekday: string;
  dau: number | null;
  dayOnDay: number | null;
  threeDayAvg: number | null;
  threeDayVsPrior: number | null;
  vsSameWeekday: number | null; // 4 weeks back
  isCampaignDay: boolean;
  organic: number | null; // dau when NOT a campaign day
  campaign: number | null; // dau when a campaign day
  campaignsThatDay: string[];
  placementsThatDay: string[];
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function explorer(
  idx: DauIndex,
  accountKey: string,
  campaigns: CampaignRow[],
  opts: { estateAccounts?: AccountConfig[] } = {},
): ExplorerRow[] {
  const isEstate = accountKey === ESTATE_KEY;
  const getter = (d: string): number | null =>
    isEstate && opts.estateAccounts
      ? estateDauAt(idx, opts.estateAccounts, d).value
      : dauAt(idx, accountKey, d);

  const campaignsFor = (d: string) =>
    campaigns.filter(
      (c) =>
        (isEstate || c.accountKey === accountKey) &&
        d >= c.startDate &&
        d <= c.endDate,
    );

  return idx.allDates.map((d) => {
    const dau = getter(d);
    const prev = getter(addDays(d, -1));
    const window = windowSeries(getter, d, ROLLING_WINDOW_DAYS);
    const threeDay =
      window.length === ROLLING_WINDOW_DAYS ? mean(window) : null;
    const priorWindow = windowSeries(
      getter,
      addDays(d, -ROLLING_WINDOW_DAYS),
      ROLLING_WINDOW_DAYS,
    );
    const priorThree =
      priorWindow.length === ROLLING_WINDOW_DAYS ? mean(priorWindow) : null;
    const sameWeekday = getter(addDays(d, -7 * WEEKDAY_LOOKBACK_WEEKS));
    const tick = isEstate
      ? campaignsFor(d).length > 0
      : cell(idx, accountKey, d).tick;
    const runs = campaignsFor(d);
    return {
      date: d,
      weekday: WEEKDAY_LABELS[weekdayMon0(d)] ?? "",
      dau,
      dayOnDay: growth(dau, prev),
      threeDayAvg: threeDay,
      threeDayVsPrior: growth(threeDay, priorThree),
      vsSameWeekday: growth(dau, sameWeekday),
      isCampaignDay: tick,
      organic: tick ? null : dau,
      campaign: tick ? dau : null,
      campaignsThatDay: runs.map((c) => c.name),
      placementsThatDay: Array.from(new Set(runs.flatMap((c) => c.placements))),
    };
  });
}

export interface TrendRow {
  date: string;
  weekday: string;
  threeDayAvg: number | null;
  vs28DaysBack: number | null;
  vsPrevMonthSameDate: number | null;
  /**
   * The dates each figure was actually computed from, oldest first, so the UI
   * can name them on hover. Emitted by the server rather than re-derived in
   * the browser: `prevMonthSameDate` clamps to the shorter month, and a
   * tooltip that disagrees with the number beside it is worse than none.
   * Present even when the matching value is null — the window is still
   * defined, the data inside it may not be.
   */
  threeDayWindow: string[];
  /** End date of the 3-day window `vs28DaysBack` compares against. */
  vs28DaysBackDate: string;
  /** End date of the 3-day window `vsPrevMonthSameDate` compares against. */
  vsPrevMonthDate: string;
}

export function trends(
  idx: DauIndex,
  accountKey: string,
  estateAccounts?: AccountConfig[],
): TrendRow[] {
  const isEstate = accountKey === ESTATE_KEY;
  const getter = (d: string): number | null =>
    isEstate && estateAccounts
      ? estateDauAt(idx, estateAccounts, d).value
      : dauAt(idx, accountKey, d);
  const threeDayAt = (d: string): number | null => {
    const w = windowSeries(getter, d, ROLLING_WINDOW_DAYS);
    return w.length === ROLLING_WINDOW_DAYS ? mean(w) : null;
  };
  return idx.allDates.map((d) => {
    const now = threeDayAt(d);
    const back = addDays(d, -TREND_LOOKBACK_DAYS);
    const prevMonth = prevMonthSameDate(d);
    return {
      date: d,
      weekday: WEEKDAY_LABELS[weekdayMon0(d)] ?? "",
      threeDayAvg: now,
      vs28DaysBack: growth(now, threeDayAt(back)),
      vsPrevMonthSameDate: growth(now, threeDayAt(prevMonth)),
      threeDayWindow: windowDates(d, ROLLING_WINDOW_DAYS),
      vs28DaysBackDate: back,
      vsPrevMonthDate: prevMonth,
    };
  });
}

// ── Campaign Index (from the campaigns table) ───────────────────
export interface CampaignIndexRow {
  accountKey: string;
  name: string;
  startDate: string;
  endDate: string;
  tickedDays: number;
  placements: string[];
}

export function campaignIndex(
  idx: DauIndex,
  campaigns: CampaignRow[],
): CampaignIndexRow[] {
  return campaigns
    .map((c) => {
      let ticked = 0;
      for (let d = c.startDate; d <= c.endDate; d = addDays(d, 1)) {
        if (cell(idx, c.accountKey, d).tick) ticked++;
      }
      return {
        accountKey: c.accountKey,
        name: c.name,
        startDate: c.startDate,
        endDate: c.endDate,
        tickedDays: ticked,
        placements: c.placements,
      };
    })
    .sort((a, b) =>
      a.accountKey === b.accountKey
        ? a.startDate.localeCompare(b.startDate)
        : a.accountKey.localeCompare(b.accountKey),
    );
}

// ── Top-level assembler ─────────────────────────────────────────
export interface DashboardInput {
  points: DauPoint[];
  accounts: AccountConfig[];
  campaigns: CampaignRow[];
  /** Defaults to the latest entered date. */
  asOf?: string | null;
  /** Defaults to the day after `asOf`. */
  forecastDate?: string | null;
}

export function computeDashboard(input: DashboardInput) {
  const idx = buildIndex(input.points);
  const accounts = [...input.accounts].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const estateAccounts = accounts.filter(
    (a) => a.includeInEstate && a.key !== ESTATE_KEY,
  );
  const asOf = input.asOf ?? idx.maxDate ?? toYmd(new Date());
  const forecastDate = input.forecastDate ?? addDays(asOf, 1);

  const perAccountExplorer: Record<string, ExplorerRow[]> = {};
  const perAccountTrends: Record<string, TrendRow[]> = {};
  for (const a of accounts.filter((x) => x.key !== ESTATE_KEY)) {
    perAccountExplorer[a.key] = explorer(idx, a.key, input.campaigns);
    perAccountTrends[a.key] = trends(idx, a.key);
  }
  perAccountExplorer[ESTATE_KEY] = explorer(idx, ESTATE_KEY, input.campaigns, {
    estateAccounts,
  });
  perAccountTrends[ESTATE_KEY] = trends(idx, ESTATE_KEY, estateAccounts);

  return {
    policy: MARKETING_ANALYTICS_POLICY,
    asOf,
    forecastDate,
    dateRange: { min: idx.minDate, max: idx.maxDate },
    accounts,
    estateSource: estateSourceOf(idx),
    lifetime: lifetime(idx, accounts, asOf),
    rolling3Day: rolling3Day(idx, accounts, asOf),
    monthly: monthlyRollup(idx, accounts),
    forecast: forecast(idx, accounts, forecastDate),
    weekly: weeklyGrowth(idx, accounts),
    explorer: perAccountExplorer,
    trends: perAccountTrends,
    campaignIndex: campaignIndex(idx, input.campaigns),
  };
}

export type MarketingAnalyticsDashboard = ReturnType<typeof computeDashboard>;

// ── Sessions (the "Telco Reports" headline) ─────────────────────
// Reproduces the old GA "Sessions" dashboard from the BNII metric that replaced
// it — `total_views_homepage` (BNII renamed `total_user_sessions` → this on
// 2026-06-10; Atlas surfaces it as "Total Homepage Views"). Estate = sum of the
// include-in-estate accounts. Compares a trailing window against the equal window
// before it (the "vs previous N days" overlay), and returns a day-aligned pacing
// series for a cumulative chart.
export interface SessionsPoint {
  accountKey: string;
  date: string;
  sessions: number | null;
}
export interface SessionsPacing {
  date: string;
  current: number | null;
  previous: number | null;
}
export interface SessionsByTelco {
  accountKey: string;
  label: string;
  total: number | null;
  previousTotal: number | null;
  pctChange: number | null;
  /**
   * The same day-aligned series as the estate `pacing`, for this account alone.
   *
   * The daily per-account points are already in hand here — the estate figures
   * are summed FROM them — so shipping a per-account series costs one more pass
   * over data already fetched, not another BNII query. Without it the
   * dashboard's Account selector can narrow every figure on the page except
   * the pacing chart, which would keep drawing the estate under a telco's name.
   */
  pacing: SessionsPacing[];
}
export interface SessionsSummary {
  windowDays: number;
  asOf: string;
  total: number | null;
  previousTotal: number | null;
  pctChange: number | null;
  pacing: SessionsPacing[];
  byTelco: SessionsByTelco[];
}

/** Default exhibit length when the page is showing its own date range. */
export const DEFAULT_SESSIONS_WINDOW_DAYS = 28;
/**
 * Longest picked range we will still fetch a comparison pre-roll for. Beyond
 * this, doubling an already-large BNII query costs more than the comparison is
 * worth, and the exhibit reports "—" instead.
 */
export const MAX_SESSIONS_COMPARISON_DAYS = 180;

/**
 * How many days the Sessions exhibit covers, and how far back the fetch has to
 * reach so "vs previous N" has something to read.
 *
 * The exhibit used to be pinned to 28 days ending at the last fetched date, so
 * the page's date picker changed only WHAT WAS FETCHED and never the figure's
 * window. Picking 1–16 Aug still produced a card titled "last 28 days" holding
 * the sum of whichever 16 of those days existed, and no comparison at all,
 * because the prior 28 days were never fetched. Neither half announced itself:
 * `sum` skips absent days rather than failing, so a half-loaded window returns
 * a clean, plausible, wrongly-labelled number.
 *
 * With no picked range the default 28-day exhibit is unchanged — the default
 * 120-day fetch already reaches far enough back to compare against. With a
 * picked range the window becomes that range and the fetch is extended one
 * window further back.
 *
 * Past `maxComparisonDays` the pre-roll is dropped rather than doubling a large
 * query. The comparison then reads "—", which is the honest answer, instead of
 * a total quietly summed from a partly-loaded window.
 */
export function resolveSessionsWindow(input: {
  /** `dateFrom` exactly as the caller supplied it; absent = no range picked. */
  requestedFrom?: string | null;
  /** The range actually being shown, after defaults are applied. */
  dateFrom: string;
  dateTo: string;
  defaultWindowDays?: number;
  maxComparisonDays?: number;
}): { windowDays: number; fetchFrom: string; extended: boolean } {
  const defaultWindowDays =
    input.defaultWindowDays ?? DEFAULT_SESSIONS_WINDOW_DAYS;
  const maxComparisonDays =
    input.maxComparisonDays ?? MAX_SESSIONS_COMPARISON_DAYS;

  if (!input.requestedFrom) {
    return {
      windowDays: defaultWindowDays,
      fetchFrom: input.dateFrom,
      extended: false,
    };
  }

  const span =
    Math.round(
      (parseYmd(input.dateTo).getTime() - parseYmd(input.dateFrom).getTime()) /
        86_400_000,
    ) + 1;
  const windowDays = Math.max(1, span);

  if (windowDays > maxComparisonDays) {
    return { windowDays, fetchFrom: input.dateFrom, extended: false };
  }
  return {
    windowDays,
    fetchFrom: addDays(input.dateFrom, -windowDays),
    extended: true,
  };
}

export function computeSessions(
  points: SessionsPoint[],
  accounts: AccountConfig[],
  asOf: string,
  windowDays = DEFAULT_SESSIONS_WINDOW_DAYS,
): SessionsSummary {
  const byAccount = new Map<string, Map<string, number | null>>();
  for (const p of points) {
    let m = byAccount.get(p.accountKey);
    if (!m) {
      m = new Map();
      byAccount.set(p.accountKey, m);
    }
    m.set(p.date, p.sessions ?? null);
  }
  const estateAccounts = accounts.filter(
    (a) => a.includeInEstate && a.key !== ESTATE_KEY,
  );
  const at = (accountKey: string, date: string): number | null =>
    byAccount.get(accountKey)?.get(date) ?? null;
  const estateAt = (date: string): number | null =>
    sum(estateAccounts.map((a) => at(a.key, date)));

  const windowSum = (
    getter: (d: string) => number | null,
    endDate: string,
  ): number | null =>
    sum(
      Array.from({ length: windowDays }, (_, i) =>
        getter(addDays(endDate, -i)),
      ),
    );

  const priorEnd = addDays(asOf, -windowDays);
  const total = windowSum(estateAt, asOf);
  const previousTotal = windowSum(estateAt, priorEnd);

  const pacingFor = (
    getter: (d: string) => number | null,
  ): SessionsPacing[] => {
    const series: SessionsPacing[] = [];
    for (let i = windowDays - 1; i >= 0; i--) {
      const d = addDays(asOf, -i);
      series.push({
        date: d,
        current: getter(d),
        previous: getter(addDays(d, -windowDays)),
      });
    }
    return series;
  };
  const pacing = pacingFor(estateAt);

  const byTelco: SessionsByTelco[] = accounts
    .filter((a) => a.key !== ESTATE_KEY)
    .map((a) => {
      const t = windowSum((d) => at(a.key, d), asOf);
      const p = windowSum((d) => at(a.key, d), priorEnd);
      return {
        accountKey: a.key,
        label: a.label,
        total: t,
        previousTotal: p,
        pctChange: growth(t, p),
        pacing: pacingFor((d) => at(a.key, d)),
      };
    });

  return {
    windowDays,
    asOf,
    total,
    previousTotal,
    pctChange: growth(total, previousTotal),
    pacing,
    byTelco,
  };
}
