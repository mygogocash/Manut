// Pure helpers for tax-month filing + lock (M9). DB-free, unit-tested.

const pad = (n: number) => String(n).padStart(2, "0");

// The inclusive calendar-month date range as YYYY-MM-DD strings, used to scope
// the VAT register when filing a month. `month` is 1-12. Uses UTC so the range
// lines up with the DATE columns (which are stored at UTC midnight).
export function monthDateRange(
  year: number,
  month: number,
): { startDate: string; endDate: string } {
  const start = new Date(Date.UTC(year, month - 1, 1));
  // Day 0 of the next month is the last day of this month (handles 28/29/30/31).
  const end = new Date(Date.UTC(year, month, 0));
  const iso = (d: Date) =>
    `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  return { startDate: iso(start), endDate: iso(end) };
}

// A filed tax month is locked; a reopened month (or one with no filing row) is
// open. Kept as a named predicate so the lock rule lives in exactly one place.
export function taxMonthLocked(
  filingStatus: string | null | undefined,
): boolean {
  return filingStatus === "filed";
}

// The (year, month) a document's tax point falls in, in UTC. The DATE columns
// come back at UTC midnight, so no timezone drift.
export function taxMonthOf(date: Date): { year: number; month: number } {
  const d = new Date(date);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}
