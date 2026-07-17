import { api, apiBaseUrl, authFetchInit } from "@/lib/api-client";
import type { AttendanceWorkMode } from "@/services/attendance.service";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

export const ATTENDANCE_CORRECTION_TYPES = [
  "check_in",
  "check_out",
  "work_mode",
  "full_day",
] as const;
export type AttendanceCorrectionType =
  (typeof ATTENDANCE_CORRECTION_TYPES)[number];

export const ATTENDANCE_CORRECTION_STATUSES = [
  "pending",
  "approved",
  "rejected",
] as const;

export interface AttendanceCorrection {
  id: string;
  employeeId: string;
  attendanceRecordId: string | null;
  attendanceDate: string;
  correctionType: AttendanceCorrectionType;
  reason: string;
  comments: string | null;
  status: (typeof ATTENDANCE_CORRECTION_STATUSES)[number];
  proposedCheckIn: string | null;
  proposedCheckOut: string | null;
  proposedWorkMode: AttendanceWorkMode | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectRemarks: string | null;
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

export interface AttendancePolicy {
  id: string;
  entityId: string | null;
  shiftStartTime: string;
  shiftEndTime: string;
  graceMinutes: number;
  halfDayThresholdHours: number;
  minimumWorkingHours: number;
  allowedWorkModes: AttendanceWorkMode[];
  weekendDays: number[];
  attendanceThresholdPct: number;
  defaultTimezone?: string;
  missedCheckInAfterMinutes?: number;
  missedCheckOutAfterMinutes?: number;
  consecutiveAbsenceAlertDays?: number;
  isActive: boolean;
}

export interface ManagerTeamDashboard {
  teamSize: number;
  presentToday: number;
  absentToday: number;
  lateToday: number;
  onLeaveToday: number;
  attendancePercentage: number;
  date: string;
  members: Array<{
    employeeId: string;
    name: string;
    department: string | null;
    status: string;
    checkIn: string | null;
    lateMinutes: number;
  }>;
}

export interface AttendanceAnalyticsSummary {
  attendancePercentage: number;
  latePercentage: number;
  averageWorkingHours: number;
  remotePercentage: number;
  hybridPercentage: number;
  monthlyTrend: Array<{ month: string; attendancePercentage: number }>;
  departmentBreakdown: Array<{
    department: string;
    attendancePercentage: number;
    latePercentage: number;
    absentPercentage: number;
  }>;
}

export interface AttendanceShift {
  id: string;
  entityId: string | null;
  shiftName: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  active: boolean;
}

export const ATTENDANCE_EXCEPTION_TYPES = [
  "business_travel",
  "client_visit",
  "training",
  "field_work",
  "official_duty",
] as const;

export interface AttendanceException {
  id: string;
  employeeId: string;
  type: (typeof ATTENDANCE_EXCEPTION_TYPES)[number];
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  employee?: { id: string; name: string; department: string | null };
}

function buildQuery(params: Record<string, string | number | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") qs.set(k, String(v));
  }
  const q = qs.toString();
  return q ? `?${q}` : "";
}

export async function createAttendanceCorrection(body: {
  attendanceDate: string;
  attendanceRecordId?: string;
  correctionType: AttendanceCorrectionType;
  reason: string;
  comments?: string;
  proposedCheckIn?: string;
  proposedCheckOut?: string;
  proposedWorkMode?: AttendanceWorkMode;
}): Promise<ApiSuccessResponse<AttendanceCorrection>> {
  return api.post("/hrms/attendance/corrections", body);
}

export async function listAttendanceCorrections(params?: {
  page?: number;
  limit?: number;
  status?: string;
  scope?: "mine" | "team" | "all";
}): Promise<ApiPaginatedResponse<AttendanceCorrection>> {
  return api.get(`/hrms/attendance/corrections${buildQuery(params ?? {})}`);
}

export async function approveAttendanceCorrection(
  id: string,
): Promise<ApiSuccessResponse<AttendanceCorrection>> {
  return api.post(`/hrms/attendance/corrections/${id}/approve`, {});
}

export async function rejectAttendanceCorrection(
  id: string,
  remarks: string,
): Promise<ApiSuccessResponse<AttendanceCorrection>> {
  return api.post(`/hrms/attendance/corrections/${id}/reject`, { remarks });
}

export async function getAttendancePolicy(
  entityId?: string,
): Promise<ApiSuccessResponse<AttendancePolicy>> {
  return api.get(`/hrms/attendance/policy${buildQuery({ entityId })}`);
}

export async function updateAttendancePolicy(
  body: Partial<AttendancePolicy> & { entityId?: string | null },
): Promise<ApiSuccessResponse<AttendancePolicy>> {
  return api.put("/hrms/attendance/policy", body);
}

export async function getManagerAttendanceDashboard(): Promise<
  ApiSuccessResponse<ManagerTeamDashboard>
> {
  return api.get("/hrms/attendance/manager/dashboard");
}

export async function getAttendanceAnalytics(params?: {
  month?: string;
  department?: string;
}): Promise<ApiSuccessResponse<AttendanceAnalyticsSummary>> {
  return api.get(`/hrms/attendance/analytics${buildQuery(params ?? {})}`);
}

export async function listAttendanceShifts(
  entityId?: string,
): Promise<ApiSuccessResponse<AttendanceShift[]>> {
  return api.get(`/hrms/attendance/shifts${buildQuery({ entityId })}`);
}

export async function createAttendanceShift(
  body: Omit<AttendanceShift, "id">,
): Promise<ApiSuccessResponse<AttendanceShift>> {
  return api.post("/hrms/attendance/shifts", body);
}

export async function listAttendanceExceptions(params?: {
  page?: number;
  limit?: number;
}): Promise<ApiPaginatedResponse<AttendanceException>> {
  return api.get(`/hrms/attendance/exceptions${buildQuery(params ?? {})}`);
}

export async function createAttendanceException(body: {
  type: AttendanceException["type"];
  startDate: string;
  endDate: string;
  reason: string;
  employeeId?: string;
}): Promise<ApiSuccessResponse<AttendanceException>> {
  return api.post("/hrms/attendance/exceptions", body);
}

async function downloadExport(path: string, filename: string) {
  const res = await fetch(`${apiBaseUrl}${path}`, authFetchInit());
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportDailyAttendance(params: {
  format: "csv" | "xlsx";
  date?: string;
  department?: string;
}) {
  const qs = buildQuery(params);
  const ext = params.format === "xlsx" ? "xlsx" : "csv";
  await downloadExport(
    `/hrms/attendance/export/daily${qs}`,
    `attendance-daily.${ext}`,
  );
}

export async function exportMonthlyAttendance(params: {
  format: "csv" | "xlsx";
  month?: string;
  department?: string;
}) {
  const qs = buildQuery(params);
  const ext = params.format === "xlsx" ? "xlsx" : "csv";
  await downloadExport(
    `/hrms/attendance/export/monthly${qs}`,
    `attendance-monthly.${ext}`,
  );
}

export async function exportDepartmentAttendance(params: {
  format: "csv" | "xlsx";
  month?: string;
  department?: string;
}) {
  const qs = buildQuery(params);
  const ext = params.format === "xlsx" ? "xlsx" : "csv";
  await downloadExport(
    `/hrms/attendance/export/department${qs}`,
    `attendance-department.${ext}`,
  );
}
