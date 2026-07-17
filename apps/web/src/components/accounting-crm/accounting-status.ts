// Shared Accounting-CRM status vocabulary. Extracted from accounting-crm-list so the
// table and the board render identical labels / colours and bucket rows
// the same way. The project-level Status mirrors the five-state kanban the
// task board already uses (Backlog → Done, see DEFAULT_COLUMNS in
// accounting-crm.service.ts), so the two board interpretations share one
// vocabulary. The full enum still lives in the API for other teams — this
// surface only cares about the five Accounting uses.
//
// Migrated from the legacy three-state workflow (Complete / In progress /
// Pending Dept. Info, 2026-05-26). Existing rows keep their stored value
// (no DB migration); the legacy keys are aliased in STATUS_LABELS /
// STATUS_VARIANTS below and remapped by normalizeAccountingStatus so
// historic rows still render and bucket into a visible column.

export const STATUS_OPTIONS = [
  { value: "backlog", label: "Backlog" },
  { value: "todo", label: "To Do" },
  { value: "in_progress", label: "In Progress" },
  { value: "in_review", label: "In Review" },
  { value: "done", label: "Done" },
] as const;

export type AccountingStatus = (typeof STATUS_OPTIONS)[number]["value"];

export const STATUS_LABELS: Record<string, string> = {
  ...Object.fromEntries(STATUS_OPTIONS.map((s) => [s.value, s.label])),
  // Legacy three-state aliases → new equivalent label, so historic rows
  // (still stored as `completed` / `pending_dept_info`) read cleanly in
  // the table badge without a DB migration.
  completed: "Done",
  pending_dept_info: "In Review",
};

export type StatusVariant =
  "green" | "amber" | "red" | "gold" | "blue" | "grey" | "purple" | "teal";

// Colours mirror the task board's DEFAULT_COLUMNS so a workstream's status
// and its task columns read as one palette: backlog grey, todo blue,
// in_progress amber, in_review purple, done green.
export const STATUS_VARIANTS: Record<string, StatusVariant> = {
  backlog: "grey",
  todo: "blue",
  in_progress: "amber",
  in_review: "purple",
  done: "green",
  // Legacy aliases.
  completed: "green",
  pending_dept_info: "purple",
};

// Top-border accent for the board columns, matching the badge colours.
export const STATUS_BORDER: Record<string, string> = {
  backlog: "border-t-zinc-500",
  todo: "border-t-blue-500",
  in_progress: "border-t-amber-500",
  in_review: "border-t-purple-500",
  done: "border-t-emerald-600",
};

// Map any free-text / legacy Status onto the five-state workflow so every
// row buckets into a visible board column. Empty → `backlog` (untriaged);
// an unrecognised non-empty value falls through to `in_progress`.
export function normalizeAccountingStatus(
  raw: string | null | undefined,
): string {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return "backlog";
  if (s === "backlog") return "backlog";
  if (s === "todo" || /^to[\s_-]*do$/.test(s)) return "todo";
  if (s === "in_review" || /^in[\s_-]*review$/.test(s) || s === "review") {
    return "in_review";
  }
  if (/^complete/.test(s) || s === "done") return "done";
  // Legacy "Pending Dept. Info" + held/blocked map onto In Review.
  if (
    /^pending[\s_-]*dept/.test(s) ||
    /^pending[\s_-]*info/.test(s) ||
    /^on[\s_-]*hold/.test(s) ||
    s === "blocked" ||
    s === "paused"
  ) {
    return "in_review";
  }
  if (
    s === "in_progress" ||
    /^in[\s_-]*progress$/.test(s) ||
    s === "wip" ||
    s === "doing"
  ) {
    return "in_progress";
  }
  return "in_progress";
}
