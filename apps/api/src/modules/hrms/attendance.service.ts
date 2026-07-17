import { PERMISSIONS } from "@/common/constants/permissions";
import {
  BadRequestException,
  ForbiddenException,
} from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import { attendanceRepository } from "@/modules/hrms/attendance.repository";
import type {
  AttendanceDashboardSummary,
  AttendancePolicyConfig,
  AttendanceRecordDto,
  AttendanceStatus,
  AttendanceWorkMode,
  DepartmentAttendanceSummary,
  MonthlyAttendanceReport,
} from "@/modules/hrms/attendance.types";
import type {
  CheckInInput,
  CheckOutInput,
  DepartmentReportQuery,
  MonthlyReportQuery,
  MyAttendanceQuery,
} from "@/modules/hrms/attendance.validation";
import { attendanceCalendarService } from "@/modules/hrms/attendance-calendar.service";
import { parseAttendanceMonth } from "@/modules/hrms/attendance-period.util";
import { serializeAttendanceRecord } from "@/modules/hrms/attendance-record.serializer";
import {
  attendanceDateFromInstant,
  COMPANY_DEFAULT_TIMEZONE,
  computeLateMinutesInTimezone,
  formatLocalDateTime,
  resolveEmployeeTimezone,
} from "@/modules/hrms/attendance-timezone.util";

function formatDateYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function parseReportMonth(
  month?: string,
  companyTz: string = COMPANY_DEFAULT_TIMEZONE,
): { from: Date; to: Date; label: string } {
  // Default the "current month" off the company-local calendar day, not the
  // server's UTC day, so a report opened near the month boundary in an
  // ahead-of-UTC office still defaults to the local month.
  const localDay = attendanceDateFromInstant(new Date(), companyTz);
  return parseAttendanceMonth(month, localDay);
}

function countWeekdaysInRange(from: Date, to: Date): number {
  let count = 0;
  const cursor = new Date(from);
  while (cursor <= to) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) count++;
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return count;
}

function computeTotalHours(checkIn: Date, checkOut: Date): number {
  const ms = checkOut.getTime() - checkIn.getTime();
  if (ms <= 0) return 0;
  return Math.round((ms / 3_600_000) * 100) / 100;
}

function resolveStatus(
  workMode: AttendanceWorkMode,
  onLeave: boolean,
  lateMinutes: number,
): AttendanceStatus {
  if (onLeave) return "on_leave";
  if (workMode === "remote") return lateMinutes > 0 ? "late" : "remote";
  if (workMode === "hybrid") return lateMinutes > 0 ? "late" : "hybrid";
  return lateMinutes > 0 ? "late" : "present";
}

export class AttendanceService {
  private canViewAll(actorPermissions: string[]): boolean {
    return (
      actorPermissions.includes(PERMISSIONS.HRMS_ATTENDANCE_MANAGE) ||
      actorPermissions.includes(PERMISSIONS.HRMS_ATTENDANCE_READ)
    );
  }

