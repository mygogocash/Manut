import type { ChartConfig } from "@/components/ui/chart";

export const revenueConfig = {
  expenses: { label: "Expenses", color: "hsl(var(--primary))" },
} satisfies ChartConfig;

// Mirrors the BD project taxonomy used by the Badge component (see
// `apps/web/src/components/shared/badge.tsx` STATUS_MAP). Colours
// match the badge variants so the dashboard pie chart and the table
// badges read as the same status. Update both files together.
export const projectStatusConfig = {
  not_yet_started: {
    label: "Not Yet Started",
    color: "hsl(var(--warning))",
  },
  in_progress: { label: "In Progress", color: "hsl(var(--destructive))" },
  uat: { label: "UAT", color: "rgb(109 40 217)" },
  staging_integrated: { label: "Staging Integrated", color: "rgb(168 85 247)" },
  prod_integrated: { label: "Prod. Integrated", color: "rgb(20 184 166)" },
  on_hold: { label: "On Hold", color: "hsl(var(--info))" },
  completed: { label: "Completed", color: "hsl(var(--success))" },
} satisfies ChartConfig;

export const STATUS_COLORS: Record<string, string> = {
  not_yet_started: "hsl(var(--warning))",
  in_progress: "hsl(var(--destructive))",
  uat: "rgb(109 40 217)",
  staging_integrated: "rgb(168 85 247)",
  prod_integrated: "rgb(20 184 166)",
  on_hold: "hsl(var(--info))",
  completed: "hsl(var(--success))",
};

export const deptConfig = {
  count: { label: "Employees", color: "hsl(var(--primary))" },
} satisfies ChartConfig;

/**
 * Compact currency for a KPI tile.
 *
 * The scale used to stop at millions, so anything larger kept counting in
 * millions: 18,000,000,000,000 rendered as `$18000000.0M` — twelve characters,
 * unreadable, and wide enough to break a KPI card on a phone. Billions and
 * trillions now have their own tiers, which keeps every figure to at most six
 * characters (`$18.0T`).
 *
 * Negatives are formatted by magnitude with the sign restored, so a refund or a
 * negative variance reads `-$4.2M` rather than falling through to the raw
 * branch and printing `$-4200000`.
 */
/** Largest first, so index-1 is always the next tier up. */
const CURRENCY_TIERS = [
  { size: 1_000_000_000_000, suffix: "T" },
  { size: 1_000_000_000, suffix: "B" },
  { size: 1_000_000, suffix: "M" },
  { size: 1_000, suffix: "K" },
] as const;

export function formatCurrency(value: number): string {
  const sign = value < 0 ? "-" : "";
  const n = Math.abs(value);

  const index = CURRENCY_TIERS.findIndex((t) => n >= t.size);
  if (index === -1) return `${sign}$${n.toFixed(0)}`;

  let tier = CURRENCY_TIERS[index]!;
  let scaled = Number((n / tier.size).toFixed(1));

  // Rounding can push a value out of the tier it was picked for: 999,999 is
  // below a million, so it lands in K and then rounds to 1000.0 — "$1000.0K".
  // Promote it instead, unless there is no larger tier to promote into.
  if (scaled >= 1000 && index > 0) {
    tier = CURRENCY_TIERS[index - 1]!;
    scaled = Number((n / tier.size).toFixed(1));
  }

  return `${sign}$${scaled.toFixed(1)}${tier.suffix}`;
}

export function formatMonthLabel(yyyyMm: string): string {
  const [year, month] = yyyyMm.split("-");
  const date = new Date(Number(year), Number(month) - 1);
  return date.toLocaleString("en-US", { month: "short" });
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
