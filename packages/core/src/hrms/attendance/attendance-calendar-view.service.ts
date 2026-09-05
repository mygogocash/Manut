import type { Db } from "@nexora/db";
import { PERMISSIONS } from "@nexora/contracts";
import { ForbiddenException } from "../../http-exception.js";
import * as attendanceRepo from "./attendance.repository.js";
import type {
  AttendanceCalendarCode,
  AttendanceCalendarView,
  AttendanceStatus,
} from "@nexora/contracts/modules/hrms/attendance.types";
import * as calendarService from "./attendance-calendar.service.js";
import type { CalendarQuery } from "@nexora/contracts/modules/hrms/attendance-phase3.validation";
import { findDirectReports } from "../../leave/leave.repository.js";
import * as metaRepo from "./attendance-meta.repository.js";

function parseMonth(month: string): { from: Date; to: Date; days: string[] } {
  const parts = month.split("-");
  const year = Number(parts[0]);
  const mon = Number(parts[1]);
  const from = new Date(Date.UTC(year, mon - 1, 1));
  const to = new Date(Date.UTC(year, mon, 0));
  const days: string[] = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return { from, to, days };
}

function statusToCode(status: AttendanceStatus): AttendanceCalendarCode {
  switch (status) {
    case "present":
    case "late":
      return "P";
    case "absent":
      return "A";
    case "on_leave":
      return "L";
    case "remote":
    case "hybrid":
      return "R";
    case "public_holiday":
      return "H";
    case "on_exception":
      return "E";
    case "weekend":
      return "-";
    default:
      return "-";
  }
}

export async function getCalendar(
  db: Db,
  actorId: string,
  actorPermissions: string[],
  query: CalendarQuery,
): Promise<AttendanceCalendarView> {
  const canViewAll = actorPermissions.includes(PERMISSIONS.HRMS_ATTENDANCE_MANAGE);
  const canRead =
    canViewAll || actorPermissions.includes(PERMISSIONS.HRMS_ATTENDANCE_READ);

  const { from, to, days } = parseMonth(query.month);

  let employees: Array<{
    id: string;
    name: string;
    department: string | null;
    entityId: string | null;
  }> = [];

  if (query.scope === "employee") {
    const targetId = query.employeeId ?? actorId;
    if (targetId !== actorId && !canRead) {
      throw new ForbiddenException("Cannot view another employee calendar");
    }
    const emp = await metaRepo.findUserById(db, targetId);
    if (!emp) throw new ForbiddenException("Employee not found");
    employees = [emp];
  } else if (query.scope === "team") {
    const directReports = await findDirectReports(db, actorId);
    employees = directReports.map((u) => ({
      id: u.id,
      name: u.name,
      department: u.department,
      entityId: u.entityId,
    }));
  } else {
    if (!canRead) {
      throw new ForbiddenException("Department calendar requires HR attendance access");
    }
    employees = await attendanceRepo.findActiveEmployees(db, query.department);
  }

  if (!employees.length) {
    return { month: query.month, scope: query.scope, days, rows: [] };
  }

  const employeeIds = employees.map((e) => e.id);
  const [records, classification] = await Promise.all([
    attendanceRepo.findRecordsInRange(db, from, to, { employeeIds }),
    calendarService.buildMonthClassificationContext(db, employees, from, to),
  ]);

  const byEmpDate = new Map<string, (typeof records)[0]>();
  for (const r of records) {
    const key = `${r.employeeId}:${String(r.attendanceDate).slice(0, 10)}`;
    byEmpDate.set(key, r);
  }

  const rows = employees.map((emp) => {
    const cells: Record<string, AttendanceCalendarCode> = {};
    for (const day of days) {
      const dayDate = new Date(`${day}T00:00:00.000Z`);
      const rec = byEmpDate.get(`${emp.id}:${day}`);
      if (rec) {
        cells[day] = statusToCode(rec.status as AttendanceStatus);
        continue;
      }
      const classified = classification.classify(emp.id, emp.entityId ?? null, dayDate);
      cells[day] = classified ? statusToCode(classified.status) : "A";
    }
    return {
      employeeId: emp.id,
      name: emp.name,
      department: emp.department,
      cells,
    };
  });

  return { month: query.month, scope: query.scope, days, rows };
}
