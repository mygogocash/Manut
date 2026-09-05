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

export interface AttendancePolicyConfig {
  shiftStartTime: string;
  shiftEndTime: string;
  graceMinutes: number;
  halfDayThresholdHours?: number;
  minimumWorkingHours?: number;
  allowedWorkModes?: AttendanceWorkMode[];
  weekendDays?: number[];
  attendanceThresholdPct?: number;
  defaultTimezone?: string;
  missedCheckInAfterMinutes?: number;
  missedCheckOutAfterMinutes?: number;
  consecutiveAbsenceAlertDays?: number;
}

export interface AttendancePolicyDto extends AttendancePolicyConfig {
  id: string;
  entityId: string | null;
  isActive: boolean;
}

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
export type AttendanceCorrectionStatus =
  (typeof ATTENDANCE_CORRECTION_STATUSES)[number];

export interface AttendanceCorrectionDto {
  id: string;
  employeeId: string;
  attendanceRecordId: string | null;
  attendanceDate: string;
  correctionType: AttendanceCorrectionType;
  reason: string;
  comments: string | null;
  status: AttendanceCorrectionStatus;
  proposedCheckIn: string | null;
  proposedCheckOut: string | null;
  proposedWorkMode: AttendanceWorkMode | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectRemarks: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: AttendanceEmployeeSummary;
}

export const ATTENDANCE_EXCEPTION_TYPES = [
  "business_travel",
  "client_visit",
  "training",
  "field_work",
  "official_duty",
] as const;
export type AttendanceExceptionType =
  (typeof ATTENDANCE_EXCEPTION_TYPES)[number];

export interface AttendanceShiftDto {
  id: string;
  entityId: string | null;
  shiftName: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  active: boolean;
}

export interface AttendanceExceptionDto {
  id: string;
  employeeId: string;
  type: AttendanceExceptionType;
  startDate: string;
  endDate: string;
  reason: string;
  status: string;
  approvedBy: string | null;
  approvedAt: string | null;
  createdAt: string;
  employee?: AttendanceEmployeeSummary;
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
    status: AttendanceStatus;
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

export interface AttendanceEmployeeSummary {
  id: string;
  name: string;
  email: string;
  department: string | null;
  employeeId: string | null;
}

export interface AttendanceTimeDisplay {
  utc: string | null;
  employeeLocal: string | null;
  employeeLocalTime: string | null;
  companyLocal: string | null;
  companyLocalTime: string | null;
  employeeTimezone: string | null;
  companyTimezone: string;
}

export interface AttendanceRecordDto {
  id: string;
  employeeId: string;
  attendanceDate: string;
  checkIn: string | null;
  checkOut: string | null;
  checkInUtc: string | null;
  checkOutUtc: string | null;
  employeeTimezone: string | null;
  localCheckInTime: string | null;
  localCheckOutTime: string | null;
  checkInDisplay?: AttendanceTimeDisplay;
  checkOutDisplay?: AttendanceTimeDisplay;
  workMode: AttendanceWorkMode;
  status: AttendanceStatus;
  totalHours: number | null;
  lateMinutes: number;
  remarks: string | null;
  createdAt: string;
  updatedAt: string;
  employee?: AttendanceEmployeeSummary;
}

export type AttendanceCalendarCode = "P" | "A" | "L" | "R" | "H" | "E" | "-";

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

export interface AttendanceShiftAssignmentDto {
  id: string;
  employeeId: string;
  shiftId: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  employee?: AttendanceEmployeeSummary;
}

export interface EmployeeAttendanceProfile {
  employeeId: string;
  name: string;
  department: string | null;
  attendancePercentage: number;
  latePercentage: number;
  currentShift: AttendanceShiftDto | null;
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
