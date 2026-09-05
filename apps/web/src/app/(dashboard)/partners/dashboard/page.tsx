"use client";

import { Download, RefreshCw } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { MarketingCrmTabs } from "@/components/partners/marketing-crm-tabs";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getErrorMessage } from "@/lib/error-message";
import {
  CAMPAIGN_STATUSES,
  getHolisticDashboard,
  getMarketingDashboard,
  type HolisticDashboard,
  type MarketingDashboard,
} from "@/services/marketing.service";

// ─── Formatting helpers ─────────────────────────────────

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  if (!y || !m) return key;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", {
    month: "short",
  });
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

function statusLabel(v: string): string {
  return CAMPAIGN_STATUSES.find((s) => s.value === v)?.label ?? v;
}

const STATUS_BAR: Record<string, string> = {
  planned: "bg-zinc-400",
  live: "bg-emerald-500",
  completed: "bg-blue-500",
  cancelled: "bg-rose-400",
};

// ─── Report chrome (mirrors the IT/Sales CRM exhibit dashboards) ───

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="gap-0 p-5">
      <div
        className={`
          text-muted-foreground text-[9px] font-semibold tracking-[0.1em]
          uppercase
        `}
      >
        {label}
      </div>
      <div className="text-foreground mt-1 font-serif text-2xl leading-tight">
        {value}
      </div>
    </Card>
  );
}

function ExhibitFrame({
  title,
  exhibit,
  note,
  children,
}: {
  title: string;
  exhibit?: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <Card className="gap-0 p-0">
      <div
        className={`
          border-border flex items-center justify-between border-b px-5 py-3
        `}
      >
        <span
          className={`
            text-foreground text-[10px] font-bold tracking-[0.12em] uppercase
          `}
        >
          {title}
        </span>
        {note ? (
          <span
            className={`
              text-muted-foreground bg-muted rounded px-2 py-0.5 font-mono
              text-[10px]
            `}
          >
            {note}
          </span>
        ) : null}
      </div>
      <div className="p-5">
        {exhibit ? (
          <div
            className={`
              text-muted-foreground mb-3 text-[9px] font-semibold
              tracking-[0.1em] uppercase
            `}
          >
            {exhibit}
          </div>
        ) : null}
        {children}
      </div>
    </Card>
  );
}

