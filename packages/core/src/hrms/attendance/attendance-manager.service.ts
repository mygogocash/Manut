import type { Db } from "@nexora/db";
import { PERMISSIONS } from "@nexora/contracts";
import { ForbiddenException } from "../../http-exception.js";
import * as attendanceRepo from "./attendance.repository.js";
import type { AttendanceStatus, ManagerTeamDashboard } from "@nexora/contracts/modules/hrms/attendance.types";
import * as calendarService from "./attendance-calendar.service.js";
import { findDirectReportIds, findDirectReports } from "../../leave/leave.repository.js";

function toDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

export async function getTeamDashboard(
  db: Db,
  actorId: string,
  actorPermissions: string[],
): Promise<ManagerTeamDashboard> {
  const canViewAll = actorPermissions.includes(PERMISSIONS.HRMS_ATTENDANCE_MANAGE);

  const reportIds = canViewAll ? null : await findDirectReportIds(db, actorId);

  if (!canViewAll && (!reportIds || reportIds.length === 0)) {
    throw new ForbiddenException("You do not have direct reports to view team attendance");
  }

  const today = toDateOnly(new Date());
  const teamMembers = canViewAll
    ? await attendanceRepo.findActiveEmployees(db)
    : (await findDirectReports(db, actorId)).map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        department: u.department,
        employeeId: null as string | null,
        entityId: u.entityId,
      }));

  const teamIds = teamMembers.map((m) => m.id);
  const records = await attendanceRepo.findRecordsForDate(db, today, teamIds);
  const recordByEmployee = new Map(records.map((r) => [r.employeeId, r]));

  let presentToday = 0;
  let absentToday = 0;
  let lateToday = 0;
  let onLeaveToday = 0;

  const members = await Promise.all(
    teamMembers.map(async (emp) => {
      const existing = recordByEmployee.get(emp.id);
      let status: AttendanceStatus = existing ? (existing.status as AttendanceStatus) : "absent";

      if (!existing) {
        const classified = await calendarService.classifyNonWorkingDay(
          db,
          emp.id,
          emp.entityId ?? null,
          today,
        );
        if (classified) status = classified.status;
      }

      if (status === "present" || status === "remote" || status === "hybrid") {
        presentToday++;
      } else if (status === "late") {
        lateToday++;
        presentToday++;
      } else if (status === "on_leave") {
        onLeaveToday++;
      } else if (status === "absent") {
        absentToday++;
      }

      return {
        employeeId: emp.id,
        name: emp.name,
        department: emp.department,
        status,
        checkIn: existing?.checkIn ? String(existing.checkIn) : null,
        lateMinutes: existing?.lateMinutes ?? 0,
      };
    }),
  );

  const accountable = teamMembers.length - onLeaveToday;
  const attendancePercentage =
    accountable > 0 ? Math.round((presentToday / accountable) * 1000) / 10 : 0;

  return {
    teamSize: teamMembers.length,
    presentToday,
    absentToday,
    lateToday,
    onLeaveToday,
    attendancePercentage,
    date: today.toISOString().slice(0, 10),
    members,
  };
}
