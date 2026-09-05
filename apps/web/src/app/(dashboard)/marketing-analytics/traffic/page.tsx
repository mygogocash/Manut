"use client";

import { Activity, Info, Loader2, Megaphone, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { StatCard } from "@/components/dashboard/stat-card";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAppliedDateRange } from "@/hooks/use-applied-date-range";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  listMarketingMetrics,
  listMarketingPartners,
  type MarketingMetric,
  type MarketingPartner,
  type MetricsQueryResult,
  queryMarketingMetrics,
} from "@/services/marketing-analytics.service";
import {
  type CampaignListItem,
  listCampaigns,
} from "@/services/marketing-campaigns.service";

// Distinct hues for per-telco lines. Kept as literal CSS values so Tailwind's
// static scan is irrelevant (used inline via recharts, not class names).
const SERIES_COLORS = [
  "var(--color-primary)",
  "#2b6fd1",
  "#2dba70",
  "#e25c2a",
  "#d83c80",
  "#8b5cf6",
  "#0ea5e9",
  "#f59e0b",
  "#14b8a6",
];

const RANGE_PRESETS = [
  { key: "7", label: "Last 7d", days: 7 },
  { key: "30", label: "Last 30d", days: 30 },
  { key: "60", label: "Last 60d", days: 60 },
] as const;

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return iso(d);
}
function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return Math.round(n).toLocaleString("en-US");
}
function prettifyKey(key: string): string {
  return key
    .replace(/[_.-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function TrafficDashboardPage() {
  const { hasAnyPermission } = useAuth();
  const canView = hasAnyPermission(
    "marketing:dashboard:view",
    "marketing:raw:view",
  );

  const [partners, setPartners] = useState<MarketingPartner[]>([]);
  const [coreMetrics, setCoreMetrics] = useState<MarketingMetric[]>([]);
  const [metric, setMetric] = useState<string>("");
  // `rangeKey` now only drives which preset button looks selected; the range
  // itself lives in the hook.
  const [rangeKey, setRangeKey] = useState<string>("30");
  // The custom inputs are `<input type="date">`, which fires a change for every
  // complete-but-nonsense value as you type a year digit by digit — 0002, 0020,
  // 0202, then 2026. Wired straight to the fetch, typing one date cost four
  // queries, three of them for ranges starting in antiquity. Apply makes the
  // request wait for a range the user has finished expressing.
  const {
    draftFrom,
    draftTo,
    appliedFrom: dateFrom,
    appliedTo: dateTo,
    setDraftFrom,
    setDraftTo,
    dirty: rangeDirty,
    apply,
    setRange,
  } = useAppliedDateRange(daysAgo(30), iso(new Date()));

  const [result, setResult] = useState<MetricsQueryResult | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // A preset is one deliberate click, so it applies on the spot — and syncs the
  // custom inputs, so they never sit showing a range the chart isn't drawing.
  const selectPreset = useCallback(
    (key: string, days: number) => {
      setRangeKey(key);
      setRange(daysAgo(days), iso(new Date()));
    },
    [setRange],
  );

  const applyCustom = useCallback(() => {
    setRangeKey("custom");
    apply();
  }, [apply]);

  // Pressing Apply changes what is charted whenever the draft differs OR a
  // preset is currently selected — in the second case it switches you to the
  // custom range even if the dates happen to match.
  const canApply = rangeDirty || rangeKey !== "custom";

  // Bootstrap: load configured partners + the core-metric list for the picker.
  useEffect(() => {
    if (!canView) {
      setBootstrapping(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [p, m] = await Promise.all([
          listMarketingPartners(),
          listMarketingMetrics({ group: "core", limit: 500 }),
        ]);
        if (cancelled) {
          return;
        }
        setPartners(p.data);
        setCoreMetrics(m.data);
        // Default to a DAU-like metric if present, else the first core metric.
        const preferred =
          m.data.find((x) => /dau|active/i.test(x.key)) ?? m.data[0];
        if (preferred) {
          setMetric(preferred.key);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Failed to load");
        }
      } finally {
        if (!cancelled) {
          setBootstrapping(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canView]);

  const fetchSeries = useCallback(async () => {
    if (!metric || partners.length === 0) {
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const [series, camps] = await Promise.all([
        queryMarketingMetrics({ dateFrom, dateTo, metrics: [metric] }),
        listCampaigns({ from: dateFrom, to: dateTo, limit: 100 }),
      ]);
      setResult(series.data);
      setCampaigns(camps.data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Query failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [metric, partners.length, dateFrom, dateTo]);

  useEffect(() => {
    void fetchSeries();
  }, [fetchSeries]);

  // Pivot the per-partner series into recharts rows: { date, [telco]: value }.
  const telcoNames = useMemo(
    () =>
      (result?.results ?? []).map(
        (r) => r.telco_name?.trim() || r.partner_id.slice(0, 8),
      ),
    [result],
  );

  // Display-name -> partner UUID, for drill-down links to the telco detail page.
  const idByName = useMemo(() => {
    const m = new Map<string, string>();
    (result?.results ?? []).forEach((r) => {
      m.set(r.telco_name?.trim() || r.partner_id.slice(0, 8), r.partner_id);
    });
    return m;
  }, [result]);

  const chartData = useMemo<
    Array<Record<string, string | number | null>>
  >(() => {
    if (!result) return [];
    const byDate = new Map<string, Record<string, string | number | null>>();
    result.results.forEach((r) => {
      const name = r.telco_name?.trim() || r.partner_id.slice(0, 8);
      r.series.forEach((pt) => {
        const row = byDate.get(pt.date) ?? { date: pt.date };
        row[name] = pt.metrics[metric] ?? null;
        byDate.set(pt.date, row);
      });
    });
    return Array.from(byDate.values()).sort((a, b) =>
      String(a.date).localeCompare(String(b.date)),
    );
  }, [result, metric]);

  // Period total + latest-day total across all telcos for the selected metric.
  const { periodTotal, composition } = useMemo(() => {
    const sums: Record<string, number> = {};
    let total = 0;
    (result?.results ?? []).forEach((r) => {
      const name = r.telco_name?.trim() || r.partner_id.slice(0, 8);
      let s = 0;
      r.series.forEach((pt) => {
        const v = pt.metrics[metric];
        if (typeof v === "number") s += v;
      });
      sums[name] = s;
      total += s;
    });
    const comp = Object.entries(sums)
      .map(([name, value]) => ({
        name,
        value,
        pct: total > 0 ? (value / total) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);
    return { periodTotal: total, composition: comp };
  }, [result, metric]);

  // Campaign markers: only those whose date falls on a charted day.
  const campaignMarkers = useMemo(() => {
    const chartedDates = new Set(chartData.map((r) => String(r.date)));
    return campaigns
      .map((c) => ({ ...c, day: c.campaignDate.slice(0, 10) }))
      .filter((c) => chartedDates.has(c.day));
  }, [campaigns, chartData]);

  const metricLabel =
    coreMetrics.find((m) => m.key === metric)?.label ?? prettifyKey(metric);

  if (!canView) {
    return (
      <div className="px-6 py-6">
        <PageHeader title="Traffic Dashboard" />
        <p className="text-muted-foreground text-sm">
          You don&apos;t have access to Marketing Analytics.
        </p>
      </div>
    );
  }

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Traffic Dashboard"
        subtitle="Per-telco traffic trends from the BNII Analytics API, with campaign markers"
      >
        <Button
          variant="outline"
          size="sm"
          onClick={fetchSeries}
          disabled={loading || bootstrapping || partners.length === 0}
        >
          {loading ? (
            <Loader2 className="mr-1 size-3.5 animate-spin" />
          ) : (
            <RefreshCw className="mr-1 size-3.5" />
          )}
          Refresh
        </Button>
      </PageHeader>

      {/* No partners configured — the whole dashboard is gated on the UUID map */}
      {!bootstrapping && partners.length === 0 && (
        <Card className="border-warning/40 mb-5">
          <CardContent className="flex items-start gap-3 py-4">
            <Info className="text-warning mt-0.5 size-4 shrink-0" />
            <div className="text-sm">
              <p className="font-medium">No telco partners configured</p>
              <p className="text-muted-foreground mt-1">
                Traffic queries need the telco partner-ID map. Set the{" "}
                <code className="bg-muted rounded px-1.5 py-0.5">
                  MARKETING_ANALYTICS_PARTNER_IDS
                </code>{" "}
                environment variable (JSON of{" "}
                <code className="bg-muted rounded px-1.5 py-0.5">
                  {'{ "Telco": "uuid" }'}
                </code>
                ) and restart the API. The dashboard lights up automatically
                once it&apos;s set.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Controls */}
      {partners.length > 0 && (
        <Card className="mb-5">
          <CardContent className="flex flex-wrap items-end gap-3 py-4">
            <div className="grid gap-1.5">
              <Label className="text-xs">Metric</Label>
              <Select value={metric} onValueChange={setMetric}>
                <SelectTrigger className="w-56">
                  <SelectValue placeholder="Select metric" />
                </SelectTrigger>
                <SelectContent>
                  {coreMetrics.map((m) => (
                    <SelectItem key={m.key} value={m.key}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs">Range</Label>
              <div className="flex gap-1.5">
                {RANGE_PRESETS.map((r) => (
                  <Button
                    key={r.key}
                    variant={rangeKey === r.key ? "default" : "outline"}
                    size="sm"
                    onClick={() => selectPreset(r.key, r.days)}
                  >
                    {r.label}
                  </Button>
                ))}
              </div>
            </div>

            <div className="grid gap-1.5">
              <Label className="text-xs">Custom from</Label>
              <Input
                type="date"
                className="w-40"
                value={draftFrom}
                onChange={(e) => setDraftFrom(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">Custom to</Label>
              <Input
                type="date"
                className="w-40"
                value={draftTo}
                onChange={(e) => setDraftTo(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs">&nbsp;</Label>
              <Button size="sm" onClick={applyCustom} disabled={!canApply}>
                Apply
              </Button>
            </div>
            {rangeDirty ? (
              <p className="text-muted-foreground self-end pb-2 text-xs">
                Charting{" "}
                <span className="tabular-nums">
                  {dateFrom} → {dateTo}
                </span>{" "}
                · apply to update
              </p>
            ) : null}
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className="border-destructive/40 mb-5">
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <p className="text-destructive text-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchSeries}>
              <RefreshCw className="mr-1 size-3.5" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {partners.length > 0 && (
        <>
          {/* KPI band */}
          <div
            className={`
              mb-5 grid gap-4
              md:grid-cols-2
              lg:grid-cols-4
            `}
          >
            {loading ? (
              Array.from({ length: 4 }, (_, i) => (
                <Skeleton key={i} className="h-[110px] rounded-xl" />
              ))
            ) : (
              <>
                <StatCard
                  label={`${metricLabel} — Period Total`}
                  value={fmtNum(periodTotal)}
                  change={`${dateFrom} → ${dateTo}`}
                  changeType="neutral"
                  icon={Activity}
                  accent="primary"
                />
                <StatCard
                  label="Telcos Reporting"
                  value={String(telcoNames.length)}
                  change={`${partners.length} configured`}
                  changeType="neutral"
                  icon={Activity}
                  accent="info"
                />
                <StatCard
                  label="Days in Range"
                  value={String(chartData.length)}
                  change="Daily data points"
                  changeType="neutral"
                  icon={Activity}
                  accent="success"
                />
                <StatCard
                  label="Campaigns in Range"
                  value={String(campaignMarkers.length)}
                  change="Overlaid on the chart"
                  changeType="neutral"
                  icon={Megaphone}
                  accent="warning"
                />
              </>
            )}
          </div>

          {/* Per-telco quick nav — click a telco to open its detail view */}
          {!loading && telcoNames.length > 0 && (
            <Card className="mb-5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  Telco detail views
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {telcoNames.map((name, i) => {
                    const id = idByName.get(name);
                    if (!id) {
                      return null;
                    }
                    return (
                      <Link
                        key={name}
                        href={`/marketing-analytics/traffic/${id}`}
                        className={`
                          border-border inline-flex items-center gap-2
                          rounded-full border px-3 py-1.5 text-xs font-medium
                          transition-colors
                          hover:border-primary hover:bg-muted
                        `}
                      >
                        <span
                          className="size-2 rounded-full"
                          style={{
                            background: SERIES_COLORS[i % SERIES_COLORS.length],
                          }}
                        />
                        {name}
                      </Link>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Trend chart */}
          <Card className="mb-5">
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                {metricLabel} by telco
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[340px] rounded-lg" />
              ) : chartData.length === 0 ? (
                <p className="text-muted-foreground py-20 text-center text-sm">
                  No data returned for this metric and range.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={340}>
                  <LineChart
                    data={chartData}
                    margin={{ top: 8, right: 16, bottom: 4, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11 }}
                      tickFormatter={(d: string) => d.slice(5)}
                      minTickGap={24}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => fmtNum(v as number)}
                      width={48}
                    />
                    <Tooltip
                      formatter={(v) => fmtNum(v as number)}
                      labelClassName="text-xs"
                      contentStyle={{ fontSize: 12 }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {campaignMarkers.map((c) => (
                      <ReferenceLine
                        key={c.id}
                        x={c.day}
                        stroke="var(--color-warning)"
                        strokeDasharray="4 3"
                        label={{
                          value: "▲",
                          position: "top",
                          fontSize: 10,
                          fill: "var(--color-warning)",
                        }}
                      />
                    ))}
                    {telcoNames.map((name, i) => (
                      <Line
                        key={name}
                        type="monotone"
                        dataKey={name}
                        stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <div
            className={`
              grid gap-4
              lg:grid-cols-2
            `}
          >
            {/* Composition */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Composition — {metricLabel} share
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {loading ? (
                  <Skeleton className="h-[220px] rounded-lg" />
                ) : composition.length === 0 ? (
                  <p className="text-muted-foreground py-16 text-center text-sm">
                    No composition data.
                  </p>
                ) : (
                  composition.map((c, i) => {
                    const id = idByName.get(c.name);
                    return (
                      <div key={c.name} className="space-y-1">
                        <div
                          className={`flex items-center justify-between text-xs`}
                        >
                          {id ? (
                            <Link
                              href={`/marketing-analytics/traffic/${id}`}
                              className={`
                                font-medium
                                hover:underline
                              `}
                            >
                              {c.name}
                            </Link>
                          ) : (
                            <span className="font-medium">{c.name}</span>
                          )}
                          <span className="text-muted-foreground">
                            {fmtNum(c.value)} · {c.pct.toFixed(1)}%
                          </span>
                        </div>
                        <div
                          className={`bg-muted h-2 overflow-hidden rounded-full`}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${c.pct}%`,
                              background:
                                SERIES_COLORS[i % SERIES_COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </CardContent>
            </Card>

            {/* Campaigns in range */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-medium">
                  Campaigns in range
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-[220px] rounded-lg" />
                ) : campaignMarkers.length === 0 ? (
                  <p className="text-muted-foreground py-16 text-center text-sm">
                    No campaigns fall inside this date range.
                  </p>
                ) : (
                  <ul className="divide-border divide-y">
                    {campaignMarkers.map((c) => (
                      <li
                        key={c.id}
                        className={`
                          flex items-center justify-between gap-3 py-2.5
                        `}
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {c.name}
                          </p>
                          <p className="text-muted-foreground text-xs">
                            {c.day}
                            {c.country ? ` · ${c.country}` : ""}
                            {c.channel ? ` · ${c.channel}` : ""}
                          </p>
                        </div>
                        <Badge variant="outline" className="shrink-0">
                          {c.status}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
