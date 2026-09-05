/**
 * Monthly spend series for IT subscriptions.
 *
 * Pure — no Prisma import, no clock read (callers pass `today`), so the whole
 * engine is unit-testable without mocks. Everything the module needs arrives as
 * plain values; the service coerces Prisma `Decimal`s to numbers at the
 * boundary.
 *
 * ── Why this is computed in memory and not in SQL ──
 *
 * The repo's one existing month roll-up (`it-crm.service.ts`) uses raw
 * `date_trunc('month', …)` with a `GROUP BY`. That shape does not apply here.
 * `date_trunc` buckets a row by ITS OWN date; a subscription instead has to be
 * spread across EVERY month it was live — one row contributes to many months —
 * and no `GROUP BY` can express that. The in-memory `Map` accumulator in
 * `marketing-reports.service.ts` is the right precedent.
 *
 * ── The model this reports ──
 *
 * "Committed run-rate": each subscription's monthly-equivalent charge, placed in
 * every month between its start and its end. It is deliberately NOT cash — an
 * annual invoice of 12,000 reads as 1,000 in each of twelve months rather than
 * one spike. That is the right basis for "is our spend going up or down", which
 * is the question this surface answers. Actual per-invoice cash lives in
 * `it_billing_records` and is not read here.
 */

/**
 * A calendar month as `"YYYY-MM"`.
 *
 * Zero-padded on purpose: lexicographic string order is therefore identical to
 * chronological order, which is what lets every window check below use a plain
 * `<` / `>` instead of parsing back to dates.
 */
export type MonthKey = string;

/** Trailing months a series covers when the caller does not say. */
export const DEFAULT_WINDOW_MONTHS = 12;

/**
 * Hard cap on window length. Guards the response size: without it a bad `from`
 * param builds a series of hundreds of points, each carrying its own movement
 * arrays.
 */
export const MAX_WINDOW_MONTHS = 36;

const MONTH_KEY_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])$/;

/**
 * Literal month names rather than `Intl.DateTimeFormat`, so a label does not
 * silently change with the server's locale — the label is part of the API
 * payload and is asserted in tests.
 */
const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

/**
 * One subscription, flattened for the series.
 *
 * A plain shape rather than the Prisma payload type so tests can build cases as
 * object literals, and so `invoiceAmount` is a number here instead of a
 * `Decimal` that would need coercing at every use.
 */
