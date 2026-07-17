import { api } from "@/lib/api-client";
import type { MonthlyAttendanceReport } from "@/services/attendance.service";
import type { AttendanceShift } from "@/services/attendance-phase2.service";
import type { ApiSuccessResponse } from "@/types/api.type";

export type AttendanceCalendarCode = "P" | "A" | "L" | "R" | "H" | "E" | "-";

export interface AttendanceTimeDisplay {
  utc: string | null;
  employeeLocal: string | null;
  employeeLocalTime: string | null;
  companyLocal: string | null;
  companyLocalTime: string | null;
  employeeTimezone: string | null;
  companyTimezone: string;
}

export interface AttendanceCalendarRow {
  employeeId: string;
  name: string;
  department: string | null;
  cells: Record<string, AttendanceCalendarCode>;
}

export interface AttendanceCalendarView {
  month: string;
  scope: "employee" | "team" | "department";
  days: string[];
  rows: AttendanceCalendarRow[];
}

export interface AttendanceShiftAssignment {
  id: string;
  employeeId: string;
  shiftId: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  employee?: {
    id: string;
    name: string;
    email: string;
    department: string | null;
    employeeId: string | null;
  };
}

export interface EmployeeAttendanceProfile {
  employeeId: string;
  name: string;
  department: string | null;
  attendancePercentage: number;
  latePercentage: number;
  currentShift: AttendanceShift | null;
  lastCheckIn: string | null;
  lastCheckOut: string | null;
  lastCheckInDisplay: AttendanceTimeDisplay | null;
  lastCheckOutDisplay: AttendanceTimeDisplay | null;
  monthlySummary: MonthlyAttendanceReport;
}

export interface ExecutiveAttendanceAnalytics {
  averageWorkingHours: number;
  mostPunctualEmployees: Array<{
    employeeId: string;
    name: string;
    department: string | null;
    latePercentage: number;
    attendancePercentage: number;
  }>;
  highestAttendanceEmployees: Array<{
    employeeId: string;
    name: string;
    department: string | null;
    attendancePercentage: number;
  }>;
  highestAbsenteeDepartments: Array<{
    department: string;
    absentPercentage: number;
    headcount: number;
  }>;
  attendanceTrend: Array<{ month: string; attendancePercentage: number }>;
  remoteVsOfficeTrend: Array<{
    month: string;
    remotePercentage: number;
    officePercentage: number;
  }>;
  monthlyAttendanceTrend: Array<{
    month: string;
    attendancePercentage: number;
  }>;
}

function buildQuery(params: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, v);
  }
  const q = qs.toString();
  return q ? `?${q}` : "";
}

export async function getAttendanceCalendar(params: {
  month: string;
  scope?: "employee" | "team" | "department";
  department?: string;
  employeeId?: string;
}): Promise<ApiSuccessResponse<AttendanceCalendarView>> {
  return api.get(`/hrms/attendance/calendar${buildQuery(params)}`);
}

export async function getExecutiveAttendanceAnalytics(params?: {
  month?: string;
  department?: string;
}): Promise<ApiSuccessResponse<ExecutiveAttendanceAnalytics>> {
  return api.get(
    `/hrms/attendance/executive-analytics${buildQuery(params ?? {})}`,
  );
}

export async function getEmployeeAttendanceProfile(
  employeeId: string,
  params?: { month?: string },
): Promise<ApiSuccessResponse<EmployeeAttendanceProfile>> {
  return api.get(
    `/hrms/attendance/employees/${employeeId}/profile${buildQuery(params ?? {})}`,
  );
}

export async function listShiftAssignments(
  entityId?: string,
): Promise<ApiSuccessResponse<AttendanceShiftAssignment[]>> {
  return api.get(
    `/hrms/attendance/shift-assignments${buildQuery({ entityId })}`,
  );
}

export async function bulkAssignShift(body: {
  employeeIds: string[];
  shiftId: string;
  effectiveFrom: string;
  effectiveTo?: string;
}): Promise<ApiSuccessResponse<{ count: number }>> {
  return api.post("/hrms/attendance/shift-assignments/bulk", body);
}

export async function changeShiftAssignment(
  id: string,
  body: {
    shiftId?: string;
    effectiveFrom?: string;
    effectiveTo?: string | null;
  },
): Promise<ApiSuccessResponse<AttendanceShiftAssignment>> {
  return api.put(`/hrms/attendance/shift-assignments/${id}`, body);
}
