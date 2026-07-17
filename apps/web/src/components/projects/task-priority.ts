export const PROJECT_TASK_PRIORITY_OPTIONS = [
  { value: "P0", label: "P0-High" },
  { value: "P1", label: "P1-Medium" },
  { value: "P2", label: "P2-Low" },
] as const;

export type ProjectTaskPriority =
  (typeof PROJECT_TASK_PRIORITY_OPTIONS)[number]["value"];

export const PROJECT_TASK_PRIORITY_DEFAULT: ProjectTaskPriority = "P1";

export const PROJECT_TASK_PRIORITY_LABELS: Record<string, string> =
  Object.fromEntries(
    PROJECT_TASK_PRIORITY_OPTIONS.map((p) => [p.value, p.label]),
  );

export function normalizeProjectTaskPriority(
  raw: string | null | undefined,
): ProjectTaskPriority {
  const s = (raw ?? "").trim();
  if (!s) return PROJECT_TASK_PRIORITY_DEFAULT;
  const upper = s.toUpperCase();
  if (
    upper === "P0" ||
    upper === "P0-HIGH" ||
    s === "critical" ||
    s === "urgent" ||
    s === "high"
  ) {
    return "P0";
  }
  if (upper === "P1" || upper === "P1-MEDIUM" || s === "medium") {
    return "P1";
  }
  if (upper === "P2" || upper === "P2-LOW" || s === "low") {
    return "P2";
  }
  if (
    (PROJECT_TASK_PRIORITY_OPTIONS as readonly { value: string }[]).some(
      (p) => p.value === upper,
    )
  ) {
    return upper as ProjectTaskPriority;
  }
  return PROJECT_TASK_PRIORITY_DEFAULT;
}

export function projectTaskPriorityLabel(
  raw: string | null | undefined,
): string {
  const normalized = normalizeProjectTaskPriority(raw);
  return PROJECT_TASK_PRIORITY_LABELS[normalized] ?? normalized;
}
