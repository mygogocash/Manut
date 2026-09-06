"use client";

import {
  Activity,
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  Clock,
  Download,
  Gauge,
  HelpCircle,
  Hourglass,
  Loader2,
  RefreshCw,
  Rocket,
  ShieldAlert,
  ShieldCheck,
  TicketCheck,
  Timer,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import type { ComponentType, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { StatCard } from "@/components/dashboard/stat-card";
import { ItWorkspaceTabs } from "@/components/it/it-workspace-tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api-client";
import {
  getItCrmDashboard,
  type ItCrmDashboardSnapshot,
} from "@/services/it-crm.service";
import { projectStatusLabel } from "@/services/project.service";

// Recharts palette anchored to brand tokens — same as the Project CRM
// dashboard so the two surfaces read as one product family. These are
// Tailwind v4 `@theme` colors that resolve to complete color values, so
// bare `var(--color-*)` is correct here (no hsl() wrapper needed).
const CHART_COLORS = [
  "var(--color-primary)",
  "var(--color-info)",
  "var(--color-success)",
  "var(--color-warning)",
  "var(--color-destructive)",
  "var(--color-accent)",
  "var(--color-muted-foreground)",
];

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatMonth(yearMonth: string): string {
  const [yearStr, monthStr] = yearMonth.split("-");
  const y = Number(yearStr);
  const m = Number(monthStr);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return yearMonth;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
}

// Short day label for the helpdesk 7-day series ("Mon 26").
function formatDayShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { weekday: "short", day: "2-digit" });
}

