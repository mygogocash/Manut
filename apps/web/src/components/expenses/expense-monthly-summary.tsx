"use client";

import { AlertTriangle } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/shared/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatCurrency } from "@/lib/format-currency";
import {
  EXPENSE_STATUS_LABELS,
  type ExpenseReportStatus,
  getMonthlyExpenseSummary,
  type MonthlyExpenseSummary,
} from "@/services/expense.service";

// Order statuses follow the report lifecycle, so the per-month breakdown
// reads left-to-right the way the workflow progresses.
const STATUS_ORDER: ExpenseReportStatus[] = [
  "draft",
  "submitted",
  "approved",
  "payroll_processed",
  "reimbursed",
  "rejected",
];

function formatPeriod(period: string): string {
  // period is "YYYY-MM"; render as e.g. "June 2026".
  const date = new Date(`${period}-01T00:00:00`);
  if (Number.isNaN(date.getTime())) return period;
  return date.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

function thb(amount: number): string {
  return formatCurrency(amount, "THB");
}

interface Props {
  // Tracks the All-statuses filter on the parent page so the overview
  // reflects the same scope as the table beneath it.
  statusFilter?: ExpenseReportStatus;
  // The month (YYYY-MM) currently drilled into, for highlight. undefined = all.
  selectedPeriod?: string;
  // Click a month row to filter the report table to it (re-click clears).
  // When omitted, rows are static (non-interactive).
  onSelectPeriod?: (period: string) => void;
}

export function ExpenseMonthlySummary({
  statusFilter,
  selectedPeriod,
  onSelectPeriod,
}: Props) {
  const [summary, setSummary] = useState<MonthlyExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await getMonthlyExpenseSummary({ status: statusFilter });
      setSummary(res);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) return null; // Non-blocking: the table below still works.

  const totals = summary?.totals;
  const rows = summary?.data ?? [];

  return (
    <section className="mb-6 space-y-4">
      <div
        className={`
          grid gap-4
          sm:grid-cols-2
          lg:grid-cols-4
        `}
      >
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Months</CardDescription>
            <CardTitle className="text-xl tabular-nums">
              {loading ? "…" : rows.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Reports</CardDescription>
            <CardTitle className="text-xl tabular-nums">
              {loading ? "…" : (totals?.reportCount ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Expenses</CardDescription>
            <CardTitle className="text-xl tabular-nums">
              {loading ? "…" : (totals?.expenseCount ?? 0)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total (THB)</CardDescription>
            <CardTitle className="text-xl tabular-nums">
              {loading ? "…" : totals ? thb(totals.totalThb) : thb(0)}
            </CardTitle>
            {!loading && totals && !totals.converted && (
              <p
                className={`
                  mt-1 flex items-center gap-1 text-[11px] text-amber-600
                `}
              >
                <AlertTriangle className="h-3 w-3" />
                Missing FX rates ({totals.missingRates.join(", ")}); total
                excludes unconverted lines.
              </p>
            )}
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Monthly overview</CardTitle>
          <CardDescription>
            Workspace-wide spend grouped by month.
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr
                className={`
                  text-muted-foreground border-b text-left text-[11px]
                  tracking-wide uppercase
                `}
              >
                <th className="px-4 py-2 font-medium">Period</th>
                <th className="px-4 py-2 text-right font-medium">Reports</th>
                <th className="px-4 py-2 text-right font-medium">Expenses</th>
                <th className="px-4 py-2 text-right font-medium">
                  Total (THB)
                </th>
                <th className="px-4 py-2 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td
                    colSpan={5}
                    className="text-muted-foreground px-4 py-6 text-center"
                  >
                    Loading…
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="text-muted-foreground px-4 py-6 text-center"
                  >
                    No reports in the workspace yet.
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const interactive = Boolean(onSelectPeriod);
                  const active = selectedPeriod === row.period;
                  return (
                    <tr
                      key={row.period}
                      role={interactive ? "button" : undefined}
                      tabIndex={interactive ? 0 : undefined}
                      aria-pressed={interactive ? active : undefined}
                      onClick={
                        interactive
                          ? () => onSelectPeriod!(row.period)
                          : undefined
                      }
                      onKeyDown={
                        interactive
                          ? (e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                onSelectPeriod!(row.period);
                              }
                            }
                          : undefined
                      }
                      className={`
                        border-b
                        last:border-0
                        ${interactive ? "cursor-pointer" : ""}
                        ${
                          active
                            ? "bg-primary/5 ring-primary/30 ring-1"
                            : interactive
                              ? "hover:bg-muted/40"
                              : ""
                        }
                      `}
                    >
                      <td className="px-4 py-2">
                        <span className="font-mono text-[12px]">
                          {row.period}
                        </span>
                        <span className="text-muted-foreground ml-2">
                          {formatPeriod(row.period)}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {row.reportCount}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {row.expenseCount}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums">
                        {row.converted ? (
                          thb(row.totalThb)
                        ) : (
                          <span
                            className="text-amber-600"
                            title={`Missing FX rates: ${row.missingRates.join(", ")}`}
                          >
                            —
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-1">
                          {STATUS_ORDER.filter(
                            (s) => (row.byStatus[s] ?? 0) > 0,
                          ).map((s) => (
                            <Badge
                              key={s}
                              variant="grey"
                              className="text-[11px]"
                            >
                              {EXPENSE_STATUS_LABELS[s]}: {row.byStatus[s]}
                            </Badge>
                          ))}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </section>
  );
}
