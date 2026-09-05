import * as XLSX from "xlsx";
import type { Db } from "@nexora/db";
import { neutralizeFormula, rowsToCsv } from "../../lib/csv.js";
import * as attendanceRepo from "./attendance.repository.js";
import * as calendarService from "./attendance-calendar.service.js";
import type { ExportQuery } from "@nexora/contracts/modules/hrms/attendance-phase2.validation";

function parseMonth(month?: string): { from: Date; to: Date } {
  const now = new Date();
  const parts = (
    month ?? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`
  ).split("-");
  const year = Number(parts[0]);
  const mon = Number(parts[1]);
  const from = new Date(Date.UTC(year, mon - 1, 1));
  const to = new Date(Date.UTC(year, mon, 0));
  return { from, to };
}

function buildFilename(base: string, format: string) {
  return `${base}.${format === "xlsx" ? "xlsx" : "csv"}`;
}

function toBuffer(headers: string[], rows: unknown[][], format: string) {
  if (format === "xlsx") {
    const safeRows = rows.map((row) => row.map(neutralizeFormula));
    const sheet = XLSX.utils.aoa_to_sheet([headers, ...safeRows]);
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Attendance");
    return XLSX.write(book, { type: "buffer", bookType: "xlsx" }) as Buffer;
  }
  return Buffer.from(rowsToCsv(headers, rows), "utf-8");
}

function dateCell(v: string | Date | null | undefined): string {
  if (!v) return "";
  return v instanceof Date ? v.toISOString() : String(v);
}

export async function exportDaily(db: Db, query: ExportQuery) {
  const date = query.date
    ? new Date(`${query.date}T00:00:00.000Z`)
    : new Date(
        Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate()),
      );

  const records = await attendanceRepo.findRecordsForDate(db, date);
  const filtered = query.department
    ? records.filter((r) => (r.employee?.department ?? "Unassigned") === query.department)
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
    String(r.attendanceDate).slice(0, 10),
    r.employee?.name ?? "",
    r.employee?.department ?? "",
    dateCell(r.checkIn),
    dateCell(r.checkOut),
    r.workMode,
    r.status,
    r.lateMinutes,
    r.totalHours !== null && r.totalHours !== undefined ? Number(r.totalHours) : "",
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
}

export async function exportMonthly(db: Db, query: ExportQuery) {
  const { from, to } = parseMonth(query.month);
  const records = await attendanceRepo.findRecordsInRange(db, from, to, {
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
    String(r.attendanceDate).slice(0, 10),
    r.employee?.name ?? "",
    r.employee?.department ?? "",
    dateCell(r.checkIn),
    dateCell(r.checkOut),
    r.workMode,
    r.status,
    r.lateMinutes,
    r.totalHours !== null && r.totalHours !== undefined ? Number(r.totalHours) : "",
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
}

export async function exportDepartment(db: Db, query: ExportQuery) {
  const { from, to } = parseMonth(query.month);
  const records = await attendanceRepo.findRecordsInRange(db, from, to, {
    department: query.department,
  });
  const employees = await attendanceRepo.findActiveEmployees(db, query.department);

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

  const workingDays = await calendarService.countWorkingDaysInRange(db, from, to, null);
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
}