// Compact age formatting for the open-ticket spotlight ("2d 4h" /
// "5h 12m"). Ticket ageing in hours is the rep's primary signal for
// "is this slipping?" — round nicely so the cell stays scannable.
function formatAge(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m`;
  if (hours < 24) {
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m ? `${h}h ${m}m` : `${h}h`;
  }
  const d = Math.floor(hours / 24);
  const h = Math.round(hours - d * 24);
  return h ? `${d}d ${h}h` : `${d}d`;
}

// "12.3d" / "—" for the flow KPI band + registers.
function formatDays(n: number | null | undefined): string {
  return n == null ? "—" : `${n}d`;
}
// "92.5%" / "—" for the SLA band.
function formatPct(n: number | null | undefined): string {
  return n == null ? "—" : `${n}%`;
}

const HELPDESK_PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgent",
  high: "High",
  medium: "Medium",
  low: "Low",
};

const HELPDESK_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  "in-progress": "In progress",
  review: "Review",
  resolved: "Resolved",
  closed: "Closed",
};

const HELPDESK_CATEGORY_LABELS: Record<string, string> = {
  "account-access": "Account access",
  "software-access": "Software access",
  hardware: "Hardware",
  network: "Network",
  "file-drive": "File / Drive",
  security: "Security",
  procurement: "Procurement",
  other: "Other",
};

// Portfolio-health RAG vocabulary. `unrated` catches projects not yet
// scored so the heat strip always sums to the whole portfolio.
const HEALTH_META: Record<string, { label: string; color: string }> = {
  green: { label: "On track", color: "var(--color-success)" },
  yellow: { label: "Watch", color: "var(--color-warning)" },
  red: { label: "At risk", color: "var(--color-destructive)" },
  unrated: { label: "Unrated", color: "var(--color-muted-foreground)" },
};
const HEALTH_ORDER = ["green", "yellow", "red", "unrated"];

// Attainment → tone. >=90% green, >=75% amber, else red; null = muted.
function slaTone(pct: number | null): string {
  if (pct == null) return "var(--color-muted-foreground)";
  if (pct >= 90) return "var(--color-success)";
  if (pct >= 75) return "var(--color-warning)";
  return "var(--color-destructive)";
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildHtmlReport(
  snapshot: ItCrmDashboardSnapshot,
  generatedAt: Date,
): string {
  const stamp = generatedAt.toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  const statusRows = snapshot.byStatus
    .map(
      (s) => `
        <tr>
          <td>${escapeHtml(projectStatusLabel(s.status))}</td>
          <td style="text-align:right;font-variant-numeric:tabular-nums">${s.count}</td>
        </tr>
      `,
    )
    .join("");
  const departmentRows = snapshot.byDepartment
    .map(
      (d) => `
        <tr>
          <td>${escapeHtml(d.department ?? "Unassigned")}</td>
          <td style="text-align:right;font-variant-numeric:tabular-nums">${d.count}</td>
        </tr>
      `,
    )
    .join("");
  const ownerRows = snapshot.ownerWorkload
    .map(
      (o) => `
        <tr>
          <td>${escapeHtml(o.ownerName)}</td>
          <td style="text-align:right;font-variant-numeric:tabular-nums">${o.count}</td>
        </tr>
      `,
    )
    .join("");
  const throughputRows = snapshot.throughput
    .map(
      (t) => `
        <tr>
          <td>${escapeHtml(formatMonth(t.month))}</td>
          <td style="text-align:right;font-variant-numeric:tabular-nums">${t.count}</td>
        </tr>
      `,
    )
    .join("");
  const healthRows = HEALTH_ORDER.map((k) => {
    const count =
      snapshot.health.distribution.find((h) => h.health === k)?.count ?? 0;
    return `
        <tr>
          <td>${escapeHtml(HEALTH_META[k].label)}</td>
          <td style="text-align:right;font-variant-numeric:tabular-nums">${count}</td>
        </tr>
      `;
  }).join("");
  const slaRows = [
    { label: "Response SLA", v: snapshot.sla.response },
    { label: "Resolution SLA", v: snapshot.sla.resolution },
  ]
    .map(
      (r) => `
        <tr>
          <td>${escapeHtml(r.label)}</td>
          <td style="text-align:right;font-variant-numeric:tabular-nums">${r.v.attainmentPct == null ? "—" : `${r.v.attainmentPct}%`}</td>
          <td style="text-align:right;font-variant-numeric:tabular-nums">${r.v.met}/${r.v.total}</td>
        </tr>
      `,
    )
    .join("");
  const firstFix = snapshot.sla.firstFix;
  const slippageRows = snapshot.flow.slippage.projects
    .map(
      (p) => `
        <tr>
          <td>${escapeHtml(p.name)}</td>
          <td>${escapeHtml(formatDate(p.originalGoLive))}</td>
          <td>${escapeHtml(formatDate(p.revisedGoLive))}</td>
          <td style="text-align:right;font-variant-numeric:tabular-nums">${p.slipDays > 0 ? "+" : ""}${p.slipDays}d</td>
          <td>${escapeHtml(p.owner?.name ?? "—")}</td>
        </tr>
      `,
    )
    .join("");
  const stageAgingRows = snapshot.flow.stageAgingOldest
    .map(
      (p) => `
        <tr>
          <td>${escapeHtml(p.name)}</td>
          <td>${escapeHtml(projectStatusLabel(p.status))}</td>
          <td style="text-align:right;font-variant-numeric:tabular-nums">${p.daysInStage == null ? "—" : `${p.daysInStage}d`}</td>
          <td>${escapeHtml(p.owner?.name ?? "—")}</td>
        </tr>
      `,
    )
    .join("");
  const upcomingRows = snapshot.upcomingGoLives
    .map(
      (p) => `
        <tr>
          <td>${escapeHtml(p.name)}</td>
          <td>${escapeHtml(projectStatusLabel(p.status))}</td>
          <td>${escapeHtml(p.department ?? "—")}</td>
          <td>${escapeHtml(p.owner?.name ?? "—")}</td>
          <td>${escapeHtml(formatDate(p.goLiveDate))}</td>
          <td>${escapeHtml(p.dependency ?? "—")}</td>
        </tr>
      `,
    )
    .join("");
  const blockedRows = snapshot.blockedProjects
    .map(
      (p) => `
        <tr>
          <td>${escapeHtml(p.name)}</td>
          <td>${escapeHtml(projectStatusLabel(p.status))}</td>
          <td>${escapeHtml(p.owner?.name ?? "—")}</td>
          <td>${escapeHtml(p.dependency ?? "")}</td>
          <td>${escapeHtml(p.comment ?? "")}</td>
        </tr>
      `,
    )
    .join("");
  const recentRows = snapshot.recentUpdates
    .map(
      (p) => `
        <tr>
          <td>${escapeHtml(p.name)}</td>
          <td>${escapeHtml(projectStatusLabel(p.status))}</td>
          <td>${escapeHtml(p.owner?.name ?? "—")}</td>
          <td>${escapeHtml(formatDate(p.updatedAt))}</td>
          <td>${escapeHtml(p.comment ?? "")}</td>
        </tr>
      `,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>IT CRM Intelligence Report — ${escapeHtml(stamp)}</title>
<style>
  :root { color-scheme: light; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 36px; background: #faf7f1; color: #2a2520; }
  header { border-bottom: 2px solid #2a2520; padding-bottom: 16px; margin-bottom: 22px; }
  h1 { font-family: Georgia, serif; font-size: 30px; margin: 0 0 6px; letter-spacing: -0.01em; }
  .subtitle { color: #7a7166; font-size: 13px; }
  .kpis { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 28px; }
  .kpi { background: #fff; border: 1px solid #ece4d4; border-radius: 12px; padding: 14px 16px; }
  .kpi .label { color: #7a7166; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; margin-bottom: 6px; }
  .kpi .value { font-family: Georgia, serif; font-size: 26px; font-variant-numeric: tabular-nums; }
  section { background: #fff; border: 1px solid #ece4d4; border-radius: 12px; padding: 18px 20px; margin-bottom: 18px; page-break-inside: avoid; }
  section h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: #7a7166; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #f1ead9; vertical-align: top; }
  th { font-weight: 600; color: #7a7166; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  footer { color: #7a7166; font-size: 11px; margin-top: 28px; }
  @media (max-width: 880px) {
    .kpis { grid-template-columns: repeat(2, 1fr); }
    .two-col { grid-template-columns: 1fr; }
  }
</style>
</head>
<body>
<header>
  <h1>IT CRM Intelligence Report</h1>
  <div class="subtitle">Generated ${escapeHtml(stamp)} · manut.xyz</div>
</header>

<div class="kpis">
  <div class="kpi"><div class="label">Total</div><div class="value">${snapshot.total}</div></div>
  <div class="kpi"><div class="label">In progress</div><div class="value">${snapshot.inProgress}</div></div>
  <div class="kpi"><div class="label">Completed</div><div class="value">${snapshot.completed}</div></div>
  <div class="kpi"><div class="label">Production live</div><div class="value">${snapshot.productionLive}</div></div>
  <div class="kpi"><div class="label">At risk</div><div class="value">${snapshot.atRisk}</div></div>
</div>

<section>
  <h2>Flow &amp; SLA intelligence</h2>
  <div class="kpis" style="grid-template-columns:repeat(6,1fr);margin-bottom:0;">
    <div class="kpi"><div class="label">Lead time</div><div class="value">${snapshot.flow.leadTimeDays == null ? "—" : `${snapshot.flow.leadTimeDays}d`}</div></div>
    <div class="kpi"><div class="label">Task cycle</div><div class="value">${snapshot.flow.taskCycleDays == null ? "—" : `${snapshot.flow.taskCycleDays}d`}</div></div>
    <div class="kpi"><div class="label">Avg in stage</div><div class="value">${snapshot.flow.avgDaysInStage == null ? "—" : `${snapshot.flow.avgDaysInStage}d`}</div></div>
    <div class="kpi"><div class="label">Avg slip</div><div class="value">${snapshot.flow.slippage.avgSlipDays == null ? "—" : `${snapshot.flow.slippage.avgSlipDays}d`}</div></div>
    <div class="kpi"><div class="label">Resolution SLA</div><div class="value">${snapshot.sla.resolution.attainmentPct == null ? "—" : `${snapshot.sla.resolution.attainmentPct}%`}</div></div>
    <div class="kpi"><div class="label">First-fix</div><div class="value">${firstFix.firstFixPct == null ? "—" : `${firstFix.firstFixPct}%`}</div></div>
  </div>
</section>

<div class="two-col">
  <section>
    <h2>Status distribution</h2>
    <table><thead><tr><th>Status</th><th style="text-align:right">Count</th></tr></thead><tbody>${statusRows || '<tr><td colspan="2">—</td></tr>'}</tbody></table>
  </section>
  <section>
    <h2>Portfolio health (RAG)</h2>
    <table><thead><tr><th>Health</th><th style="text-align:right">Projects</th></tr></thead><tbody>${healthRows}</tbody></table>
  </section>
</div>

<div class="two-col">
  <section>
    <h2>By department</h2>
    <table><thead><tr><th>Department</th><th style="text-align:right">Count</th></tr></thead><tbody>${departmentRows || '<tr><td colspan="2">—</td></tr>'}</tbody></table>
  </section>
  <section>
    <h2>Owner workload (top 8)</h2>
    <table><thead><tr><th>Owner</th><th style="text-align:right">Projects</th></tr></thead><tbody>${ownerRows || '<tr><td colspan="2">—</td></tr>'}</tbody></table>
  </section>
</div>

<div class="two-col">
  <section>
    <h2>Monthly throughput (last 6 months)</h2>
    <table><thead><tr><th>Month</th><th style="text-align:right">Production-live</th></tr></thead><tbody>${throughputRows || '<tr><td colspan="2">—</td></tr>'}</tbody></table>
  </section>
  <section>
    <h2>Helpdesk SLA attainment</h2>
    <table><thead><tr><th>Metric</th><th style="text-align:right">Attainment</th><th style="text-align:right">Met</th></tr></thead><tbody>${slaRows}
      <tr><td>First-fix rate</td><td style="text-align:right;font-variant-numeric:tabular-nums">${firstFix.firstFixPct == null ? "—" : `${firstFix.firstFixPct}%`}</td><td style="text-align:right;font-variant-numeric:tabular-nums">${firstFix.clean}/${firstFix.total}</td></tr>
    </tbody></table>
  </section>
</div>

<section>
  <h2>Schedule slippage (active, pushed go-lives)</h2>
  <table><thead><tr><th>Project</th><th>Original</th><th>Revised</th><th style="text-align:right">Slip</th><th>Owner</th></tr></thead><tbody>${slippageRows || '<tr><td colspan="5">No slipped go-lives.</td></tr>'}</tbody></table>
</section>

<section>
  <h2>Stage aging — most-stuck active work</h2>
  <table><thead><tr><th>Project</th><th>Status</th><th style="text-align:right">Days in stage</th><th>Owner</th></tr></thead><tbody>${stageAgingRows || '<tr><td colspan="4">No active projects.</td></tr>'}</tbody></table>
</section>

<section>
  <h2>Upcoming go-lives (next 14 days)</h2>
  <table><thead><tr><th>Project</th><th>Status</th><th>Department</th><th>Owner</th><th>Go-live</th><th>Dependency</th></tr></thead><tbody>${upcomingRows || '<tr><td colspan="6">No upcoming go-lives.</td></tr>'}</tbody></table>
</section>

<section>
  <h2>Blocked or commented (active projects)</h2>
  <table><thead><tr><th>Project</th><th>Status</th><th>Owner</th><th>Dependency</th><th>Comment</th></tr></thead><tbody>${blockedRows || '<tr><td colspan="5">No active blockers.</td></tr>'}</tbody></table>
</section>

<section>
  <h2>Recently updated (last 7 days)</h2>
  <table><thead><tr><th>Project</th><th>Status</th><th>Owner</th><th>Updated</th><th>Comment</th></tr></thead><tbody>${recentRows || '<tr><td colspan="5">No recent updates.</td></tr>'}</tbody></table>
</section>

<section>
  <h2>Tasks &amp; subtasks</h2>
  <div class="kpis" style="grid-template-columns:repeat(5,1fr);">
    <div class="kpi"><div class="label">Total tasks</div><div class="value">${snapshot.tasks.total}</div></div>
    <div class="kpi"><div class="label">Subtasks</div><div class="value">${snapshot.tasks.subtasks}</div></div>
    <div class="kpi"><div class="label">In progress</div><div class="value">${snapshot.tasks.inProgress}</div></div>
    <div class="kpi"><div class="label">Done</div><div class="value">${snapshot.tasks.done}</div></div>
    <div class="kpi"><div class="label">Overdue</div><div class="value">${snapshot.tasks.overdue}</div></div>
  </div>
  <table style="margin-top:8px;"><thead><tr><th>Task</th><th>Project</th><th>Status</th><th>Owner</th><th>Due</th><th>Type</th></tr></thead><tbody>${
    snapshot.tasks.overdueList
      .map(
        (t) => `
        <tr>
          <td>${escapeHtml(t.title)}</td>
          <td>${escapeHtml(t.project.name)}</td>
          <td>${escapeHtml(t.status)}</td>
          <td>${escapeHtml(t.owner?.name ?? "—")}</td>
          <td>${escapeHtml(formatDate(t.endDate))}</td>
          <td>${t.isSubtask ? "Subtask" : "Task"}</td>
        </tr>
      `,
      )
      .join("") || '<tr><td colspan="6">No overdue tasks.</td></tr>'
  }</tbody></table>
</section>

<section>
  <h2>Daily catchup — yesterday done</h2>
  <table><thead><tr><th>Item</th><th>Type</th><th>Owner / Department</th></tr></thead><tbody>${
    [
      ...snapshot.dailyCatchup.yesterdayDone.projects.map(
        (p) => `
        <tr>
          <td>${escapeHtml(p.name)}</td>
          <td>Project</td>
          <td>${escapeHtml(p.owner?.name ?? p.department ?? "—")}</td>
        </tr>
      `,
      ),
      ...snapshot.dailyCatchup.yesterdayDone.tasks.map(
        (t) => `
        <tr>
          <td>${escapeHtml(t.title)} <span style="color:#7a7166">· ${escapeHtml(t.project.name)}</span></td>
          <td>${t.isSubtask ? "Subtask" : "Task"}</td>
          <td>${escapeHtml(t.owner?.name ?? "—")}</td>
        </tr>
      `,
      ),
    ].join("") ||
    '<tr><td colspan="3">Nothing recorded as done yesterday.</td></tr>'
  }</tbody></table>
</section>

<section>
  <h2>Daily catchup — today in progress</h2>
  <table><thead><tr><th>Task</th><th>Project</th><th>Owner</th></tr></thead><tbody>${
    snapshot.dailyCatchup.todayInProgress.tasks
      .map(
        (t) => `
        <tr>
          <td>${escapeHtml(t.title)}</td>
          <td>${escapeHtml(t.project.name)}</td>
          <td>${escapeHtml(t.owner?.name ?? "—")}</td>
        </tr>
      `,
      )
      .join("") ||
    '<tr><td colspan="3">No tasks moved into in-progress today yet.</td></tr>'
  }</tbody></table>
</section>

<section>
  <h2>IT Helpdesk — snapshot</h2>
  <div class="kpis" style="grid-template-columns:repeat(6,1fr);">
    <div class="kpi"><div class="label">Created today</div><div class="value">${snapshot.helpdesk.created.today}</div></div>
    <div class="kpi"><div class="label">Created yesterday</div><div class="value">${snapshot.helpdesk.created.yesterday}</div></div>
    <div class="kpi"><div class="label">Created this week</div><div class="value">${snapshot.helpdesk.created.thisWeek}</div></div>
    <div class="kpi"><div class="label">Open</div><div class="value">${snapshot.helpdesk.open}</div></div>
    <div class="kpi"><div class="label">Resolved this week</div><div class="value">${snapshot.helpdesk.resolved.thisWeek}</div></div>
    <div class="kpi"><div class="label">Avg resolution</div><div class="value">${snapshot.helpdesk.avgResolutionHours == null ? "—" : `${snapshot.helpdesk.avgResolutionHours}h`}</div></div>
  </div>
  <div class="two-col" style="margin-top:14px;">
    <div>
      <h2>By priority</h2>
      <table><thead><tr><th>Priority</th><th style="text-align:right">Count</th><th style="text-align:right">Avg resolve</th></tr></thead><tbody>${(
        ["urgent", "high", "medium", "low"] as const
      )
        .map((p) => {
          const row = snapshot.helpdesk.byPriority.find(
            (r) => r.priority === p,
          );
          const avg = snapshot.helpdesk.avgResolutionHoursByPriority?.[p];
          return `
        <tr>
          <td>${escapeHtml(HELPDESK_PRIORITY_LABELS[p])}</td>
          <td style="text-align:right;font-variant-numeric:tabular-nums">${row?.count ?? 0}</td>
          <td style="text-align:right;font-variant-numeric:tabular-nums">${avg == null ? "—" : `${avg}h`}</td>
        </tr>
      `;
        })
        .join("")}</tbody></table>
    </div>
    <div>
      <h2>By category</h2>
      <table><thead><tr><th>Category</th><th style="text-align:right">Count</th></tr></thead><tbody>${
        snapshot.helpdesk.byCategory
          .map(
            (c) => `
        <tr>
          <td>${escapeHtml(HELPDESK_CATEGORY_LABELS[c.category] ?? c.category)}</td>
          <td style="text-align:right;font-variant-numeric:tabular-nums">${c.count}</td>
        </tr>
      `,
          )
          .join("") || '<tr><td colspan="2">No tickets yet.</td></tr>'
      }</tbody></table>
    </div>
  </div>
  <h2 style="margin-top:14px;">Open ticket spotlight</h2>
  <table><thead><tr><th>#</th><th>Title</th><th>Priority</th><th>Category</th><th>Assignee</th><th style="text-align:right">Age</th></tr></thead><tbody>${
    snapshot.helpdesk.openSpotlight
      .map(
        (t) => `
        <tr>
          <td>#${t.ticketNumber}</td>
          <td>${escapeHtml(t.title)}</td>
          <td>${escapeHtml(HELPDESK_PRIORITY_LABELS[t.priority] ?? t.priority)}</td>
          <td>${escapeHtml(HELPDESK_CATEGORY_LABELS[t.category] ?? t.category)}</td>
          <td>${escapeHtml(t.assignee?.name ?? "—")}</td>
          <td style="text-align:right;font-variant-numeric:tabular-nums">${formatAge(t.ageHours)}</td>
        </tr>
      `,
      )
      .join("") || '<tr><td colspan="6">No open tickets.</td></tr>'
  }</tbody></table>
</section>

<footer>Manut · Internal use only · Generated from the live IT CRM workspace.</footer>
</body>
</html>`;
}

