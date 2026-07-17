import { BadRequestException } from "@/common/exceptions/http-exception";

type AttendanceDateParts = {
  year: number;
  month: number;
  day: number;
  date: Date;
};

type AttendanceTimeParts = {
  hour: number;
  minute: number;
};

export type AttendanceMonthPeriod = {
  from: Date;
  to: Date;
  label: string;
};

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
const TIME_PATTERN = /^(\d{2}):(\d{2})$/;

function createUtcDate(year: number, monthIndex: number, day: number): Date {
  // Date.UTC treats years 0-99 as 1900-1999. setUTCFullYear preserves the
  // exact four-digit year supplied at the API boundary.
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, monthIndex, day);
  return date;
}

export function parseAttendanceDate(value: string): AttendanceDateParts {
  const match = DATE_PATTERN.exec(value);
  const yearText = match?.[1];
  const monthText = match?.[2];
  const dayText = match?.[3];
  if (!yearText || !monthText || !dayText) {
    throw new BadRequestException(
      "Invalid attendance date; expected YYYY-MM-DD",
    );
  }

  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const date = createUtcDate(year, month - 1, day);
  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new BadRequestException(
      "Invalid attendance date; expected YYYY-MM-DD",
    );
  }

  return { year, month, day, date };
}

export function parseAttendanceTime(value: string): AttendanceTimeParts {
  const match = TIME_PATTERN.exec(value);
  const hourText = match?.[1];
  const minuteText = match?.[2];
  if (!hourText || !minuteText) {
    throw new BadRequestException("Invalid attendance time; expected HH:mm");
  }

  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (hour > 23 || minute > 59) {
    throw new BadRequestException("Invalid attendance time; expected HH:mm");
  }

  return { hour, minute };
}

export function parseAttendanceMonth(
  month?: string,
  defaultDate = new Date(),
): AttendanceMonthPeriod {
  const label =
    month ??
    `${defaultDate.getUTCFullYear()}-${String(defaultDate.getUTCMonth() + 1).padStart(2, "0")}`;
  const match = MONTH_PATTERN.exec(label);
  const yearText = match?.[1];
  const monthText = match?.[2];
  if (!yearText || !monthText) {
    throw new BadRequestException("Invalid attendance month; expected YYYY-MM");
  }

  const year = Number(yearText);
  const monthNumber = Number(monthText);
  if (monthNumber < 1 || monthNumber > 12) {
    throw new BadRequestException("Invalid attendance month; expected YYYY-MM");
  }

  return {
    from: createUtcDate(year, monthNumber - 1, 1),
    to: createUtcDate(year, monthNumber, 0),
    label,
  };
}

export function listAttendanceMonthDays(
  period: Pick<AttendanceMonthPeriod, "from" | "to">,
): string[] {
  const days: string[] = [];
  const cursor = new Date(period.from);
  while (cursor <= period.to) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}
