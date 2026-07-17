/** Leave request duration — mirrored in API `leave.validation.ts`. */

export const LEAVE_DURATION_OPTIONS = [
  { value: "full_day", label: "Full Day Leave" },
  { value: "half_day", label: "Half Day Leave" },
] as const;

export type LeaveDurationType =
  (typeof LEAVE_DURATION_OPTIONS)[number]["value"];

export const HALF_DAY_PERIOD_OPTIONS = [
  { value: "am", label: "A.M." },
  { value: "pm", label: "P.M." },
] as const;

export type HalfDayPeriod = (typeof HALF_DAY_PERIOD_OPTIONS)[number]["value"];

export function halfDayPeriodLabel(period: string | null | undefined): string {
  if (period === "am") return "A.M.";
  if (period === "pm") return "P.M.";
  return "";
}

export function formatLeaveDateRange(input: {
  startDate: string;
  endDate: string;
  durationType?: string | null;
  halfDayPeriod?: string | null;
}): string {
  const start = input.startDate.slice(0, 10);
  const end = input.endDate.slice(0, 10);
  const formatted = new Date(`${start}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  if (input.durationType === "half_day") {
    const period = halfDayPeriodLabel(input.halfDayPeriod);
    return period ? `${formatted} (${period})` : formatted;
  }

  if (start === end) return formatted;

  const formattedEnd = new Date(`${end}T00:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  return `${formatted} – ${formattedEnd}`;
}

export function formatLeaveDays(input: {
  days: string | number;
  durationType?: string | null;
  halfDayPeriod?: string | null;
}): string {
  const n = Number(input.days);
  const base = Number.isInteger(n) ? String(n) : String(n);
  if (input.durationType === "half_day") {
    const period = halfDayPeriodLabel(input.halfDayPeriod);
    return period ? `${base} (${period})` : base;
  }
  return base;
}