// ─── McKinsey-report chrome ────────────────────────────────────────
//
// ReportHeader = serif title + standfirst + "AS OF" stamp + actions, on a
// heavy bottom rule. ExhibitFrame = the bordered card with an uppercase
// section title and a numbered "Exhibit N —" caption, mirroring the Sales
// CRM dashboard so the two surfaces read as one product family.
function ReportHeader({
  total,
  asOf,
  onExport,
  disabled,
}: {
  total: number;
  asOf: string;
  onExport: () => void;
  disabled: boolean;
}) {
  return (
    <div
      className={`
        border-foreground flex flex-wrap items-end justify-between gap-3
        border-b-2 pb-3
      `}
    >
      <div>
        <h1 className="text-foreground font-serif text-2xl leading-tight">
          IT CRM Intelligence
        </h1>
        <p
          className={`
            text-muted-foreground mt-1 flex flex-wrap items-center gap-2 text-xs
          `}
        >
          Delivery, flow &amp; support health across the IT CRM workspace
          <span
            className={`bg-muted-foreground/50 inline-block size-1 rounded-full`}
          />
          {total.toLocaleString()} projects
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
            {asOf}
          </div>
        </div>
        {/*
          "Back to list" lived here until the workspace strip above carried a
          Projects tab pointing at the same route.
        */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onExport}
            disabled={disabled}
          >
            <Download className="size-3.5" />
            Export
          </Button>
        </div>
      </div>
    </div>
  );
}

