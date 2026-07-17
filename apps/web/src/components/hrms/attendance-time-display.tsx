import type { AttendanceTimeDisplay } from "@/services/attendance-phase3.service";

export function formatDualTime(
  display: AttendanceTimeDisplay | null | undefined,
  fallbackUtc: string | null,
): string {
  if (display?.employeeLocalTime && display?.companyLocalTime) {
    return `${display.employeeLocalTime} (${display.employeeTimezone ?? "local"}) · ${display.companyLocalTime} (company)`;
  }
  if (!fallbackUtc) return "—";
  return new Date(fallbackUtc).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}
