/** Calendar date parts of an instant in an IANA timezone (moved from apps/api expense-shared). */
export function datePartsInTimezone(
  at: Date,
  timezone: string,
): { year: string; month: string; day: string } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(at);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  const day = parts.find((p) => p.type === "day")?.value;
  if (!year || !month || !day) {
    throw new Error(`Failed to resolve calendar date in timezone "${timezone}"`);
  }
  return { year, month, day };
}
