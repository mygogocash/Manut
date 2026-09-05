import { PERMISSIONS } from "@/common/constants/permissions";
import { ForbiddenException } from "@/common/exceptions/http-exception";
import { prisma } from "@/infrastructure/database/prisma";
import { attendanceRepository } from "@/modules/hrms/attendance.repository";
import type { ExecutiveAttendanceAnalytics } from "@/modules/hrms/attendance.types";
import { attendanceCalendarService } from "@/modules/hrms/attendance-calendar.service";
import type { ExecutiveAnalyticsQuery } from "@/modules/hrms/attendance-phase3.validation";
import { serializeAttendanceRecord } from "@/modules/hrms/attendance-record.serializer";
import { attendanceShiftService } from "@/modules/hrms/attendance-shift.service";
import { COMPANY_DEFAULT_TIMEZONE } from "@/modules/hrms/attendance-timezone.util";

function parseMonth(month?: string): { from: Date; to: Date; label: string } {
  const now = new Date();
  const [year, mon] = (
    month ??
    `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`
  )
    .split("-")
    .map(Number);
  const from = new Date(Date.UTC(year, mon - 1, 1));
  const to = new Date(Date.UTC(year, mon, 0));
  return { from, to, label: `${year}-${String(mon).padStart(2, "0")}` };
}

