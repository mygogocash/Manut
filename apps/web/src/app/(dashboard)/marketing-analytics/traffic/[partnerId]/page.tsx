"use client";

import {
  Activity,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  FileDown,
  Loader2,
  Megaphone,
  RefreshCw,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
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

import { BnrySplit } from "@/app/(dashboard)/marketing-analytics/traffic/bnry-split";
import { PopBannerModel } from "@/app/(dashboard)/marketing-analytics/traffic/pop-banner-model";
import {
  generateTelcoReport,
  type ReportKind,
} from "@/app/(dashboard)/marketing-analytics/traffic/report-export";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  CustomizableTable,
  type TableColumn,
} from "@/components/shared/customizable-table";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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

// KPI metrics surfaced for a single telco. Keys are the stable BNII core-metric
// names (same ones Atlas keys off in its ingest map).
const KPI_METRICS = [
  { key: "unique_users", label: "Avg DAU", agg: "avg" as const, unit: "" },
  { key: "new_users", label: "New Users", agg: "sum" as const, unit: "" },
  {
    key: "repeated_users",
    label: "Repeat Users",
    agg: "sum" as const,
    unit: "",
  },
  {
    key: "total_views_homepage",
    label: "Homepage Views",
    agg: "sum" as const,
    unit: "",
  },
  {
    key: "avg_time_spent_seconds",
    label: "Avg Session Time",
    agg: "avg" as const,
    unit: "s",
  },
];
// BNRY-by-source components (tx.* metrics): Videos = Fando + Ngage
// (FOLLOW/LIKE), STW = spin_reward, Games = online_reward (screen-time).
const BNRY_KEYS = [
  "tx.spin_reward.amount",
  "tx.online_reward.amount",
  "tx.FOLLOW_GIVEN.amount",
  "tx.LIKE_GIVEN.amount",
];
const ALL_KEYS = [...KPI_METRICS.map((m) => m.key), ...BNRY_KEYS];

const RANGE_PRESETS = [
  { key: "7", label: "7d", days: 7 },
  { key: "30", label: "30d", days: 30 },
  { key: "60", label: "60d", days: 60 },
] as const;

// Host-app user-behaviour facts (from the OW2.0 traction sheet telco tabs).
// Static reference data — only the two telcos with published behaviour facts.
const TELCO_FACTS: Record<string, Array<{ label: string; value: string }>> = {
  Dialog: [
    { label: "Peak hours", value: "7pm–9pm" },
    { label: "Most active day", value: "Wednesday" },
    { label: "Strongest channel", value: "SMS (6–7% open vs 0.3% push)" },
    { label: "Splash banner open rate", value: "5–10%" },
    { label: "30-day retention", value: "82% of MAU" },
    { label: "Logins / user / month", value: "3–4" },
    { label: "Avg session (MTD)", value: "1m 34s" },
    { label: "Audience sweet spot", value: "Ages 22–28" },
    { label: "Reward preference", value: "Data → Reload → Vouchers" },
  ],
  U9: [
    { label: "Peak hours", value: "9am · 12pm · 3pm · 6pm" },
    { label: "Most active day", value: "Wednesday" },
    { label: "Strongest channel", value: "In-app notifications" },
    { label: "Avg session", value: "~1 min" },
    { label: "Host DAU", value: "900K – 1M" },
    { label: "Host MAU", value: "2.3M" },
  ],
};

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

