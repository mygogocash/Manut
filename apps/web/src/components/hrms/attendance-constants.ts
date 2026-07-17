export const ATTENDANCE_SUB_TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "my-attendance", label: "My Attendance" },
  { id: "calendar", label: "Calendar" },
  { id: "monthly-reports", label: "Monthly Reports" },
  { id: "live", label: "Live Monitor" },
  { id: "corrections", label: "Corrections" },
  { id: "team", label: "Team Dashboard" },
  { id: "analytics", label: "Analytics" },
  { id: "executive", label: "Executive" },
  { id: "shift-assignment", label: "Shift Assignment" },
  { id: "settings", label: "Settings" },
] as const;

export type AttendanceSubTabId = (typeof ATTENDANCE_SUB_TABS)[number]["id"];

export const LIVE_REFRESH_MS = 30_000;
