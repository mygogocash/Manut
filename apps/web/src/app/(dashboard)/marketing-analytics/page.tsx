"use client";

import {
  Megaphone,
  Pencil,
  RefreshCw,
  Settings,
  Table2,
  TrendingUp,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { OverviewManageDialog } from "@/app/(dashboard)/marketing-analytics/overview-manage-dialog";
import { BnrySplit } from "@/app/(dashboard)/marketing-analytics/traffic/bnry-split";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  CustomizableTable,
  type TableColumn,
} from "@/components/shared/customizable-table";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  getOverviewContent,
  listMarketingPartners,
  type MarketingPartner,
  type MetricsQueryResult,
  type OverviewContent,
  queryMarketingMetrics,
} from "@/services/marketing-analytics.service";
import {
  type CampaignListItem,
  listCampaigns,
} from "@/services/marketing-campaigns.service";

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
// Launches span Mar–May 2026; a Jan-1 floor captures the full lifetime window.
const LIFETIME_FROM = "2026-01-01";

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function fmtNum(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  if (Math.abs(n) >= 1e9) return (n / 1e9).toFixed(2) + "B";
  if (Math.abs(n) >= 1e6) return (n / 1e6).toFixed(2) + "M";
  if (Math.abs(n) >= 1e3) return (n / 1e3).toFixed(1) + "K";
  return Math.round(n).toLocaleString("en-US");
}

// Page through EVERY campaign, not just the first page — the dashboard's
// headline count, cadence score, and per-market org rollup are aggregates
// that must cover the whole set (the list endpoint caps `limit` at 200, so a
// single fetch silently under-counts once there are >200 campaigns).
async function loadAllCampaigns(): Promise<CampaignListItem[]> {
  const limit = 200;
  const first = await listCampaigns({ limit, page: 1 });
  const all = [...first.data];
  const total = first.meta.total;
  let page = 2;
  while (all.length < total) {
    const next = await listCampaigns({ limit, page });
    if (next.data.length === 0) break;
    all.push(...next.data);
    page += 1;
  }
  return all;
}

