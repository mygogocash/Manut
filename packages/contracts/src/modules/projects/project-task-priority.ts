export const PROJECT_TASK_PRIORITIES = ["P0", "P1", "P2"] as const;

export type ProjectTaskPriority = (typeof PROJECT_TASK_PRIORITIES)[number];

export const PROJECT_TASK_PRIORITY_DEFAULT: ProjectTaskPriority = "P1";

/** Map legacy + import values to the P0|P1|P2 storage format. */
export function normalizeProjectTaskPriority(
  raw: string | null | undefined,
): ProjectTaskPriority {
  const s = (raw ?? "").trim();
  if (!s) return PROJECT_TASK_PRIORITY_DEFAULT;
  const upper = s.toUpperCase();
  if (
    upper === "P0" ||
    upper === "P0-HIGH" ||
    upper === "P0 — HIGH" ||
    s === "critical" ||
    s === "urgent" ||
    s === "high"
  ) {
    return "P0";
  }
  if (
    upper === "P1" ||
    upper === "P1-MEDIUM" ||
    upper === "P1 — MEDIUM" ||
    s === "medium"
  ) {
    return "P1";
  }
  if (
    upper === "P2" ||
    upper === "P2-LOW" ||
    upper === "P2 — LOW" ||
    s === "low"
  ) {
    return "P2";
  }
  if ((PROJECT_TASK_PRIORITIES as readonly string[]).includes(upper)) {
    return upper as ProjectTaskPriority;
  }
  return PROJECT_TASK_PRIORITY_DEFAULT;
}
