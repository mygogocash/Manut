/** Accounting CRM task priority — stored on `accounting_projects.priority`. */

export const ACCOUNTING_PRIORITY_OPTIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;

export type AccountingPriority =
  (typeof ACCOUNTING_PRIORITY_OPTIONS)[number]["value"];

export const ACCOUNTING_PRIORITY_LABELS: Record<string, string> =
  Object.fromEntries(
    ACCOUNTING_PRIORITY_OPTIONS.map((p) => [p.value, p.label]),
  );

export type AccountingPriorityVariant = "grey" | "blue" | "amber" | "red";

export const ACCOUNTING_PRIORITY_VARIANTS: Record<
  string,
  AccountingPriorityVariant
> = {
  low: "grey",
  medium: "blue",
  high: "amber",
  critical: "red",
};

export function normalizeAccountingPriority(
  raw: string | null | undefined,
): AccountingPriority {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return "medium";
  if (s === "critical" || s === "urgent" || s === "p0") return "critical";
  if (s === "high" || s === "p1") return "high";
  if (s === "low" || s === "p3") return "low";
  if (s === "medium" || s === "normal" || s === "p2") return "medium";
  if (
    (ACCOUNTING_PRIORITY_OPTIONS as readonly { value: string }[]).some(
      (p) => p.value === s,
    )
  ) {
    return s as AccountingPriority;
  }
  return "medium";
}
