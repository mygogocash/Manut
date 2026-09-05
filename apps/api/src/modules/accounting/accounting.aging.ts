// Central AR/AP aging-bucket definitions (NFR-4): defined ONCE here, never
// hardcoded per screen or per query. The dashboard + aging reports import
// these and echo them in the payload so the UI shows exactly which thresholds
// each figure was measured against.
//
// Five buckets, matching the Revenue-Department standard statement-of-account
// ladder: the 60+ tail is split into 61-90 and 90+ so slow-paying accounts are
// visible separately from genuinely bad debt.

export const AGING_BUCKETS = [
  { key: "notYetDue", label: "Not yet due", maxDaysOverdue: 0 },
  { key: "d1_30", label: "1-30 days", maxDaysOverdue: 30 },
  { key: "d31_60", label: "31-60 days", maxDaysOverdue: 60 },
  { key: "d61_90", label: "61-90 days", maxDaysOverdue: 90 },
  { key: "d90plus", label: "90+ days", maxDaysOverdue: null },
] as const;

export type AgingBucketKey = (typeof AGING_BUCKETS)[number]["key"];

const MS_PER_DAY = 86_400_000;

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

// Whole days a document is past due as of `asOf`. Negative/zero = not yet due.
// Both dates are compared as UTC-midnight instants; callers pass DATE columns
// (already midnight) so no timezone drift.
export function daysOverdue(dueDate: Date, asOf: Date): number {
  return Math.floor((asOf.getTime() - dueDate.getTime()) / MS_PER_DAY);
}

// Map a days-overdue count to its bucket key using the AGING_BUCKETS ladder.
export function bucketForDaysOverdue(days: number): AgingBucketKey {
  for (const b of AGING_BUCKETS) {
    if (b.maxDaysOverdue === null || days <= b.maxDaysOverdue) return b.key;
  }
  // Unreachable: the final bucket has maxDaysOverdue === null.
  return "d90plus";
}

export function bucketForDueDate(dueDate: Date, asOf: Date): AgingBucketKey {
  return bucketForDaysOverdue(daysOverdue(dueDate, asOf));
}

export function emptyBucketTotals(): Record<AgingBucketKey, number> {
  return { notYetDue: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90plus: 0 };
}

// One open document, already converted to the reporting base currency, ready to
// be bucketed. `outstandingBase` is the still-owed amount (amount − amountPaid)
// in base currency.
export interface AgingInvoiceInput {
  dueDate: Date;
  outstandingBase: number;
}

export interface AgingSideSummary {
  buckets: Record<AgingBucketKey, number>;
  total: number;
  count: number;
}

// Pure roll-up: bucket each open document by how overdue it is as of `asOf` and
// sum the outstanding base amounts. Deterministic — no clock, no currency
// resolution (the caller converts to base first). Rounds each running total to
// 2dp so the bucket sum equals the grand total without float drift.
export function buildAgingSummary(
  invoices: AgingInvoiceInput[],
  asOf: Date,
): AgingSideSummary {
  const buckets = emptyBucketTotals();
  let total = 0;
  for (const inv of invoices) {
    const key = bucketForDueDate(inv.dueDate, asOf);
    buckets[key] = round2(buckets[key] + inv.outstandingBase);
    total = round2(total + inv.outstandingBase);
  }
  return { buckets, total, count: invoices.length };
}
