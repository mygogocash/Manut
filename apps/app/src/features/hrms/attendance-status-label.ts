import type { AttendanceStatus, AttendanceWorkMode } from "@manut/app-core";

export function attendanceStatusLabel(status: AttendanceStatus): string {
  switch (status) {
    case "present":
      return "Present";
    case "late":
      return "Late";
    case "absent":
      return "Absent";
    case "on_leave":
      return "On leave";
    case "remote":
      return "Remote";
    case "hybrid":
      return "Hybrid";
    case "public_holiday":
      return "Public holiday";
    case "weekend":
      return "Weekend";
    case "on_exception":
      return "On exception";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function attendanceWorkModeLabel(workMode: AttendanceWorkMode): string {
  switch (workMode) {
    case "office":
      return "Office";
    case "remote":
      return "Remote";
    case "hybrid":
      return "Hybrid";
    default: {
      const _exhaustive: never = workMode;
      return _exhaustive;
    }
  }
}
