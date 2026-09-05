"use client";

import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { KpiCard } from "@/components/shared/kpi-card";
import { MonthYearPicker } from "@/components/shared/month-year-picker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ApiError } from "@/lib/api-client";
import { formatCurrency } from "@/lib/format-currency";
import {
  type MonthlyDetail,
  monthlyDetailReport,
  type MonthlySeries,
  monthlySeriesReport,
} from "@/services/it-operations.service";

/** Window lengths offered. Capped at 36 by the API regardless. */
const WINDOWS = [6, 12, 24, 36] as const;

const COLUMN_COUNT = 5;

export function ItBillingMonthlyTab() {
  const [series, setSeries] = useState<MonthlySeries | null>(null);
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState<number>(12);
  const [endMonth, setEndMonth] = useState<string>("");
  const [currency, setCurrency] = useState<string>("");

  const fetchSeries = useCallback(async () => {
    try {
      setLoading(true);
      const res = await monthlySeriesReport({
        months,
        to: endMonth || undefined,
        currency: currency || undefined,
      });
      setSeries(res.data);
      // Adopt whatever currency the API resolved, so the selector shows the
      // series actually on screen rather than an empty "default" state.
      if (!currency) setCurrency(res.data.currency);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [months, endMonth, currency]);

  useEffect(() => {
    void fetchSeries();
  }, [fetchSeries]);

  // Newest month first: the question is almost always "what are we paying now",
  // and the answer should not be at the bottom of a 36-row list.
  const descending = useMemo(
    () => (series ? [...series.points].reverse() : []),
    [series],
  );

  const summary = series?.summary;
  const showCurrencyPicker = (series?.currenciesPresent.length ?? 0) > 1;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={String(months)}
          onValueChange={(v) => setMonths(Number(v))}
        >
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WINDOWS.map((w) => (
              <SelectItem key={w} value={String(w)}>
                Last {w} months
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <MonthYearPicker
          value={endMonth || undefined}
          onChange={setEndMonth}
          placeholder="Ending this month"
          className="h-9 w-[190px]"
        />
        {showCurrencyPicker && (
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="h-9 w-[110px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {series?.currenciesPresent.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {loading && (
          <Loader2 className="text-muted-foreground size-4 animate-spin" />
        )}
      </div>

      {summary && series && (
        <>
          <div
            className={`
              grid gap-3
              sm:grid-cols-2
              lg:grid-cols-4
            `}
          >
            <KpiCard
              label={`Committed spend — ${series.points[series.points.length - 1]?.label ?? ""}`}
              value={formatCurrency(summary.currentMonthlySpend, currency)}
              change={`${summary.activeCount} active`}
              accent
            />
            <KpiCard
              label="Change across window"
              value={signedCurrency(summary.changeOverWindow, currency)}
              change={`${series.points[0]?.label ?? ""} → ${
                series.points[series.points.length - 1]?.label ?? ""
              }`}
            />
            <KpiCard
              label="Monthly cost removed"
              value={formatCurrency(summary.monthlyRunRateRemoved, currency)}
              change={`${summary.endedCount} ended in window`}
            />
            <KpiCard
              label="Spend avoided since"
              value={formatCurrency(summary.cumulativeAvoided, currency)}
              change="From those cancellations"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Committed monthly spend ({currency})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={260}>
                {/* Chronological here — a trend must read left to right even
                    though the table below is newest-first. */}
                <ComposedChart data={series.points}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="spend" tick={{ fontSize: 11 }} />
                  <YAxis
                    yAxisId="count"
                    orientation="right"
                    tick={{ fontSize: 11 }}
                    allowDecimals={false}
                  />
                  <Tooltip
                    // The two series are in different units, so one formatter
                    // has to branch on which one it was handed.
                    formatter={(value, name) =>
                      name === "total"
                        ? [formatCurrency(Number(value), currency), "Spend"]
                        : [String(value), "Active"]
                    }
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Bar
                    yAxisId="spend"
                    dataKey="total"
                    fill="var(--color-info)"
                  />
                  <Line
                    yAxisId="count"
                    type="monotone"
                    dataKey="activeCount"
                    stroke="var(--color-primary)"
                    strokeWidth={2}
                    dot={{ r: 2 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <MonthGroups points={descending} currency={currency} />
        </>
      )}

      {!loading && series && series.points.length === 0 && (
        <p className="text-muted-foreground text-sm">
          No months in the selected window.
        </p>
      )}
    </div>
  );
}

function MonthGroups({
  points,
  currency,
}: {
  points: MonthlySeries["points"];
  currency: string;
}) {
  // Which months are open, and the detail already fetched for them. Detail is
  // fetched per month on expand rather than shipped with the series: the series
  // covers up to 36 months and sending every line item for all of them would
  // dwarf the payload that draws the chart.
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [detail, setDetail] = useState<Record<string, MonthlyDetail>>({});
  const [busy, setBusy] = useState<Set<string>>(new Set());

  // Any change of currency invalidates every cached month — the rows were for a
  // different currency and would otherwise render under the new one.
  useEffect(() => {
    setDetail({});
    setOpen(new Set());
  }, [currency]);

  const toggle = useCallback(
    async (month: string) => {
      const next = new Set(open);
      if (next.has(month)) {
        next.delete(month);
        setOpen(next);
        return;
      }
      next.add(month);
      setOpen(next);
      if (detail[month]) return;
      try {
        setBusy((b) => new Set(b).add(month));
        const res = await monthlyDetailReport({ month, currency });
        // Guard against a response for the PREVIOUS currency landing after the
        // switch: the clearing effect below empties the cache, but a request
        // already in flight would then write stale rows back in and render
        // them under the new currency's heading. The API echoes the currency it
        // answered in, so the check is on the response, not on a ref.
        if (res.data.currency !== currency) return;
        setDetail((d) => ({ ...d, [month]: res.data }));
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Failed to load");
      } finally {
        setBusy((b) => {
          const c = new Set(b);
          c.delete(month);
          return c;
        });
      }
    },
    [open, detail, currency],
  );

  return (
    <div className="border-border overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/40 text-muted-foreground">
          <tr>
            <th className="px-4 py-2 text-left font-medium">Month</th>
            <th className="px-4 py-2 text-right font-medium">Spend</th>
            <th className="px-4 py-2 text-right font-medium">Change</th>
            <th className="px-4 py-2 text-right font-medium">Active</th>
            <th className="px-4 py-2 text-left font-medium">Movement</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point) => {
            const isOpen = open.has(point.month);
            const rows = detail[point.month]?.rows;
            return (
              // Fragment carries the key: a month renders as two sibling rows
              // (header + detail), and keying the inner <tr> instead leaves the
              // list unkeyed as far as React is concerned.
              <Fragment key={point.month}>
                <tr
                  className={`
                    border-border cursor-pointer border-t
                    hover:bg-muted/30
                  `}
                  onClick={() => void toggle(point.month)}
                >
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-1.5 font-medium">
                      {isOpen ? (
                        <ChevronDown className="size-3.5" />
                      ) : (
                        <ChevronRight className="size-3.5" />
                      )}
                      {point.label}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    {formatCurrency(point.total, currency)}
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    <DeltaCell
                      delta={point.deltaVsPrevious}
                      currency={currency}
                    />
                  </td>
                  <td
                    className={`
                      text-muted-foreground px-4 py-2 text-right tabular-nums
                    `}
                  >
                    {point.activeCount}
                  </td>
                  <td className="px-4 py-2">
                    <MovementSummary point={point} />
                  </td>
                </tr>
                {isOpen && (
                  <tr className="bg-muted/20">
                    <td colSpan={COLUMN_COUNT} className="px-4 py-3">
                      {busy.has(point.month) || !rows ? (
                        <span
                          className={`
                            text-muted-foreground flex items-center gap-2
                            text-xs
                          `}
                        >
                          <Loader2 className="size-3.5 animate-spin" />
                          Loading {point.label}…
                        </span>
                      ) : (
                        <MonthDetailTable
                          detail={detail[point.month]!}
                          currency={currency}
                        />
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
          {points.length === 0 && (
            <tr>
              <td
                colSpan={COLUMN_COUNT}
                className="text-muted-foreground px-4 py-6 text-center"
              >
                Nothing to show.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function DeltaCell({
  delta,
  currency,
}: {
  delta: number | null;
  currency: string;
}) {
  // The first month of a window has no predecessor. Rendering 0 there would
  // claim spend was flat when the truth is that it is simply unknown.
  if (delta === null) return <span className="text-muted-foreground">—</span>;
  if (delta === 0) return <span className="text-muted-foreground">0.00</span>;
  return (
    <span className={delta < 0 ? "text-success" : "text-destructive"}>
      {signedCurrency(delta, currency)}
    </span>
  );
}

function MovementSummary({
  point,
}: {
  point: MonthlySeries["points"][number];
}) {
  const cancelled = point.ended.filter((r) => !r.isOneTime);
  const completed = point.ended.filter((r) => r.isOneTime);
  const parts: string[] = [];
  if (point.started.length > 0) {
    parts.push(`+${point.started.length} started`);
  }
  // A one-time purchase leaving the run-rate is not a cancellation, and calling
  // it one would credit a saving nobody made.
  if (cancelled.length > 0) parts.push(`−${cancelled.length} ended`);
  if (completed.length > 0) parts.push(`${completed.length} one-time`);
  if (parts.length === 0) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }
  const names = [...point.started, ...point.ended]
    .map((r) => r.productName)
    .join(", ");
  return (
    <span className="text-muted-foreground text-xs" title={names}>
      {parts.join(" · ")}
    </span>
  );
}

function MonthDetailTable({
  detail,
  currency,
}: {
  detail: MonthlyDetail;
  currency: string;
}) {
  if (detail.rows.length === 0) {
    return (
      <p className="text-muted-foreground text-xs">
        Nothing live in {detail.label}.
      </p>
    );
  }
  return (
    <table className="w-full text-xs">
      <thead className="text-muted-foreground">
        <tr>
          <th className="py-1 text-left font-medium">Product</th>
          <th className="py-1 text-left font-medium">Vendor</th>
          <th className="py-1 text-left font-medium">Billing</th>
          <th className="py-1 text-right font-medium">Invoiced</th>
          <th className="py-1 text-right font-medium">This month</th>
          <th className="py-1 text-left font-medium"></th>
        </tr>
      </thead>
      <tbody>
        {detail.rows.map((row) => (
          <tr key={row.id} className="border-border/60 border-t">
            <td className="py-1">{row.productName}</td>
            <td className="text-muted-foreground py-1">{row.vendorName}</td>
            <td className="text-muted-foreground py-1">
              {row.billingFrequency}
            </td>
            <td className="py-1 text-right tabular-nums">
              {formatCurrency(row.invoiceAmount, currency)}
            </td>
            <td className="py-1 text-right tabular-nums">
              {formatCurrency(row.monthlyAmount, currency)}
            </td>
            <td className="py-1">
              {row.startedThisMonth && (
                <span className="text-muted-foreground">started</span>
              )}
              {row.endedThisMonth && (
                <span className="text-muted-foreground">
                  {row.isOneTime ? "one-time" : "last month billed"}
                </span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-border border-t font-medium">
          <td className="py-1" colSpan={4}>
            Total
          </td>
          <td className="py-1 text-right tabular-nums">
            {formatCurrency(detail.total, currency)}
          </td>
          <td />
        </tr>
      </tfoot>
    </table>
  );
}

/** Always shows the sign, so a fall is unmistakable at a glance. */
function signedCurrency(value: number, currency: string): string {
  const formatted = formatCurrency(Math.abs(value), currency);
  if (value === 0) return formatted;
  return `${value < 0 ? "−" : "+"}${formatted}`;
}