export const attendanceExecutiveService = {
  async getExecutiveAnalytics(
    actorPermissions: string[],
    query: ExecutiveAnalyticsQuery,
  ): Promise<ExecutiveAttendanceAnalytics> {
    const canView =
      actorPermissions.includes(PERMISSIONS.HRMS_ATTENDANCE_MANAGE) ||
      actorPermissions.includes(PERMISSIONS.HRMS_ATTENDANCE_READ);
    if (!canView) {
      throw new ForbiddenException(
        "Executive attendance analytics requires HR access",
      );
    }

    const { from, to } = parseMonth(query.month);
    const employees = await attendanceRepository.findActiveEmployees(
      query.department,
    );
    const records = await attendanceRepository.findRecordsInRange(from, to, {
      department: query.department,
    });

    const entityId = employees[0]?.entityId ?? null;
    const workingDays = await attendanceCalendarService.countWorkingDaysInRange(
      from,
      to,
      entityId,
    );

    let totalHours = 0;
    let hoursCount = 0;
    const byEmployee = new Map<
      string,
      { present: number; late: number; remote: number; office: number }
    >();

    for (const emp of employees) {
      byEmployee.set(emp.id, { present: 0, late: 0, remote: 0, office: 0 });
    }

    for (const r of records) {
      const bucket = byEmployee.get(r.employeeId);
      if (!bucket) continue;
      if (["present", "late", "remote", "hybrid"].includes(r.status)) {
        bucket.present++;
      }
      if (r.status === "late") bucket.late++;
      if (r.workMode === "remote" || r.status === "remote") bucket.remote++;
      if (r.workMode === "office" || r.status === "present") bucket.office++;
      if (r.totalHours !== null) {
        totalHours += Number(r.totalHours);
        hoursCount++;
      }
    }

    const employeeStats = employees.map((emp) => {
      const b = byEmployee.get(emp.id) ?? {
        present: 0,
        late: 0,
        remote: 0,
        office: 0,
      };
      const possible = workingDays;
      const attendancePercentage =
        possible > 0 ? Math.round((b.present / possible) * 1000) / 10 : 0;
      const latePercentage =
        b.present > 0 ? Math.round((b.late / b.present) * 1000) / 10 : 0;
      return {
        employeeId: emp.id,
        name: emp.name,
        department: emp.department,
        attendancePercentage,
        latePercentage,
        present: b.present,
        late: b.late,
      };
    });

    const mostPunctualEmployees = [...employeeStats]
      .filter((e) => e.present > 0)
      .sort((a, b) => a.latePercentage - b.latePercentage)
      .slice(0, 5)
      .map(({ present: _p, late: _l, ...rest }) => rest);

    const highestAttendanceEmployees = [...employeeStats]
      .sort((a, b) => b.attendancePercentage - a.attendancePercentage)
      .slice(0, 5)
      .map(({ latePercentage: _l, ...rest }) => rest);

    const deptMap = new Map<
      string,
      { headcount: number; absent: number; present: number }
    >();
    for (const emp of employees) {
      const dept = emp.department ?? "Unassigned";
      const cur = deptMap.get(dept) ?? { headcount: 0, absent: 0, present: 0 };
      cur.headcount++;
      const b = byEmployee.get(emp.id);
      if (b) {
        cur.present += b.present;
        cur.absent += Math.max(0, workingDays - b.present);
      }
      deptMap.set(dept, cur);
    }

    const highestAbsenteeDepartments = [...deptMap.entries()]
      .map(([department, v]) => ({
        department,
        headcount: v.headcount,
        absentPercentage:
          v.headcount * workingDays > 0
            ? Math.round((v.absent / (v.headcount * workingDays)) * 1000) / 10
            : 0,
      }))
      .sort((a, b) => b.absentPercentage - a.absentPercentage)
      .slice(0, 5);

    const attendanceTrend: ExecutiveAttendanceAnalytics["attendanceTrend"] = [];
    const remoteVsOfficeTrend: ExecutiveAttendanceAnalytics["remoteVsOfficeTrend"] =
      [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(from);
      d.setUTCMonth(d.getUTCMonth() - i);
      const mFrom = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
      const mTo = new Date(
        Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0),
      );
      const mLabel = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
      const mRecords = await attendanceRepository.findRecordsInRange(
        mFrom,
        mTo,
        { department: query.department },
      );
      const mPresent = mRecords.filter((r) =>
        ["present", "late", "remote", "hybrid"].includes(r.status),
      ).length;
      const mRemote = mRecords.filter(
        (r) => r.workMode === "remote" || r.status === "remote",
      ).length;
      const mOffice = mRecords.filter(
        (r) => r.workMode === "office" && r.status !== "remote",
      ).length;
      const mPossible = employees.length * workingDays;
      const pct =
        mPossible > 0 ? Math.round((mPresent / mPossible) * 1000) / 10 : 0;
      attendanceTrend.push({ month: mLabel, attendancePercentage: pct });
      remoteVsOfficeTrend.push({
        month: mLabel,
        remotePercentage:
          mPresent > 0 ? Math.round((mRemote / mPresent) * 1000) / 10 : 0,
        officePercentage:
          mPresent > 0 ? Math.round((mOffice / mPresent) * 1000) / 10 : 0,
      });
    }

    return {
      averageWorkingHours:
        hoursCount > 0 ? Math.round((totalHours / hoursCount) * 100) / 100 : 0,
      mostPunctualEmployees,
      highestAttendanceEmployees,
      highestAbsenteeDepartments,
      attendanceTrend,
      remoteVsOfficeTrend,
      monthlyAttendanceTrend: attendanceTrend,
    };
  },

  async getEmployeeProfileSummary(employeeId: string, month?: string) {
    const user = await prisma.user.findUnique({
      where: { id: employeeId },
      select: {
        id: true,
        name: true,
        department: true,
        timezone: true,
        entityId: true,
      },
    });
    if (!user) return null;

    const { from, to, label } = parseMonth(month);
    const records = await attendanceRepository.findRecordsInRange(from, to, {
      employeeId,
    });
    const workingDays = await attendanceCalendarService.countWorkingDaysInRange(
      from,
      to,
      user.entityId,
    );

    let present = 0;
    let late = 0;
    for (const r of records) {
      if (["present", "late", "remote", "hybrid"].includes(r.status)) {
        present++;
      }
      if (r.status === "late") late++;
    }

    const lastRecord = await prisma.attendanceRecord.findFirst({
      where: { employeeId, checkIn: { not: null } },
      orderBy: { attendanceDate: "desc" },
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            employeeId: true,
            timezone: true,
          },
        },
      },
    });

    const policy = await attendanceRepository.findPolicyForEntity(
      user.entityId,
    );
    const companyTz = policy?.defaultTimezone ?? COMPANY_DEFAULT_TIMEZONE;
    const shiftAssignment = await attendanceShiftService.getEmployeeShift(
      employeeId,
      new Date(),
    );

    const serialized = lastRecord
      ? serializeAttendanceRecord(lastRecord, companyTz)
      : null;

    return {
      employeeId: user.id,
      name: user.name,
      department: user.department,
      attendancePercentage:
        workingDays > 0 ? Math.round((present / workingDays) * 1000) / 10 : 0,
      latePercentage:
        present > 0 ? Math.round((late / present) * 1000) / 10 : 0,
      currentShift: shiftAssignment?.shift
        ? {
            id: shiftAssignment.shift.id,
            entityId: shiftAssignment.shift.entityId,
            shiftName: shiftAssignment.shift.shiftName,
            startTime: shiftAssignment.shift.startTime,
            endTime: shiftAssignment.shift.endTime,
            graceMinutes: shiftAssignment.shift.graceMinutes,
            active: shiftAssignment.shift.active,
          }
        : null,
      lastCheckIn: serialized?.checkInUtc ?? null,
      lastCheckOut: serialized?.checkOutUtc ?? null,
      lastCheckInDisplay: serialized?.checkInDisplay ?? null,
      lastCheckOutDisplay: serialized?.checkOutDisplay ?? null,
      monthlySummary: {
        month: label,
        employeeId,
        attendancePercentage:
          workingDays > 0 ? Math.round((present / workingDays) * 1000) / 10 : 0,
        lateArrivals: late,
        absenteeCount: Math.max(0, workingDays - present),
        remoteDays: records.filter((r) => r.workMode === "remote").length,
        officeDays: records.filter((r) => r.workMode === "office").length,
        hybridDays: records.filter((r) => r.workMode === "hybrid").length,
        totalWorkingDays: workingDays,
        daysPresent: present,
        remoteVsOfficeRatio:
          present > 0
            ? Math.round(
                (records.filter((r) => r.workMode === "remote").length /
                  present) *
                  1000,
              ) / 10
            : 0,
      },
    };
  },
};
