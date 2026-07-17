import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

export const ATTENDANCE_WORK_MODES = ["office", "remote", "hybrid"] as const;
export type AttendanceWorkMode = (typeof ATTENDANCE_WORK_MODES)[number];

export const ATTENDANCE_STATUSES = [
  "present",
  "late",
  "absent",
  "on_leave",
  "remote",
  "hybrid",
  "public_holiday",
  "weekend",
  "on_exception",
] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const ATTENDANCE_WORK_MODE_LABELS: Record<AttendanceWorkMode, string> = {
  office: "Work From Office",
  remote: "Remote",
  hybrid: "Hybrid",
};

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: "Present",
  late: "Late",
  absent: "Absent",
  on_leave: "On Leave",
  remote: "Remote",
  hybrid: "Hybrid",
  public_holiday: "Public Holiday",
  weekend: "Weekend",
  on_exception: "Official Exception",
};

export interface AttendanceTimeDisplay {
  utc: string | null;
  employeeLocal: string | null;
  employeeLocalTime: string | null;
  companyLocal: string | null;
  companyLocalTime: string | null;
  employeeTimezone: string | null;
  companyTimezone: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
  attendanceDate: string;
  checkIn: string | null;
  checkOut: string | null;
  checkInUtc?: string | null;
  checkOutUtc?: string | null;
  employeeTimezone?: string | null;
  localCheckInTime?: string | null;
  localCheckOutTime?: string | null;
  checkInDisplay?: AttendanceTimeDisplay;
  checkOutDisplay?: AttendanceTimeDisplay;
  workMode: AttendanceWorkMode;
  status: AttendanceStatus;
  totalHours: number | null;
  lateMinutes: number;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: {
    id: string;
    name: string;
    email: string;
    department: string | null;
    employeeId: string | null;
  };
}

export interface AttendanceDashboardSummary {
  presentToday: number;
  absentToday: number;
  lateToday: number;
  remoteToday: number;
  hybridToday: number;
  onLeaveToday: number;
  totalActiveEmployees: number;
  date: string;
}

export interface MonthlyAttendanceReport {
  month: string;
  employeeId?: string;
  attendancePercentage: number;
  lateArrivals: number;
  absenteeCount: number;
  remoteDays: number;
  officeDays: number;
  hybridDays: number;
  totalWorkingDays: number;
  daysPresent: number;
  remoteVsOfficeRatio: number;
}

export interface DepartmentAttendanceSummary {
  department: string;
  headcount: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  remoteCount: number;
  hybridCount: number;
  onLeaveCount: number;
  attendancePercentage: number;
}

export interface MyAttendanceParams {
  page?: number;
  limit?: number;
  from?: string;
  to?: string;
  status?: string;
}

function buildQuery(
  params: Record<string, string | number | undefined> | MyAttendanceParams,
) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const q = qs.toString();
  return q ? `?${q}` : "";
}

export async function checkInAttendance(body: {
  workMode?: AttendanceWorkMode;
  remarks?: string;
}): Promise<ApiSuccessResponse<AttendanceRecord>> {
  return api.post("/hrms/attendance/check-in", body);
}

export async function checkOutAttendance(body?: {
  remarks?: string;
}): Promise<ApiSuccessResponse<AttendanceRecord>> {
  return api.post("/hrms/attendance/check-out", body ?? {});
}

export async function getTodayAttendance(): Promise<
  ApiSuccessResponse<AttendanceRecord | null>
> {
  return api.get("/hrms/attendance/today");
}

export async function getAttendanceDashboard(): Promise<
  ApiSuccessResponse<AttendanceDashboardSummary>
> {
  return api.get("/hrms/attendance/dashboard");
}

export async function getLiveAttendance(): Promise<
  ApiSuccessResponse<AttendanceRecord[]>
> {
  return api.get("/hrms/attendance/live");
}

export async function getMyAttendance(
  params: MyAttendanceParams = {},
): Promise<ApiPaginatedResponse<AttendanceRecord>> {
  return api.get(`/hrms/attendance/my-attendance${buildQuery(params)}`);
}

export async function getMonthlyAttendanceReport(params?: {
  month?: string;
  employeeId?: string;
  department?: string;
}): Promise<ApiSuccessResponse<MonthlyAttendanceReport>> {
  return api.get(`/hrms/attendance/report/monthly${buildQuery(params ?? {})}`);
}

export async function getDepartmentAttendanceReport(params?: {
  month?: string;
  department?: string;
}): Promise<ApiSuccessResponse<DepartmentAttendanceSummary[]>> {
  return api.get(
    `/hrms/attendance/report/department${buildQuery(params ?? {})}`,
  );
}
