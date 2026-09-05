import { PERMISSIONS } from "@/common/constants/permissions";
import { ForbiddenException } from "@/common/exceptions/http-exception";
import { attendanceRepository } from "@/modules/hrms/attendance.repository";
import type {
  AttendanceCalendarCode,
  AttendanceCalendarView,
  AttendanceStatus,
} from "@/modules/hrms/attendance.types";
import { attendanceCalendarService } from "@/modules/hrms/attendance-calendar.service";
import type { CalendarQuery } from "@/modules/hrms/attendance-phase3.validation";
import { leaveRepository } from "@/modules/leave/leave.repository";

function parseMonth(month: string): { from: Date; to: Date; days: string[] } {
  const [year, mon] = month.split("-").map(Number);
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
    // falls through
    case "late":
      return "P";
    case "absent":
      return "A";
    case "on_leave":
      return "L";
    case "remote":
    // falls through
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

export const attendanceCalendarViewService = {
  async getCalendar(
    actorId: string,
    actorPermissions: string[],
    query: CalendarQuery,
  ): Promise<AttendanceCalendarView> {
    const canViewAll = actorPermissions.includes(
      PERMISSIONS.HRMS_ATTENDANCE_MANAGE,
    );
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
      const user = await attendanceRepository.findActiveEmployees();
      const emp = user.find((u) => u.id === targetId);
      if (!emp) throw new ForbiddenException("Employee not found");
      employees = [emp];
    } else if (query.scope === "team") {
      const directReports = await leaveRepository.findDirectReports(actorId);
      employees = directReports.map((u) => ({
        id: u.id,
        name: u.name,
        department: u.department,
        entityId: u.entityId,
      }));
    } else {
      if (!canRead) {
        throw new ForbiddenException(
          "Department calendar requires HR attendance access",
        );
      }
      employees = await attendanceRepository.findActiveEmployees(
        query.department,
      );
    }

    if (!employees.length) {
      return {
        month: query.month,
        scope: query.scope,
        days,
        rows: [],
      };
    }

    const employeeIds = employees.map((e) => e.id);
    const [records, classification] = await Promise.all([
      attendanceRepository.findRecordsInRange(from, to, { employeeIds }),
      attendanceCalendarService.buildMonthClassificationContext(
        employees,
        from,
        to,
      ),
    ]);

    const byEmpDate = new Map<string, (typeof records)[0]>();
    for (const r of records) {
      const key = `${r.employeeId}:${r.attendanceDate.toISOString().slice(0, 10)}`;
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
        const classified = classification.classify(
          emp.id,
          emp.entityId ?? null,
          dayDate,
        );
        cells[day] = classified ? statusToCode(classified.status) : "A";
      }
      return {
        employeeId: emp.id,
        name: emp.name,
        department: emp.department,
        cells,
      };
    });

    return {
      month: query.month,
      scope: query.scope,
      days,
      rows,
    };
  },
};
