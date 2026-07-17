/** Legal CRM task priority — stored on `legal_projects.priority`. */

export const LEGAL_PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;

export type LegalPriority = (typeof LEGAL_PRIORITY_OPTIONS)[number]["value"];

export const LEGAL_PRIORITY_LABELS: Record<string, string> = Object.fromEntries(
  LEGAL_PRIORITY_OPTIONS.map((p) => [p.value, p.label]),
);

export type LegalPriorityVariant = "grey" | "blue" | "amber" | "red";

export const LEGAL_PRIORITY_VARIANTS: Record<string, LegalPriorityVariant> = {
  low: "grey",
  medium: "blue",
  high: "amber",
  critical: "red",
};

export function normalizeLegalPriority(
  raw: string | null | undefined,
): LegalPriority {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return "medium";
  if (s === "critical" || s === "urgent" || s === "p0") return "critical";
  if (s === "high" || s === "p1") return "high";
  if (s === "low" || s === "p3") return "low";
  if (s === "medium" || s === "normal" || s === "p2") return "medium";
  if (
    (LEGAL_PRIORITY_OPTIONS as readonly { value: string }[]).some(
      (p) => p.value === s,
    )
  ) {
    return s as LegalPriority;
  }
  return "medium";
}
