import type { BadgeVariant } from "@/components/shared/badge";

// Marketing-CRM task priority scale. Free-text on the backend (`priority`
// defaults to "medium"), so adding "critical" needs no migration. Each
// level carries a swatch colour for the picker dots and a Badge variant
// for the board cards so urgency reads at a glance.
export interface PartnerPriority {
  value: string;
  label: string;
  color: string;
  variant: BadgeVariant;
}

export const PARTNER_PRIORITIES: PartnerPriority[] = [
  { value: "low", label: "Low", color: "#64748b", variant: "grey" },
  { value: "medium", label: "Medium", color: "#2563eb", variant: "blue" },
  { value: "high", label: "High", color: "#d97706", variant: "amber" },
  { value: "urgent", label: "Urgent", color: "#dc2626", variant: "red" },
  { value: "critical", label: "Critical", color: "#7c3aed", variant: "purple" },
];

export const PARTNER_PRIORITY_BY_VALUE: Record<string, PartnerPriority> =
  Object.fromEntries(PARTNER_PRIORITIES.map((p) => [p.value, p]));

export function partnerPriorityVariant(value: string): BadgeVariant {
  return PARTNER_PRIORITY_BY_VALUE[value]?.variant ?? "grey";
}