export interface MonthlySubscription {
  id: string;
  productName: string;
  vendorId: string;
  vendorName: string;
  category: string;
  currency: string;
  invoiceAmount: number;
  billingFrequency: string;
  status: string;
  contractStartDate: Date | null;
  renewalDate: Date | null;
  cancelledAt: Date | null;
  renewalDecision: string | null;
  renewalDecisionAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** A subscription named as the cause of a month-on-month movement. */
export interface MovementRow {
  id: string;
  productName: string;
  vendorName: string;
  category: string;
  /** Monthly-equivalent this row carried in the month it moved. */
  monthlyAmount: number;
  /**
   * A one-time purchase, not a recurring subscription. The UI must say so: a
   * one-time charge appearing in `ended` is a purchase completing, not a
   * cancellation, and reporting it as a cancellation invents a saving.
   */
  isOneTime: boolean;
}

export interface MonthPoint {
  month: MonthKey;
  /** `"Aug 2026"` — for chart axes and group headers. */
  label: string;
  total: number;
  /** Subscriptions in force this month. */
  activeCount: number;
  /** Null on the first point of the window — there is nothing to compare to. */
  deltaVsPrevious: number | null;
  /** Rows whose first charged month this is. */
  started: MovementRow[];
  /** Rows whose last charged month this is — why next month falls. */
  ended: MovementRow[];
}

export interface MonthlySeries {
  currency: string;
  from: MonthKey;
  to: MonthKey;
  points: MonthPoint[];
  /**
   * Every currency present in the data, not just the one reported. The UI needs
   * it to decide whether to render a currency selector at all.
   */
  currenciesPresent: string[];
}

export interface MonthDetailRow extends MovementRow {
  billingFrequency: string;
  /** Amount as actually invoiced, before any monthly amortisation. */
  invoiceAmount: number;
  status: string;
  startedThisMonth: boolean;
  endedThisMonth: boolean;
  contractStartDate: string | null;
  renewalDate: string | null;
  cancelledAt: string | null;
}

export interface MonthDetail {
  month: MonthKey;
  label: string;
  currency: string;
  total: number;
  rows: MonthDetailRow[];
}

export interface SeriesSummary {
  currency: string;
  /** Committed spend in the last month of the window. */
  currentMonthlySpend: number;
  /**
   * First-to-last change across the window. Negative means spend has fallen —
   * the headline number for "is the cancellation programme working".
   */
  changeOverWindow: number;
  activeCount: number;
  monthlyRunRateRemoved: number;
  cumulativeAvoided: number;
  endedCount: number;
}

export interface RealisedSavings {
  currency: string;
  /** Recurring monthly cost removed by everything that ended in the window. */
  monthlyRunRateRemoved: number;
  /**
   * Spend avoided by those endings, from the month after each stopped through
   * the end of the window. What the cancellations have actually saved so far.
   */
  cumulativeAvoided: number;
  endedCount: number;
  ended: Array<MovementRow & { lastChargedMonth: MonthKey }>;
}

// ─────────────────────────── month-key arithmetic ───────────────────────────

export function isMonthKey(value: string): boolean {
  return MONTH_KEY_PATTERN.test(value);
}

function splitMonthKey(key: MonthKey): [number, number] {
  const [year, month] = key.split("-");
  return [Number(year), Number(month)];
}

function formatMonthKey(year: number, month: number): MonthKey {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}`;
}

/**
 * The calendar month a date falls in, **in UTC**.
 *
 * `contract_start_date`, `renewal_date` and `cancelled_at` are Postgres `DATE`
 * columns, which Prisma hands back as UTC midnight. Reading them with local
 * getters puts a row dated the 1st into the PREVIOUS month for any server west
 * of UTC — a whole month of spend attributed to the wrong month, and only
 * visible to some deployments.
 */
export function monthKey(date: Date): MonthKey {
  return formatMonthKey(date.getUTCFullYear(), date.getUTCMonth() + 1);
}

export function addMonths(key: MonthKey, delta: number): MonthKey {
  const [year, month] = splitMonthKey(key);
  // Work in absolute month count so December→January carries the year without
  // a special case.
  const absolute = year * 12 + (month - 1) + delta;
  const nextYear = Math.floor(absolute / 12);
  return formatMonthKey(nextYear, absolute - nextYear * 12 + 1);
}

/** Months from `from` to `to`; negative when `to` precedes `from`. */
export function monthDistance(from: MonthKey, to: MonthKey): number {
  const [fromYear, fromMonth] = splitMonthKey(from);
  const [toYear, toMonth] = splitMonthKey(to);
  return toYear * 12 + toMonth - (fromYear * 12 + fromMonth);
}

/** Inclusive list of months from `from` to `to`; empty if `to` precedes `from`. */
export function monthRange(from: MonthKey, to: MonthKey): MonthKey[] {
  const span = monthDistance(from, to);
  if (span < 0) return [];
  return Array.from({ length: span + 1 }, (_, i) => addMonths(from, i));
}

export function monthLabel(key: MonthKey): string {
  const [year, month] = splitMonthKey(key);
  return `${MONTH_NAMES[month - 1] ?? "???"} ${year}`;
}

/**
 * Resolve the requested window into a concrete, bounded month range.
 *
 * `today` is a parameter rather than a `new Date()` read so the whole engine
 * stays pure and the window logic is testable.
 */
export function resolveWindow(
  input: { from?: string; to?: string; months?: number },
  today: Date,
): { from: MonthKey; to: MonthKey } {
  const to = input.to && isMonthKey(input.to) ? input.to : monthKey(today);
  const months =
    input.months && input.months > 0 ? input.months : DEFAULT_WINDOW_MONTHS;
  let from =
    input.from && isMonthKey(input.from)
      ? input.from
      : addMonths(to, -(months - 1));

  // A reversed range is a typo, not a request for nothing — read it the way it
  // was obviously meant rather than returning an empty chart.
  if (monthDistance(from, to) < 0) from = to;

  if (monthDistance(from, to) + 1 > MAX_WINDOW_MONTHS) {
    from = addMonths(to, -(MAX_WINDOW_MONTHS - 1));
  }
  return { from, to };
}

// ───────────────────────────── per-subscription ─────────────────────────────

/**
 * Monthly-equivalent spend for an invoice given its billing frequency.
 *
 * Lives here rather than in the service because `chargeInMonth` needs it and
 * this module must not import the service (that would be circular). The service
 * re-exports it, so `it-operations.service.ts` and the existing tests keep
 * their import path.
 *
 * Returns 0 for `one-time`, which is correct for THIS function's contract —
 * there is no recurring monthly cost. Placing a one-time charge in a month is
 * `chargeInMonth`'s job, not this one's.
 */
export function toMonthlySpend(amount: number, frequency: string): number {
  switch (frequency) {
    case "annual":
      return amount / 12;
    case "quarterly":
      return amount / 3;
    case "monthly":
      return amount;
    default:
      return 0; // one-time / unknown - not a recurring monthly cost
  }
}

/** First month this subscription costs anything. */
export function startMonth(subscription: MonthlySubscription): MonthKey {
  return monthKey(subscription.contractStartDate ?? subscription.createdAt);
}

/**
 * The month the subscription's cost stops, or null while it runs on.
 *
 * `cancelledAt` when set — including when it is in the future and the row is
 * still `active`, which is a scheduled cancellation and should show as one.
 *
 * For a row already `cancelled` but with no `cancelledAt`, fall back rather than
 * give up: `renewalDate` first, because that is the paid-through date the money
 * actually followed, then the decision stamp, then `updatedAt`. This fallback is
 * what lets the migration ship without a backfill — and therefore what makes
 * staging (`db:push`, which never runs data-migration SQL) agree with prod.
 */
export function endMonth(subscription: MonthlySubscription): MonthKey | null {
  if (subscription.cancelledAt) return monthKey(subscription.cancelledAt);
  if (subscription.status !== "cancelled") return null;
  const legacy =
    subscription.renewalDate ??
    subscription.renewalDecisionAt ??
    subscription.updatedAt;
  return monthKey(legacy);
}

/**
 * Last month this subscription puts a charge in the ledger, or null if it runs
 * on indefinitely.
 *
 * Distinct from `endMonth`, which means "the month it was cancelled". A one-time
 * purchase is never cancelled but stops costing money after its single month,
 * and the trend has to show that or the following month's fall is unexplained.
 */
export function lastChargedMonth(
  subscription: MonthlySubscription,
): MonthKey | null {
  if (subscription.billingFrequency === "one-time") {
    const start = startMonth(subscription);
    const end = endMonth(subscription);
    // A one-time purchase normally charges once, in its own month, and a
    // cancellation dated at or after that month changes nothing — the money
    // was spent. But a cancellation dated BEFORE it means the purchase never
    // happened, and returning `start` unconditionally billed the full invoice
    // anyway: a 5,000 purchase starting in September, cancelled in August,
    // posted 5,000 to September and appeared in `started` AND `ended` at once.
    // Returning the earlier month lets `isLiveInMonth`'s start check exclude
    // every month, which is the correct answer of zero.
    return end !== null && end < start ? end : start;
  }
  return endMonth(subscription);
}

/** Is this subscription in force in `month`? */
export function isLiveInMonth(
  subscription: MonthlySubscription,
  month: MonthKey,
): boolean {
  if (month < startMonth(subscription)) return false;
  const last = lastChargedMonth(subscription);
  return last === null || month <= last;
}

/**
 * Rounded to 2dp deliberately, and rounded HERE rather than only on the total.
 *
 * The month group header shows a total and expands to the rows behind it. If the
 * total were `round(sum of raw)` while each row displayed `round(row)`, the two
 * could differ by cents and the header would contradict its own contents.
 * Rounding per row and summing those keeps them equal by construction.
 */
export function chargeInMonth(
  subscription: MonthlySubscription,
  month: MonthKey,
): number {
  if (!isLiveInMonth(subscription, month)) return 0;
  const raw =
    subscription.billingFrequency === "one-time"
      ? subscription.invoiceAmount
      : toMonthlySpend(
          subscription.invoiceAmount,
          subscription.billingFrequency,
        );
  return round2(raw);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function movementRow(
  subscription: MonthlySubscription,
  month: MonthKey,
): MovementRow {
  return {
    id: subscription.id,
    productName: subscription.productName,
    vendorName: subscription.vendorName,
    category: subscription.category,
    monthlyAmount: chargeInMonth(subscription, month),
    isOneTime: subscription.billingFrequency === "one-time",
  };
}

// ──────────────────────────────── the series ────────────────────────────────

/**
 * Currency to report when the caller does not pick one: the one carrying the
 * largest run-rate this month. Mirrors `primaryCurrency` in
 * `it-operations.service.ts` so the two surfaces default the same way.
 *
 * Ties break on the currency code so the choice is deterministic — otherwise the
 * default could flip between requests and the page would appear to change
 * currency on reload.
 */
export function pickPrimaryCurrency(
  subscriptions: MonthlySubscription[],
  today: Date,
): string {
  const month = monthKey(today);
  const byCurrency = new Map<string, number>();
  for (const subscription of subscriptions) {
    byCurrency.set(
      subscription.currency,
      (byCurrency.get(subscription.currency) ?? 0) +
        chargeInMonth(subscription, month),
    );
  }
  const ranked = [...byCurrency].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );
  return ranked[0]?.[0] ?? "USD";
}

function currenciesOf(subscriptions: MonthlySubscription[]): string[] {
  return [...new Set(subscriptions.map((s) => s.currency))].sort();
}

/**
 * Spend per calendar month across the window, for ONE currency.
 *
 * One currency, never a blend: the amounts are in different units and summing
 * them produces a number that is not money in any currency. Callers pick the
 * currency; `currenciesPresent` tells the UI what else is there.
 */
export function buildMonthlySeries(
  subscriptions: MonthlySubscription[],
  options: { from: MonthKey; to: MonthKey; currency: string },
): MonthlySeries {
  const scoped = subscriptions.filter((s) => s.currency === options.currency);
  const points: MonthPoint[] = [];
  let previousTotal: number | null = null;

  for (const month of monthRange(options.from, options.to)) {
    let total = 0;
    let activeCount = 0;
    const started: MovementRow[] = [];
    const ended: MovementRow[] = [];

    for (const subscription of scoped) {
      if (!isLiveInMonth(subscription, month)) continue;
      activeCount += 1;
      total = round2(total + chargeInMonth(subscription, month));
      if (startMonth(subscription) === month) {
        started.push(movementRow(subscription, month));
      }
      if (lastChargedMonth(subscription) === month) {
        ended.push(movementRow(subscription, month));
      }
    }

    points.push({
      month,
      label: monthLabel(month),
      total,
      activeCount,
      deltaVsPrevious:
        previousTotal === null ? null : round2(total - previousTotal),
      started,
      ended,
    });
    previousTotal = total;
  }

  return {
    currency: options.currency,
    from: options.from,
    to: options.to,
    points,
    currenciesPresent: currenciesOf(subscriptions),
  };
}

/**
 * The KPI band above the chart.
 *
 * Derived here rather than assembled in the service so the arithmetic is
 * covered by the same tests as the series it describes.
 */
export function summariseSeries(
  series: MonthlySeries,
  savings: RealisedSavings,
): SeriesSummary {
  const first = series.points[0];
  const last = series.points[series.points.length - 1];
  return {
    currency: series.currency,
    currentMonthlySpend: last?.total ?? 0,
    changeOverWindow: first && last ? round2(last.total - first.total) : 0,
    activeCount: last?.activeCount ?? 0,
    monthlyRunRateRemoved: savings.monthlyRunRateRemoved,
    cumulativeAvoided: savings.cumulativeAvoided,
    endedCount: savings.endedCount,
  };
}

/**
 * The line items live in one month.
 *
 * Returned whole, not paginated: this is what a month group expands to, and a
 * subtotal computed from one page of rows would be wrong. One month of
 * subscriptions is a small set.
 */
export function buildMonthDetail(
  subscriptions: MonthlySubscription[],
  month: MonthKey,
  currency: string,
): MonthDetail {
  const rows: MonthDetailRow[] = [];
  let total = 0;

  for (const subscription of subscriptions) {
    if (subscription.currency !== currency) continue;
    if (!isLiveInMonth(subscription, month)) continue;
    const amount = chargeInMonth(subscription, month);
    total = round2(total + amount);
    rows.push({
      ...movementRow(subscription, month),
      billingFrequency: subscription.billingFrequency,
      invoiceAmount: subscription.invoiceAmount,
      status: subscription.status,
      startedThisMonth: startMonth(subscription) === month,
      endedThisMonth: lastChargedMonth(subscription) === month,
      contractStartDate: isoDate(subscription.contractStartDate),
      renewalDate: isoDate(subscription.renewalDate),
      cancelledAt: isoDate(subscription.cancelledAt),
    });
  }

  rows.sort(
    (a, b) =>
      b.monthlyAmount - a.monthlyAmount ||
      a.productName.localeCompare(b.productName),
  );

  return { month, label: monthLabel(month), currency, total, rows };
}

function isoDate(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

/**
 * What the cancellations in this window have actually saved.
 *
 * One-time purchases are excluded on purpose. A one-time charge stops appearing
 * after its month, but it was never going to recur — counting it as a saving
 * would credit the cancellation programme with money it never avoided.
 */
export function realisedSavings(
  subscriptions: MonthlySubscription[],
  options: { from: MonthKey; to: MonthKey; currency: string; today: MonthKey },
): RealisedSavings {
  const ended: RealisedSavings["ended"] = [];
  let monthlyRunRateRemoved = 0;
  let cumulativeAvoided = 0;

  for (const subscription of subscriptions) {
    if (subscription.currency !== options.currency) continue;
    if (subscription.billingFrequency === "one-time") continue;
    const last = lastChargedMonth(subscription);
    if (last === null) continue;
    if (last < options.from || last > options.to) continue;

    const monthly = chargeInMonth(subscription, last);
    // A row that charged nothing in its final month removed no run-rate, so it
    // is not a saving and must not inflate `endedCount` either — reporting
    // "1 ended, 0.00 removed" reads as a bug in the figure rather than as a
    // zero-cost row.
    if (monthly === 0) continue;
    monthlyRunRateRemoved = round2(monthlyRunRateRemoved + monthly);
    // Months from the one after it stopped through the end of the window — but
    // never past the CURRENT month. "Spend avoided" is money not spent, and a
    // month that has not happened yet has not been avoided; counting it let a
    // window ending in the future report savings nobody had banked.
    const horizon = options.to < options.today ? options.to : options.today;
    const monthsSaved = Math.max(0, monthDistance(last, horizon));
    cumulativeAvoided = round2(cumulativeAvoided + monthly * monthsSaved);
    ended.push({
      ...movementRow(subscription, last),
      lastChargedMonth: last,
    });
  }

  ended.sort(
    (a, b) =>
      b.monthlyAmount - a.monthlyAmount ||
      a.productName.localeCompare(b.productName),
  );

  return {
    currency: options.currency,
    monthlyRunRateRemoved,
    cumulativeAvoided,
    endedCount: ended.length,
    ended,
  };
}