export default function MarketingOverviewPage() {
  const { hasAnyPermission, hasPermission } = useAuth();
  const canView = hasAnyPermission(
    "marketing:dashboard:view",
    "marketing:raw:view",
  );
  const canRaw = hasAnyPermission("marketing:raw:view");
  const canEdit = hasPermission("admin:manage");

  const [partners, setPartners] = useState<MarketingPartner[]>([]);
  const [content, setContent] = useState<OverviewContent | null>(null);
  const [seriesResult, setSeriesResult] = useState<MetricsQueryResult | null>(
    null,
  );
  const [campaigns, setCampaigns] = useState<CampaignListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    const today = isoDate(new Date());
    // Each section loads independently — one failing endpoint (e.g. the
    // narrative content) degrades that section rather than blanking the page.
    const [partnersRes, contentRes, seriesRes, campsRes] =
      await Promise.allSettled([
        listMarketingPartners(),
        getOverviewContent(),
        queryMarketingMetrics({
          dateFrom: LIFETIME_FROM,
          dateTo: today,
          metrics: [
            "new_users",
            "repeated_users",
            "total_views_homepage",
            "unique_users",
            "tx.spin_reward.amount",
            "tx.online_reward.amount",
            "tx.FOLLOW_GIVEN.amount",
            "tx.LIKE_GIVEN.amount",
          ],
        }),
        loadAllCampaigns(),
      ]);

    if (partnersRes.status === "fulfilled") {
      setPartners(partnersRes.value.data);
    }
    // Narrative content is optional — fall back to whatever's already loaded.
    if (contentRes.status === "fulfilled") {
      setContent(contentRes.value.data);
    }
    if (campsRes.status === "fulfilled") {
      setCampaigns(campsRes.value);
    }
    if (seriesRes.status === "fulfilled") {
      setSeriesResult(seriesRes.value.data);
    }

    // Only surface a page-level error if everything failed (e.g. API down).
    const anyOk = [partnersRes, contentRes, seriesRes, campsRes].some(
      (r) => r.status === "fulfilled",
    );
    if (!anyOk) {
      const first = [partnersRes, contentRes, seriesRes, campsRes].find(
        (r) => r.status === "rejected",
      ) as PromiseRejectedResult | undefined;
      const reason = first?.reason;
      setError(reason instanceof ApiError ? reason.message : "Failed to load");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (canView) {
      void fetchAll();
    } else {
      setLoading(false);
    }
  }, [canView, fetchAll]);

  // Per-telco totals for the selected metrics, derived from the raw series.
  const perTelco = useMemo(() => {
    const rows = seriesResult?.results ?? [];
    return rows.map((r) => {
      const name = r.telco_name?.trim() || r.partner_id.slice(0, 8);
      const sum = (k: string) =>
        r.series
          .map((pt) => pt.metrics[k])
          .filter((v): v is number => typeof v === "number")
          .reduce((a, b) => a + b, 0);
      const views = sum("total_views_homepage");
      // Day-on-day on homepage views (last charted day vs the day before).
      const n = r.series.length;
      const currV =
        n > 0 ? (r.series[n - 1].metrics.total_views_homepage ?? null) : null;
      const prevV =
        n > 1 ? (r.series[n - 2].metrics.total_views_homepage ?? null) : null;
      const dod =
        typeof currV === "number" && typeof prevV === "number" && prevV > 0
          ? ((currV - prevV) / prevV) * 100
          : null;
      return {
        name,
        new: sum("new_users"),
        repeat: sum("repeated_users"),
        views,
        stw: sum("tx.spin_reward.amount"),
        games: sum("tx.online_reward.amount"),
        videos: sum("tx.FOLLOW_GIVEN.amount") + sum("tx.LIKE_GIVEN.amount"),
        currViews: currV,
        prevViews: prevV,
        dod,
      };
    });
  }, [seriesResult]);

  const cumulativeNew = useMemo(
    () => perTelco.reduce((a, t) => a + t.new, 0),
    [perTelco],
  );
  const cumulativeRepeat = useMemo(
    () => perTelco.reduce((a, t) => a + t.repeat, 0),
    [perTelco],
  );

  const composition = useMemo(() => {
    const total = perTelco.reduce((a, t) => a + t.views, 0);
    return perTelco
      .map((t) => ({
        name: t.name,
        value: t.views,
        pct: total > 0 ? (t.views / total) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }, [perTelco]);

  // Network BNRY-by-source split.
  const networkBnry = useMemo(() => {
    const stw = perTelco.reduce((a, t) => a + t.stw, 0);
    const games = perTelco.reduce((a, t) => a + t.games, 0);
    const videos = perTelco.reduce((a, t) => a + t.videos, 0);
    return { stw, games, videos, total: stw + games + videos };
  }, [perTelco]);

  // Day-on-day movers (homepage views), split into changed vs steady.
  const movers = useMemo(() => {
    const withDod = perTelco.filter((t) => t.dod !== null);
    const changed = withDod
      .filter((t) => Math.abs(t.dod as number) >= 10)
      .sort((a, b) => Math.abs(b.dod as number) - Math.abs(a.dod as number));
    const steady = withDod.filter((t) => Math.abs(t.dod as number) < 10);
    return { changed, steady };
  }, [perTelco]);

  // Composite network health score (0-100) vs a 155M-MAU network target.
  const health = useMemo(() => {
    const TARGET = 155_000_000;
    const reach = cumulativeNew + cumulativeRepeat;
    const penPct = (reach / TARGET) * 100;
    const penScore = Math.min(100, 100 * Math.sqrt(penPct / 5));
    const activeMarkets = new Set(
      campaigns.map((c) => c.country?.toLowerCase()).filter(Boolean),
    ).size;
    const accScore = partners.length
      ? Math.min(100, (activeMarkets / partners.length) * 200)
      : 0;
    const cadenceScore = Math.min(100, (campaigns.length / 4) * 100);
    const prevTot = perTelco.reduce((a, t) => a + (t.prevViews ?? 0), 0);
    const currTot = perTelco.reduce((a, t) => a + (t.currViews ?? 0), 0);
    const dod = prevTot > 0 ? (currTot - prevTot) / prevTot : 0;
    const growthScore = Math.max(0, Math.min(100, (dod / 0.2) * 100));
    const total = Math.round(
      penScore * 0.3 + accScore * 0.2 + cadenceScore * 0.2 + growthScore * 0.3,
    );
    let grade = "F";
    if (total >= 85) grade = "A";
    else if (total >= 70) grade = "B";
    else if (total >= 55) grade = "C";
    else if (total >= 40) grade = "D";
    return {
      total,
      grade,
      components: [
        { label: "Target reach", value: penPct.toFixed(2) + "%" },
        {
          label: "Active markets",
          value: `${activeMarkets}/${partners.length}`,
        },
        { label: "Campaign cadence", value: `${campaigns.length}` },
        {
          label: "D-o-D growth",
          value: (dod >= 0 ? "+" : "") + (dod * 100).toFixed(0) + "%",
        },
      ],
    };
  }, [cumulativeNew, cumulativeRepeat, campaigns, partners, perTelco]);

  // Org-wide campaign rollup, keyed per telco by matching campaign country to
  // the telco's market (campaigns are country-scoped in the CRM).
  const orgRollup = useMemo(() => {
    return partners
      .map((p) => {
        const inMarket = p.country
          ? campaigns.filter(
              (c) => c.country?.toLowerCase() === p.country?.toLowerCase(),
            )
          : [];
        const levers = new Set<string>();
        let reach = 0;
        inMarket.forEach((c) => {
          c.levers.forEach((l) => levers.add(l.name));
          if (typeof c.actualReach === "number") reach += c.actualReach;
        });
        return {
          name: p.name,
          country: p.country,
          campaigns: inMarket.length,
          levers: [...levers],
          reach,
        };
      })
      .sort((a, b) => b.campaigns - a.campaigns);
  }, [partners, campaigns]);

  const telcoNames = useMemo(() => partners.map((p) => p.name), [partners]);

  if (!canView) {
    return (
      <div className="px-6 py-6">
        <PageHeader title="Marketing Overview" />
        <p className="text-muted-foreground text-sm">
          You don&apos;t have access to Marketing Analytics.
        </p>
      </div>
    );
  }

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="Marketing Overview"
        subtitle="Holistic, org-wide view across every live telco account"
      >
        {canEdit && content && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setManageOpen(true)}
          >
            <Pencil className="mr-1 size-3.5" />
            Edit content
          </Button>
        )}
        <Button variant="outline" size="sm" asChild>
          <Link href="/marketing-analytics/traffic">
            <TrendingUp className="mr-1 size-3.5" />
            Traffic Dashboard
          </Link>
        </Button>
        {canRaw && (
          <Button variant="outline" size="sm" asChild>
            <Link href="/marketing-analytics/raw">
              <Table2 className="mr-1 size-3.5" />
              Raw Data
            </Link>
          </Button>
        )}
        <Button variant="outline" size="sm" asChild>
          <Link href="/marketing-analytics/settings">
            <Settings className="mr-1 size-3.5" />
            Settings
          </Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={fetchAll}
          disabled={loading}
        >
          <RefreshCw className="mr-1 size-3.5" />
          Refresh
        </Button>
      </PageHeader>

      {error && (
        <Card className="border-destructive/40 mb-5">
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <p className="text-destructive text-sm">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchAll}>
              <RefreshCw className="mr-1 size-3.5" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Health score + daily movers (Daily Briefing) */}
      {!loading && perTelco.length > 0 && (
        <div
          className={`
            mb-5 grid gap-4
            lg:grid-cols-3
          `}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Network health
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center gap-4">
              <div className="relative flex size-24 items-center justify-center">
                <svg viewBox="0 0 100 100" className="size-24 -rotate-90">
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    strokeWidth="9"
                    className="stroke-muted"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    strokeWidth="9"
                    strokeLinecap="round"
                    className="stroke-primary"
                    strokeDasharray={2 * Math.PI * 42}
                    strokeDashoffset={
                      2 * Math.PI * 42 * (1 - health.total / 100)
                    }
                  />
                </svg>
                <div className="absolute text-center">
                  <div className="font-serif text-2xl font-medium">
                    {health.grade}
                  </div>
                  <div className="text-muted-foreground text-[10px]">
                    {health.total}/100
                  </div>
                </div>
              </div>
              <div className="grid flex-1 grid-cols-2 gap-2">
                {health.components.map((c) => (
                  <div key={c.label}>
                    <p className="text-muted-foreground text-[10px] uppercase">
                      {c.label}
                    </p>
                    <p className="text-sm font-medium tabular-nums">
                      {c.value}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Day-on-day movers (homepage views)
              </CardTitle>
            </CardHeader>
            <CardContent>
              {movers.changed.length === 0 ? (
                <p className="text-muted-foreground py-6 text-center text-sm">
                  No accounts moved more than 10% day-on-day.
                </p>
              ) : (
                <ul className="divide-border divide-y">
                  {movers.changed.slice(0, 5).map((t) => (
                    <li
                      key={t.name}
                      className="flex items-center justify-between py-2 text-sm"
                    >
                      <span className="font-medium">{t.name}</span>
                      <span className="flex items-center gap-3">
                        <span
                          className={`
                            text-muted-foreground text-xs tabular-nums
                          `}
                        >
                          {fmtNum(t.prevViews)} → {fmtNum(t.currViews)}
                        </span>
                        <span
                          className={`
                            font-medium tabular-nums
                            ${
                              (t.dod as number) >= 0
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
                          {(t.dod as number) >= 0 ? "+" : ""}
                          {(t.dod as number).toFixed(0)}%
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {movers.steady.length > 0 && (
                <p className="text-muted-foreground mt-3 text-xs">
                  Steady (under 10%):{" "}
                  {movers.steady.map((t) => t.name).join(", ")}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cumulative KPIs */}
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
              label="Cumulative New Users"
              value={fmtNum(cumulativeNew)}
              change="All accounts, since launch"
              changeType="neutral"
              icon={Users}
              accent="primary"
            />
            <StatCard
              label="Cumulative Repeat Users"
              value={fmtNum(cumulativeRepeat)}
              change="Returning across the network"
              changeType="neutral"
              icon={Users}
              accent="success"
            />
            <StatCard
              label="Live Telco Accounts"
              value={String(partners.length)}
              change="Reporting to the network"
              changeType="neutral"
              icon={TrendingUp}
              accent="info"
            />
            <StatCard
              label="Campaigns"
              value={String(campaigns.length)}
              change="Tracked in the CRM"
              changeType="neutral"
              icon={Megaphone}
              accent="warning"
              href="/marketing-analytics/campaigns"
            />
          </>
        )}
      </div>

      {/* Composition */}
      <Card className="mb-5">
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            Traffic composition by telco (homepage views, lifetime)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <Skeleton className="h-[200px] rounded-lg" />
          ) : composition.length === 0 ? (
            <p className="text-muted-foreground py-12 text-center text-sm">
              No traffic data returned.
            </p>
          ) : (
            composition.map((c, i) => (
              <div key={c.name} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground">
                    {fmtNum(c.value)} · {c.pct.toFixed(1)}%
                  </span>
                </div>
                <div className="bg-muted h-2 overflow-hidden rounded-full">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${c.pct}%`,
                      background: SERIES_COLORS[i % SERIES_COLORS.length],
                    }}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Network BNRY-by-source split */}
      {!loading && networkBnry.total > 0 && (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              BNRY earned by source (network, lifetime)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BnrySplit bnry={networkBnry} />
          </CardContent>
        </Card>
      )}

      {/* Org-wide campaign rollup */}
      {loading ? (
        <Card className="mb-5">
          <CardHeader>
            <CardTitle className="text-sm font-medium">
              Org-wide campaign activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[220px] rounded-lg" />
          </CardContent>
        </Card>
      ) : (
        <div className="mb-5">
          <OrgRollupTable rows={orgRollup} />
        </div>
      )}

      {/* Learnings: shared vs unique */}
      <Card className="mb-5">
        <CardHeader>
          <CardTitle className="text-sm font-medium">
            What&apos;s shared vs what&apos;s unique
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-[200px] rounded-lg" />
          ) : !content ? (
            <p className="text-muted-foreground py-8 text-center text-sm">
              Learnings content is unavailable right now.
            </p>
          ) : (
            <div
              className={`
                grid gap-4
                lg:grid-cols-2
              `}
            >
              <div className="border-primary/40 rounded-lg border p-4">
                <p
                  className={`
                    text-muted-foreground mb-3 text-xs font-medium tracking-wide
                    uppercase
                  `}
                >
                  Shared across telcos
                </p>
                <ul className="space-y-2.5">
                  {content.learningsShared.map((l, i) => (
                    <li key={i} className="text-sm">
                      <span className="text-primary font-medium">{l.tag}</span>
                      <span className="text-muted-foreground"> — {l.text}</span>
                    </li>
                  ))}
                  {content.learningsShared.length === 0 && (
                    <li className="text-muted-foreground text-sm">
                      No shared learnings yet.
                    </li>
                  )}
                </ul>
              </div>
              <div
                className={`
                  grid gap-2
                  sm:grid-cols-2
                `}
              >
                {telcoNames.map((name) => {
                  const items = content.learningsPerTelco[name] ?? [];
                  return (
                    <div
                      key={name}
                      className="border-border rounded-lg border p-3"
                    >
                      <p className="mb-1.5 text-xs font-semibold">{name}</p>
                      {items.length === 0 ? (
                        <p className="text-muted-foreground text-xs italic">
                          No campaign learnings yet
                        </p>
                      ) : (
                        <ul
                          className={`
                            text-muted-foreground list-disc space-y-1 pl-4
                            text-xs
                          `}
                        >
                          {items.map((it, j) => (
                            <li key={j}>{it}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Macro advice */}
      {!loading && content && (
        <Card className="border-primary/40 mb-5">
          <CardHeader>
            <CardTitle className="text-base">{content.macroHeadline}</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4 text-sm">
              {content.macroBody}
            </p>
            <div
              className={`
                grid gap-3
                md:grid-cols-3
              `}
            >
              {content.macroPlays.map((p, i) => (
                <div
                  key={i}
                  className="border-border bg-muted/30 rounded-lg border p-3"
                >
                  <p
                    className={`
                      text-muted-foreground text-[10px] font-medium
                      tracking-wider uppercase
                    `}
                  >
                    {p.step}
                  </p>
                  <p className="text-primary mb-1 text-sm font-medium italic">
                    {p.title}
                  </p>
                  <p className="text-muted-foreground text-xs">{p.text}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {content && (
        <OverviewManageDialog
          open={manageOpen}
          onOpenChange={setManageOpen}
          content={content}
          telcoNames={telcoNames}
          onSaved={setContent}
        />
      )}
    </div>
  );
}

/**
 * Org-wide campaign rollup, one row per telco.
 *
 * The colour dot is keyed off the row's own name rather than its render index:
 * the shared table lets the reader sort, and a colour that reshuffles on sort
 * would stop matching the charts above.
 */
function OrgRollupTable({
  rows,
}: {
  rows: {
    name: string;
    country: string | null;
    campaigns: number;
    levers: string[];
    reach: number;
  }[];
}) {
  const colorOf = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r, i) =>
      map.set(r.name, SERIES_COLORS[i % SERIES_COLORS.length] ?? ""),
    );
    return map;
  }, [rows]);

  const columns = useMemo<TableColumn<(typeof rows)[number]>[]>(
    () => [
      {
        key: "telco",
        label: "Telco",
        render: (r) => (
          <span className="inline-flex items-center gap-2 font-medium">
            <span
              className="size-2 rounded-full"
              style={{ background: colorOf.get(r.name) }}
            />
            {r.name}
          </span>
        ),
        sortValue: (r) => r.name,
      },
      {
        key: "market",
        label: "Market",
        render: (r) => (
          <span className="text-muted-foreground">{r.country ?? "—"}</span>
        ),
        sortValue: (r) => r.country,
      },
      {
        key: "campaigns",
        label: "Campaigns",
        align: "right",
        render: (r) => r.campaigns,
        sortValue: (r) => r.campaigns,
      },
      {
        key: "levers",
        label: "Levers tested",
        render: (r) => (
          <span className="text-muted-foreground text-xs">
            {r.levers.length > 0 ? r.levers.join(", ") : "—"}
          </span>
        ),
        sortValue: (r) => r.levers.length,
      },
      {
        key: "reach",
        label: "Reach captured",
        align: "right",
        render: (r) => (r.reach > 0 ? fmtNum(r.reach) : "—"),
        sortValue: (r) => r.reach,
      },
    ],
    [colorOf],
  );

  return (
    <CustomizableTable
      tableId="ma-org-rollup"
      title="Org-wide campaign activity"
      columns={columns}
      rows={rows}
      rowKey={(r) => r.name}
      footnote="Campaigns are matched to a telco by market (country). Telcos sharing a market show that market's campaigns."
    />
  );
}