  private async getUserAttendanceContext(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { entityId: true, timezone: true },
    });
    const policyRow = await attendanceRepository.findPolicyForEntity(
      user?.entityId ?? null,
    );
    const companyTz = policyRow?.defaultTimezone ?? COMPANY_DEFAULT_TIMEZONE;
    const employeeTz = resolveEmployeeTimezone(user?.timezone, companyTz);
    const policy: AttendancePolicyConfig = policyRow
      ? {
          shiftStartTime: policyRow.shiftStartTime,
          shiftEndTime: policyRow.shiftEndTime,
          graceMinutes: policyRow.graceMinutes,
          defaultTimezone: companyTz,
        }
      : {
          shiftStartTime: "09:00",
          shiftEndTime: "18:00",
          graceMinutes: 15,
          defaultTimezone: companyTz,
        };
    return { user, policy, employeeTz, companyTz };
  }

  private todayForUser(employeeTz: string, at = new Date()): Date {
    return attendanceDateFromInstant(at, employeeTz);
  }

  // Company-wide default timezone (global/default policy). Used by the
  // all-employees views (live monitor, dashboard) so the queried day matches
  // the timezone the write path stamps records in — otherwise early-morning
  // check-ins in ahead-of-UTC offices fall on the wrong UTC day.
  private async resolveCompanyTz(): Promise<string> {
    const policy = await attendanceRepository.findPolicyForEntity(null);
    return policy?.defaultTimezone ?? COMPANY_DEFAULT_TIMEZONE;
  }

  async checkIn(
    actorId: string,
    input: CheckInInput,
  ): Promise<AttendanceRecordDto> {
    const { policy, employeeTz, companyTz } =
      await this.getUserAttendanceContext(actorId);
    const now = new Date();
    const today = this.todayForUser(employeeTz, now);
    const existing = await attendanceRepository.findRecordByEmployeeAndDate(
      actorId,
      today,
    );
    if (existing?.checkIn) {
      throw new BadRequestException("Already checked in for today");
    }

    const onLeave = await attendanceRepository.hasApprovedLeaveOnDate(
      actorId,
      today,
    );
    const lateMinutes = onLeave
      ? 0
      : computeLateMinutesInTimezone(
          now,
          policy.shiftStartTime,
          policy.graceMinutes,
          today,
          employeeTz,
        );
    const status = resolveStatus(input.workMode, onLeave, lateMinutes);
    const localCheckInTime = formatLocalDateTime(now, employeeTz);

    const tzPayload = {
      checkIn: now,
      checkInUtc: now,
      employeeTimezone: employeeTz,
      localCheckInTime,
    };

    const record = existing
      ? await attendanceRepository.updateRecord(existing.id, {
          ...tzPayload,
          workMode: input.workMode,
          status,
          lateMinutes,
          remarks: input.remarks ?? existing.remarks,
        })
      : await attendanceRepository.createRecord({
          employeeId: actorId,
          attendanceDate: today,
          ...tzPayload,
          workMode: input.workMode,
          status,
          lateMinutes,
          remarks: input.remarks ?? null,
        });

    await attendanceRepository.createAuditLog({
      recordId: record.id,
      employeeId: actorId,
      actorId,
      action: "check_in",
      details: { workMode: input.workMode, status, lateMinutes },
    });

    return serializeAttendanceRecord(record, companyTz);
  }

  async checkOut(
    actorId: string,
    input: CheckOutInput,
  ): Promise<AttendanceRecordDto> {
    const { employeeTz, companyTz } =
      await this.getUserAttendanceContext(actorId);
    const now = new Date();
    const today = this.todayForUser(employeeTz, now);
    const existing = await attendanceRepository.findRecordByEmployeeAndDate(
      actorId,
      today,
    );
    if (!existing?.checkIn) {
      throw new BadRequestException("Check in before checking out");
    }
    if (existing.checkOut) {
      throw new BadRequestException("Already checked out for today");
    }

    const totalHours = computeTotalHours(existing.checkIn, now);

    const record = await attendanceRepository.updateRecord(existing.id, {
      checkOut: now,
      checkOutUtc: now,
      localCheckOutTime: formatLocalDateTime(now, employeeTz),
      employeeTimezone: existing.employeeTimezone ?? employeeTz,
      totalHours,
      remarks: input.remarks ?? existing.remarks,
    });

    await attendanceRepository.createAuditLog({
      recordId: record.id,
      employeeId: actorId,
      actorId,
      action: "check_out",
      details: { totalHours },
    });

    return serializeAttendanceRecord(record, companyTz);
  }

  async getToday(actorId: string): Promise<AttendanceRecordDto | null> {
    const { employeeTz, companyTz } =
      await this.getUserAttendanceContext(actorId);
    const today = this.todayForUser(employeeTz);
    const record = await attendanceRepository.findRecordByEmployeeAndDate(
      actorId,
      today,
    );
    return record ? serializeAttendanceRecord(record, companyTz) : null;
  }

  async getLive(
    actorId: string,
    actorPermissions: string[],
  ): Promise<AttendanceRecordDto[]> {
    if (!this.canViewAll(actorPermissions)) {
      throw new ForbiddenException(
        "You do not have permission to view live attendance",
      );
    }

    const companyTz = await this.resolveCompanyTz();
    const today = attendanceDateFromInstant(new Date(), companyTz);
    const records = await attendanceRepository.findRecordsForDate(today);
    const activeEmployees = await attendanceRepository.findActiveEmployees();
    const recordByEmployee = new Map(records.map((r) => [r.employeeId, r]));

    const merged = await Promise.all(
      activeEmployees.map(async (emp) => {
        const existing = recordByEmployee.get(emp.id);
        if (existing) return serializeAttendanceRecord(existing, companyTz);

        const classified =
          await attendanceCalendarService.classifyNonWorkingDay(
            emp.id,
            emp.entityId ?? null,
            today,
          );
        const virtualStatus: AttendanceStatus = classified?.status ?? "absent";

        return {
          id: `virtual-${emp.id}`,
          employeeId: emp.id,
          attendanceDate: formatDateYmd(today),
          checkIn: null,
          checkOut: null,
          checkInUtc: null,
          checkOutUtc: null,
          employeeTimezone: null,
          localCheckInTime: null,
          localCheckOutTime: null,
          workMode: "office" as AttendanceWorkMode,
          status: virtualStatus,
          totalHours: null,
          lateMinutes: 0,
          remarks: classified?.label ?? null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          employee: {
            id: emp.id,
            name: emp.name,
            email: emp.email,
            department: emp.department,
            employeeId: emp.employeeId,
          },
        };
      }),
    );

    return merged;
  }

  async getDashboard(
    actorPermissions: string[],
  ): Promise<AttendanceDashboardSummary> {
    if (!this.canViewAll(actorPermissions)) {
      throw new ForbiddenException(
        "You do not have permission to view attendance dashboard",
      );
    }

    const companyTz = await this.resolveCompanyTz();
    const today = attendanceDateFromInstant(new Date(), companyTz);
    const records = await attendanceRepository.findRecordsForDate(today);
    const totalActive = await attendanceRepository.countActiveEmployees();

    const statusCounts = {
      present: 0,
      late: 0,
      absent: 0,
      remote: 0,
      hybrid: 0,
      on_leave: 0,
    };

    for (const r of records) {
      const s = r.status as keyof typeof statusCounts;
      if (s in statusCounts) statusCounts[s]++;
    }

    let virtualAbsent = 0;
    const employeesWithoutRecord =
      await attendanceRepository.findActiveEmployees();
    const recordedIds = new Set(records.map((r) => r.employeeId));
    for (const emp of employeesWithoutRecord) {
      if (recordedIds.has(emp.id)) continue;
      const classified = await attendanceCalendarService.classifyNonWorkingDay(
        emp.id,
        emp.entityId ?? null,
        today,
      );
      if (!classified) virtualAbsent++;
      else if (classified.status === "on_leave") statusCounts.on_leave++;
      else if (classified.status === "public_holiday") {
        /* not counted absent */
      } else if (classified.status === "weekend") {
        /* not counted absent */
      } else if (classified.status === "on_exception") {
        /* not counted absent */
      }
    }

    const absentToday = statusCounts.absent + virtualAbsent;

    return {
      presentToday: statusCounts.present,
      absentToday,
      lateToday: statusCounts.late,
      remoteToday: statusCounts.remote,
      hybridToday: statusCounts.hybrid,
      onLeaveToday: statusCounts.on_leave,
      totalActiveEmployees: totalActive,
      date: formatDateYmd(today),
    };
  }

  async getMyAttendance(
    actorId: string,
    query: MyAttendanceQuery,
  ): Promise<{
    data: AttendanceRecordDto[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const from = query.from
      ? new Date(`${query.from}T00:00:00.000Z`)
      : undefined;
    const to = query.to ? new Date(`${query.to}T00:00:00.000Z`) : undefined;

    const { companyTz } = await this.getUserAttendanceContext(actorId);
    const { data, total } = await attendanceRepository.findRecords(
      {
        employeeId: actorId,
        from,
        to,
        status: query.status,
      },
      query.page,
      query.limit,
    );

    return {
      data: data.map((r) => serializeAttendanceRecord(r, companyTz)),
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit) || 1,
      },
    };
  }

  async getMonthlyReport(
    actorId: string,
    actorPermissions: string[],
    query: MonthlyReportQuery,
  ): Promise<MonthlyAttendanceReport> {
    const canViewAll = this.canViewAll(actorPermissions);
    const targetEmployeeId =
      query.employeeId && canViewAll ? query.employeeId : actorId;

    if (query.employeeId && query.employeeId !== actorId && !canViewAll) {
      throw new ForbiddenException("Cannot view another employee's report");
    }

    const { from, to, label } = parseReportMonth(query.month);
    const records = await attendanceRepository.findRecordsInRange(from, to, {
      employeeId: targetEmployeeId,
      department: query.department,
    });

    const user = await prisma.user.findUnique({
      where: { id: targetEmployeeId },
      select: { entityId: true },
    });
    const totalWorkingDays =
      await attendanceCalendarService.countWorkingDaysInRange(
        from,
        to,
        user?.entityId ?? null,
      );
    let daysPresent = 0;
    let remoteDays = 0;
    let officeDays = 0;
    let hybridDays = 0;
    let lateArrivals = 0;
    let absenteeCount = 0;

    for (const r of records) {
      if (r.status === "late") lateArrivals++;
      if (r.status === "absent") absenteeCount++;
      if (
        r.status === "present" ||
        r.status === "late" ||
        r.status === "remote" ||
        r.status === "hybrid"
      ) {
        daysPresent++;
      }
      if (r.workMode === "remote") remoteDays++;
      if (r.workMode === "office") officeDays++;
      if (r.workMode === "hybrid") hybridDays++;
    }

    const attendancePercentage =
      totalWorkingDays > 0
        ? Math.round((daysPresent / totalWorkingDays) * 1000) / 10
        : 0;

    const remoteVsOfficeRatio =
      officeDays + remoteDays + hybridDays > 0
        ? Math.round(
            ((remoteDays + hybridDays) /
              (officeDays + remoteDays + hybridDays)) *
              1000,
          ) / 10
        : 0;

    return {
      month: label,
      employeeId: targetEmployeeId,
      attendancePercentage,
      lateArrivals,
      absenteeCount,
      remoteDays,
      officeDays,
      hybridDays,
      totalWorkingDays,
      daysPresent,
      remoteVsOfficeRatio,
    };
  }

  async getDepartmentReport(
    actorPermissions: string[],
    query: DepartmentReportQuery,
  ): Promise<DepartmentAttendanceSummary[]> {
    if (!this.canViewAll(actorPermissions)) {
      throw new ForbiddenException(
        "You do not have permission to view department attendance",
      );
    }

    const { from, to } = parseReportMonth(query.month);
    const records = await attendanceRepository.findRecordsInRange(from, to, {
      department: query.department,
    });
    const employees = await attendanceRepository.findActiveEmployees(
      query.department,
    );

    const deptMap = new Map<string, DepartmentAttendanceSummary>();

    for (const emp of employees) {
      const dept = emp.department?.trim() || "Unassigned";
      if (!deptMap.has(dept)) {
        deptMap.set(dept, {
          department: dept,
          headcount: 0,
          presentCount: 0,
          absentCount: 0,
          lateCount: 0,
          remoteCount: 0,
          hybridCount: 0,
          onLeaveCount: 0,
          attendancePercentage: 0,
        });
      }
      deptMap.get(dept)!.headcount++;
    }

    for (const r of records) {
      const dept = r.employee?.department?.trim() || "Unassigned";
      const entry = deptMap.get(dept);
      if (!entry) continue;

      if (r.status === "present") entry.presentCount++;
      if (r.status === "absent") entry.absentCount++;
      if (r.status === "late") entry.lateCount++;
      if (r.status === "remote") entry.remoteCount++;
      if (r.status === "hybrid") entry.hybridCount++;
      if (r.status === "on_leave") entry.onLeaveCount++;
    }

    const workingDays = countWeekdaysInRange(from, to);

    for (const entry of deptMap.values()) {
      const attended =
        entry.presentCount +
        entry.lateCount +
        entry.remoteCount +
        entry.hybridCount;
      const possible = entry.headcount * workingDays;
      entry.attendancePercentage =
        possible > 0 ? Math.round((attended / possible) * 1000) / 10 : 0;
    }

    return [...deptMap.values()].sort((a, b) =>
      a.department.localeCompare(b.department),
    );
  }
}

export const attendanceService = new AttendanceService();
