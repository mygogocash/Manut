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

export function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
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
