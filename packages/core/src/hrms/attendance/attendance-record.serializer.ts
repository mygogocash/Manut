import type {
  AttendanceRecordDto,
  AttendanceStatus,
  AttendanceWorkMode,
} from "@nexora/contracts/modules/hrms/attendance.types";
import {
  buildTimezoneDisplayFields,
  COMPANY_DEFAULT_TIMEZONE,
  formatDateYmdUtc,
  formatLocalDateTime,
  resolveEmployeeTimezone,
} from "@nexora/contracts/modules/hrms/attendance-timezone.util";

function toInstant(v: string | Date | null | undefined): Date | null {
  if (v == null) return null;
  return v instanceof Date ? v : new Date(v);
}

function toIso(v: string | Date | null | undefined): string | null {
  const d = toInstant(v);
  return d ? d.toISOString() : null;
}

type RecordWithEmployee = {
  id: string;
  employeeId: string;
  attendanceDate: string | Date;
  checkIn?: string | Date | null;
  checkOut?: string | Date | null;
  checkInUtc?: string | Date | null;
  checkOutUtc?: string | Date | null;
  employeeTimezone?: string | null;
  localCheckInTime?: string | null;
  localCheckOutTime?: string | null;
  workMode: string;
  status: string;
  totalHours?: string | number | null;
  lateMinutes: number;
  remarks?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
  employee?: {
    id: string;
    name: string;
    email: string;
    department: string | null;
    employeeId: string | null;
    timezone?: string | null;
  } | null;
};

export function serializeAttendanceRecord(
  record: RecordWithEmployee,
  companyTimezone = COMPANY_DEFAULT_TIMEZONE,
): AttendanceRecordDto {
  const employeeTz = resolveEmployeeTimezone(
    record.employeeTimezone ?? record.employee?.timezone,
    companyTimezone,
  );
  const checkInInstant = toInstant(record.checkInUtc ?? record.checkIn);
  const checkOutInstant = toInstant(record.checkOutUtc ?? record.checkOut);

  const checkInDisplay = checkInInstant
    ? {
        ...buildTimezoneDisplayFields(checkInInstant, employeeTz, companyTimezone),
        employeeTimezone: employeeTz,
        companyTimezone,
      }
    : undefined;

  const checkOutDisplay = checkOutInstant
    ? {
        ...buildTimezoneDisplayFields(checkOutInstant, employeeTz, companyTimezone),
        employeeTimezone: employeeTz,
        companyTimezone,
      }
    : undefined;

  return {
    id: record.id,
    employeeId: record.employeeId,
    attendanceDate: formatDateYmdUtc(toInstant(record.attendanceDate) ?? new Date(String(record.attendanceDate))),
    checkIn: toIso(record.checkIn),
    checkOut: toIso(record.checkOut),
    checkInUtc: toIso(checkInInstant),
    checkOutUtc: toIso(checkOutInstant),
    employeeTimezone: record.employeeTimezone ?? employeeTz,
    localCheckInTime:
      record.localCheckInTime ??
      (checkInInstant ? formatLocalDateTime(checkInInstant, employeeTz) : null),
    localCheckOutTime:
      record.localCheckOutTime ??
      (checkOutInstant ? formatLocalDateTime(checkOutInstant, employeeTz) : null),
    checkInDisplay,
    checkOutDisplay,
    workMode: record.workMode as AttendanceWorkMode,
    status: record.status as AttendanceStatus,
    totalHours:
      record.totalHours !== null && record.totalHours !== undefined
        ? Number(record.totalHours)
        : null,
    lateMinutes: record.lateMinutes,
    remarks: record.remarks ?? null,
    createdAt: toIso(record.createdAt) ?? new Date().toISOString(),
    updatedAt: toIso(record.updatedAt) ?? new Date().toISOString(),
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
