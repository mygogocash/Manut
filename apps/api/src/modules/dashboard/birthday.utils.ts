export type BirthdayWindowDay = {
  month: number;
  day: number;
  offset: number;
};

/** Today plus the next `horizonDays` calendar days (UTC date parts). */
export function getBirthdayWindowDays(
  refDate: Date = new Date(),
  horizonDays = 3,
): BirthdayWindowDay[] {
  const days: BirthdayWindowDay[] = [];
  for (let offset = 0; offset <= horizonDays; offset++) {
    const d = new Date(
      Date.UTC(
        refDate.getUTCFullYear(),
        refDate.getUTCMonth(),
        refDate.getUTCDate() + offset,
      ),
    );
    days.push({
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
      offset,
    });
  }
  return days;
}

export function daysUntilBirthday(
  dateOfBirth: Date,
  window: BirthdayWindowDay[],
): number | null {
  const month = dateOfBirth.getUTCMonth() + 1;
  const day = dateOfBirth.getUTCDate();
  const hit = window.find((w) => w.month === month && w.day === day);
  return hit?.offset ?? null;
}

export function birthdayWindowLabel(offset: number): string {
  if (offset === 0) return "Today";
  if (offset === 1) return "Tomorrow";
  return `In ${offset} days`;
}
