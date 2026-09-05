"use client";

import {
  ArrowLeft,
  BarChart3,
  CalendarClock,
  Download,
  FileDown,
  Gauge,
  Layers,
  RefreshCw,
  Target,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/shared/badge";
import { DataPagination } from "@/components/shared/data-pagination";
import { DataTable } from "@/components/shared/data-table";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePagination } from "@/hooks/use-pagination";
import { useTabParam } from "@/hooks/use-tab-param";
import { ApiError } from "@/lib/api-client";
import { type ExportColumn, exportRows } from "@/lib/crm-export";
import { useAuth } from "@/providers/auth-provider";
import {
  type AccuracyRow,
  type CampaignPerfRow,
  getCampaignPerformance,
  getCampaignSummary,
  getLeverPerformance,
  getPredictionAccuracy,
  getPredictionVsActual,
  getReportsDashboard,
  type LeverPerfRow,
  type PvaRow,
  type ReportFilter,
  type ReportsDashboard,
  type SummaryRow,
} from "@/services/marketing-reports.service";

function money(n: number) {
  return n.toLocaleString();
}
function pct(v: number | null) {
  return v === null ? "—" : `${v}%`;
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB");
}

/** Escape a caller-supplied value before interpolating it into export HTML. */
function esc(value: string | null | undefined): string {
  if (value == null) return "";
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * PDF export via the browser print dialog (no new dependency). Every
 * caller-supplied value (title, headers, cells — e.g. free-text campaign
 * names) is HTML-escaped, and the document is served via a Blob URL instead
 * of document.write() to avoid the HTML/script-injection foot-gun.
 */
function printReport(title: string, headers: string[], rows: string[][]) {
  const th = headers.map((h) => `<th>${esc(h)}</th>`).join("");
  const trs = rows
    .map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`)
    .join("");
  const html = `<!doctype html><html><head><title>${esc(title)}</title>
<style>
  body{font-family:Arial,Helvetica,sans-serif;padding:24px;color:#111}
  h1{font-size:18px;margin:0 0 4px}
  p{color:#666;font-size:12px;margin:0 0 16px}
  table{border-collapse:collapse;width:100%;font-size:12px}
  th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
  th{background:#f4f4f4}
</style></head><body>
<h1>${esc(title)}</h1><p>Generated ${new Date().toLocaleString("en-GB")}</p>
<table><thead><tr>${th}</tr></thead><tbody>${trs}</tbody></table>
<script>window.onload=function(){window.print();}</script>
</body></html>`;
  const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  const w = window.open(url, "_blank", "noopener,noreferrer");
  if (w) {
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } else {
    URL.revokeObjectURL(url);
    toast.error("Allow pop-ups to export PDF");
  }
}

type ExportFmt = "csv" | "xlsx" | "pdf";

function ExportButtons<T>({
  baseName,
  columns,
  rows,
  disabled,
}: {
  baseName: string;
  columns: ExportColumn<T>[];
  rows: T[];
  disabled?: boolean;
}) {
  function run(fmt: ExportFmt) {
    if (fmt === "pdf") {
      printReport(
        baseName,
        columns.map((c) => c.header),
        rows.map((r) =>
          columns.map((c) => {
            const v = c.value(r);
            return v === null || v === undefined ? "" : String(v);
          }),
        ),
      );
      return;
    }
    exportRows(baseName, columns, rows, fmt);
  }
  return (
    <div className="flex gap-1.5">
      <Button
        variant="outline"
        size="xs"
        disabled={disabled}
        onClick={() => run("csv")}
      >
        <Download className="mr-1 size-3" />
        CSV
      </Button>
      <Button
        variant="outline"
        size="xs"
        disabled={disabled}
        onClick={() => run("xlsx")}
      >
        <Download className="mr-1 size-3" />
        Excel
      </Button>
      <Button
        variant="outline"
        size="xs"
        disabled={disabled}
        onClick={() => run("pdf")}
      >
        <FileDown className="mr-1 size-3" />
        PDF
      </Button>
    </div>
  );
}

export default function MarketingReportsPage() {
  const { hasAnyPermission } = useAuth();
  const canView = hasAnyPermission(
    "marketing:reports:view",
    "marketing:campaign:view",
  );

  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const filter: ReportFilter = useMemo(
    () => ({
      status: status !== "all" ? status : undefined,
      from: from || undefined,
      to: to || undefined,
    }),
    [status, from, to],
  );

  const [snap, setSnap] = useState<ReportsDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useTabParam("pva");

  const fetchDashboard = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getReportsDashboard(filter);
      setSnap(res.data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  if (!canView) {
    return (
      <div className="px-6 py-6">
        <PageHeader title="Marketing Reports" />
        <p className="text-muted-foreground text-sm">No access.</p>
      </div>
    );
  }

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Analytics & Reports"
        subtitle="Prediction vs actual, campaign & lever performance"
      >
        <Button variant="outline" size="sm" asChild>
          <Link href="/marketing-analytics">
            <ArrowLeft className="mr-1 size-3.5" />
            Marketing Analytics
          </Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchDashboard}
          disabled={loading}
        >
          <RefreshCw className="mr-1 size-3.5" />
          Refresh
        </Button>
      </PageHeader>

      {/* Filters (shared across dashboard + reports) */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="h-9 w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="planned">Planned</SelectItem>
            <SelectItem value="scheduled">Scheduled</SelectItem>
            <SelectItem value="live">Live</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground text-xs">From</span>
          <Input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-9 w-[150px]"
          />
          <span className="text-muted-foreground text-xs">To</span>
          <Input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-9 w-[150px]"
          />
        </div>
      </div>

      {/* KPI band */}
      <div
        className={`
          mb-5 grid gap-4
          md:grid-cols-2
          lg:grid-cols-4
        `}
      >
        {loading || !snap ? (
          Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[110px] rounded-xl" />
          ))
        ) : (
          <>
            <StatCard
              label="Total Campaigns"
              value={snap.campaignPerformance.totalCampaigns.toLocaleString()}
              change="In range"
              changeType="neutral"
              icon={Target}
              accent="primary"
            />
            <StatCard
              label="Actual Reach"
              value={money(snap.campaignPerformance.totalActualReach)}
              change={`Predicted ${money(snap.campaignPerformance.totalExpectedReach)}`}
              changeType="neutral"
              icon={BarChart3}
              accent="info"
            />
            <StatCard
              label="Avg Performance"
              value={pct(snap.campaignPerformance.avgPerformancePct)}
              change={`${snap.predictionAccuracy.evaluatedCampaigns} evaluated`}
              changeType={
                (snap.campaignPerformance.avgPerformancePct ?? 0) >= 100
                  ? "up"
                  : "down"
              }
              icon={Gauge}
              accent="success"
            />
            <StatCard
              label="Total Budget"
              value={money(snap.campaignPerformance.totalBudget)}
              change="Across campaigns"
              changeType="neutral"
              icon={Wallet}
              accent="warning"
            />
          </>
        )}
      </div>

      {/* Charts */}
      {snap && (
        <div
          className={`
            mb-5 grid gap-4
            lg:grid-cols-2
          `}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Traffic Trends (predicted vs actual)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {snap.trafficTrends.length === 0 ? (
                <p className="text-muted-foreground py-14 text-center text-sm">
                  No data in range.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={snap.trafficTrends}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="expected"
                      stroke="var(--color-info)"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="actual"
                      stroke="var(--color-primary)"
                      strokeWidth={2}
                      dot={{ r: 2 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Lever Performance (actual reach)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {snap.leverPerformance.length === 0 ? (
                <p className="text-muted-foreground py-14 text-center text-sm">
                  No lever data.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={snap.leverPerformance}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="lever" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="actualReach" fill="var(--color-primary)" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <Layers className="size-4" /> Campaign Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-muted-foreground mb-1 text-xs">By status</p>
                {snap.campaignSummary.byStatus.map((s) => (
                  <div key={s.status} className="flex justify-between text-sm">
                    <span className="capitalize">{s.status}</span>
                    <span className="font-medium">{s.count}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-muted-foreground mb-1 text-xs">By channel</p>
                {snap.campaignSummary.byChannel.length === 0 ? (
                  <p className="text-muted-foreground text-sm">—</p>
                ) : (
                  snap.campaignSummary.byChannel.map((s) => (
                    <div
                      key={s.channel}
                      className="flex justify-between text-sm"
                    >
                      <span>{s.channel}</span>
                      <span className="font-medium">{s.count}</span>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-medium">
                <CalendarClock className="size-4" /> Upcoming Campaigns
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {snap.upcomingCampaigns.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                  Nothing scheduled.
                </p>
              ) : (
                snap.upcomingCampaigns.map((c) => (
                  <Link
                    key={c.id}
                    href={`/marketing-analytics/campaigns/${c.id}`}
                    className={`
                      hover:bg-muted/40
                      flex items-center justify-between rounded-lg px-2 py-1.5
                      text-sm
                    `}
                  >
                    <span>{c.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {fmtDate(c.campaignDate)}
                    </span>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Reports */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="pva">Prediction vs Actual</TabsTrigger>
          <TabsTrigger value="performance">Campaign Performance</TabsTrigger>
          <TabsTrigger value="summary">Campaign Summary</TabsTrigger>
          <TabsTrigger value="accuracy">Prediction Accuracy</TabsTrigger>
          <TabsTrigger value="lever">Lever Performance</TabsTrigger>
        </TabsList>
        <TabsContent value="pva" className="mt-4">
          <PredictionVsActual filter={filter} />
        </TabsContent>
        <TabsContent value="performance" className="mt-4">
          <CampaignPerformance filter={filter} />
        </TabsContent>
        <TabsContent value="summary" className="mt-4">
          <CampaignSummaryReport filter={filter} />
        </TabsContent>
        <TabsContent value="accuracy" className="mt-4">
          <PredictionAccuracyReport filter={filter} />
        </TabsContent>
        <TabsContent value="lever" className="mt-4">
          <LeverPerformanceReport filter={filter} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ── Prediction vs Actual (server paginated + sortable) ──
function PredictionVsActual({ filter }: { filter: ReportFilter }) {
  const [rows, setRows] = useState<PvaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("campaignDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const pagination = usePagination();
  const { setTotalCount } = pagination;

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getPredictionVsActual({
        ...filter,
        page: pagination.page,
        limit: pagination.pageSize,
        sortBy,
        sortDir,
      });
      setRows(res.data);
      setTotalCount(res.meta.total);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [
    filter,
    pagination.page,
    pagination.pageSize,
    sortBy,
    sortDir,
    setTotalCount,
  ]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  function onSort(key: string) {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key);
      setSortDir("desc");
    }
  }

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <ExportButtons<PvaRow>
          baseName="prediction-vs-actual"
          rows={rows}
          disabled={rows.length === 0}
          columns={[
            { header: "Campaign", value: (r) => r.name },
            { header: "Date", value: (r) => fmtDate(r.campaignDate) },
            { header: "Status", value: (r) => r.status },
            { header: "Predicted", value: (r) => r.predicted ?? "" },
            { header: "Actual", value: (r) => r.actual ?? "" },
            { header: "Difference", value: (r) => r.difference ?? "" },
            { header: "Performance %", value: (r) => r.performancePct ?? "" },
          ]}
        />
      </div>
      <DataTable
        loading={loading}
        data={rows}
        emptyMessage="No campaigns"
        sortBy={sortBy}
        sortOrder={sortDir}
        onSortChange={onSort}
        columns={[
          { key: "name", header: "Campaign", sortable: true },
          {
            key: "campaignDate",
            header: "Date",
            sortable: true,
            render: (r) => fmtDate(r.campaignDate),
          },
          {
            key: "expectedReach",
            header: "Predicted",
            sortable: true,
            className: "text-right",
            render: (r) => r.predicted?.toLocaleString() ?? "—",
          },
          {
            key: "actualReach",
            header: "Actual",
            sortable: true,
            className: "text-right",
            render: (r) => r.actual?.toLocaleString() ?? "—",
          },
          {
            key: "difference",
            header: "Difference",
            className: "text-right",
            render: (r) =>
              r.difference === null ? (
                "—"
              ) : (
                <span
                  className={
                    r.difference >= 0 ? "text-success" : "text-destructive"
                  }
                >
                  {r.difference >= 0 ? "+" : ""}
                  {r.difference.toLocaleString()}
                </span>
              ),
          },
          {
            key: "performancePct",
            header: "Performance",
            className: "text-right",
            render: (r) => pct(r.performancePct),
          },
        ]}
        pagination={
          <DataPagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalCount={pagination.totalCount}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        }
      />
    </div>
  );
}

// ── Campaign Performance (server paginated + sortable) ──
function CampaignPerformance({ filter }: { filter: ReportFilter }) {
  const [rows, setRows] = useState<CampaignPerfRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState("campaignDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const pagination = usePagination();
  const { setTotalCount } = pagination;

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getCampaignPerformance({
        ...filter,
        page: pagination.page,
        limit: pagination.pageSize,
        sortBy,
        sortDir,
      });
      setRows(res.data);
      setTotalCount(res.meta.total);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [
    filter,
    pagination.page,
    pagination.pageSize,
    sortBy,
    sortDir,
    setTotalCount,
  ]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  function onSort(key: string) {
    if (sortBy === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(key);
      setSortDir("desc");
    }
  }

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <ExportButtons<CampaignPerfRow>
          baseName="campaign-performance"
          rows={rows}
          disabled={rows.length === 0}
          columns={[
            { header: "Campaign", value: (r) => r.name },
            { header: "Date", value: (r) => fmtDate(r.campaignDate) },
            { header: "Status", value: (r) => r.status },
            { header: "Channel", value: (r) => r.channel ?? "" },
            { header: "Owner", value: (r) => r.owner ?? "" },
            { header: "Expected", value: (r) => r.expectedReach ?? "" },
            { header: "Actual", value: (r) => r.actualReach ?? "" },
            { header: "Budget", value: (r) => r.budget ?? "" },
            { header: "Performance %", value: (r) => r.performancePct ?? "" },
          ]}
        />
      </div>
      <DataTable
        loading={loading}
        data={rows}
        emptyMessage="No campaigns"
        sortBy={sortBy}
        sortOrder={sortDir}
        onSortChange={onSort}
        columns={[
          { key: "name", header: "Campaign", sortable: true },
          {
            key: "campaignDate",
            header: "Date",
            sortable: true,
            render: (r) => fmtDate(r.campaignDate),
          },
          {
            key: "status",
            header: "Status",
            sortable: true,
            render: (r) => <Badge status={r.status}>{r.status}</Badge>,
          },
          {
            key: "channel",
            header: "Channel",
            render: (r) => r.channel ?? "—",
          },
          {
            key: "budget",
            header: "Budget",
            sortable: true,
            className: "text-right",
            render: (r) =>
              r.budget === null ? "—" : `${r.currency} ${money(r.budget)}`,
          },
          {
            key: "performancePct",
            header: "Performance",
            className: "text-right",
            render: (r) => pct(r.performancePct),
          },
        ]}
        pagination={
          <DataPagination
            page={pagination.page}
            pageSize={pagination.pageSize}
            totalCount={pagination.totalCount}
            totalPages={pagination.totalPages}
            onPageChange={pagination.setPage}
            onPageSizeChange={pagination.setPageSize}
          />
        }
      />
    </div>
  );
}

// ── Campaign Summary (daily/weekly/monthly) ──
function CampaignSummaryReport({ filter }: { filter: ReportFilter }) {
  const [rows, setRows] = useState<SummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [granularity, setGranularity] = useState<
    "daily" | "weekly" | "monthly"
  >("monthly");

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getCampaignSummary({ ...filter, granularity });
      setRows(res.data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [filter, granularity]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <Select
          value={granularity}
          onValueChange={(v) =>
            setGranularity(v as "daily" | "weekly" | "monthly")
          }
        >
          <SelectTrigger className="h-9 w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Daily</SelectItem>
            <SelectItem value="weekly">Weekly</SelectItem>
            <SelectItem value="monthly">Monthly</SelectItem>
          </SelectContent>
        </Select>
        <ExportButtons<SummaryRow>
          baseName={`campaign-summary-${granularity}`}
          rows={rows}
          disabled={rows.length === 0}
          columns={[
            { header: "Period", value: (r) => r.period },
            { header: "Campaigns", value: (r) => r.campaigns },
            { header: "Expected", value: (r) => r.expectedReach },
            { header: "Actual", value: (r) => r.actualReach },
            { header: "Budget", value: (r) => r.budget },
            { header: "Performance %", value: (r) => r.performancePct ?? "" },
          ]}
        />
      </div>
      <DataTable
        loading={loading}
        data={rows}
        emptyMessage="No data in range"
        getRowId={(r) => r.period}
        columns={[
          { key: "period", header: "Period" },
          {
            key: "campaigns",
            header: "Campaigns",
            className: "text-right",
            render: (r) => r.campaigns,
          },
          {
            key: "expectedReach",
            header: "Expected",
            className: "text-right",
            render: (r) => money(r.expectedReach),
          },
          {
            key: "actualReach",
            header: "Actual",
            className: "text-right",
            render: (r) => money(r.actualReach),
          },
          {
            key: "budget",
            header: "Budget",
            className: "text-right",
            render: (r) => money(r.budget),
          },
          {
            key: "performancePct",
            header: "Performance",
            className: "text-right",
            render: (r) => pct(r.performancePct),
          },
        ]}
      />
    </div>
  );
}

// ── Prediction Accuracy ──
function PredictionAccuracyReport({ filter }: { filter: ReportFilter }) {
  const [rows, setRows] = useState<AccuracyRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getPredictionAccuracy(filter);
      setRows(res.data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <ExportButtons<AccuracyRow>
          baseName="prediction-accuracy"
          rows={rows}
          disabled={rows.length === 0}
          columns={[
            { header: "Campaign", value: (r) => r.name },
            { header: "Date", value: (r) => fmtDate(r.campaignDate) },
            { header: "Predicted", value: (r) => r.predicted },
            { header: "Actual", value: (r) => r.actual },
            { header: "Difference", value: (r) => r.difference },
            { header: "Performance %", value: (r) => r.performancePct ?? "" },
            { header: "Accuracy %", value: (r) => r.accuracyPct ?? "" },
          ]}
        />
      </div>
      <DataTable
        loading={loading}
        data={rows}
        emptyMessage="No campaigns with both predicted and actual reach"
        columns={[
          { key: "name", header: "Campaign" },
          {
            key: "campaignDate",
            header: "Date",
            render: (r) => fmtDate(r.campaignDate),
          },
          {
            key: "predicted",
            header: "Predicted",
            className: "text-right",
            render: (r) => money(r.predicted),
          },
          {
            key: "actual",
            header: "Actual",
            className: "text-right",
            render: (r) => money(r.actual),
          },
          {
            key: "performancePct",
            header: "Performance",
            className: "text-right",
            render: (r) => pct(r.performancePct),
          },
          {
            key: "accuracyPct",
            header: "Accuracy",
            className: "text-right",
            render: (r) => pct(r.accuracyPct),
          },
        ]}
      />
    </div>
  );
}

// ── Lever Performance ──
function LeverPerformanceReport({ filter }: { filter: ReportFilter }) {
  const [rows, setRows] = useState<LeverPerfRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRows = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getLeverPerformance(filter);
      setRows(res.data);
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void fetchRows();
  }, [fetchRows]);

  return (
    <div>
      <div className="mb-2 flex justify-end">
        <ExportButtons<LeverPerfRow>
          baseName="lever-performance"
          rows={rows}
          disabled={rows.length === 0}
          columns={[
            { header: "Lever", value: (r) => r.lever },
            { header: "Campaigns", value: (r) => r.campaigns },
            { header: "Expected", value: (r) => r.expectedReach },
            { header: "Actual", value: (r) => r.actualReach },
            { header: "Budget", value: (r) => r.budget },
            {
              header: "Avg Performance %",
              value: (r) => r.avgPerformancePct ?? "",
            },
          ]}
        />
      </div>
      <DataTable
        loading={loading}
        data={rows}
        emptyMessage="No lever data"
        getRowId={(r) => r.leverId}
        columns={[
          { key: "lever", header: "Lever" },
          {
            key: "campaigns",
            header: "Campaigns",
            className: "text-right",
            render: (r) => r.campaigns,
          },
          {
            key: "actualReach",
            header: "Actual Reach",
            className: "text-right",
            render: (r) => money(r.actualReach),
          },
          {
            key: "avgPerformancePct",
            header: "Avg Performance",
            className: "text-right",
            render: (r) => pct(r.avgPerformancePct),
          },
        ]}
      />
    </div>
  );
}