function CadenceBars({ monthly }: { monthly: MarketingDashboard["monthly"] }) {
  const max = Math.max(1, ...monthly.map((m) => m.count));
  return (
    <div className="flex items-end gap-1.5" style={{ height: 140 }}>
      {monthly.map((m) => (
        <div key={m.month} className="flex flex-1 flex-col items-center gap-1">
          <div className="text-muted-foreground text-[10px] tabular-nums">
            {m.count || ""}
          </div>
          <div
            className="bg-foreground/80 w-full rounded-t"
            style={{ height: `${(m.count / max) * 104}px`, minHeight: 2 }}
          />
          <div className="text-muted-foreground text-[9px]">
            {monthLabel(m.month)}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusStrip({
  breakdown,
}: {
  breakdown: MarketingDashboard["statusBreakdown"];
}) {
  const entries = CAMPAIGN_STATUSES.map((s) => ({
    key: s.value,
    label: s.label,
    count: breakdown[s.value] ?? 0,
  }));
  const total = entries.reduce((sum, e) => sum + e.count, 0);
  if (total === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-xs">
        No campaigns logged yet.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-3 w-full overflow-hidden rounded-full">
        {entries
          .filter((e) => e.count > 0)
          .map((e) => (
            <div
              key={e.key}
              className={STATUS_BAR[e.key] ?? "bg-muted-foreground"}
              style={{ width: `${(e.count / total) * 100}%` }}
              title={`${e.label}: ${e.count}`}
            />
          ))}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        {entries.map((e) => (
          <span
            key={e.key}
            className="text-muted-foreground flex items-center gap-1.5 text-xs"
          >
            <span
              className={`
                size-2 rounded-full
                ${STATUS_BAR[e.key] ?? "bg-muted-foreground"}
              `}
            />
            {e.label}
            <span className="text-foreground tabular-nums">{e.count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Printable HTML export ───────────────────────────────

function esc(v: string | null | undefined): string {
  if (v == null) return "";
  return v
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildHtmlReport(d: MarketingDashboard, asOf: string): string {
  const kpis: Array<[string, string]> = [
    ["Total campaigns", String(d.totalCampaigns)],
    ["Upcoming", String(d.upcomingCount)],
    ["Live now", String(d.liveCount)],
    ["Total hours", String(d.totalHours)],
  ];
  const upcomingRows = d.upcoming
    .map(
      (c) => `<tr>
        <td>${fmtDate(c.campaignDate)}</td>
        <td>${esc(c.title)}</td>
        <td>${c.hours ?? "—"}</td>
        <td>${esc(statusLabel(c.status))}</td>
      </tr>`,
    )
    .join("");
  const statusRows = CAMPAIGN_STATUSES.map(
    (s) =>
      `<tr><td>${esc(s.label)}</td><td>${d.statusBreakdown[s.value] ?? 0}</td></tr>`,
  ).join("");
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<title>OneWave Traction Dashboard</title>
<style>
  body { font-family: Georgia, "Times New Roman", serif; color: #1a1a1a; margin: 40px; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .sub { color: #666; font-size: 12px; margin-bottom: 24px; }
  .kpis { display: flex; gap: 16px; margin-bottom: 28px; flex-wrap: wrap; }
  .kpi { border: 1px solid #ddd; border-radius: 8px; padding: 14px 18px; min-width: 130px; }
  .kpi .l { font-size: 10px; text-transform: uppercase; letter-spacing: .1em; color: #777; }
  .kpi .v { font-size: 24px; margin-top: 4px; }
  h2 { font-size: 13px; text-transform: uppercase; letter-spacing: .12em; border-bottom: 2px solid #1a1a1a; padding-bottom: 4px; margin: 28px 0 10px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { text-align: left; color: #666; font-size: 11px; text-transform: uppercase; border-bottom: 1px solid #ccc; padding: 6px 8px; }
  td { padding: 6px 8px; border-bottom: 1px solid #eee; }
  footer { margin-top: 40px; color: #999; font-size: 11px; }
  @media print { body { margin: 16px; } .noprint { display: none; } }
  button { font: inherit; padding: 6px 14px; cursor: pointer; }
</style></head>
<body>
  <div class="noprint" style="margin-bottom:16px"><button onclick="window.print()">Print / Save as PDF</button></div>
  <h1>OneWave Traction Dashboard</h1>
  <div class="sub">The Binary Holdings · Marketing CRM · As of ${esc(asOf)}</div>
  <div class="kpis">${kpis
    .map(
      ([l, v]) =>
        `<div class="kpi"><div class="l">${esc(l)}</div><div class="v">${esc(v)}</div></div>`,
    )
    .join("")}</div>
  <h2>Upcoming campaigns</h2>
  <table><thead><tr><th>Date</th><th>Campaign</th><th>Hours</th><th>Status</th></tr></thead>
  <tbody>${upcomingRows || `<tr><td colspan="4" style="color:#999">No upcoming campaigns</td></tr>`}</tbody></table>
  <h2>Status mix</h2>
  <table><thead><tr><th>Status</th><th>Count</th></tr></thead><tbody>${statusRows}</tbody></table>
  <footer>Internal use only · OW2.0 traction-sheet metrics will appear here once the sheet sync (Phase 2) is connected.</footer>
</body></html>`;
}

export default function OwDashboardPage() {
  const [data, setData] = useState<MarketingDashboard | null>(null);
  const [holistic, setHolistic] = useState<HolisticDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);

  const fetchData = useCallback(async (fresh = false) => {
    try {
      if (fresh) setRefreshing(true);
      else setLoading(true);
      // Campaign KPIs and the holistic sheet snapshot load together. The
      // holistic call can be slow (sheet ingest on a cold/forced refresh),
      // so a failure there must not blank the campaign dashboard.
      const [res, hol] = await Promise.allSettled([
        getMarketingDashboard(fresh),
        getHolisticDashboard(fresh),
      ]);
      if (res.status === "fulfilled") {
        setData(res.value.data);
        setLoadedAt(new Date());
      } else {
        toast.error(
          getErrorMessage(res.reason, "Failed to load the dashboard"),
        );
      }
      if (hol.status === "fulfilled") setHolistic(hol.value.data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleExport = useCallback(() => {
    if (!data) return;
    const html = buildHtmlReport(
      data,
      (loadedAt ?? new Date()).toLocaleString(),
    );
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "onewave-traction-dashboard.html";
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }, [data, loadedAt]);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Marketing CRM"
        subtitle="Manage marketing campaigns and partner relationships"
      />
      <MarketingCrmTabs />

      <div
        className={`
          border-foreground flex flex-wrap items-end justify-between gap-3
          border-b-2 pb-3
        `}
      >
        <div>
          <h1 className="text-foreground font-serif text-2xl leading-tight">
            OneWave Traction Dashboard
          </h1>
          <p className="text-muted-foreground mt-1 text-xs">
            Campaign cadence &amp; traction across the OneWave (OW2.0)
            programme.
          </p>
        </div>
        <div className="flex items-end gap-4">
          <div className="text-right">
            <div
              className={`
                text-muted-foreground text-[9px] font-semibold tracking-[0.1em]
                uppercase
              `}
            >
              As of
            </div>
            <div className="text-muted-foreground font-mono text-[11px]">
              {loadedAt ? loadedAt.toLocaleString() : "—"}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchData(true)}
            disabled={loading || refreshing}
          >
            <RefreshCw
              className={`
                size-3.5
                ${refreshing ? "animate-spin" : ""}
              `}
            />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={!data}
          >
            <Download className="size-3.5" />
            Export
          </Button>
        </div>
      </div>

      {loading || !data ? (
        <div
          className={`
            grid grid-cols-2 gap-4
            lg:grid-cols-4
          `}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div
            className={`
              grid grid-cols-2 gap-4
              lg:grid-cols-4
            `}
          >
            <KpiCard
              label="Total campaigns"
              value={String(data.totalCampaigns)}
            />
            <KpiCard label="Upcoming" value={String(data.upcomingCount)} />
            <KpiCard label="Live now" value={String(data.liveCount)} />
            <KpiCard
              label="Total hours"
              value={data.totalHours ? String(data.totalHours) : "—"}
            />
          </div>

          <div
            className={`
              grid grid-cols-1 gap-4
              lg:grid-cols-2
            `}
          >
            <ExhibitFrame
              title="Campaign cadence"
              exhibit="Exhibit 1 — Campaigns logged per month (last 12 months)"
            >
              <CadenceBars monthly={data.monthly} />
            </ExhibitFrame>

            <ExhibitFrame
              title="Status mix"
              exhibit="Exhibit 2 — Campaigns by status"
              note={`${data.totalCampaigns} total`}
            >
              <StatusStrip breakdown={data.statusBreakdown} />
            </ExhibitFrame>
          </div>

          <ExhibitFrame
            title="Upcoming campaigns"
            exhibit="Exhibit 3 — Next campaigns by date"
          >
            {data.upcoming.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-xs">
                No upcoming campaigns. Add one from the Campaigns tab.
              </p>
            ) : (
              <div className="flex flex-col divide-y">
                {data.upcoming.map((c) => (
                  <div key={c.id} className="flex items-center gap-3 py-2.5">
                    <span
                      className={`
                        text-muted-foreground w-24 shrink-0 text-xs tabular-nums
                      `}
                    >
                      {fmtDate(c.campaignDate)}
                    </span>
                    <span className="text-foreground flex-1 truncate text-sm">
                      {c.title}
                    </span>
                    <span className={`text-muted-foreground shrink-0 text-xs`}>
                      {c.hours != null ? `${c.hours}h` : ""}
                    </span>
                    <span
                      className={`
                        shrink-0 rounded-full px-2 py-0.5 text-[10px]
                        font-medium text-white
                        ${STATUS_BAR[c.status] ?? "bg-muted-foreground"}
                      `}
                    >
                      {statusLabel(c.status)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </ExhibitFrame>

          <ExhibitFrame
            title="OW2.0 traction (live sheet)"
            exhibit="Exhibit 4 — Live data from the OW2.0 Traction sheet"
            note={
              data.traction
                ? `synced ${new Date(data.traction.fetchedAt).toLocaleTimeString()}`
                : "not connected"
            }
          >
            {data.traction ? (
              data.traction.rows.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-xs">
                  Sheet connected but the range {data.traction.range} is empty.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead className="text-muted-foreground">
                      <tr className="border-border border-b">
                        {data.traction.headers.map((h, i) => (
                          <th
                            key={i}
                            className={`
                              px-2 py-1.5 text-left font-medium
                              whitespace-nowrap
                            `}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.traction.rows.map((row, ri) => (
                        <tr key={ri} className="border-border/50 border-b">
                          {data.traction!.headers.map((_, ci) => (
                            <td
                              key={ci}
                              className="px-2 py-1.5 whitespace-nowrap"
                            >
                              {row[ci] ?? ""}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            ) : (
              <div
                className={`
                  border-border/60 text-muted-foreground rounded-lg border
                  border-dashed px-6 py-10 text-center text-xs
                `}
              >
                No traction data yet. The dashboard syncs from the BNII
                Analytics API and needs no configuration — if this stays empty,
                the last sync returned nothing. Try Refresh, or check the API
                logs.
              </div>
            )}
          </ExhibitFrame>

          <ExhibitFrame
            title="OW2.0 — all tabs (holistic ingest)"
            exhibit="Exhibit 5 — Normalized multi-tab snapshot (Phase 1)"
            note={
              holistic?.generatedAt
                ? `snapshot ${new Date(holistic.generatedAt).toLocaleString()}`
                : "no snapshot yet"
            }
          >
            {holistic?.snapshot ? (
              <div className="flex flex-col gap-3">
                <p className="text-muted-foreground text-[11px]">
                  {holistic.snapshot.rawTabs.length} tabs ·{" "}
                  {holistic.snapshot.metricCount} normalized rows.{" "}
                  {holistic.snapshot.warnings.length > 0
                    ? `${holistic.snapshot.warnings.length} ingest note(s) — charts + AI insights land in later phases.`
                    : "Charts + AI insights land in later phases."}
                </p>
                {holistic.snapshot.warnings.length > 0 ? (
                  <details
                    className={`
                      border-border/60 rounded-lg border bg-amber-500/5 px-3
                      py-2
                    `}
                  >
                    <summary
                      className={`
                        text-muted-foreground cursor-pointer text-[11px]
                        font-medium
                      `}
                    >
                      Ingest notes ({holistic.snapshot.warnings.length})
                    </summary>
                    <ul
                      className={`
                        text-muted-foreground mt-2 list-disc pl-4 text-[11px]
                      `}
                    >
                      {holistic.snapshot.warnings.map((w, i) => (
                        <li key={i}>{w}</li>
                      ))}
                    </ul>
                  </details>
                ) : null}
                {holistic.snapshot.rawTabs.map((tab, ti) => (
                  <details
                    key={ti}
                    className="border-border/60 rounded-lg border px-3 py-2"
                  >
                    <summary
                      className={`
                        flex cursor-pointer items-center gap-2 text-xs
                        font-medium
                      `}
                    >
                      {tab.title}
                      {tab.telco ? (
                        <span
                          className={`
                            bg-muted text-muted-foreground rounded px-1.5 py-0.5
                            text-[10px]
                          `}
                        >
                          {tab.telco}
                        </span>
                      ) : null}
                      <span className="text-muted-foreground text-[10px]">
                        {tab.rows.length} rows
                      </span>
                    </summary>
                    <div className="mt-2 overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="text-muted-foreground">
                          <tr className="border-border border-b">
                            {tab.headers.map((h, i) => (
                              <th
                                key={i}
                                className={`
                                  px-2 py-1.5 text-left font-medium
                                  whitespace-nowrap
                                `}
                              >
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {tab.rows.map((row, ri) => (
                            <tr key={ri} className="border-border/50 border-b">
                              {tab.headers.map((_, ci) => (
                                <td
                                  key={ci}
                                  className="px-2 py-1.5 whitespace-nowrap"
                                >
                                  {row[ci] ?? ""}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </details>
                ))}
              </div>
            ) : (
              <div
                className={`
                  border-border/60 text-muted-foreground rounded-lg border
                  border-dashed px-6 py-10 text-center text-xs
                `}
              >
                No holistic snapshot yet. Once the OW2.0 sheet is connected,
                this section ingests every tab; the charts + AI narrative arrive
                in later phases.
              </div>
            )}
          </ExhibitFrame>
        </>
      )}
    </div>
  );
}
