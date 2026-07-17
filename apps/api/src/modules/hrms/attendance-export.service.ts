import * as XLSX from "xlsx";

import { neutralizeFormula, rowsToCsv } from "@/common/utils/csv";
import { attendanceRepository } from "@/modules/hrms/attendance.repository";
import { attendanceCalendarService } from "@/modules/hrms/attendance-calendar.service";
import {
  parseAttendanceDate,
  parseAttendanceMonth,
} from "@/modules/hrms/attendance-period.util";
import type { ExportQuery } from "@/modules/hrms/attendance-phase2.validation";

function buildFilename(base: string, format: string) {
  return `${base}.${format === "xlsx" ? "xlsx" : "csv"}`;
}

function toBuffer(headers: string[], rows: unknown[][], format: string) {
  if (format === "xlsx") {
    // aoa_to_sheet treats a leading "=" string as a formula — neutralize
    // string cells the same way the CSV path does (numbers untouched).
    const safeRows = rows.map((row) => row.map(neutralizeFormula));
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...safeRows]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Attendance");
    return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
  }
  return Buffer.from(rowsToCsv(headers, rows), "utf-8");
}

export const attendanceExportService = {
  async exportDaily(query: ExportQuery) {
    const date = query.date
      ? parseAttendanceDate(query.date).date
      : new Date(
          Date.UTC(
            new Date().getUTCFullYear(),
            new Date().getUTCMonth(),
            new Date().getUTCDate(),
          ),
        );

    const records = await attendanceRepository.findRecordsForDate(
      date,
      undefined,
    );
    const filtered = query.department
      ? records.filter(
          (r) => (r.employee?.department ?? "Unassigned") === query.department,
        )
      : records;

    const headers = [
      "Date",
      "Employee",
      "Department",
      "Check In",
      "Check Out",
      "Work Mode",
      "Status",
      "Late (min)",
      "Hours",
    ];
    const rows = filtered.map((r) => [
      r.attendanceDate.toISOString().slice(0, 10),
      r.employee?.name ?? "",
      r.employee?.department ?? "",
      r.checkIn?.toISOString() ?? "",
      r.checkOut?.toISOString() ?? "",
      r.workMode,
      r.status,
      r.lateMinutes,
      r.totalHours !== null ? Number(r.totalHours) : "",
    ]);

    const ymd = date.toISOString().slice(0, 10);
    return {
      buffer: toBuffer(headers, rows, query.format),
      filename: buildFilename(`attendance-daily-${ymd}`, query.format),
      contentType:
        query.format === "xlsx"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "text/csv; charset=utf-8",
    };
  },

  async exportMonthly(query: ExportQuery) {
    const { from, to } = parseAttendanceMonth(query.month);
    const records = await attendanceRepository.findRecordsInRange(from, to, {
      department: query.department,
    });

    const headers = [
      "Date",
      "Employee",
      "Department",
      "Check In",
      "Check Out",
      "Work Mode",
      "Status",
      "Late (min)",
      "Hours",
    ];
    const rows = records.map((r) => [
      r.attendanceDate.toISOString().slice(0, 10),
      r.employee?.name ?? "",
      r.employee?.department ?? "",
      r.checkIn?.toISOString() ?? "",
      r.checkOut?.toISOString() ?? "",
      r.workMode,
      r.status,
      r.lateMinutes,
      r.totalHours !== null ? Number(r.totalHours) : "",
    ]);

    const label = query.month ?? from.toISOString().slice(0, 7);
    return {
      buffer: toBuffer(headers, rows, query.format),
      filename: buildFilename(`attendance-monthly-${label}`, query.format),
      contentType:
        query.format === "xlsx"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "text/csv; charset=utf-8",
    };
  },

  async exportDepartment(query: ExportQuery) {
    const { from, to } = parseAttendanceMonth(query.month);
    const records = await attendanceRepository.findRecordsInRange(from, to, {
      department: query.department,
    });
    const employees = await attendanceRepository.findActiveEmployees(
      query.department,
    );

    const deptMap = new Map<
      string,
      {
        department: string;
        headcount: number;
        present: number;
        absent: number;
        late: number;
        remote: number;
        onLeave: number;
      }
    >();

    for (const emp of employees) {
      const dept = emp.department?.trim() || "Unassigned";
      if (!deptMap.has(dept)) {
        deptMap.set(dept, {
          department: dept,
          headcount: 0,
          present: 0,
          absent: 0,
          late: 0,
          remote: 0,
          onLeave: 0,
        });
      }
      deptMap.get(dept)!.headcount++;
    }

    for (const r of records) {
      const dept = r.employee?.department?.trim() || "Unassigned";
      const entry = deptMap.get(dept);
      if (!entry) continue;
      if (r.status === "present") entry.present++;
      if (r.status === "late") entry.late++;
      if (r.status === "remote" || r.status === "hybrid") entry.remote++;
      if (r.status === "on_leave") entry.onLeave++;
    }

    // "absent" is virtual (never persisted): derive per department from the
    // working-day capacity minus every accounted day.
    const workingDays = await attendanceCalendarService.countWorkingDaysInRange(
      from,
      to,
      null,
    );
    for (const d of deptMap.values()) {
      const accounted = d.present + d.late + d.remote + d.onLeave;
      d.absent = Math.max(0, d.headcount * workingDays - accounted);
    }

    const headers = [
      "Department",
      "Headcount",
      "Present",
      "Absent",
      "Late",
      "Remote/Hybrid",
      "On Leave",
    ];
    const rows = [...deptMap.values()].map((d) => [
      d.department,
      d.headcount,
      d.present,
      d.absent,
      d.late,
      d.remote,
      d.onLeave,
    ]);

    const label = query.month ?? from.toISOString().slice(0, 7);
    return {
      buffer: toBuffer(headers, rows, query.format),
      filename: buildFilename(`attendance-department-${label}`, query.format),
      contentType:
        query.format === "xlsx"
          ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : "text/csv; charset=utf-8",
    };
  },
};