export default function TelcoDetailPage() {
  const params = useParams<{ partnerId: string }>();
  const partnerId =
    typeof params?.partnerId === "string" ? params.partnerId : "";
  const { hasAnyPermission } = useAuth();
  const canView = hasAnyPermission(
    "marketing:dashboard:view",
    "marketing:raw:view",
  );

  const [partner, setPartner] = useState<MarketingPartner | null>(null);
  const [result, setResult] = useState<MetricsQueryResult | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [rangeKey, setRangeKey] = useState<string>("30");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<ReportKind | null>(null);

  // "All metrics" section — additive, collapsed by default, lazy-loaded.
  // Removing this block (state + effect + the <Card> below) fully reverts the
  // feature with no impact on the default telco view.
  const [showAll, setShowAll] = useState(false);
  const [allCatalog, setAllCatalog] = useState<MarketingMetric[]>([]);
  const [allResult, setAllResult] = useState<MetricsQueryResult | null>(null);
  const [allLoading, setAllLoading] = useState(false);
  const [allError, setAllError] = useState<string | null>(null);

  const { dateFrom, dateTo } = useMemo(() => {
    const preset = RANGE_PRESETS.find((r) => r.key === rangeKey);
    return {
      dateFrom: daysAgo(preset ? preset.days : 30),
      dateTo: iso(new Date()),
    };
  }, [rangeKey]);

  useEffect(() => {
    if (!canView) {
      return;
    }
    let cancelled = false;
    void listMarketingPartners()
      .then((r) => {
        if (cancelled) {
          return;
        }
        setPartner(r.data.find((p) => p.id === partnerId) ?? null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [canView, partnerId]);

  const fetchData = useCallback(async () => {
    if (!canView) {
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const [series, camps] = await Promise.all([
        queryMarketingMetrics({
          dateFrom,
          dateTo,
          metrics: ALL_KEYS,
          partnerIds: [partnerId],
        }),
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
  }, [canView, partnerId, dateFrom, dateTo]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Lazy-load the full core-metric set for this telco when the section is
  // opened (and whenever the range changes while it's open). Core metrics (~20)
  // fit within the query's 30-metric cap in a single call.
  useEffect(() => {
    if (!showAll || !canView) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        setAllLoading(true);
        setAllError(null);
        const catalog =
          allCatalog.length > 0
            ? { data: allCatalog }
            : await listMarketingMetrics({ group: "core", limit: 500 });
        if (cancelled) {
          return;
        }
        if (allCatalog.length === 0) {
          setAllCatalog(catalog.data);
        }
        const keys = catalog.data.map((m) => m.key).slice(0, 30);
        const res = await queryMarketingMetrics({
          dateFrom,
          dateTo,
          metrics: keys,
          partnerIds: [partnerId],
        });
        if (!cancelled) {
          setAllResult(res.data);
        }
      } catch (err) {
        if (!cancelled) {
          setAllError(err instanceof ApiError ? err.message : "Query failed");
        }
      } finally {
        if (!cancelled) {
          setAllLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [showAll, canView, partnerId, dateFrom, dateTo, allCatalog]);

  const partnerSeries = result?.results.find((r) => r.partner_id === partnerId);

  // Per-metric aggregates (total / avg-per-day / latest) for the all-metrics table.
  const allMetricRows = useMemo(() => {
    const series =
      allResult?.results.find((r) => r.partner_id === partnerId)?.series ?? [];
    const labelByKey = new Map(allCatalog.map((m) => [m.key, m.label]));
    return allCatalog.map((m) => {
      const vals = series
        .map((pt) => pt.metrics[m.key])
        .filter((v): v is number => typeof v === "number");
      const total = vals.reduce((a, b) => a + b, 0);
      const latest = vals.length > 0 ? vals[vals.length - 1] : null;
      return {
        key: m.key,
        label: labelByKey.get(m.key) ?? m.key,
        total: vals.length > 0 ? total : null,
        avg: vals.length > 0 ? total / vals.length : null,
        latest,
      };
    });
  }, [allResult, allCatalog, partnerId]);
  const telcoName =
    partnerSeries?.telco_name?.trim() || partner?.name || "Telco";
  const facts =
    TELCO_FACTS[telcoName] ?? (partner ? TELCO_FACTS[partner.name] : undefined);

  const handleExport = useCallback(
    async (kind: ReportKind) => {
      try {
        setExporting(kind);
        await generateTelcoReport(partnerId, telcoName, kind);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Report export failed",
        );
      } finally {
        setExporting(null);
      }
    },
    [partnerId, telcoName],
  );

  // Completed campaigns in this telco's market, as recap cards.
  const recaps = useMemo(() => {
    const country = partner?.country?.toLowerCase();
    return campaigns
      .filter((c) =>
        country && c.country ? c.country.toLowerCase() === country : false,
      )
      .filter((c) => c.status === "completed")
      .sort((a, b) => b.campaignDate.localeCompare(a.campaignDate));
  }, [campaigns, partner]);

  const kpis = useMemo(() => {
    const series = partnerSeries?.series ?? [];
    return KPI_METRICS.map((m) => {
      const vals = series
        .map((pt) => pt.metrics[m.key])
        .filter((v): v is number => typeof v === "number");
      if (vals.length === 0) return { ...m, value: null as number | null };
      const total = vals.reduce((a, b) => a + b, 0);
      return {
        ...m,
        value: m.agg === "avg" ? total / vals.length : total,
      };
    });
  }, [partnerSeries]);

  const chartData = useMemo(() => {
    const series = partnerSeries?.series ?? [];
    return series
      .map((pt) => ({
        date: pt.date,
        "New Users": pt.metrics.new_users ?? null,
        "Repeat Users": pt.metrics.repeated_users ?? null,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [partnerSeries]);

  // Campaigns that match this telco's country and fall on a charted day.
  const telcoCampaigns = useMemo(() => {
    const chartedDates = new Set(chartData.map((r) => r.date));
    const country = partner?.country?.toLowerCase();
    return campaigns
      .map((c) => ({ ...c, day: c.campaignDate.slice(0, 10) }))
      .filter((c) => chartedDates.has(c.day))
      .filter((c) =>
        country && c.country ? c.country.toLowerCase() === country : true,
      );
  }, [campaigns, chartData, partner]);

  const sumKey = useCallback(
    (key: string) =>
      (partnerSeries?.series ?? [])
        .map((pt) => pt.metrics[key])
        .filter((v): v is number => typeof v === "number")
        .reduce((a, b) => a + b, 0),
    [partnerSeries],
  );

  // BNRY earned by source (lifetime-of-range), collapsed into the three
  // user-meaningful buckets the reference dashboard uses.
  const bnry = useMemo(() => {
    const stw = sumKey("tx.spin_reward.amount");
    const games = sumKey("tx.online_reward.amount");
    const videos =
      sumKey("tx.FOLLOW_GIVEN.amount") + sumKey("tx.LIKE_GIVEN.amount");
    return { stw, games, videos, total: stw + games + videos };
  }, [sumKey]);

  // Repeat-user share over the range (for the insight card).
  const repeatShare = useMemo(() => {
    const newU = sumKey("new_users");
    const rep = sumKey("repeated_users");
    return newU + rep > 0 ? (rep / (newU + rep)) * 100 : null;
  }, [sumKey]);

  // Our reach + engagement vs the host telco-app baselines (progress bars).
  const baseline = useMemo(() => {
    const series = partnerSeries?.series ?? [];
    if (series.length === 0 || !partner) return null;
    const dauVals = series
      .map((pt) => pt.metrics.unique_users)
      .filter((v): v is number => typeof v === "number");
    const avgDau =
      dauVals.length > 0
        ? dauVals.reduce((a, b) => a + b, 0) / dauVals.length
        : 0;
    const secVals = series
      .map((pt) => pt.metrics.avg_time_spent_seconds)
      .filter((v): v is number => typeof v === "number");
    const avgSec =
      secVals.length > 0
        ? secVals.reduce((a, b) => a + b, 0) / secVals.length
        : 0;
    const totalViews = sumKey("total_views_homepage");
    const sessionsPerDau = avgDau > 0 ? totalViews / series.length / avgDau : 0;
    // Approx monthly reach: unique users across the window, deduped ~55%.
    const mau =
      series
        .map((pt) => pt.metrics.unique_users)
        .filter((v): v is number => typeof v === "number")
        .reduce((a, b) => a + b, 0) * 0.55;
    return { avgDau, avgSec, sessionsPerDau, mau };
  }, [partnerSeries, partner, sumKey]);

  // Day-on-day comparison: latest charted day vs the day before.
  const dailyCompare = useMemo(() => {
    const series = partnerSeries?.series ?? [];
    if (series.length < 2) return null;
    const curr = series[series.length - 1];
    const prev = series[series.length - 2];
    const rows = [
      { label: "Unique Users", key: "unique_users" },
      { label: "New Users", key: "new_users" },
      { label: "Repeat Users", key: "repeated_users" },
      { label: "Homepage Views", key: "total_views_homepage" },
    ].map((m) => {
      const c = curr.metrics[m.key];
      const p = prev.metrics[m.key];
      const pct =
        typeof c === "number" && typeof p === "number" && p > 0
          ? ((c - p) / p) * 100
          : null;
      return { label: m.label, curr: c ?? null, prev: p ?? null, pct };
    });
    return { currDate: curr.date, prevDate: prev.date, rows };
  }, [partnerSeries]);

  // Progress bars: our reach/engagement vs the host telco-app baselines.
  const baselineBars = useMemo(() => {
    if (!baseline || !partner) return [];
    const bars: Array<{
      label: string;
      our: number;
      base: number;
      fmt: (n: number) => string;
    }> = [];
    if (partner.hostDau) {
      bars.push({
        label: "Reach — avg DAU vs host app DAU",
        our: baseline.avgDau,
        base: partner.hostDau,
        fmt: fmtNum,
      });
    }
    if (partner.hostMau) {
      bars.push({
        label: "Monthly reach — est. MAU vs host app MAU",
        our: baseline.mau,
        base: partner.hostMau,
        fmt: fmtNum,
      });
    }
    if (partner.hostSessionSec) {
      bars.push({
        label: "Session depth — avg session vs host app baseline",
        our: baseline.avgSec,
        base: partner.hostSessionSec,
        fmt: (n: number) => `${Math.round(n)}s`,
      });
    }
    return bars;
  }, [baseline, partner]);

  if (!canView) {
    return (
      <div className="px-6 py-6">
        <PageHeader title="Telco Detail" />
        <p className="text-muted-foreground text-sm">
          You don&apos;t have access to Marketing Analytics.
        </p>
      </div>
    );
  }

  return (
    <div className="px-6 py-6">
      <div className="mb-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/marketing-analytics/traffic">
            <ArrowLeft className="mr-1 size-3.5" />
            Traffic Dashboard
          </Link>
        </Button>
      </div>

      <PageHeader
        title={telcoName}
        subtitle={
          partner
            ? [partner.country, partner.subscribers]
                .filter(Boolean)
                .join(" · ") || "Live from the BNII Analytics API"
            : "Live from the BNII Analytics API"
        }
      >
        <div className="flex gap-1.5">
          {RANGE_PRESETS.map((r) => (
            <Button
              key={r.key}
              variant={rangeKey === r.key ? "default" : "outline"}
              size="sm"
              onClick={() => setRangeKey(r.key)}
            >
              {r.label}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            onClick={fetchData}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
          </Button>
        </div>
      </PageHeader>

      {error && (
        <Card className="border-destructive/40 mb-5">
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <p className="text-destructive text-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="mr-1 size-3.5" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Client-ready report export */}
      <Card className="mb-5">
        <CardContent
          className={`flex flex-wrap items-center justify-between gap-3 py-4`}
        >
          <div>
            <p className="text-sm font-medium">Export client-ready report</p>
            <p className="text-muted-foreground text-xs">
              Printable KPIs + campaigns, current period vs the prior comparable
              window.
            </p>
          </div>
          <div className="flex gap-1.5">
            {(["daily", "weekly", "mom"] as ReportKind[]).map((k) => (
              <Button
                key={k}
                variant="outline"
                size="sm"
                onClick={() => handleExport(k)}
                disabled={exporting !== null}
              >
                {exporting === k ? (
                  <Loader2 className="mr-1 size-3.5 animate-spin" />
                ) : (
                  <FileDown className="mr-1 size-3.5" />
                )}
                {k === "daily"
                  ? "Daily"
                  : k === "weekly"
                    ? "Weekly"
                    : "Month-on-month"}
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* KPI band */}
      <div
        className={`
          mb-5 grid gap-4
          md:grid-cols-3
          lg:grid-cols-5
        `}
      >
        {loading ? (
          Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-[110px] rounded-xl" />
          ))
        ) : (
          <>
            {kpis.map((k) => (
              <StatCard
                key={k.key}
                label={k.label}
                value={
                  k.value === null
                    ? "—"
                    : k.unit === "s"
                      ? `${Math.round(k.value)}s`
                      : fmtNum(k.value)
                }
                change={k.agg === "avg" ? "Avg / day" : "Period total"}
                changeType="neutral"
                icon={k.key === "new_users" ? Users : Activity}
                accent="primary"
              />
            ))}
          </>
        )}
      </div>

      {/* Acquisition vs retention trend */}
      <Card className="mb-5">
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            New vs repeat users
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[320px] rounded-lg" />
          ) : chartData.length === 0 ? (
            <p className="text-muted-foreground py-20 text-center text-sm">
              No data returned for this telco and range.
            </p>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
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
                  contentStyle={{ fontSize: 12 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {telcoCampaigns.map((c) => (
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
                <Line
                  type="monotone"
                  dataKey="New Users"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
                <Line
                  type="monotone"
                  dataKey="Repeat Users"
                  stroke="#2dba70"
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Day-on-day comparison */}
      {!loading && dailyCompare && (
        <DayOnDayTable
          rows={dailyCompare.rows}
          currDate={dailyCompare.currDate}
          prevDate={dailyCompare.prevDate}
        />
      )}

      {/* Reach & engagement vs host baseline */}
      {!loading && baselineBars.length > 0 && (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Reach &amp; engagement vs {telcoName} app baseline
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {baselineBars.map((b) => {
              const max = Math.max(b.our, b.base) * 1.1 || 1;
              const ourPct = (b.our / max) * 100;
              const basePct = (b.base / max) * 100;
              const delta =
                b.base > 0 ? ((b.our - b.base) / b.base) * 100 : null;
              return (
                <div key={b.label} className="space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{b.label}</span>
                    <span
                      className={
                        delta === null
                          ? "text-muted-foreground"
                          : delta >= 0
                            ? `
                              text-emerald-600
                              dark:text-emerald-400
                            `
                            : `
                              text-amber-600
                              dark:text-amber-400
                            `
                      }
                    >
                      {delta === null
                        ? "—"
                        : `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}%`}
                    </span>
                  </div>
                  <div className="bg-muted relative h-3 rounded-full">
                    <div
                      className="bg-primary h-full rounded-full"
                      style={{ width: `${ourPct}%` }}
                    />
                    <div
                      className={`
                        bg-foreground/70 absolute top-[-2px] bottom-[-2px] w-0.5
                      `}
                      style={{ left: `${basePct}%` }}
                      title="Host baseline"
                    />
                  </div>
                  <div
                    className={`
                      text-muted-foreground flex justify-between text-[11px]
                    `}
                  >
                    <span>Ours: {b.fmt(b.our)}</span>
                    <span>Baseline: {b.fmt(b.base)}</span>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* BNRY-by-source + repeat-share insight */}
      <div
        className={`
          mb-5 grid gap-4
          lg:grid-cols-2
        `}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              BNRY earned by source
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[200px] rounded-lg" />
            ) : bnry.total <= 0 ? (
              <p className="text-muted-foreground py-12 text-center text-sm">
                No BNRY earned in this range.
              </p>
            ) : (
              <BnrySplit bnry={bnry} />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Returning-user insight
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading || repeatShare === null ? (
              <Skeleton className="h-[200px] rounded-lg" />
            ) : (
              <div className="flex h-full flex-col justify-center py-4">
                <p className="text-primary font-serif text-5xl font-medium">
                  {repeatShare.toFixed(1)}
                  <span className="text-2xl">%</span>
                </p>
                <p className="mt-2 text-sm font-medium">
                  of activity came from returning users
                </p>
                <p className="text-muted-foreground mt-1 text-xs">
                  Over {dateFrom} → {dateTo}. Repeat-user share is the clearest
                  signal that {telcoName} is becoming a routine touchpoint
                  rather than a one-off visit.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Pop-banner first-entry saturation model */}
      {!loading && partner?.hostMau && partner?.hostDau && (
        <PopBannerModel
          hostName={telcoName}
          hostMau={partner.hostMau}
          hostDau={partner.hostDau}
          startingCumulative={sumKey("new_users")}
        />
      )}

      {/* Campaign recap — completed campaigns in this market */}
      {!loading && recaps.length > 0 && (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Campaign recap &amp; learnings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recaps.map((c) => {
              const lift =
                typeof c.expectedReach === "number" &&
                typeof c.actualReach === "number" &&
                c.expectedReach > 0
                  ? ((c.actualReach - c.expectedReach) / c.expectedReach) * 100
                  : null;
              return (
                <div key={c.id} className="border-border rounded-lg border p-4">
                  <div
                    className={`
                      flex flex-wrap items-baseline justify-between gap-2
                    `}
                  >
                    <span className="text-sm font-medium">{c.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {c.campaignDate.slice(0, 10)}
                      {c.hours ? ` · ${c.hours}h` : ""}
                      {lift !== null
                        ? ` · reach ${lift >= 0 ? "+" : ""}${lift.toFixed(0)}% vs forecast`
                        : ""}
                    </span>
                  </div>
                  {c.levers.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {c.levers.map((l) => (
                        <Badge key={l.id} variant="outline">
                          {l.name}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <Link
                    href={`/marketing-analytics/campaigns/${c.id}`}
                    className={`
                      text-primary mt-2 inline-block text-xs
                      hover:underline
                    `}
                  >
                    View full campaign →
                  </Link>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Host-app user-behaviour facts */}
      {facts && facts.length > 0 && (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              {telcoName} user-behaviour facts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`
                grid gap-3
                sm:grid-cols-2
                lg:grid-cols-3
              `}
            >
              {facts.map((f) => (
                <div
                  key={f.label}
                  className="border-border rounded-lg border p-3"
                >
                  <p className="text-muted-foreground text-[10px] uppercase">
                    {f.label}
                  </p>
                  <p className="text-sm font-medium">{f.value}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* All metrics (Atlas parity) — additive, collapsed by default */}
      <Card className="mb-5">
        <CardHeader>
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="flex w-full items-center justify-between"
          >
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              {showAll ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
              All metrics
              <span className="text-muted-foreground text-xs font-normal">
                every core metric this telco reports, for the selected range
              </span>
            </CardTitle>
            {allLoading && <Loader2 className="size-3.5 animate-spin" />}
          </button>
        </CardHeader>
        {showAll && (
          <CardContent>
            {allError ? (
              <p className="text-destructive py-6 text-center text-sm">
                {allError}
              </p>
            ) : allLoading && allMetricRows.length === 0 ? (
              <Skeleton className="h-[280px] rounded-lg" />
            ) : allMetricRows.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-sm">
                No metrics returned for this telco and range.
              </p>
            ) : (
              <AllMetricsTable rows={allMetricRows} />
            )}
          </CardContent>
        )}
      </Card>

      {/* Campaigns for this telco */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Megaphone className="size-4" />
            Campaigns in range
            {partner?.country ? ` · ${partner.country}` : ""}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[160px] rounded-lg" />
          ) : telcoCampaigns.length === 0 ? (
            <p className="text-muted-foreground py-12 text-center text-sm">
              No campaigns for this telco in range.
            </p>
          ) : (
            <ul className="divide-border divide-y">
              {telcoCampaigns.map((c) => (
                <li key={c.id}>
                  <Link
                    href={`/marketing-analytics/campaigns/${c.id}`}
                    className={`
                      hover:bg-muted/50
                      flex items-center justify-between gap-3 rounded px-1
                      py-2.5
                    `}
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{c.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {c.day}
                        {c.channel ? ` · ${c.channel}` : ""}
                        {c.campaignType ? ` · ${c.campaignType}` : ""}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0">
                      {c.status}
                    </Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/** Day-on-day metric comparison for a partner. */
function DayOnDayTable({
  rows,
  currDate,
  prevDate,
}: {
  rows: {
    label: string;
    curr: number | null;
    prev: number | null;
    pct: number | null;
  }[];
  currDate: string;
  prevDate: string;
}) {
  const columns = useMemo<TableColumn<(typeof rows)[number]>[]>(
    () => [
      {
        key: "metric",
        label: "Metric",
        render: (r) => r.label,
        sortValue: (r) => r.label,
      },
      {
        key: "latest",
        label: "Latest",
        align: "right",
        render: (r) => fmtNum(r.curr),
        sortValue: (r) => r.curr,
      },
      {
        key: "prior",
        label: "Prior",
        align: "right",
        render: (r) => (
          <span className="text-muted-foreground">{fmtNum(r.prev)}</span>
        ),
        sortValue: (r) => r.prev,
      },
      {
        key: "change",
        label: "Change",
        align: "right",
        render: (r) => (
          <span
            className={`
              font-medium
              ${
                r.pct === null
                  ? "text-muted-foreground"
                  : r.pct >= 0
                    ? `
                      text-emerald-600
                      dark:text-emerald-400
                    `
                    : `
                      text-red-600
                      dark:text-red-400
                    `
              }
            `}
          >
            {r.pct === null
              ? "—"
              : `${r.pct >= 0 ? "+" : ""}${r.pct.toFixed(1)}%`}
          </span>
        ),
        sortValue: (r) => r.pct,
      },
    ],
    [],
  );

  return (
    <div className="mb-5">
      <CustomizableTable
        tableId="ma-traffic-day-on-day"
        title={`Day-on-day — ${currDate} vs ${prevDate}`}
        columns={columns}
        rows={rows}
        rowKey={(r) => r.label}
      />
    </div>
  );
}

/**
 * Every metric this telco reports for the range.
 *
 * Rendered bare: it already sits inside the collapsible "All metrics" card, and
 * a second Card shell would nest one card inside another.
 */
function AllMetricsTable({
  rows,
}: {
  rows: {
    key: string;
    label: string;
    total: number | null;
    avg: number | null;
    latest: number | null;
  }[];
}) {
  const columns = useMemo<TableColumn<(typeof rows)[number]>[]>(
    () => [
      {
        key: "metric",
        label: "Metric",
        render: (r) => r.label,
        sortValue: (r) => r.label,
      },
      {
        key: "total",
        label: "Period total",
        align: "right",
        render: (r) => <span className="font-medium">{fmtNum(r.total)}</span>,
        sortValue: (r) => r.total,
      },
      {
        key: "avg",
        label: "Avg / day",
        align: "right",
        render: (r) => (
          <span className="text-muted-foreground">
            {r.avg === null ? "—" : fmtNum(Math.round(r.avg))}
          </span>
        ),
        sortValue: (r) => r.avg,
      },
      {
        key: "latest",
        label: "Latest",
        align: "right",
        render: (r) => fmtNum(r.latest),
        sortValue: (r) => r.latest,
      },
    ],
    [],
  );

  return (
    <CustomizableTable
      bare
      tableId="ma-traffic-all-metrics"
      title="All metrics"
      columns={columns}
      rows={rows}
      rowKey={(r) => r.key}
    />
  );
}
