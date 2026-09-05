"use client";

import {
  Activity,
  ArrowLeft,
  BellRing,
  CalendarDays,
  Info,
  RefreshCw,
  Target,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import {
  accountFigures,
  rowsForSelection,
  TOTAL_LABEL,
} from "@/app/(dashboard)/marketing-analytics/dau-mau/account-scope";
import { DailyRecapTab } from "@/app/(dashboard)/marketing-analytics/dau-mau/daily-recap";
import { StatCard } from "@/components/dashboard/stat-card";
import {
  AccountMultiSelect,
  summarise,
} from "@/components/marketing-analytics/account-multi-select";
import { DriftRecipientsDialog } from "@/components/marketing-analytics/drift-recipients-dialog";
import {
  CustomizableTable,
  type TableColumn,
} from "@/components/shared/customizable-table";
import { FormDatePicker } from "@/components/shared/form-date-picker";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
// Aliased: `Tooltip` is already taken by recharts' chart tooltip above.
import {
  Tooltip as HoverTip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAppliedAccounts } from "@/hooks/use-applied-accounts";
import { useAppliedDateRange } from "@/hooks/use-applied-date-range";
import { useTabParam } from "@/hooks/use-tab-param";
import { ApiError } from "@/lib/api-client";
import { useAuth } from "@/providers/auth-provider";
import {
  type DauMauDashboard,
  getDauMauDashboard,
  MA_ESTATE_KEY,
  type MaTrendRow,
} from "@/services/marketing-analytics.service";

/**
 * Where the applied filters are remembered, so a return visit continues from the
 * last Apply instead of snapping back to the API defaults. Namespaced by page
 * because the Traffic Dashboard shares the same date-range hook.
 */
const RANGE_STORAGE_KEY = "dau-mau.range";
const ACCOUNTS_STORAGE_KEY = "dau-mau.accounts";

const ORGANIC_COLOR = "var(--color-primary)";
const CAMPAIGN_COLOR = "var(--color-destructive)";

/**
 * Right-hand breathing room for the daily-date axis of a LINE chart.
 *
 * Recharts hides x tick labels that would collide, but it measures collisions
 * against the whole SVG rather than the plot area. On a point scale the last
 * category sits flush with the right edge, so its label overhangs; recharts
 * corrects the overhang by sliding that label left and then reserves the slid
 * width — which silently swallows the tick beside it. On the 28-day pacing
 * chart that dropped "08-15" from the axis even though its data point was on
 * the line, because the neighbour needed 1.5 label-widths of pitch instead of
 * the 1 it needs everywhere else on the axis.
 *
 * Padding the range by more than half a label means the end tick never has to
 * slide, so its neighbour is judged by the same rule as every other tick.
 * Bar charts don't need this: a band scale already centres the final tick half
 * a band in from the edge.
 */
const DATE_AXIS_PADDING = { right: 16 } as const;

function fmtInt(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return Math.round(v).toLocaleString("en-US");
}
/** Charts here plot counts; raw `2572008` in a tooltip is hard to read. */
function fmtTooltipValue(v: unknown): string {
  return typeof v === "number" ? fmtInt(v) : String(v ?? "—");
}
function fmtPct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}
function fmtSignedPct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return `${v > 0 ? "+" : ""}${(v * 100).toFixed(digits)}%`;
}
function growthColor(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) {
    return "var(--color-muted-foreground)";
  }
  if (v > 0) return "var(--color-success)";
  if (v < 0) return "var(--color-destructive)";
  return "var(--color-muted-foreground)";
}
function monthLabel(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  if (!y || !m) return ym;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", {
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * "2026-06-14" → "Jun 14, 2026".
 *
 * Pinned to UTC like `monthLabel` above: the API's dates are plain calendar
 * days, and formatting them in the viewer's zone would render the day before
 * for anyone west of Greenwich.
 */
function dayLabel(ymd: string): string {
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return ymd;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/**
 * Hover text for the Trend detail cells, naming the dates each figure was
 * computed from. The windows come from the server (`threeDayWindow`,
 * `vs28DaysBackDate`, `vsPrevMonthDate`) so the label can never disagree with
 * the number it sits beside.
 */
function threeDayAvgTip(r: MaTrendRow): string {
  if (r.threeDayWindow.length === 0) return "";
  const days = r.threeDayWindow.map(dayLabel).join(", ");
  return r.threeDayAvg === null
    ? `No 3-day average — needs DAU for all of ${days}`
    : `Mean DAU across ${days}`;
}

function vsDaysBackTip(r: MaTrendRow, lookbackDays: number): string {
  const base = `3-day avg ending ${dayLabel(r.date)} vs the 3-day avg ending ${dayLabel(r.vs28DaysBackDate)} (${lookbackDays} days earlier)`;
  return r.vs28DaysBack === null ? `${base} — not enough data` : base;
}

/**
 * TODO(project-team): this is the plainest possible version — it names the
 * baseline date and stops.
 *
 * The prev-month comparison has a wrinkle the other two don't: the server
 * clamps to the shorter month, so 31 May compares against 30 Apr and 31 Mar
 * against 28 Feb. On those rows `vsPrevMonthDate` is NOT the same day number
 * as `date`, and a reader who assumes "same date last month" will misread the
 * figure. Decide whether the tooltip should call that out, and how.
 */
function vsPrevMonthTip(r: MaTrendRow): string {
  const base = `3-day avg ending ${dayLabel(r.date)} vs the 3-day avg ending ${dayLabel(r.vsPrevMonthDate)}`;
  return r.vsPrevMonthSameDate === null ? `${base} — not enough data` : base;
}

function Meter({ pct }: { pct: number | null }) {
  const clamped = pct === null ? 0 : Math.max(0, Math.min(1, pct));
  const tone =
    pct === null
      ? "var(--color-muted-foreground)"
      : pct >= 0.5
        ? "var(--color-success)"
        : pct >= 0.15
          ? "var(--color-warning)"
          : "var(--color-primary)";
  return (
    <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
      <div
        style={{ width: `${clamped * 100}%`, backgroundColor: tone }}
        className="h-full rounded-full"
      />
    </div>
  );
}

/**
 * Marks a Trend detail figure as having hover detail behind it. Without a
 * visible affordance the tooltip is undiscoverable — you only find it by
 * happening to rest the pointer on the right cell. Dotted underline reads as
 * "there is more here" without competing with the growth colours.
 */
const TREND_HINT_CLS = `
  decoration-muted-foreground/50 cursor-help underline decoration-dotted
  underline-offset-4
`;

export default function DauMauPage() {
  const { hasPermission } = useAuth();
  // Saving the recipient list is an org-wide config change, gated ADMIN_MANAGE
  // on the backend. Mirror that here so a viewer gets a read-only dialog
  // rather than a Save button that 403s.
  const canManageDrift = hasPermission("admin:manage");
  const [driftDialogOpen, setDriftDialogOpen] = useState(false);
  const [data, setData] = useState<DauMauDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useTabParam("dashboard");
  /**
   * Which accounts count, for the whole page.
   *
   * This replaced six independent per-tab selectors. Those were deliberate —
   * moving between tabs never reinterpreted what you were looking at — but they
   * could only ever narrow to ONE account, and they narrowed the rows on screen
   * without changing what the totals summed, because membership was a hardcoded
   * `!/okara/i` test in the API. Now the selection IS the membership: the server
   * totals exactly what is checked, so it has to be one page-wide answer rather
   * than six that would each imply a different total.
   */
  const accountSelection = useAppliedAccounts(ACCOUNTS_STORAGE_KEY);
  /**
   * Which single account the two per-account exhibits plot.
   *
   * DAU Explorer and 3-Day Trends are keyed by account (`data.explorer[key]`) —
   * "four accounts" is not a series they can draw. They keep a one-of picker,
   * but its options are the checked accounts plus the estate key, which the
   * engine builds as the total over exactly those accounts.
   */
  const [explorerTelco, setExplorerTelco] = useState<string>(MA_ESTATE_KEY);
  const [trendTelco, setTrendTelco] = useState<string>(MA_ESTATE_KEY);
  // Date window. Unlike the partner filters this cannot be per-tab: it is the
  // range the single dashboard request is built from, so it governs every tab
  // at once. Empty means "whatever the API defaults to" — the page renders the
  // resolved window it got back, so first paint is unchanged.
  //
  // The pickers hold a DRAFT that only Apply promotes to the range the request
  // is built from. Fetching straight off the pickers meant choosing FROM fired
  // a request immediately, for a range the user had not finished expressing —
  // one wasted 120-day BNII round trip per edit, and a dashboard that redrew
  // itself with numbers for a window nobody asked for on the way to the one
  // they wanted.
  const {
    draftFrom,
    draftTo,
    appliedFrom,
    appliedTo,
    setDraftFrom,
    setDraftTo,
    dirty: rangeDirty,
    isSet: rangeSet,
    apply: applyRange,
    reset: resetRange,
    hydrated: rangeHydrated,
  } = useAppliedDateRange("", "", RANGE_STORAGE_KEY);
  const {
    draft: draftAccounts,
    applied: appliedAccounts,
    isAll: allAccounts,
    dirty: accountsDirty,
    toggle: toggleAccount,
    selectAll: selectAllAccounts,
    selectOnly: selectOnlyAccount,
    apply: applyAccounts,
    reset: resetAccounts,
    hydrated: accountsHydrated,
  } = accountSelection;
  /**
   * Both filters are restored in effects, so the very first commit still holds
   * the defaults. Fetching then would spend a 120-day BNII query on a window the
   * reader did not choose and immediately spend another on the restored one, with
   * a flash of the wrong numbers in between.
   */
  const filtersHydrated = rangeHydrated && accountsHydrated;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDauMauDashboard({
        dateFrom: appliedFrom || undefined,
        dateTo: appliedTo || undefined,
        // Omitted entirely while nothing is narrowed: the API reads absent as
        // "every account", and an empty string as an error.
        accounts: appliedAccounts?.join(",") || undefined,
      });
      setData(res.data);
    } catch (err) {
      toast.error(
        err instanceof ApiError
          ? err.message
          : "Failed to load DAU/MAU analytics",
      );
    } finally {
      setLoading(false);
    }
  }, [appliedFrom, appliedTo, appliedAccounts]);

  useEffect(() => {
    if (!filtersHydrated) return;
    void fetchData();
  }, [fetchData, filtersHydrated]);

  const accounts = useMemo(
    () => data?.accounts.filter((a) => a.key !== MA_ESTATE_KEY) ?? [],
    [data],
  );
  const labelOf = useCallback(
    (key: string) =>
      key === MA_ESTATE_KEY
        ? TOTAL_LABEL
        : (data?.accounts.find((a) => a.key === key)?.label ?? key),
    [data],
  );
  /**
   * The accounts actually counted, read back from the response rather than the
   * checkboxes: the server drops keys it does not recognise, and the page should
   * render what was totalled, not what was requested.
   */
  const countedAccounts = useMemo(
    () =>
      accounts.filter((a) => (data?.selectedAccounts ?? []).includes(a.key)),
    [accounts, data],
  );
  const months = data?.monthly ?? [];
  const latest = months[months.length - 1];

  /**
   * Dashboard headline figures — the total over the selected accounts.
   *
   * These used to follow a per-tab one-of picker. They now read the estate key,
   * which the engine computes over exactly the accounts the page asked for, so
   * "which accounts" is answered once in the filter bar instead of per exhibit.
   */
  const dashboardFigures = useMemo(
    () => (data ? accountFigures(data, MA_ESTATE_KEY) : null),
    [data],
  );

  /** Weekly DAU for the selection, from the same estate-key total. */
  const weeklyChart = useMemo(
    () =>
      (data?.weekly ?? []).map((w) => ({
        week: `W${w.weekIndex}`,
        weeklyDau: w.estate.weeklyDau ?? 0,
      })),
    [data],
  );

  /**
   * Options for the two per-account exhibits: the total, then the accounts
   * actually counted. An account nobody selected has no business being plotted
   * on a page whose totals exclude it.
   */
  const plottableOptions = useMemo(
    () => [
      { key: MA_ESTATE_KEY, label: TOTAL_LABEL },
      ...accounts
        .filter((a) => (data?.selectedAccounts ?? []).includes(a.key))
        .map((a) => ({ key: a.key, label: a.label })),
    ],
    [accounts, data],
  );

  const sessionsPacing = useMemo(() => {
    let cur = 0;
    let prev = 0;
    return (dashboardFigures?.sessions?.pacing ?? []).map((pt) => {
      cur += pt.current ?? 0;
      prev += pt.previous ?? 0;
      return { date: pt.date.slice(5), current: cur, previous: prev };
    });
  }, [dashboardFigures]);

  const overallSplit = useMemo(() => {
    if (!data) return [];
    const byDate = new Map<string, { organic: number; campaign: number }>();
    for (const a of accounts) {
      for (const r of data.explorer[a.key] ?? []) {
        const b = byDate.get(r.date) ?? { organic: 0, campaign: 0 };
        b.organic += r.organic ?? 0;
        b.campaign += r.campaign ?? 0;
        byDate.set(r.date, b);
      }
    }
    return [...byDate.entries()]
      .sort((x, y) => x[0].localeCompare(y[0]))
      .map(([date, v]) => ({ date: date.slice(5), ...v }));
  }, [data, accounts]);

  const explorerRows = useMemo(
    () => data?.explorer[explorerTelco] ?? [],
    [data, explorerTelco],
  );
  const explorerChart = useMemo(
    () =>
      explorerRows.map((r) => ({
        date: r.date.slice(5),
        organic: r.organic ?? 0,
        campaign: r.campaign ?? 0,
      })),
    [explorerRows],
  );
  const trendRows = useMemo(
    () => data?.trends[trendTelco] ?? [],
    [data, trendTelco],
  );
  const trendChart = useMemo(
    () =>
      trendRows
        .filter((r) => r.threeDayAvg !== null)
        .map((r) => ({ date: r.date.slice(5), avg: r.threeDayAvg })),
    [trendRows],
  );

  const TABS = [
    { key: "dashboard", label: "Dashboard" },
    { key: "explorer", label: "DAU Explorer" },
    { key: "trends", label: "3-Day Trends" },
    { key: "forecast", label: "Forecast" },
    { key: "weekly", label: "Weekly Growth" },
    { key: "charts", label: "Charts" },
    { key: "campaigns", label: "Campaign Index" },
    { key: "recap", label: "Daily Recap" },
  ];

  return (
    <div className="px-6 py-6">
      <PageHeader
        title="DAU / MAU Analytics"
        subtitle="OneWave engagement, laid out like the source workbook: Dashboard, DAU Explorer, 3-Day Trends, Forecast, Weekly Growth, Charts and the Campaign Index."
      >
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/marketing-analytics">
              <ArrowLeft className="mr-1 h-4 w-4" /> Marketing Analytics
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => void fetchData()}>
            <RefreshCw className="mr-1 h-4 w-4" /> Refresh
          </Button>
          {/*
            Read is dashboard-level, so anyone looking at these numbers can see
            who is told when they stop agreeing with the store. Saving is
            admin-only on the backend, so the dialog opens read-only for
            everyone else rather than offering a Save that would 403.
          */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDriftDialogOpen(true)}
          >
            <BellRing className="mr-1 h-4 w-4" /> Drift alerts
          </Button>
        </div>
      </PageHeader>

      {loading && !data ? (
        <div
          className={`
            mt-6 grid gap-4
            md:grid-cols-4
          `}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px] rounded-xl" />
          ))}
        </div>
      ) : null}

      {data ? (
        <>
          {/*
            Date window. Sits above the tab bar rather than inside a tab
            because it is the range the dashboard request itself is built
            from — every tab renders from that one payload, so scoping it to a
            tab would be a lie. Blank means "API default"; the resolved window
            is echoed beside the pickers so it is always clear what is on
            screen, including before anyone touches them.
          */}
          <div
            className={`
              bg-card mt-6 flex flex-wrap items-end gap-3 rounded-lg border p-3
            `}
          >
            <div className="space-y-1">
              <Label className="text-muted-foreground text-[11px] uppercase">
                From
              </Label>
              <FormDatePicker
                value={draftFrom}
                onChange={setDraftFrom}
                placeholder="Earliest"
                maxDate={draftTo || undefined}
                className="w-44"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-muted-foreground text-[11px] uppercase">
                To
              </Label>
              <FormDatePicker
                value={draftTo}
                onChange={setDraftTo}
                placeholder="Latest"
                minDate={draftFrom || undefined}
                className="w-44"
              />
            </div>
            {/*
              Accounts sit beside the dates because they are the same kind of
              thing: an input to the one request every tab renders from. The
              totals are summed by the metrics engine over exactly this set, so
              a tab-scoped version would imply a different total per tab.
            */}
            <div className="space-y-1">
              <Label className="text-muted-foreground text-[11px] uppercase">
                Accounts
              </Label>
              <AccountMultiSelect
                accounts={accounts}
                selected={draftAccounts}
                onToggle={(key) =>
                  toggleAccount(
                    key,
                    accounts.map((a) => a.key),
                  )
                }
                onSelectAll={selectAllAccounts}
                onSelectOnly={selectOnlyAccount}
              />
            </div>
            <Button
              size="sm"
              onClick={() => {
                applyRange();
                applyAccounts();
              }}
              disabled={(!rangeDirty && !accountsDirty) || loading}
            >
              Apply
            </Button>
            {rangeSet ? (
              <Button variant="ghost" size="sm" onClick={resetRange}>
                Reset range
              </Button>
            ) : null}
            {!allAccounts ? (
              <Button variant="ghost" size="sm" onClick={resetAccounts}>
                All accounts
              </Button>
            ) : null}
            {/*
              "Showing" reports the window the data on screen was actually
              built from, which is why it reads the response and not the
              pickers. Once the two can differ, that distinction has to be
              visible or the stale-looking dates read as a bug.
            */}
            <p className="text-muted-foreground ml-auto text-xs">
              Showing{" "}
              <span className="tabular-nums">
                {data.dateFrom} → {data.dateTo}
              </span>
              {" · "}
              {summarise(accounts, data.selectedAccounts)}
              {rangeDirty || accountsDirty ? (
                <span className="text-foreground font-medium">
                  {" "}
                  · apply to update
                </span>
              ) : null}
            </p>
          </div>

          <Tabs value={tab} onValueChange={setTab} className="mt-6">
            {/*
            w-full overrides the primitive's default w-fit so the bar spans the
            content width like the sections below it. h-auto lets a wrapped
            second row breathe instead of being squeezed into the fixed 8-unit
            height, and flex-1 lets each trigger share the width evenly.
          */}
            <TabsList
              className={`
                flex w-full flex-wrap justify-start gap-1
                group-data-[orientation=horizontal]/tabs:h-auto
              `}
            >
              {TABS.map((t) => (
                <TabsTrigger key={t.key} value={t.key} className="flex-1">
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {/* ── Dashboard - All Accounts ── */}
            <TabsContent value="dashboard" className="mt-6 space-y-6">
              <div
                className={`
                  grid gap-4
                  md:grid-cols-4
                `}
              >
                {/*
                  Summed daily actives over the loaded range — user-DAYS, not a
                  headcount, and "lifetime" only reaches back as far as the
                  range shown below. Both were read as "how many users we have"
                  and then compared against a 28-day sessions figure.
                */}
                <StatCard
                  label={`${TOTAL_LABEL} DAU, summed`}
                  value={fmtInt(dashboardFigures?.lifetime?.totalSessions)}
                  change={`Peak day ${fmtInt(dashboardFigures?.lifetime?.peakSessions)} · counts a returning user once per day`}
                  changeType="neutral"
                  icon={Activity}
                  accent="primary"
                />
                <StatCard
                  label={`${TOTAL_LABEL} DAU (as-of)`}
                  value={fmtInt(dashboardFigures?.lifetime?.dauOnAsOf)}
                  change={data.asOf}
                  changeType="neutral"
                  icon={CalendarDays}
                  accent="info"
                />
                <StatCard
                  label={`${latest ? monthLabel(latest.month) : ""} MAU · capture`}
                  value={fmtInt(dashboardFigures?.monthly?.mau)}
                  change={fmtPct(dashboardFigures?.monthly?.capture)}
                  changeType="neutral"
                  icon={Target}
                  accent="success"
                />
                <StatCard
                  label={`Next-day ${TOTAL_LABEL} forecast`}
                  value={fmtInt(dashboardFigures?.forecast)}
                  change={`for ${data.forecastDate}`}
                  changeType="neutral"
                  icon={TrendingUp}
                  accent="warning"
                />
              </div>

              {/*
              The text sits in its own span: this <p> is a flex row, so every
              text fragment and <code> was becoming a separate flex item and
              picking up the gap-2, which scattered the sentence. Two children
              only — icon, then prose.
            */}
              <p
                className={`
                  text-muted-foreground flex items-start gap-2 text-xs
                `}
              >
                <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  DAU source <code>{data.dauMetric}</code>, homepage views{" "}
                  <code>{data.sessionsMetric}</code> from the BNII API (
                  {data.dateFrom} → {data.dateTo}). Capture uses each
                  telco&apos;s host MAU; campaign days are inferred from
                  campaigns in the telco&apos;s country. Totals count the
                  accounts checked in Accounts above — every account by default,
                  Okara included. Homepage views are not GA sessions — they run
                  around double, so this will not tie out to the Telco Reports
                  &ldquo;Sessions&rdquo; figure.
                </span>
              </p>

              {/*
                Homepage views, NOT sessions. The exhibit plots
                `total_views_homepage`, which runs roughly 2x BNII's GA-sourced
                `sessions_ga` and has been drifting further from it (1.9x in
                June, 2.6x in August). Calling it "Sessions" invited a direct
                comparison with the Telco Reports Data Studio dashboard, which
                reads its own GA source and disagrees on both magnitude AND
                direction. The API field is still `sessions` — renaming the
                contract would ripple through the metrics engine for no
                user-visible gain — so the label and the field deliberately
                differ here.
              */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">
                    {TOTAL_LABEL} homepage views — last{" "}
                    {data.sessions.windowDays} days vs previous{" "}
                    {data.sessions.windowDays}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="mb-4 flex items-end gap-4">
                    <div
                      className={`
                        text-foreground font-serif text-4xl tabular-nums
                      `}
                    >
                      {fmtInt(dashboardFigures?.sessions?.total)}
                    </div>
                    <div
                      className="pb-1 text-sm font-semibold tabular-nums"
                      style={{
                        color: growthColor(
                          dashboardFigures?.sessions?.pctChange ?? null,
                        ),
                      }}
                    >
                      {dashboardFigures?.sessions?.pctChange != null
                        ? `${dashboardFigures.sessions.pctChange > 0 ? "▲" : dashboardFigures.sessions.pctChange < 0 ? "▼" : "▶"} ${fmtSignedPct(dashboardFigures.sessions.pctChange)}`
                        : "—"}
                    </div>
                    <div className="text-muted-foreground pb-1 text-xs">
                      vs {fmtInt(dashboardFigures?.sessions?.previousTotal)}{" "}
                      prior
                    </div>
                  </div>
                  <div
                    className={`
                      text-muted-foreground mb-2 text-[11px] font-semibold
                      tracking-wide uppercase
                    `}
                  >
                    Cumulative homepage views pacing
                  </div>
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={sessionsPacing}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10 }}
                        interval="preserveStartEnd"
                        padding={DATE_AXIS_PADDING}
                      />
                      <YAxis tick={{ fontSize: 11 }} width={70} />
                      <Tooltip
                        contentStyle={{ fontSize: 12 }}
                        formatter={fmtTooltipValue}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Line
                        type="monotone"
                        dataKey="current"
                        name="Homepage views"
                        stroke={ORGANIC_COLOR}
                        strokeWidth={2}
                        dot={false}
                      />
                      <Line
                        type="monotone"
                        dataKey="previous"
                        name={`Homepage views (previous ${data.sessions.windowDays} days)`}
                        stroke="var(--color-muted-foreground)"
                        strokeWidth={1.5}
                        strokeDasharray="4 3"
                        dot={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Lifetime */}
              <LifetimeSessionsTable
                rows={[
                  ...rowsForSelection(
                    data.lifetime.rows,
                    data.selectedAccounts,
                  ),
                  data.lifetime.estate,
                ]}
                estateKey={data.lifetime.estate.accountKey}
              />

              {/* Rolling 3-day */}
              <RollingMomentumTable
                rows={[
                  ...rowsForSelection(
                    data.rolling3Day.rows,
                    data.selectedAccounts,
                  ),
                  data.rolling3Day.estate,
                ]}
                asOf={data.asOf}
                estateKey={data.rolling3Day.estate.accountKey}
              />

              {/* Monthly MAU, capture and month-end forecast */}
              <MonthlyMauTable
                months={months}
                accounts={countedAccounts}
                latest={latest}
              />
            </TabsContent>

            {/* ── DAU Explorer ── */}
            <TabsContent value="explorer" className="mt-6 space-y-6">
              <TelcoSelect
                value={explorerTelco}
                onChange={setExplorerTelco}
                options={plottableOptions}
              />
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">
                    {labelOf(explorerTelco)} — organic vs campaign
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={explorerChart}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis tick={{ fontSize: 11 }} width={70} />
                      <Tooltip
                        contentStyle={{ fontSize: 12 }}
                        formatter={fmtTooltipValue}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar
                        dataKey="organic"
                        name="Organic"
                        stackId="d"
                        fill={ORGANIC_COLOR}
                      />
                      <Bar
                        dataKey="campaign"
                        name="Campaign"
                        stackId="d"
                        fill={CAMPAIGN_COLOR}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <DailyDetailTable rows={explorerRows} />
            </TabsContent>

            {/* ── 3-Day Trends ── */}
            <TabsContent value="trends" className="mt-6 space-y-6">
              <TelcoSelect
                value={trendTelco}
                onChange={setTrendTelco}
                options={plottableOptions}
              />
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">
                    {labelOf(trendTelco)} — rolling{" "}
                    {data.policy.rollingWindowDays}-day average
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={260}>
                    <LineChart data={trendChart}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10 }}
                        interval="preserveStartEnd"
                        padding={DATE_AXIS_PADDING}
                      />
                      <YAxis tick={{ fontSize: 11 }} width={70} />
                      <Tooltip
                        contentStyle={{ fontSize: 12 }}
                        formatter={fmtTooltipValue}
                      />
                      <Line
                        type="monotone"
                        dataKey="avg"
                        stroke={ORGANIC_COLOR}
                        strokeWidth={2}
                        dot={false}
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <TrendDetailTable
                rows={trendRows}
                lookbackDays={data.policy.trendLookbackDays}
              />
            </TabsContent>

            {/* ── Forecast ── */}
            <TabsContent value="forecast" className="mt-6 space-y-6">
              <ForecastTable
                rows={rowsForSelection(
                  data.forecast.rows,
                  data.selectedAccounts,
                )}
                forecastDate={data.forecastDate}
                estateForecast={data.forecast.estateForecast}
              />
            </TabsContent>

            {/* ── Weekly Growth ── */}
            <TabsContent value="weekly" className="mt-6 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">
                    {TOTAL_LABEL} weekly DAU (Mon–Sun)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={weeklyChart}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} width={70} />
                      <Tooltip
                        contentStyle={{ fontSize: 12 }}
                        formatter={fmtTooltipValue}
                      />
                      <Bar
                        dataKey="weeklyDau"
                        name={`${TOTAL_LABEL} weekly DAU`}
                        fill={ORGANIC_COLOR}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <WeeklyGrowthTable
                rows={data.weekly}
                accounts={countedAccounts}
              />
            </TabsContent>

            {/* ── Charts (Overall + By Account) ── */}
            <TabsContent value="charts" className="mt-6 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">
                    Estate — organic vs campaign
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={overallSplit}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10 }}
                        interval="preserveStartEnd"
                      />
                      <YAxis tick={{ fontSize: 11 }} width={70} />
                      <Tooltip
                        contentStyle={{ fontSize: 12 }}
                        formatter={fmtTooltipValue}
                      />
                      <Legend wrapperStyle={{ fontSize: 11 }} />
                      <Bar
                        dataKey="organic"
                        name="Organic"
                        stackId="d"
                        fill={ORGANIC_COLOR}
                      />
                      <Bar
                        dataKey="campaign"
                        name="Campaign"
                        stackId="d"
                        fill={CAMPAIGN_COLOR}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
              <div
                className={`
                  grid gap-4
                  md:grid-cols-2
                `}
              >
                {accounts.map((a) => {
                  const series = (data.explorer[a.key] ?? []).map((r) => ({
                    date: r.date.slice(5),
                    organic: r.organic ?? 0,
                    campaign: r.campaign ?? 0,
                  }));
                  return (
                    <Card key={a.key}>
                      <CardHeader>
                        <CardTitle className="text-sm">{a.label}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ResponsiveContainer width="100%" height={180}>
                          <BarChart data={series}>
                            <CartesianGrid
                              strokeDasharray="3 3"
                              opacity={0.2}
                            />
                            <XAxis
                              dataKey="date"
                              tick={{ fontSize: 9 }}
                              interval="preserveStartEnd"
                            />
                            <YAxis tick={{ fontSize: 10 }} width={56} />
                            <Tooltip
                              contentStyle={{ fontSize: 12 }}
                              formatter={fmtTooltipValue}
                            />
                            <Bar
                              dataKey="organic"
                              name="Organic"
                              stackId="d"
                              fill={ORGANIC_COLOR}
                            />
                            <Bar
                              dataKey="campaign"
                              name="Campaign"
                              stackId="d"
                              fill={CAMPAIGN_COLOR}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            {/* ── Campaign Index ── */}
            <TabsContent value="campaigns" className="mt-6 space-y-6">
              <CampaignIndexTable
                rows={rowsForSelection(
                  data.campaignIndex,
                  data.selectedAccounts,
                )}
                total={data.campaignIndex.length}
                labelOf={labelOf}
              />
            </TabsContent>

            {/* ── Daily Recap ── */}
            <TabsContent value="recap" className="mt-6 space-y-6">
              <DailyRecapTab data={data} labelOf={labelOf} />
            </TabsContent>
          </Tabs>
        </>
      ) : null}

      <DriftRecipientsDialog
        open={driftDialogOpen}
        onOpenChange={setDriftDialogOpen}
        canEdit={canManageDrift}
      />
    </div>
  );
}

function TelcoSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: { key: string; label: string }[];
}) {
  return (
    <div className="flex items-center gap-3">
      <span
        className={`
          text-muted-foreground text-xs font-semibold tracking-wide uppercase
        `}
      >
        Account
      </span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-72">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.key} value={o.key}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * Trend detail, rendered through the shared customizable table.
 *
 * Columns are declared as data: the shared component resolves the org default
 * under the user's own arrangement, drops hidden columns, owns sort state and
 * renders the customize menu.
 */
function TrendDetailTable({
  rows,
  lookbackDays,
}: {
  rows: MaTrendRow[];
  lookbackDays: number;
}) {
  const columns = useMemo<TableColumn<MaTrendRow>[]>(
    () => [
      {
        key: "date",
        label: "Date",
        render: (r) => <span className="tabular-nums">{r.date}</span>,
        sortValue: (r) => r.date,
      },
      {
        key: "day",
        label: "Day",
        render: (r) => (
          <span className="text-muted-foreground">{r.weekday}</span>
        ),
        sortValue: (r) => r.weekday,
      },
      {
        key: "avg",
        label: "3-day avg",
        align: "right",
        render: (r) => (
          <HoverTip>
            <TooltipTrigger asChild>
              <span className={TREND_HINT_CLS}>{fmtInt(r.threeDayAvg)}</span>
            </TooltipTrigger>
            <TooltipContent className="max-w-[280px]">
              {threeDayAvgTip(r)}
            </TooltipContent>
          </HoverTip>
        ),
        sortValue: (r) => r.threeDayAvg,
      },
      {
        key: "vs28",
        label: `vs ${lookbackDays}d back`,
        align: "right",
        render: (r) => (
          <HoverTip>
            <TooltipTrigger asChild>
              <span
                className={TREND_HINT_CLS}
                style={{ color: growthColor(r.vs28DaysBack) }}
              >
                {fmtSignedPct(r.vs28DaysBack)}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-[280px]">
              {vsDaysBackTip(r, lookbackDays)}
            </TooltipContent>
          </HoverTip>
        ),
        sortValue: (r) => r.vs28DaysBack,
      },
      {
        key: "vsPrev",
        label: "vs prev month",
        align: "right",
        render: (r) => (
          <HoverTip>
            <TooltipTrigger asChild>
              <span
                className={TREND_HINT_CLS}
                style={{ color: growthColor(r.vsPrevMonthSameDate) }}
              >
                {fmtSignedPct(r.vsPrevMonthSameDate)}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-[280px]">
              {vsPrevMonthTip(r)}
            </TooltipContent>
          </HoverTip>
        ),
        sortValue: (r) => r.vsPrevMonthSameDate,
      },
    ],
    [lookbackDays],
  );

  return (
    <CustomizableTable
      tableId="ma-trend-detail"
      title="Trend detail"
      columns={columns}
      rows={rows}
      rowKey={(r) => r.date}
      maxHeight="max-h-[520px]"
    />
  );
}

/**
 * Lifetime DAU per account.
 *
 * The row fields are named `totalSessions` / `averageSessions` /
 * `peakSessions`, but `lifetime()` builds all three from `dauAt` — they hold
 * DAU, not sessions, and the table used to be titled "sessions since first
 * entry" on top of them. Summed DAU is user-DAYS: a daily returner is counted
 * once per day, so this is not a headcount and not comparable to the homepage
 * views exhibit above. The API field names are left alone deliberately;
 * renaming them would ripple through the metrics engine to fix a label.
 *
 * The estate total arrives as the last row rather than a footer, because the
 * caller already appends it — sorting therefore keeps it in place only while
 * unsorted, which is why the row is styled by accountKey rather than index.
 */
function LifetimeSessionsTable({
  rows,
  estateKey,
}: {
  rows: DauMauDashboard["lifetime"]["rows"];
  estateKey: string;
}) {
  const columns = useMemo<TableColumn<(typeof rows)[number]>[]>(
    () => [
      {
        key: "account",
        label: "Account",
        render: (r) => (
          <span
            className={
              r.accountKey === estateKey ? "font-semibold" : "font-medium"
            }
          >
            {r.label}
          </span>
        ),
        sortValue: (r) => r.label,
      },
      {
        key: "total",
        label: "Total",
        align: "right",
        render: (r) => fmtInt(r.totalSessions),
        sortValue: (r) => r.totalSessions,
      },
      {
        key: "average",
        label: "Average",
        align: "right",
        render: (r) => fmtInt(r.averageSessions),
        sortValue: (r) => r.averageSessions,
      },
      {
        key: "peak",
        label: "Peak",
        align: "right",
        render: (r) => fmtInt(r.peakSessions),
        sortValue: (r) => r.peakSessions,
      },
      {
        key: "peakDate",
        label: "Peak date",
        render: (r) => (
          <span className="text-muted-foreground">{r.peakDate ?? "—"}</span>
        ),
        sortValue: (r) => r.peakDate,
      },
      {
        key: "dauAsOf",
        label: "DAU (as-of)",
        align: "right",
        render: (r) => fmtInt(r.dauOnAsOf),
        sortValue: (r) => r.dauOnAsOf,
      },
      {
        key: "share",
        label: "Share",
        align: "right",
        render: (r) => fmtPct(r.shareOfTotal),
        sortValue: (r) => r.shareOfTotal,
      },
    ],
    [estateKey],
  );

  return (
    <CustomizableTable
      // tableId is the persisted column-preferences key — renaming it would
      // reset every user's saved column layout, so it keeps its old name.
      tableId="ma-lifetime-sessions"
      title="Lifetime — DAU summed since first entry"
      columns={columns}
      rows={rows}
      rowKey={(r) => r.accountKey}
    />
  );
}

/** Rolling 3-day momentum per account, estate appended as the last row. */
function RollingMomentumTable({
  rows,
  asOf,
  estateKey,
}: {
  rows: DauMauDashboard["rolling3Day"]["rows"];
  asOf: string;
  estateKey: string;
}) {
  const columns = useMemo<TableColumn<(typeof rows)[number]>[]>(
    () => [
      {
        key: "account",
        label: "Account",
        render: (r) => (
          <span
            className={
              r.accountKey === estateKey ? "font-semibold" : "font-medium"
            }
          >
            {r.label}
          </span>
        ),
        sortValue: (r) => r.label,
      },
      {
        key: "last3",
        label: "Last 3-day",
        align: "right",
        render: (r) => fmtInt(r.last3Avg),
        sortValue: (r) => r.last3Avg,
      },
      {
        key: "prior3",
        label: "Prior 3-day",
        align: "right",
        render: (r) => fmtInt(r.prior3Avg),
        sortValue: (r) => r.prior3Avg,
      },
      {
        key: "change",
        label: "Change",
        align: "right",
        render: (r) => fmtInt(r.change),
        sortValue: (r) => r.change,
      },
      {
        key: "pctChange",
        label: "% change",
        align: "right",
        render: (r) => (
          <span style={{ color: growthColor(r.pctChange) }}>
            {fmtSignedPct(r.pctChange)}
          </span>
        ),
        sortValue: (r) => r.pctChange,
      },
      {
        key: "direction",
        label: "Direction",
        render: (r) => (
          <span
            className="capitalize"
            style={{ color: growthColor(r.pctChange) }}
          >
            {r.direction ?? "—"}
          </span>
        ),
        sortValue: (r) => r.direction,
      },
    ],
    [estateKey],
  );

  return (
    <CustomizableTable
      tableId="ma-rolling-momentum"
      title={`Rolling 3-day momentum — ending ${asOf}`}
      columns={columns}
      rows={rows}
      rowKey={(r) => r.accountKey}
    />
  );
}

/**
 * Next-day forecast per account.
 *
 * The estate sum is a footer rather than a row: it is a total, not an account,
 * so it must stay at the bottom regardless of how the reader sorts. It spans
 * whatever columns sit between the label and the forecast, which is why the
 * footer receives the visible keys.
 */
function ForecastTable({
  rows,
  forecastDate,
  estateForecast,
}: {
  rows: DauMauDashboard["forecast"]["rows"];
  forecastDate: string;
  estateForecast: number | null;
}) {
  const columns = useMemo<TableColumn<(typeof rows)[number]>[]>(
    () => [
      {
        key: "account",
        label: "Account",
        render: (r) => <span className="font-medium">{r.label}</span>,
        sortValue: (r) => r.label,
      },
      {
        key: "organicBaseline",
        label: "Organic baseline",
        align: "right",
        render: (r) => fmtInt(r.organicBaseline),
        sortValue: (r) => r.organicBaseline,
      },
      {
        key: "tickedDays",
        label: "Ticked days",
        align: "right",
        render: (r) => r.tickedDays,
        sortValue: (r) => r.tickedDays,
      },
      {
        key: "campaignAvg",
        label: "Campaign-day avg",
        align: "right",
        render: (r) => fmtInt(r.campaignAvg),
        sortValue: (r) => r.campaignAvg,
      },
      {
        key: "uplift",
        label: "Uplift",
        align: "right",
        render: (r) => `${r.uplift.toFixed(2)}×`,
        sortValue: (r) => r.uplift,
      },
      {
        key: "ticked",
        label: "Ticked?",
        render: (r) =>
          r.tickedOnForecastDate ? (
            <Badge variant="destructive" className="text-[10px]">
              Yes
            </Badge>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
        sortValue: (r) => (r.tickedOnForecastDate ? 1 : 0),
      },
      {
        key: "forecastDau",
        label: "Forecast DAU",
        align: "right",
        render: (r) => (
          <span className="font-semibold">{fmtInt(r.forecastDau)}</span>
        ),
        sortValue: (r) => r.forecastDau,
      },
      {
        key: "basis",
        label: "Basis",
        render: (r) => (
          <span className="text-muted-foreground text-xs">{r.basis}</span>
        ),
      },
    ],
    [],
  );

  return (
    <CustomizableTable
      tableId="ma-forecast"
      title={`Next-day forecast (${forecastDate}) — baseline × campaign uplift`}
      columns={columns}
      rows={rows}
      rowKey={(r) => r.accountKey}
      footer={(visibleKeys) => {
        const forecastIdx = visibleKeys.indexOf("forecastDau");
        if (forecastIdx < 0) return null;
        const spanBefore = forecastIdx - 1;
        const spanAfter = visibleKeys.length - forecastIdx - 1;
        return (
          <tr className="border-foreground border-t-2 font-semibold">
            <td className="py-2">Estate (sum)</td>
            {spanBefore > 0 ? (
              <td className="py-2" colSpan={spanBefore} />
            ) : null}
            <td className="py-2 text-right tabular-nums">
              {fmtInt(estateForecast)}
            </td>
            {spanAfter > 0 ? <td className="py-2" colSpan={spanAfter} /> : null}
          </tr>
        );
      }}
    />
  );
}

/** Campaign index. Rows are campaign runs, so the key includes the index. */
function CampaignIndexTable({
  rows,
  total,
  labelOf,
}: {
  rows: DauMauDashboard["campaignIndex"];
  total: number;
  labelOf: (key: string) => string;
}) {
  const columns = useMemo<TableColumn<(typeof rows)[number]>[]>(
    () => [
      {
        key: "account",
        label: "Account",
        render: (c) => (
          <span className="font-medium">{labelOf(c.accountKey)}</span>
        ),
        sortValue: (c) => labelOf(c.accountKey),
      },
      {
        key: "campaign",
        label: "Campaign",
        render: (c) => (
          <span className="block max-w-[280px] truncate" title={c.name}>
            {c.name}
          </span>
        ),
        sortValue: (c) => c.name,
      },
      {
        key: "firstDate",
        label: "First date",
        render: (c) => <span className="tabular-nums">{c.startDate}</span>,
        sortValue: (c) => c.startDate,
      },
      {
        key: "lastDate",
        label: "Last date",
        render: (c) => <span className="tabular-nums">{c.endDate}</span>,
        sortValue: (c) => c.endDate,
      },
      {
        key: "days",
        label: "Days",
        align: "right",
        render: (c) => c.tickedDays,
        sortValue: (c) => c.tickedDays,
      },
      {
        key: "levers",
        label: "Levers",
        render: (c) => (
          <div className="flex flex-wrap gap-1">
            {c.placements.slice(0, 4).map((p) => (
              <Badge key={p} variant="secondary" className="text-[10px]">
                {p}
              </Badge>
            ))}
            {c.placements.length === 0 ? (
              <span className="text-muted-foreground text-xs">—</span>
            ) : null}
          </div>
        ),
      },
    ],
    [labelOf],
  );

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            Campaign index — {total} campaigns
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground py-8 text-center text-sm">
            No campaigns in range.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <CustomizableTable
      tableId="ma-campaign-index"
      title={`Campaign index — ${total} campaigns`}
      columns={columns}
      rows={rows}
      rowKey={(c, i) => `${c.accountKey}-${c.name}-${i}`}
    />
  );
}

/**
 * DAU Explorer daily detail.
 *
 * Campaign days used to be tinted via a row class. The shared table owns row
 * rendering, so the signal moved into the Campaign column's badge — which was
 * already the authoritative marker and survives hiding or reordering.
 */
function DailyDetailTable({
  rows,
}: {
  rows: DauMauDashboard["explorer"][string];
}) {
  const columns = useMemo<TableColumn<(typeof rows)[number]>[]>(
    () => [
      {
        key: "date",
        label: "Date",
        render: (r) => <span className="tabular-nums">{r.date}</span>,
        sortValue: (r) => r.date,
      },
      {
        key: "day",
        label: "Day",
        render: (r) => (
          <span className="text-muted-foreground">{r.weekday}</span>
        ),
        sortValue: (r) => r.weekday,
      },
      {
        key: "dau",
        label: "DAU",
        align: "right",
        render: (r) => fmtInt(r.dau),
        sortValue: (r) => r.dau,
      },
      {
        key: "dayOnDay",
        label: "Day-on-day",
        align: "right",
        render: (r) => (
          <span style={{ color: growthColor(r.dayOnDay) }}>
            {fmtSignedPct(r.dayOnDay)}
          </span>
        ),
        sortValue: (r) => r.dayOnDay,
      },
      {
        key: "threeDayAvg",
        label: "3-day avg",
        align: "right",
        render: (r) => fmtInt(r.threeDayAvg),
        sortValue: (r) => r.threeDayAvg,
      },
      {
        key: "vsPrior3",
        label: "vs prior 3",
        align: "right",
        render: (r) => (
          <span style={{ color: growthColor(r.threeDayVsPrior) }}>
            {fmtSignedPct(r.threeDayVsPrior)}
          </span>
        ),
        sortValue: (r) => r.threeDayVsPrior,
      },
      {
        key: "vs4wk",
        label: "vs 4wk",
        align: "right",
        render: (r) => (
          <span style={{ color: growthColor(r.vsSameWeekday) }}>
            {fmtSignedPct(r.vsSameWeekday)}
          </span>
        ),
        sortValue: (r) => r.vsSameWeekday,
      },
      {
        key: "campaign",
        label: "Campaign",
        render: (r) =>
          r.isCampaignDay ? (
            <Badge variant="destructive" className="text-[10px]">
              {r.campaignsThatDay[0] ?? "Campaign"}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          ),
        sortValue: (r) => (r.isCampaignDay ? 1 : 0),
      },
    ],
    [],
  );

  return (
    <CustomizableTable
      tableId="ma-dau-explorer"
      title="Daily detail"
      columns={columns}
      rows={rows}
      rowKey={(r) => r.date}
      maxHeight="max-h-[520px]"
    />
  );
}

/**
 * Weekly growth, one row per week with a column per account.
 *
 * The account columns are dynamic but their keys are not: `acct:<accountKey>`
 * is stable across date ranges and partner filters, so a saved arrangement
 * survives both. Accounts absent from the current filter drop out of the code
 * order, and resolveLayout merges them back when they return.
 */
function WeeklyGrowthTable({
  rows,
  accounts,
}: {
  rows: DauMauDashboard["weekly"];
  accounts: { key: string; label: string }[];
}) {
  const columns = useMemo<TableColumn<(typeof rows)[number]>[]>(
    () => [
      {
        key: "week",
        label: "Week",
        render: (w) => <span className="font-medium">W{w.weekIndex}</span>,
        sortValue: (w) => w.weekIndex,
      },
      {
        key: "range",
        label: "Range",
        render: (w) => (
          <span className="text-muted-foreground text-xs whitespace-nowrap">
            {w.weekStart.slice(5)} – {w.weekEnd.slice(5)}
          </span>
        ),
        sortValue: (w) => w.weekStart,
      },
      ...accounts.map((a) => ({
        key: `acct:${a.key}`,
        label: a.label,
        align: "right" as const,
        render: (w: (typeof rows)[number]) =>
          fmtInt(w.accounts.find((c) => c.accountKey === a.key)?.weeklyDau),
        sortValue: (w: (typeof rows)[number]) =>
          w.accounts.find((c) => c.accountKey === a.key)?.weeklyDau ?? null,
      })),
      {
        key: "estate",
        label: "Estate",
        align: "right",
        render: (w) => (
          <span className="font-semibold">{fmtInt(w.estate.weeklyDau)}</span>
        ),
        sortValue: (w) => w.estate.weeklyDau,
      },
      {
        key: "wow",
        label: "WoW",
        align: "right",
        render: (w) => (
          <span style={{ color: growthColor(w.estate.vsPrevWeek) }}>
            {fmtSignedPct(w.estate.vsPrevWeek)}
          </span>
        ),
        sortValue: (w) => w.estate.vsPrevWeek,
      },
      {
        key: "campaignDays",
        label: "Campaign acct-days",
        align: "right",
        render: (w) => w.campaignAccountDays,
        sortValue: (w) => w.campaignAccountDays,
      },
      {
        key: "accountsRunning",
        label: "Accounts running",
        render: (w) => (
          <span
            className={`
              text-muted-foreground block max-w-[220px] truncate text-xs
            `}
          >
            {w.whichAccounts.join(", ") || "—"}
          </span>
        ),
      },
    ],
    [accounts],
  );

  return (
    <CustomizableTable
      tableId="ma-weekly-growth"
      title="Weekly growth + campaign explorer"
      columns={columns}
      rows={rows}
      rowKey={(w) => String(w.weekIndex)}
    />
  );
}

/**
 * Monthly MAU, capture and month-end forecast — one row per account, with a
 * MAU column and a capture column per month in range.
 *
 * The month columns are dynamic, but `mau:<ym>` / `cap:<ym>` are stable keys:
 * narrowing the range drops those months from the code order and resolveLayout
 * merges them back at their natural position when the range widens again. That
 * is exactly the case mergeStoredColumnOrder exists for.
 *
 * The estate row is a footer rather than a row: it is a total, not an account,
 * so it stays at the bottom however the reader sorts. It reads the visible
 * keys to place each cell under the right column, which is what lets it
 * survive hiding or reordering.
 */
function MonthlyMauTable({
  months,
  accounts,
  latest,
}: {
  months: DauMauDashboard["monthly"];
  accounts: { key: string; label: string; accessibleMau: number | null }[];
  latest: DauMauDashboard["monthly"][number] | undefined;
}) {
  type Row = (typeof accounts)[number];
  const cellOf = (a: Row, ym: string) =>
    months
      .find((m) => m.month === ym)
      ?.accounts.find((c) => c.accountKey === a.key);

  const columns = useMemo<TableColumn<Row>[]>(() => {
    const cols: TableColumn<Row>[] = [
      {
        key: "account",
        label: "Account",
        render: (a) => <span className="font-medium">{a.label}</span>,
        sortValue: (a) => a.label,
      },
      ...months.map((m) => ({
        key: `mau:${m.month}`,
        label: `${monthLabel(m.month)} MAU`,
        align: "right" as const,
        render: (a: Row) => fmtInt(cellOf(a, m.month)?.mau),
        sortValue: (a: Row) => cellOf(a, m.month)?.mau ?? null,
      })),
      {
        key: "accessible",
        label: "Accessible",
        align: "right",
        render: (a) => fmtInt(a.accessibleMau),
        sortValue: (a) => a.accessibleMau,
      },
      ...months.map((m) => ({
        key: `cap:${m.month}`,
        label: `${monthLabel(m.month)} cap.`,
        align: "right" as const,
        render: (a: Row) => fmtPct(cellOf(a, m.month)?.capture),
        sortValue: (a: Row) => cellOf(a, m.month)?.capture ?? null,
      })),
    ];
    if (latest) {
      cols.push(
        {
          key: "monthEndForecast",
          label: "Month-end fc.",
          align: "right",
          render: (a) => fmtInt(cellOf(a, latest.month)?.monthEndForecast),
          sortValue: (a) => cellOf(a, latest.month)?.monthEndForecast ?? null,
        },
        {
          key: "forecastCapture",
          label: "Fc. capture",
          align: "right",
          render: (a) => fmtPct(cellOf(a, latest.month)?.forecastCapture),
          sortValue: (a) => cellOf(a, latest.month)?.forecastCapture ?? null,
        },
      );
    }
    return cols;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [months, latest]);

  /** Estate value for whichever column key a footer cell sits under. */
  function estateCell(key: string): ReactNode {
    if (key === "account") return TOTAL_LABEL;
    if (key.startsWith("mau:")) {
      const m = months.find((x) => x.month === key.slice(4));
      return fmtInt(m?.estate.mau);
    }
    if (key.startsWith("cap:")) {
      const m = months.find((x) => x.month === key.slice(4));
      return fmtPct(m?.estate.capture);
    }
    if (key === "monthEndForecast") {
      return fmtInt(latest?.estate.monthEndForecast);
    }
    if (key === "forecastCapture") {
      return fmtPct(latest?.estate.forecastCapture);
    }
    return null; // Accessible has no estate figure
  }

  return (
    <CustomizableTable
      tableId="ma-monthly-mau"
      title="Monthly MAU, capture & month-end forecast"
      columns={columns}
      rows={accounts}
      rowKey={(a) => a.key}
      footer={(visibleKeys) => (
        <tr className="border-foreground border-t-2 font-semibold">
          {visibleKeys.map((key) => (
            <td
              key={key}
              className={`
                py-2
                ${
                  key === "account" || key === "__handle"
                    ? ""
                    : `text-right tabular-nums`
                }
              `}
            >
              {key === "__handle" ? null : estateCell(key)}
            </td>
          ))}
        </tr>
      )}
      footnote={
        latest ? (
          <span className="flex items-center gap-2">
            <span className="text-muted-foreground w-40 shrink-0">
              {monthLabel(latest.month)} estate capture
            </span>
            <span className="max-w-xs flex-1">
              <Meter pct={latest.estate.capture} />
            </span>
            <span className="tabular-nums">
              {fmtPct(latest.estate.capture)}
            </span>
          </span>
        ) : null
      }
    />
  );
}
