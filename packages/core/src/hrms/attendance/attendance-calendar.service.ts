import type { Db } from "@nexora/db";
import { eq, schema } from "@nexora/db";
import * as attendanceRepo from "./attendance.repository.js";
import * as metaRepo from "./attendance-meta.repository.js";
import type { AttendanceStatus } from "@nexora/contracts/modules/hrms/attendance.types";

export type NonWorkingClassification = {
  status: AttendanceStatus;
  label: string;
};

export type MonthClassificationContext = {
  classify(
    employeeId: string,
    entityId: string | null | undefined,
    date: Date,
  ): NonWorkingClassification | null;
};

type DateRange = { start: string; end: string };

function toYmd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

const DEFAULT_WEEKEND_DAYS = [0, 6];

function parseWeekendDays(value: unknown): number[] {
  if (Array.isArray(value)) {
    return value.filter((d): d is number => typeof d === "number");
  }
  return DEFAULT_WEEKEND_DAYS;
}

function isWeekend(date: Date, weekendDays: number[]): boolean {
  return weekendDays.includes(date.getUTCDay());
}


export async function getPolicyWeekendDays(db: Db, 
    entityId: string | null | undefined,
  ): Promise<number[]> {
    const policy = await attendanceRepo.findPolicyForEntity(db, 
      entityId ?? null,
    );
    return parseWeekendDays(policy?.weekendDays ?? DEFAULT_WEEKEND_DAYS);
  }

export async function findHolidayOnDate(
    db: Db,
    entityId: string | null | undefined,
    date: Date,
  ): Promise<{ name: string } | null> {
    return metaRepo.findPublicHolidayOnDate(db, entityId, toYmd(date));
  }

export async function hasApprovedExceptionOnDate(
    db: Db,
    employeeId: string,
    date: Date,
  ): Promise<boolean> {
    const row = await metaRepo.findApprovedExceptionOnDate(db, employeeId, toYmd(date));
    return Boolean(row);
  }

export async function buildMonthClassificationContext(db: Db, 
    employees: Array<{ id: string; entityId: string | null | undefined }>,
    from: Date,
    to: Date,
  ): Promise<MonthClassificationContext> {
    const uniqueEntities = [
      ...new Set(employees.map((e) => e.entityId ?? null)),
    ] as Array<string | null>;

    const weekendByEntity = new Map<string | null, number[]>();
    await Promise.all(
      uniqueEntities.map(async (entityId) => {
        weekendByEntity.set(
          entityId,
          await getPolicyWeekendDays(db, entityId),
        );
      }),
    );

    const employeeIds = employees.map((e) => e.id);
    const [holidays, leaves, exceptions] = await Promise.all([
      metaRepo.findPublicHolidaysInRange(db, toYmd(from), toYmd(to)),
      attendanceRepo.findApprovedLeavesInRange(db, employeeIds, from, to),
      employeeIds.length
        ? metaRepo.findApprovedExceptionsInRange(db, employeeIds, toYmd(from), toYmd(to))
        : Promise.resolve([]),
    ]);

    const leaveByEmployee = new Map<string, DateRange[]>();
    for (const leave of leaves) {
      const ranges = leaveByEmployee.get(leave.employeeId) ?? [];
      ranges.push({
        start: String(leave.startDate).slice(0, 10),
        end: String(leave.endDate).slice(0, 10),
      });
      leaveByEmployee.set(leave.employeeId, ranges);
    }

    const exceptionByEmployee = new Map<string, DateRange[]>();
    for (const exception of exceptions) {
      const ranges = exceptionByEmployee.get(exception.employeeId) ?? [];
      ranges.push({
        start: String(exception.startDate).slice(0, 10),
        end: String(exception.endDate).slice(0, 10),
      });
      exceptionByEmployee.set(exception.employeeId, ranges);
    }

    const isOnLeave = (employeeId: string, ymd: string) => {
      const ranges = leaveByEmployee.get(employeeId) ?? [];
      return ranges.some((range) => ymd >= range.start && ymd <= range.end);
    };

    const isOnException = (employeeId: string, ymd: string) => {
      const ranges = exceptionByEmployee.get(employeeId) ?? [];
      return ranges.some((range) => ymd >= range.start && ymd <= range.end);
    };

    const findHolidayOnDate = (
      entityId: string | null | undefined,
      ymd: string,
    ) => {
      const dayHolidays = holidays.filter((h) => String(h.date).slice(0, 10) === ymd);
      if (!dayHolidays.length) return null;

      if (entityId) {
        const match = dayHolidays.find((h) => h.entityId === entityId);
        return match ? { name: match.name } : null;
      }

      return { name: dayHolidays[0]!.name };
    };

    return {
      classify(employeeId, entityId, date) {
        const ymd = toYmd(date);
        const weekendDays =
          weekendByEntity.get(entityId ?? null) ?? DEFAULT_WEEKEND_DAYS;

        if (isWeekend(date, weekendDays)) {
          return { status: "weekend", label: "Weekend" };
        }

        if (isOnLeave(employeeId, ymd)) {
          return { status: "on_leave", label: "On Leave" };
        }

        const holiday = findHolidayOnDate(entityId, ymd);
        if (holiday) {
          return { status: "public_holiday", label: holiday.name };
        }

        if (isOnException(employeeId, ymd)) {
          return { status: "on_exception", label: "Official Exception" };
        }

        return null;
      },
    };
  }

export async function classifyNonWorkingDay(db: Db, 
    employeeId: string,
    entityId: string | null | undefined,
    date: Date,
  ): Promise<NonWorkingClassification | null> {
    const weekendDays = await getPolicyWeekendDays(db, entityId);
    if (isWeekend(date, weekendDays)) {
      return { status: "weekend", label: "Weekend" };
    }

    const onLeave = await attendanceRepo.hasApprovedLeaveOnDate(db, 
      employeeId,
      date,
    );
    if (onLeave) {
      return { status: "on_leave", label: "On Leave" };
    }

    const holiday = await findHolidayOnDate(db, entityId, date);
    if (holiday) {
      return { status: "public_holiday", label: holiday.name };
    }

    const onException = await hasApprovedExceptionOnDate(db, employeeId, date);
    if (onException) {
      return { status: "on_exception", label: "Official Exception" };
    }

    return null;
  }

export async function countWorkingDaysInRange(db: Db, 
    from: Date,
    to: Date,
    entityId: string | null | undefined,
  ): Promise<number> {
    const weekendDays = await getPolicyWeekendDays(db, entityId);
    const holidays = await metaRepo.findPublicHolidaysInRange(db, toYmd(from), toYmd(to));
    const holidaySet = new Set(
      holidays
        .filter((h) => !entityId || h.entityId === entityId)
        .map((h) => String(h.date).slice(0, 10)),
    );

    let count = 0;
    const cursor = new Date(from);
    while (cursor <= to) {
      const ymd = cursor.toISOString().slice(0, 10);
      if (!isWeekend(cursor, weekendDays) && !holidaySet.has(ymd)) {
        count++;
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    return count;
  }
