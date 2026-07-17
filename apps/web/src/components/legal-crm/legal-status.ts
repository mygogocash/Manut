// Shared Legal-CRM status vocabulary. Extracted from legal-crm-list so the
// table and the board render identical labels / colours and bucket rows
// the same way. Legal uses a three-state workflow (matches the team's
// Google Sheet, 2026-05-26); the full enum still lives in the API for
// other teams — this surface only cares about the three Legal uses.

export const STATUS_OPTIONS = [
  { value: "completed", label: "Complete" },
  { value: "in_progress", label: "In progress" },
  { value: "pending_dept_info", label: "Pending Dept. Info" },
] as const;

export type LegalStatus = (typeof STATUS_OPTIONS)[number]["value"];

export const STATUS_LABELS: Record<string, string> = Object.fromEntries(
  STATUS_OPTIONS.map((s) => [s.value, s.label]),
);

export type StatusVariant =
  "green" | "amber" | "red" | "gold" | "blue" | "grey" | "purple" | "teal";

export const STATUS_VARIANTS: Record<string, StatusVariant> = {
  completed: "green",
  in_progress: "red",
  pending_dept_info: "purple",
};

// Top-border accent for the board columns, matching the badge colours.
export const STATUS_BORDER: Record<string, string> = {
  completed: "border-t-green-600",
  in_progress: "border-t-red-500",
  pending_dept_info: "border-t-purple-500",
};

// Map the xlsx free-text Status to the three-state workflow. Unknown
// values fall through to `in_progress` so every row still buckets.
export function normalizeLegalStatus(raw: string | null | undefined): string {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return "in_progress";
  if (/^complete/.test(s) || s === "done") return "completed";
  if (/^pending[\s_-]*dept/.test(s) || /^pending[\s_-]*info/.test(s)) {
    return "pending_dept_info";
  }
  if (/^on[\s_-]*hold/.test(s) || s === "blocked" || s === "paused") {
    return "pending_dept_info";
  }
  return "in_progress";
}
