import type { AttendanceRecord } from "@manut/database";

import type {
  AttendanceRecordDto,
  AttendanceStatus,
  AttendanceWorkMode,
} from "@/modules/hrms/attendance.types";
import {
  buildTimezoneDisplayFields,
  COMPANY_DEFAULT_TIMEZONE,
  formatDateYmdUtc,
  formatLocalDateTime,
  resolveEmployeeTimezone,
} from "@/modules/hrms/attendance-timezone.util";

type RecordWithEmployee = AttendanceRecord & {
  employee?: {
    id: string;
    name: string;
    email: string;
    department: string | null;
    employeeId: string | null;
    timezone?: string | null;
  };
};

export function serializeAttendanceRecord(
  record: RecordWithEmployee,
  companyTimezone = COMPANY_DEFAULT_TIMEZONE,
): AttendanceRecordDto {
  const employeeTz = resolveEmployeeTimezone(
    record.employeeTimezone ?? record.employee?.timezone,
    companyTimezone,
  );
  const checkInInstant = record.checkInUtc ?? record.checkIn;
  const checkOutInstant = record.checkOutUtc ?? record.checkOut;

  const checkInDisplay = checkInInstant
    ? {
        ...buildTimezoneDisplayFields(
          checkInInstant,
          employeeTz,
          companyTimezone,
        ),
        employeeTimezone: employeeTz,
        companyTimezone,
      }
    : undefined;

  const checkOutDisplay = checkOutInstant
    ? {
        ...buildTimezoneDisplayFields(
          checkOutInstant,
          employeeTz,
          companyTimezone,
        ),
        employeeTimezone: employeeTz,
        companyTimezone,
      }
    : undefined;

  return {
    id: record.id,
    employeeId: record.employeeId,
    attendanceDate: formatDateYmdUtc(record.attendanceDate),
    checkIn: record.checkIn?.toISOString() ?? null,
    checkOut: record.checkOut?.toISOString() ?? null,
    checkInUtc: checkInInstant?.toISOString() ?? null,
    checkOutUtc: checkOutInstant?.toISOString() ?? null,
    employeeTimezone: record.employeeTimezone ?? employeeTz,
    localCheckInTime:
      record.localCheckInTime ??
      (checkInInstant ? formatLocalDateTime(checkInInstant, employeeTz) : null),
    localCheckOutTime:
      record.localCheckOutTime ??
      (checkOutInstant
        ? formatLocalDateTime(checkOutInstant, employeeTz)
        : null),
    checkInDisplay,
    checkOutDisplay,
    workMode: record.workMode as AttendanceWorkMode,
    status: record.status as AttendanceStatus,
    totalHours:
      record.totalHours !== null && record.totalHours !== undefined
        ? Number(record.totalHours)
        : null,
    lateMinutes: record.lateMinutes,
    remarks: record.remarks,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
    employee: record.employee
      ? {
          id: record.employee.id,
          name: record.employee.name,
          email: record.employee.email,
          department: record.employee.department,
          employeeId: record.employee.employeeId,
        }
      : undefined,
  };
}
