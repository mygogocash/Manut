import type { ChartConfig } from "@/components/ui/chart";
import type { RevenuePeriod } from "@/services/revenue.service";

export const PERIODS: { value: RevenuePeriod; label: string }[] = [
  { value: "3m", label: "Last 3 months" },
  { value: "6m", label: "Last 6 months" },
  { value: "12m", label: "Last 12 months" },
  { value: "ytd", label: "Year to date" },
  { value: "all", label: "All time" },
];

export const DEAL_STAGE_LABELS: Record<string, string> = {
  lead: "Lead",
  qualified: "Qualified",
  proposal: "Proposal",
  negotiation: "Negotiation",
  closed_won: "Closed Won",
  closed_lost: "Closed Lost",
};

export const revenueChartConfig = {
  revenue: { label: "Revenue", color: "hsl(var(--primary))" },
} satisfies ChartConfig;

export const expenseChartConfig = {
  total: { label: "Expenses", color: "hsl(var(--destructive))" },
} satisfies ChartConfig;

export const invoiceChartConfig = {
  paid: { label: "Paid", color: "hsl(var(--success))" },
  unpaid: { label: "Unpaid", color: "hsl(var(--warning))" },
  overdue: { label: "Overdue", color: "hsl(var(--destructive))" },
  draft: { label: "Draft", color: "hsl(var(--muted-foreground))" },
} satisfies ChartConfig;

export const INVOICE_COLORS: Record<string, string> = {
  paid: "hsl(var(--success))",
  unpaid: "hsl(var(--warning))",
  overdue: "hsl(var(--destructive))",
  draft: "hsl(var(--muted-foreground))",
  sent: "hsl(var(--info))",
};

export const pipelineChartConfig = {
  totalValue: { label: "Value", color: "hsl(var(--primary))" },
} satisfies ChartConfig;

export function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

export function formatFullCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatMonthLabel(yyyyMm: string): string {
  const [year, month] = yyyyMm.split("-");
  const date = new Date(Number(year), Number(month) - 1);
  return date.toLocaleString("en-US", { month: "short", year: "2-digit" });
}
