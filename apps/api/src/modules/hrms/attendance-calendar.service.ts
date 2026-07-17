import { prisma } from "@/infrastructure/database/prisma";
import { attendanceRepository } from "@/modules/hrms/attendance.repository";
import type { AttendanceStatus } from "@/modules/hrms/attendance.types";

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

export class AttendanceCalendarService {
  async getPolicyWeekendDays(
    entityId: string | null | undefined,
  ): Promise<number[]> {
    const policy = await attendanceRepository.findPolicyForEntity(
      entityId ?? null,
    );
    return parseWeekendDays(policy?.weekendDays ?? DEFAULT_WEEKEND_DAYS);
  }

  async findHolidayOnDate(
    entityId: string | null | undefined,
    date: Date,
  ): Promise<{ name: string } | null> {
    const holiday = await prisma.publicHoliday.findFirst({
      where: {
        date,
        isActive: true,
        ...(entityId ? { entityId } : {}),
      },
      select: { name: true },
    });
    return holiday;
  }

  async hasApprovedExceptionOnDate(
    employeeId: string,
    date: Date,
  ): Promise<boolean> {
    const row = await prisma.attendanceException.findFirst({
      where: {
        employeeId,
        status: "approved",
        startDate: { lte: date },
        endDate: { gte: date },
      },
      select: { id: true },
    });
    return Boolean(row);
  }

  async buildMonthClassificationContext(
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
          await this.getPolicyWeekendDays(entityId),
        );
      }),
    );

    const employeeIds = employees.map((e) => e.id);
    const [holidays, leaves, exceptions] = await Promise.all([
      prisma.publicHoliday.findMany({
        where: { isActive: true, date: { gte: from, lte: to } },
        select: { date: true, entityId: true, name: true },
      }),
      attendanceRepository.findApprovedLeavesInRange(employeeIds, from, to),
      employeeIds.length
        ? prisma.attendanceException.findMany({
            where: {
              employeeId: { in: employeeIds },
              status: "approved",
              startDate: { lte: to },
              endDate: { gte: from },
            },
            select: { employeeId: true, startDate: true, endDate: true },
          })
        : Promise.resolve([]),
    ]);

    const leaveByEmployee = new Map<string, DateRange[]>();
    for (const leave of leaves) {
      const ranges = leaveByEmployee.get(leave.employeeId) ?? [];
      ranges.push({
        start: toYmd(leave.startDate),
        end: toYmd(leave.endDate),
      });
      leaveByEmployee.set(leave.employeeId, ranges);
    }

    const exceptionByEmployee = new Map<string, DateRange[]>();
    for (const exception of exceptions) {
      const ranges = exceptionByEmployee.get(exception.employeeId) ?? [];
      ranges.push({
        start: toYmd(exception.startDate),
        end: toYmd(exception.endDate),
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
      const dayHolidays = holidays.filter((h) => toYmd(h.date) === ymd);
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

  async classifyNonWorkingDay(
    employeeId: string,
    entityId: string | null | undefined,
    date: Date,
  ): Promise<NonWorkingClassification | null> {
    const weekendDays = await this.getPolicyWeekendDays(entityId);
    if (isWeekend(date, weekendDays)) {
      return { status: "weekend", label: "Weekend" };
    }

    const onLeave = await attendanceRepository.hasApprovedLeaveOnDate(
      employeeId,
      date,
    );
    if (onLeave) {
      return { status: "on_leave", label: "On Leave" };
    }

    const holiday = await this.findHolidayOnDate(entityId, date);
    if (holiday) {
      return { status: "public_holiday", label: holiday.name };
    }

    const onException = await this.hasApprovedExceptionOnDate(employeeId, date);
    if (onException) {
      return { status: "on_exception", label: "Official Exception" };
    }

    return null;
  }

  async countWorkingDaysInRange(
    from: Date,
    to: Date,
    entityId: string | null | undefined,
  ): Promise<number> {
    const weekendDays = await this.getPolicyWeekendDays(entityId);
    const holidays = await prisma.publicHoliday.findMany({
      where: {
        isActive: true,
        date: { gte: from, lte: to },
        ...(entityId ? { entityId } : {}),
      },
      select: { date: true },
    });
    const holidaySet = new Set(
      holidays.map((h) => h.date.toISOString().slice(0, 10)),
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
}

export const attendanceCalendarService = new AttendanceCalendarService();
