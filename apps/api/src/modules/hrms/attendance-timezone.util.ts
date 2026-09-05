import { datePartsInTimezone } from "@/modules/expenses/expense-shared";

export const SUPPORTED_EMPLOYEE_TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Colombo",
  "Asia/Bangkok",
  "Asia/Dubai",
  "Asia/Ho_Chi_Minh",
] as const;

export const COMPANY_DEFAULT_TIMEZONE = "Asia/Bangkok";

export function isValidEmployeeTimezone(
  tz: string | null | undefined,
): tz is string {
  if (!tz) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function resolveEmployeeTimezone(
  userTimezone: string | null | undefined,
  policyDefault?: string | null,
): string {
  if (isValidEmployeeTimezone(userTimezone)) return userTimezone;
  if (isValidEmployeeTimezone(policyDefault)) return policyDefault!;
  return COMPANY_DEFAULT_TIMEZONE;
}

export function attendanceDateFromInstant(at: Date, timeZone: string): Date {
  const { year, month, day } = datePartsInTimezone(at, timeZone);
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

export function formatDateYmdUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

function zonedParts(at: Date, timeZone: string): ZonedParts {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const get = (type: string) =>
    Number(parts.find((p) => p.type === type)?.value ?? "0");
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

/** Convert local wall-clock on a calendar day in `timeZone` to a UTC instant. */
export function zonedLocalToUtc(
  dateYmd: string,
  timeHHmm: string,
  timeZone: string,
): Date {
  const [y, mo, d] = dateYmd.split("-").map(Number);
  const [hh, mm] = timeHHmm.split(":").map(Number);
  let utcMs = Date.UTC(y, mo - 1, d, hh, mm, 0);
  for (let i = 0; i < 4; i++) {
    const zp = zonedParts(new Date(utcMs), timeZone);
    const desired = Date.UTC(y, mo - 1, d, hh, mm, 0);
    const actual = Date.UTC(
      zp.year,
      zp.month - 1,
      zp.day,
      zp.hour,
      zp.minute,
      0,
    );
    utcMs += desired - actual;
  }
  return new Date(utcMs);
}

export function formatLocalDateTime(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .format(at)
    .replace(", ", "T");
}

export function formatLocalTime(at: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(at);
}

export function computeLateMinutesInTimezone(
  checkIn: Date,
  shiftStartTime: string,
  graceMinutes: number,
  attendanceDate: Date,
  timeZone: string,
): number {
  const dateYmd = formatDateYmdUtc(attendanceDate);
  const shiftStart = zonedLocalToUtc(dateYmd, shiftStartTime, timeZone);
  const graceEnd = new Date(shiftStart.getTime() + graceMinutes * 60_000);
  if (checkIn <= graceEnd) return 0;
  return Math.floor((checkIn.getTime() - graceEnd.getTime()) / 60_000);
}

export function buildTimezoneDisplayFields(
  instant: Date,
  employeeTz: string,
  companyTz: string,
) {
  return {
    utc: instant.toISOString(),
    employeeLocal: formatLocalDateTime(instant, employeeTz),
    employeeLocalTime: formatLocalTime(instant, employeeTz),
    companyLocal: formatLocalDateTime(instant, companyTz),
    companyLocalTime: formatLocalTime(instant, companyTz),
  };
}