function ExhibitFrame({
  title,
  exhibit,
  note,
  className,
  children,
}: {
  title: string;
  exhibit?: string;
  note?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Card
      className={`
        gap-0 p-0
        ${className ?? ""}
      `}
    >
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

// Horizontal stacked RAG bar + legend. Pure CSS (no chart lib) so it stays
// crisp at any width and prints cleanly.
function HealthStrip({
  distribution,
}: {
  distribution: Array<{ health: string; count: number }>;
}) {
  const byKey = new Map(distribution.map((d) => [d.health, d.count]));
  const total = distribution.reduce((s, d) => s + d.count, 0);
  const segments = HEALTH_ORDER.map((k) => ({
    key: k,
    count: byKey.get(k) ?? 0,
  })).filter((s) => s.count > 0);

  if (total === 0) {
    return (
      <p className="text-muted-foreground py-6 text-center text-xs">
        No projects to rate yet.
      </p>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="bg-muted flex h-3 w-full overflow-hidden rounded-full">
        {segments.map((s) => (
          <div
            key={s.key}
            style={{
              width: `${(s.count / total) * 100}%`,
              backgroundColor: HEALTH_META[s.key].color,
            }}
            title={`${HEALTH_META[s.key].label}: ${s.count}`}
          />
        ))}
      </div>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {HEALTH_ORDER.map((k) => {
          const count = byKey.get(k) ?? 0;
          const pct = total ? Math.round((count / total) * 100) : 0;
          return (
            <div key={k} className="flex items-center gap-2">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: HEALTH_META[k].color }}
              />
              <span className="text-foreground text-xs font-medium">
                {HEALTH_META[k].label}
              </span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {count} · {pct}%
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Single SLA attainment tile — big serif %, tone-coloured progress bar,
// met/total caption.
function SlaTile({
  label,
  pct,
  met,
  total,
  hint,
}: {
  label: string;
  pct: number | null;
  met: number;
  total: number;
  hint: string;
}) {
  const tone = slaTone(pct);
  return (
    <div className="border-border bg-background/40 rounded-lg border p-4">
      <p
        className={`
          text-muted-foreground text-[11px] font-semibold tracking-[0.08em]
          uppercase
        `}
      >
        {label}
      </p>
      <p
        className="mt-1 font-serif text-[30px] leading-none tabular-nums"
        style={{ color: tone }}
      >
        {pct == null ? "—" : `${pct}%`}
      </p>
      <div className="bg-muted mt-3 h-1.5 w-full overflow-hidden rounded-full">
        <div
          className="h-full rounded-full"
          style={{ width: `${pct ?? 0}%`, backgroundColor: tone }}
        />
      </div>
      <p className="text-muted-foreground mt-2 text-[11px]">
        {total === 0 ? "No sample yet" : `${met}/${total} · ${hint}`}
      </p>
    </div>
  );
}

// Compact flow-KPI tile used in the second band. Mirrors StatCard's serif
// numeral but trimmed for the denser 6-up row.
function FlowKpi({
  label,
  value,
  hint,
  icon: Icon,
  tone = "primary",
}: {
  label: string;
  value: string;
  hint: string;
  icon: ComponentType<{ className?: string }>;
  tone?: "primary" | "info" | "success" | "warning";
}) {
  const toneClass: Record<string, string> = {
    primary: "bg-primary/12 text-primary",
    info: "bg-info/12 text-info",
    success: "bg-success/12 text-success",
    warning: "bg-warning/12 text-warning",
  };
  return (
    <Card className="border-border/80 bg-card/85 gap-0 rounded-xl px-4 py-3">
      <CardContent className="p-0">
        <div className="flex items-center justify-between gap-2">
          <p
            className={`
              text-muted-foreground text-[10px] font-semibold tracking-[0.08em]
              uppercase
            `}
          >
            {label}
          </p>
          <span
            className={`
              flex size-7 shrink-0 items-center justify-center rounded-lg
              ${toneClass[tone]}
            `}
          >
            <Icon className="size-3.5" />
          </span>
        </div>
        <p
          className={`
            text-foreground mt-1.5 font-serif text-[24px] leading-none
            tabular-nums
          `}
        >
          {value}
        </p>
        <p className="text-muted-foreground mt-1.5 text-[11px] leading-snug">
          {hint}
        </p>
      </CardContent>
    </Card>
  );
}

export default function ItCrmDashboardPage() {
  const [snapshot, setSnapshot] = useState<ItCrmDashboardSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);

  const fetchSnapshot = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getItCrmDashboard();
      setSnapshot(res.data);
      setLoadedAt(new Date());
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Failed to load dashboard";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchSnapshot();
  }, [fetchSnapshot]);

  const statusChartData = useMemo(
    () =>
      (snapshot?.byStatus ?? []).map((s) => ({
        name: projectStatusLabel(s.status),
        value: s.count,
      })),
    [snapshot],
  );
  const departmentChartData = useMemo(
    () =>
      (snapshot?.byDepartment ?? []).map((d) => ({
        name: d.department ?? "Unassigned",
        count: d.count,
      })),
    [snapshot],
  );
  const ownerChartData = useMemo(
    () =>
      (snapshot?.ownerWorkload ?? []).map((o) => ({
        name: o.ownerName,
        count: o.count,
      })),
    [snapshot],
  );
  const throughputChartData = useMemo(
    () =>
      (snapshot?.throughput ?? []).map((t) => ({
        month: formatMonth(t.month),
        count: t.count,
      })),
    [snapshot],
  );

  const handleExportHtml = useCallback(() => {
    if (!snapshot) return;
    const html = buildHtmlReport(snapshot, loadedAt ?? new Date());
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `it-crm-intelligence-report-${stamp}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }, [snapshot, loadedAt]);

  const asOf = (loadedAt ?? new Date()).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return (
    <div className="flex flex-col gap-5">
      {/*
        Heading first, then the strip — the same order as the other four
        surfaces. ReportHeader is this page's heading block (serif title,
        subtitle, 2px rule) and stands in for the PageHeader those pages use.
        The strip sat above it until this read as the one inconsistent surface
        in the workspace.
      */}
      <ReportHeader
        total={snapshot?.total ?? 0}
        asOf={asOf}
        onExport={handleExportHtml}
        disabled={loading || !snapshot}
      />

      {/*
        mb-0 because this page's column already supplies a gap-5; the strip's
        own mb-6 would stack on top of it and space this surface 44px where
        the others use 24px.
      */}
      <ItWorkspaceTabs className="mb-0" />

      {/* Report scope — McKinsey reports state their parameters rather than
          hide them behind controls; the analytic windows are fixed. */}
      <p
        className={`
          border-border bg-surface text-muted-foreground rounded-md border px-3
          py-2 text-[11px]
        `}
      >
        <span className="text-foreground font-semibold">Scope</span> · Portfolio
        — all IT CRM projects · Helpdesk — workspace-wide · Cycle-time window
        90d · Lead-time window 180d · SLA &amp; resolution sampled over 30d.
      </p>

      {/* KPI band — portfolio headline numbers. */}
      <div
        className={`
          grid gap-4
          md:grid-cols-5
        `}
      >
        {loading || !snapshot ? (
          Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-[124px] rounded-xl" />
          ))
        ) : (
          <>
            <StatCard
              label="Total"
              value={snapshot.total.toLocaleString()}
              change="Across the IT workspace"
              changeType="neutral"
              icon={Activity}
              accent="primary"
              href="/it-crm"
            />
            <StatCard
              label="In progress"
              value={snapshot.inProgress.toLocaleString()}
              change="Active rows"
              changeType="neutral"
              icon={Loader2}
              accent="info"
            />
            <StatCard
              label="Completed"
              value={snapshot.completed.toLocaleString()}
              change="Completed + Prod. Integrated"
              changeType="up"
              icon={CheckCircle2}
              accent="success"
            />
            <StatCard
              label="Production live"
              value={snapshot.productionLive.toLocaleString()}
              change="Has Production Live date"
              changeType="up"
              icon={Rocket}
              accent="success"
            />
            <StatCard
              label="At risk"
              value={snapshot.atRisk.toLocaleString()}
              change="Go-Live revised + still active"
              changeType={snapshot.atRisk > 0 ? "down" : "neutral"}
              icon={AlertTriangle}
              accent="warning"
            />
          </>
        )}
      </div>

      {/* Flow + SLA KPI band — the intelligence the old approximations
          couldn't reach. */}
      <div
        className={`
          grid gap-3
          md:grid-cols-3
          lg:grid-cols-6
        `}
      >
        {loading || !snapshot ? (
          Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-[104px] rounded-xl" />
          ))
        ) : (
          <>
            <FlowKpi
              label="Lead time"
              value={formatDays(snapshot.flow.leadTimeDays)}
              hint="Create → production-live"
              icon={Timer}
              tone="primary"
            />
            <FlowKpi
              label="Task cycle"
              value={formatDays(snapshot.flow.taskCycleDays)}
              hint="Create → done · 90d"
              icon={Gauge}
              tone="info"
            />
            <FlowKpi
              label="Avg in stage"
              value={formatDays(snapshot.flow.avgDaysInStage)}
              hint="Active work, current status"
              icon={Hourglass}
              tone="info"
            />
            <FlowKpi
              label="Avg slip"
              value={formatDays(snapshot.flow.slippage.avgSlipDays)}
              hint="Revised vs original go-live"
              icon={TrendingDown}
              tone="warning"
            />
            <FlowKpi
              label="Resolution SLA"
              value={formatPct(snapshot.sla.resolution.attainmentPct)}
              hint={`${snapshot.sla.resolution.met}/${snapshot.sla.resolution.total} within target`}
              icon={ShieldCheck}
              tone="success"
            />
            <FlowKpi
              label="First-fix rate"
              value={formatPct(snapshot.sla.firstFix.firstFixPct)}
              hint={`${snapshot.sla.firstFix.clean}/${snapshot.sla.firstFix.total} no reopen`}
              icon={RefreshCw}
              tone="primary"
            />
          </>
        )}
      </div>

      {snapshot ? (
        <DailyCatchupSection snapshot={snapshot} />
      ) : (
        <Skeleton className="h-[260px] rounded-xl" />
      )}

      {!snapshot ? (
        <div
          className={`
            grid gap-4
            md:grid-cols-2
          `}
        >
          <Skeleton className="h-[320px] rounded-xl" />
          <Skeleton className="h-[320px] rounded-xl" />
        </div>
      ) : (
        <>
          {/* Exhibits 1-2 — status mix + delivery throughput. */}
          <div
            className={`
              grid gap-4
              md:grid-cols-2
            `}
          >
            <ExhibitFrame
              title="Project status mix"
              exhibit="Exhibit 1 — Status distribution"
            >
              {statusChartData.length === 0 ? (
                <p className="text-muted-foreground py-12 text-center text-xs">
                  No status data yet.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                    >
                      {statusChartData.map((_, i) => (
                        <Cell
                          key={i}
                          fill={CHART_COLORS[i % CHART_COLORS.length]}
                        />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </ExhibitFrame>

            <ExhibitFrame
              title="Delivery throughput"
              exhibit="Exhibit 2 — Production go-lives, last 6 months"
            >
              {throughputChartData.length === 0 ? (
                <p className="text-muted-foreground py-12 text-center text-xs">
                  No projects went live in the last 6 months.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={260}>
                  <LineChart data={throughputChartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="count"
                      stroke="var(--color-primary)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </ExhibitFrame>
          </div>

          {/* Exhibit 3 — portfolio health RAG. */}
          <ExhibitFrame
            title="Portfolio health"
            exhibit="Exhibit 3 — RAG distribution across the portfolio"
            note={`${snapshot.total} projects`}
          >
            <HealthStrip distribution={snapshot.health.distribution} />
          </ExhibitFrame>

          {/* Exhibits 4-5 — workload by department + owner. */}
          <div
            className={`
              grid gap-4
              md:grid-cols-2
            `}
          >
            <ExhibitFrame
              title="Workload by department"
              exhibit="Exhibit 4 — Project count by department"
            >
              {departmentChartData.length === 0 ? (
                <p className="text-muted-foreground py-12 text-center text-xs">
                  No department data yet.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={departmentChartData}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="var(--color-info)" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ExhibitFrame>

            <ExhibitFrame
              title="Owner workload"
              exhibit="Exhibit 5 — Top 8 owners by project count"
            >
              {ownerChartData.length === 0 ? (
                <p className="text-muted-foreground py-12 text-center text-xs">
                  No owners yet.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={ownerChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis
                      type="number"
                      allowDecimals={false}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      width={100}
                    />
                    <Tooltip />
                    <Bar dataKey="count" fill="var(--color-success)" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </ExhibitFrame>
          </div>

          {/* Exhibit 6 — schedule slippage register. */}
          <ExhibitFrame
            title="Schedule slippage"
            exhibit="Exhibit 6 — Active projects with a pushed go-live"
            note={
              snapshot.flow.slippage.avgSlipDays == null
                ? "no slips"
                : `avg +${snapshot.flow.slippage.avgSlipDays}d`
            }
          >
            {snapshot.flow.slippage.projects.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-xs">
                No active projects have a revised go-live date.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr className="text-left">
                      <th className="py-2 pr-3 font-medium">Project</th>
                      <th className="py-2 pr-3 font-medium">Original</th>
                      <th className="py-2 pr-3 font-medium">Revised</th>
                      <th className="py-2 pr-3 text-right font-medium">Slip</th>
                      <th className="py-2 pr-3 font-medium">Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.flow.slippage.projects.map((p) => (
                      <tr key={p.id} className="border-border/40 border-t">
                        <td className="py-2 pr-3">
                          <Link
                            href={`/it-crm/${p.slug || p.id}`}
                            className="hover:underline"
                          >
                            {p.name}
                          </Link>
                        </td>
                        <td className="text-muted-foreground py-2 pr-3">
                          {formatDate(p.originalGoLive)}
                        </td>
                        <td className="py-2 pr-3">
                          {formatDate(p.revisedGoLive)}
                        </td>
                        <td
                          className={`
                            py-2 pr-3 text-right tabular-nums
                            ${
                              p.slipDays > 0
                                ? "text-destructive"
                                : p.slipDays < 0
                                  ? "text-success"
                                  : "text-muted-foreground"
                            }
                          `}
                        >
                          {p.slipDays > 0 ? "+" : ""}
                          {p.slipDays}d
                        </td>
                        <td className="text-muted-foreground py-2 pr-3">
                          {p.owner?.name ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ExhibitFrame>

          {/* Exhibit 7 — stage aging. */}
          <ExhibitFrame
            title="Stage aging"
            exhibit="Exhibit 7 — Most-stuck active work (days in current status)"
            note={
              snapshot.flow.avgDaysInStage == null
                ? "—"
                : `avg ${snapshot.flow.avgDaysInStage}d`
            }
          >
            {snapshot.flow.stageAgingOldest.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-xs">
                No active projects.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr className="text-left">
                      <th className="py-2 pr-3 font-medium">Project</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 pr-3 font-medium">Department</th>
                      <th className="py-2 pr-3 text-right font-medium">
                        Days in stage
                      </th>
                      <th className="py-2 pr-3 font-medium">Owner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.flow.stageAgingOldest.map((p) => (
                      <tr key={p.id} className="border-border/40 border-t">
                        <td className="py-2 pr-3">
                          <Link
                            href={`/it-crm/${p.slug || p.id}`}
                            className="hover:underline"
                          >
                            {p.name}
                          </Link>
                        </td>
                        <td className="py-2 pr-3">
                          {projectStatusLabel(p.status)}
                        </td>
                        <td className="text-muted-foreground py-2 pr-3">
                          {p.department ?? "—"}
                        </td>
                        <td
                          className={`
                            py-2 pr-3 text-right tabular-nums
                            ${
                              (p.daysInStage ?? 0) > 60
                                ? "text-destructive"
                                : (p.daysInStage ?? 0) > 30
                                  ? "text-warning"
                                  : ""
                            }
                          `}
                        >
                          {formatDays(p.daysInStage)}
                        </td>
                        <td className="text-muted-foreground py-2 pr-3">
                          {p.owner?.name ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ExhibitFrame>

          {/* Exhibit 8 — upcoming go-lives. */}
          <ExhibitFrame
            title="Upcoming go-lives"
            exhibit="Exhibit 8 — Scheduled go-lives, next 14 days"
          >
            {!snapshot.upcomingGoLives.length ? (
              <p className="text-muted-foreground py-6 text-center text-xs">
                No upcoming go-lives.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr className="text-left">
                      <th className="py-2 pr-3 font-medium">Project</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 pr-3 font-medium">Department</th>
                      <th className="py-2 pr-3 font-medium">Owner</th>
                      <th className="py-2 pr-3 font-medium">Go-live</th>
                      <th className="py-2 pr-3 font-medium">Dependency</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.upcomingGoLives.map((p) => (
                      <tr key={p.id} className="border-border/40 border-t">
                        <td className="py-2 pr-3">
                          <Link
                            href={`/it-crm/${p.slug || p.id}`}
                            className="hover:underline"
                          >
                            {p.name}
                          </Link>
                        </td>
                        <td className="py-2 pr-3">
                          {projectStatusLabel(p.status)}
                        </td>
                        <td className="py-2 pr-3">{p.department ?? "—"}</td>
                        <td className="py-2 pr-3">{p.owner?.name ?? "—"}</td>
                        <td className="py-2 pr-3">
                          {formatDate(p.goLiveDate)}
                        </td>
                        <td className="text-muted-foreground py-2 pr-3">
                          {p.dependency ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ExhibitFrame>

          {/* Exhibit 9 — risk register: blocked / commented. */}
          <ExhibitFrame
            title="Risk register"
            exhibit="Exhibit 9 — Blocked or commented active projects"
          >
            {!snapshot.blockedProjects.length ? (
              <p className="text-muted-foreground py-6 text-center text-xs">
                No active blockers.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr className="text-left">
                      <th className="py-2 pr-3 font-medium">Project</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 pr-3 font-medium">Owner</th>
                      <th className="py-2 pr-3 font-medium">Dependency</th>
                      <th className="py-2 pr-3 font-medium">Comment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.blockedProjects.map((p) => (
                      <tr key={p.id} className="border-border/40 border-t">
                        <td className="py-2 pr-3">
                          <Link
                            href={`/it-crm/${p.slug || p.id}`}
                            className="hover:underline"
                          >
                            {p.name}
                          </Link>
                        </td>
                        <td className="py-2 pr-3">
                          {projectStatusLabel(p.status)}
                        </td>
                        <td className="py-2 pr-3">{p.owner?.name ?? "—"}</td>
                        <td className="text-muted-foreground py-2 pr-3">
                          {p.dependency ? (
                            <span className="line-clamp-2 max-w-[200px]">
                              {p.dependency}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="text-muted-foreground py-2 pr-3">
                          {p.comment ? (
                            <span className="line-clamp-2 max-w-[280px]">
                              {p.comment}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ExhibitFrame>

          {/* Exhibit 10 — recently updated. */}
          <ExhibitFrame
            title="Recently updated"
            exhibit="Exhibit 10 — Activity in the last 7 days"
          >
            {!snapshot.recentUpdates.length ? (
              <p className="text-muted-foreground py-6 text-center text-xs">
                No recent updates.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr className="text-left">
                      <th className="py-2 pr-3 font-medium">Project</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 pr-3 font-medium">Owner</th>
                      <th className="py-2 pr-3 font-medium">Updated</th>
                      <th className="py-2 pr-3 font-medium">Comment</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.recentUpdates.map((p) => (
                      <tr key={p.id} className="border-border/40 border-t">
                        <td className="py-2 pr-3">
                          <Link
                            href={`/it-crm/${p.slug || p.id}`}
                            className="hover:underline"
                          >
                            {p.name}
                          </Link>
                        </td>
                        <td className="py-2 pr-3">
                          {projectStatusLabel(p.status)}
                        </td>
                        <td className="py-2 pr-3">{p.owner?.name ?? "—"}</td>
                        <td className="py-2 pr-3">{formatDate(p.updatedAt)}</td>
                        <td className="text-muted-foreground py-2 pr-3">
                          {p.comment ? (
                            <span className="line-clamp-2 max-w-[280px]">
                              {p.comment}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ExhibitFrame>

          {/* Exhibit 11 — execution: tasks & subtasks. */}
          <ExhibitFrame
            title="Execution"
            exhibit="Exhibit 11 — Tasks & subtasks · overdue detail"
          >
            <div
              className={`
                mb-4 grid grid-cols-2 gap-2
                md:grid-cols-5
              `}
            >
              {[
                { label: "Total tasks", value: snapshot.tasks.total },
                { label: "Subtasks", value: snapshot.tasks.subtasks },
                { label: "In progress", value: snapshot.tasks.inProgress },
                { label: "Done", value: snapshot.tasks.done },
                { label: "Overdue", value: snapshot.tasks.overdue },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className={`
                    border-border/60 bg-card/60 rounded-md border px-3 py-2
                  `}
                >
                  <p
                    className={`
                      text-muted-foreground text-[10px] font-semibold
                      tracking-[0.08em] uppercase
                    `}
                  >
                    {stat.label}
                  </p>
                  <p className="text-foreground text-lg tabular-nums">
                    {stat.value.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
            {snapshot.tasks.overdueList.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-xs">
                No overdue tasks or subtasks.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="text-muted-foreground">
                    <tr className="text-left">
                      <th className="py-2 pr-3 font-medium">Task</th>
                      <th className="py-2 pr-3 font-medium">Project</th>
                      <th className="py-2 pr-3 font-medium">Status</th>
                      <th className="py-2 pr-3 font-medium">Owner</th>
                      <th className="py-2 pr-3 font-medium">Due</th>
                      <th className="py-2 pr-3 font-medium">Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.tasks.overdueList.map((t) => (
                      <tr key={t.id} className="border-border/40 border-t">
                        <td className="py-2 pr-3">{t.title}</td>
                        <td className="py-2 pr-3">
                          <Link
                            href={`/it-crm/${t.project.slug || t.project.id}`}
                            className="hover:underline"
                          >
                            {t.project.name}
                          </Link>
                        </td>
                        <td className="py-2 pr-3">
                          {projectStatusLabel(t.status)}
                        </td>
                        <td className="py-2 pr-3">{t.owner?.name ?? "—"}</td>
                        <td className="text-destructive py-2 pr-3">
                          {formatDate(t.endDate)}
                        </td>
                        <td className="text-muted-foreground py-2 pr-3">
                          {t.isSubtask ? "Subtask" : "Task"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </ExhibitFrame>

          <HelpdeskInsightsSection snapshot={snapshot} />
        </>
      )}
    </div>
  );
}

// ─── Daily Catchup ─────────────────────────────────────────────────
//
// Three-column standup card layout: yesterday's wins, what's actively
// moving today, and the next things to chase. All three lists are
// already in the dashboard payload — this section just frames them
// for the management standup view.
function DailyCatchupSection({
  snapshot,
}: {
  snapshot: ItCrmDashboardSnapshot;
}) {
  const { yesterdayDone, todayInProgress, nextSteps } = snapshot.dailyCatchup;
  const yesterdayItems = [
    ...yesterdayDone.projects.map((p) => ({
      id: p.id,
      label: p.name,
      hint: p.owner?.name ?? p.department ?? "—",
      kind: "project" as const,
    })),
    ...yesterdayDone.tasks.map((t) => ({
      id: t.id,
      label: t.title,
      hint: `${t.project.name}${t.owner ? ` · ${t.owner.name}` : ""}`,
      kind: "task" as const,
    })),
  ];

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <CalendarCheck className="text-primary size-4" />
        <h2 className="text-foreground text-sm font-semibold">Daily catchup</h2>
        <span className="text-muted-foreground text-[11px]">
          What shipped yesterday · what&apos;s in flight today · what&apos;s
          next
        </span>
      </div>
      <div
        className={`
          grid gap-4
          md:grid-cols-3
        `}
      >
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className={`flex items-center gap-2 text-sm`}>
              <CheckCircle2 className="text-success size-3.5" />
              Yesterday — Done
              <span className="text-muted-foreground ml-auto text-[11px]">
                {yesterdayItems.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {yesterdayItems.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-xs">
                Nothing recorded as done yesterday.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {yesterdayItems.slice(0, 8).map((i) => (
                  <li
                    key={`${i.kind}-${i.id}`}
                    className={`
                      border-border bg-background/30 flex items-start gap-2
                      rounded-md border px-2 py-1.5
                    `}
                  >
                    <span
                      className={`
                        mt-1 size-1.5 shrink-0 rounded-full
                        ${i.kind === "project" ? "bg-success" : "bg-info"}
                      `}
                    />
                    <div className="min-w-0">
                      <p
                        className={`
                          text-foreground truncate text-xs font-medium
                        `}
                      >
                        {i.label}
                      </p>
                      <p className="text-muted-foreground truncate text-[10px]">
                        {i.kind === "project" ? "Project" : "Task"} · {i.hint}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className={`flex items-center gap-2 text-sm`}>
              <Loader2 className="text-info size-3.5" />
              Today — In progress
              <span className="text-muted-foreground ml-auto text-[11px]">
                {todayInProgress.tasks.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {todayInProgress.tasks.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-xs">
                No tasks moved into in-progress today yet.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {todayInProgress.tasks.slice(0, 8).map((t) => (
                  <li
                    key={t.id}
                    className={`
                      border-border bg-background/30 flex items-start gap-2
                      rounded-md border px-2 py-1.5
                    `}
                  >
                    <Activity className={`text-info mt-0.5 size-3 shrink-0`} />
                    <div className="min-w-0">
                      <p
                        className={`
                          text-foreground truncate text-xs font-medium
                        `}
                      >
                        {t.title}
                      </p>
                      <p className="text-muted-foreground truncate text-[10px]">
                        {t.project.name}
                        {t.owner ? ` · ${t.owner.name}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className={`flex items-center gap-2 text-sm`}>
              <Rocket className="text-warning size-3.5" />
              Next steps
              <span className="text-muted-foreground ml-auto text-[11px]">
                {nextSteps.upcomingGoLives.length +
                  nextSteps.overdueTasks.length}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {nextSteps.upcomingGoLives.length === 0 &&
            nextSteps.overdueTasks.length === 0 ? (
              <p className="text-muted-foreground py-6 text-center text-xs">
                No upcoming go-lives or overdue tasks.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {nextSteps.upcomingGoLives.map((g) => (
                  <li
                    key={`go-${g.id}`}
                    className={`
                      border-border bg-background/30 flex items-start gap-2
                      rounded-md border px-2 py-1.5
                    `}
                  >
                    <Rocket className={`text-warning mt-0.5 size-3 shrink-0`} />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`
                          text-foreground truncate text-xs font-medium
                        `}
                      >
                        {g.name}
                      </p>
                      <p className="text-muted-foreground truncate text-[10px]">
                        Go-live {formatDate(g.goLiveDate)}
                        {g.owner ? ` · ${g.owner.name}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
                {nextSteps.overdueTasks.map((t) => (
                  <li
                    key={`od-${t.id}`}
                    className={`
                      border-border bg-background/30 flex items-start gap-2
                      rounded-md border px-2 py-1.5
                    `}
                  >
                    <AlertTriangle
                      className={`text-destructive mt-0.5 size-3 shrink-0`}
                    />
                    <div className="min-w-0 flex-1">
                      <p
                        className={`
                          text-foreground truncate text-xs font-medium
                        `}
                      >
                        {t.title}
                      </p>
                      <p className="text-muted-foreground truncate text-[10px]">
                        Due {formatDate(t.endDate)} · {t.project.name}
                        {t.owner ? ` · ${t.owner.name}` : ""}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Helpdesk Insights ─────────────────────────────────────────────
//
// IT support service intelligence: SLA attainment exhibit first, then the
// existing volume / resolution / queue views. Everything resolves off
// snapshot.helpdesk + snapshot.sla so no extra round trip.
function HelpdeskInsightsSection({
  snapshot,
}: {
  snapshot: ItCrmDashboardSnapshot;
}) {
  const h = snapshot.helpdesk;
  const sla = snapshot.sla;
  const dailyChartData = h.dailySeries.map((d) => ({
    day: formatDayShort(d.day),
    Created: d.created,
    Resolved: d.resolved,
  }));
  const priorityChartData = h.byPriority.map((p) => ({
    name: HELPDESK_PRIORITY_LABELS[p.priority] ?? p.priority,
    value: p.count,
    priority: p.priority,
  }));
  const categoryChartData = h.byCategory.map((c) => ({
    name: HELPDESK_CATEGORY_LABELS[c.category] ?? c.category,
    count: c.count,
  }));
  // Priority palette anchored on intent — destructive for urgent,
  // warning for high, brand primary for medium, muted for low. Keeps
  // the donut readable without legend hunting.
  const PRIORITY_COLOR: Record<string, string> = {
    urgent: "var(--color-destructive)",
    high: "var(--color-warning)",
    medium: "var(--color-primary)",
    low: "var(--color-muted-foreground)",
  };

  function deltaTone(
    today: number,
    yesterday: number,
  ): "up" | "down" | "neutral" {
    if (today === yesterday) return "neutral";
    return today > yesterday ? "up" : "down";
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2 pt-1">
        <HelpCircle className="text-primary size-4" />
        <h2 className="text-foreground text-sm font-semibold">
          IT Helpdesk — service intelligence
        </h2>
        <span className="text-muted-foreground text-[11px]">
          SLA attainment · ticket volume · resolution time · open queue
        </span>
      </div>

      {/* Exhibit 12 — SLA attainment. */}
      <ExhibitFrame
        title="Helpdesk SLA attainment"
        exhibit="Exhibit 12 — Response, resolution & first-fix vs target (30d)"
      >
        <div
          className={`
            grid gap-4
            sm:grid-cols-3
          `}
        >
          <SlaTile
            label="Response SLA"
            pct={sla.response.attainmentPct}
            met={sla.response.met}
            total={sla.response.total}
            hint="first reply in target"
          />
          <SlaTile
            label="Resolution SLA"
            pct={sla.resolution.attainmentPct}
            met={sla.resolution.met}
            total={sla.resolution.total}
            hint="resolved in target"
          />
          <SlaTile
            label="First-fix rate"
            pct={sla.firstFix.firstFixPct}
            met={sla.firstFix.clean}
            total={sla.firstFix.total}
            hint="no reopen after resolve"
          />
        </div>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="text-left">
                <th className="py-2 pr-3 font-medium">Priority</th>
                <th className="py-2 pr-3 text-right font-medium">
                  Response target
                </th>
                <th className="py-2 pr-3 text-right font-medium">
                  Resolution target
                </th>
              </tr>
            </thead>
            <tbody>
              {(["urgent", "high", "medium", "low"] as const).map((p) => {
                const t = sla.targets[p];
                return (
                  <tr key={p} className="border-border/40 border-t">
                    <td className="flex items-center gap-2 py-2 pr-3">
                      <span
                        className="size-2 rounded-full"
                        style={{ backgroundColor: PRIORITY_COLOR[p] }}
                      />
                      {HELPDESK_PRIORITY_LABELS[p]}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {t ? `${t.response}h` : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {t ? `${t.resolution}h` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ExhibitFrame>

      {/* KPI strip — created today / yesterday / this week, open,
          high-priority open, avg resolution. */}
      <div
        className={`
          grid gap-4
          md:grid-cols-3
          lg:grid-cols-6
        `}
      >
        <StatCard
          label="Created today"
          value={h.created.today.toLocaleString()}
          change={`vs ${h.created.yesterday} yesterday`}
          changeType={deltaTone(h.created.today, h.created.yesterday)}
          icon={TicketCheck}
          accent="primary"
        />
        <StatCard
          label="Created yesterday"
          value={h.created.yesterday.toLocaleString()}
          change="Previous calendar day"
          changeType="neutral"
          icon={CalendarCheck}
          accent="info"
        />
        <StatCard
          label="Created this week"
          value={h.created.thisWeek.toLocaleString()}
          change="Mon → today"
          changeType="neutral"
          icon={TrendingUp}
          accent="info"
        />
        <StatCard
          label="Open"
          value={h.open.toLocaleString()}
          change={`${h.openHighPriority} high / urgent`}
          changeType={h.openHighPriority > 0 ? "down" : "neutral"}
          icon={ShieldAlert}
          accent={h.openHighPriority > 0 ? "warning" : "primary"}
        />
        <StatCard
          label="Resolved this week"
          value={h.resolved.thisWeek.toLocaleString()}
          change={`${h.resolved.today} today · ${h.resolved.yesterday} yesterday`}
          changeType="up"
          icon={ShieldCheck}
          accent="success"
        />
        <StatCard
          label="Avg resolution"
          value={
            h.avgResolutionHours == null ? "—" : formatAge(h.avgResolutionHours)
          }
          change="Rolling 30 days"
          changeType="neutral"
          icon={Timer}
          accent="primary"
        />
      </div>

      {/* Created vs Resolved 7-day series + priority donut row. */}
      <div
        className={`
          grid gap-4
          lg:grid-cols-3
        `}
      >
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Created vs resolved · last 7 days
            </CardTitle>
          </CardHeader>
          <CardContent>
            {dailyChartData.every(
              (d) => d.Created === 0 && d.Resolved === 0,
            ) ? (
              <p className="text-muted-foreground py-12 text-center text-xs">
                No ticket activity in the last 7 days.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={dailyChartData}>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                  />
                  <XAxis
                    dataKey="day"
                    fontSize={11}
                    stroke="var(--color-muted-foreground)"
                  />
                  <YAxis
                    allowDecimals={false}
                    fontSize={11}
                    stroke="var(--color-muted-foreground)"
                  />
                  <Tooltip
                    cursor={{ fill: "var(--color-muted)" }}
                    contentStyle={{
                      backgroundColor: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="Created"
                    fill="var(--color-primary)"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar
                    dataKey="Resolved"
                    fill="var(--color-success)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">By priority</CardTitle>
          </CardHeader>
          <CardContent>
            {priorityChartData.length === 0 ? (
              <p className="text-muted-foreground py-12 text-center text-xs">
                No tickets yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie
                    data={priorityChartData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {priorityChartData.map((d) => (
                      <Cell
                        key={d.priority}
                        fill={
                          PRIORITY_COLOR[d.priority] ?? "var(--color-primary)"
                        }
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* By category bar + avg resolution comparison table. */}
      <div
        className={`
          grid gap-4
          lg:grid-cols-3
        `}
      >
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">By category</CardTitle>
          </CardHeader>
          <CardContent>
            {categoryChartData.length === 0 ? (
              <p className="text-muted-foreground py-12 text-center text-xs">
                No tickets yet.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={categoryChartData} layout="vertical">
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="var(--color-border)"
                  />
                  <XAxis
                    type="number"
                    allowDecimals={false}
                    fontSize={11}
                    stroke="var(--color-muted-foreground)"
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={130}
                    fontSize={11}
                    stroke="var(--color-muted-foreground)"
                  />
                  <Tooltip
                    cursor={{ fill: "var(--color-muted)" }}
                    contentStyle={{
                      backgroundColor: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="var(--color-primary)"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Avg resolution · by priority
            </CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="border-border text-muted-foreground border-b">
                  <th className="py-2 text-left font-medium">Priority</th>
                  <th className="py-2 text-right font-medium">Avg time</th>
                </tr>
              </thead>
              <tbody>
                {(["urgent", "high", "medium", "low"] as const).map((p) => {
                  const hours = h.avgResolutionHoursByPriority?.[p] ?? null;
                  return (
                    <tr
                      key={p}
                      className={`
                        border-border/50 border-b
                        last:border-0
                      `}
                    >
                      <td className="flex items-center gap-2 py-2">
                        <span
                          className="size-2 rounded-full"
                          style={{ backgroundColor: PRIORITY_COLOR[p] }}
                        />
                        {HELPDESK_PRIORITY_LABELS[p]}
                      </td>
                      <td
                        className={`
                          py-2 text-right tabular-nums
                          ${hours == null ? "text-muted-foreground" : ""}
                        `}
                      >
                        {hours == null ? "No data" : formatAge(hours)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Open ticket spotlight — oldest first within priority. */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">
            Open ticket spotlight
            <span className="text-muted-foreground ml-2 text-[11px] font-normal">
              Top 8 by priority + age
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {h.openSpotlight.length === 0 ? (
            <p className="text-muted-foreground py-6 text-center text-xs">
              No open tickets. Inbox zero.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-border text-muted-foreground border-b">
                    <th className="py-2 pr-3 text-left font-medium">#</th>
                    <th className="py-2 pr-3 text-left font-medium">Title</th>
                    <th className="py-2 pr-3 text-left font-medium">
                      Priority
                    </th>
                    <th className="py-2 pr-3 text-left font-medium">
                      Category
                    </th>
                    <th className="py-2 pr-3 text-left font-medium">
                      Assignee
                    </th>
                    <th className="py-2 pr-3 text-right font-medium">Age</th>
                    <th className="py-2 text-left font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {h.openSpotlight.map((t) => (
                    <tr
                      key={t.id}
                      className={`
                        border-border/50 border-b
                        hover:bg-muted/40
                        last:border-0
                      `}
                    >
                      <td
                        className={`
                          text-muted-foreground py-2 pr-3 tabular-nums
                        `}
                      >
                        #{t.ticketNumber}
                      </td>
                      <td
                        className={`
                          text-foreground max-w-[280px] truncate py-2 pr-3
                        `}
                      >
                        {t.title}
                      </td>
                      <td className="py-2 pr-3">
                        <span
                          className={`
                            rounded-full px-2 py-0.5 text-[10px] font-medium
                            text-white
                          `}
                          style={{
                            backgroundColor:
                              PRIORITY_COLOR[t.priority] ??
                              "var(--color-muted-foreground)",
                          }}
                        >
                          {HELPDESK_PRIORITY_LABELS[t.priority] ?? t.priority}
                        </span>
                      </td>
                      <td className="text-muted-foreground py-2 pr-3">
                        {HELPDESK_CATEGORY_LABELS[t.category] ?? t.category}
                      </td>
                      <td className="text-muted-foreground py-2 pr-3">
                        {t.assignee?.name ?? "—"}
                      </td>
                      <td
                        className={`
                          py-2 pr-3 text-right tabular-nums
                          ${t.ageHours > 48 ? "text-warning" : ""}
                          ${t.ageHours > 120 ? "text-destructive" : ""}
                        `}
                      >
                        {formatAge(t.ageHours)}
                      </td>
                      <td className="text-muted-foreground py-2">
                        {HELPDESK_STATUS_LABELS[t.status] ?? t.status}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-start gap-2 pt-1">
        <Clock className="text-muted-foreground mt-0.5 size-3" />
        <p className="text-muted-foreground text-[10px]">
          SLA attainment + avg resolution sampled over the last 30 days.
          &ldquo;Today / yesterday / this week&rdquo; align with the local
          calendar; week starts Monday.
        </p>
      </div>
    </div>
  );
}
