"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FolderKanban,
  Loader2,
  Rocket,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { StatCard } from "@/components/dashboard/stat-card";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api-client";
import {
  getProjectsDashboard,
  type ProjectDashboardSnapshot,
  projectStatusLabel,
} from "@/services/project.service";

// Recharts palette anchored to the live brand tokens so the bars /
// slices match the rest of the intranet without inlining hex codes.
// Cycled by index so adding a status / department row stays
// zero-config.
const CHART_COLORS = [
  "var(--color-primary)",
  "var(--color-info)",
  "var(--color-success)",
  "var(--color-warning)",
  "var(--color-destructive)",
  "var(--color-accent)",
  "var(--color-muted-foreground)",
];

function formatGoLive(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Build a self-contained HTML snapshot of the dashboard for sharing
// with management. Inline CSS keeps the file portable (email, Drive,
// Notion attachment); no external assets, no JS. Mirrors the on-screen
// sections so a recipient seeing the file can read the same story.
function buildDashboardHtml(
  snapshot: ProjectDashboardSnapshot,
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
  const upcomingRows = snapshot.upcomingGoLives
    .map(
      (p) => `
        <tr>
          <td>${escapeHtml(p.name)}</td>
          <td>${escapeHtml(projectStatusLabel(p.status))}</td>
          <td>${escapeHtml(p.department ?? "—")}</td>
          <td>${escapeHtml(p.owner?.name ?? "—")}</td>
          <td>${escapeHtml(formatGoLive(p.goLiveDate))}</td>
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
          <td>${escapeHtml(formatGoLive(p.updatedAt))}</td>
          <td>${escapeHtml(p.comment ?? "")}</td>
        </tr>
      `,
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Project CRM Dashboard — ${escapeHtml(stamp)}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; margin: 0; padding: 32px; background: #faf7f1; color: #2a2520; }
  h1 { font-family: Georgia, serif; font-size: 28px; margin: 0 0 4px; }
  .subtitle { color: #7a7166; font-size: 13px; margin-bottom: 24px; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px; }
  .kpi { background: #fff; border: 1px solid #ece4d4; border-radius: 12px; padding: 14px 16px; }
  .kpi .label { color: #7a7166; font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600; margin-bottom: 6px; }
  .kpi .value { font-family: Georgia, serif; font-size: 26px; }
  section { background: #fff; border: 1px solid #ece4d4; border-radius: 12px; padding: 18px 20px; margin-bottom: 18px; }
  section h2 { font-size: 13px; text-transform: uppercase; letter-spacing: 0.08em; color: #7a7166; margin: 0 0 12px; }
  table { width: 100%; border-collapse: collapse; font-size: 12.5px; }
  th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #f1ead9; }
  th { font-weight: 600; color: #7a7166; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 18px; }
  @media (max-width: 760px) {
    .kpis, .two-col { grid-template-columns: 1fr 1fr; }
  }
</style>
</head>
<body>
<h1>Project CRM Dashboard</h1>
<p class="subtitle">Generated ${escapeHtml(stamp)} · Source: intranet.manut.example</p>

<div class="kpis">
  <div class="kpi"><div class="label">Total projects</div><div class="value">${snapshot.total}</div></div>
  <div class="kpi"><div class="label">In progress</div><div class="value">${snapshot.inProgress}</div></div>
  <div class="kpi"><div class="label">Production live</div><div class="value">${snapshot.productionLive}</div></div>
  <div class="kpi"><div class="label">At risk</div><div class="value">${snapshot.atRisk}</div></div>
</div>

<div class="two-col">
  <section>
    <h2>By status</h2>
    <table><thead><tr><th>Status</th><th style="text-align:right">Count</th></tr></thead><tbody>${statusRows || '<tr><td colspan="2">—</td></tr>'}</tbody></table>
  </section>
  <section>
    <h2>By department</h2>
    <table><thead><tr><th>Department</th><th style="text-align:right">Count</th></tr></thead><tbody>${departmentRows || '<tr><td colspan="2">—</td></tr>'}</tbody></table>
  </section>
</div>

<section>
  <h2>Upcoming go-lives (next 14 days)</h2>
  <table><thead><tr><th>Project</th><th>Status</th><th>Department</th><th>Owner</th><th>Go-live</th></tr></thead><tbody>${upcomingRows || '<tr><td colspan="5">No upcoming go-lives.</td></tr>'}</tbody></table>
</section>

<section>
  <h2>Recently updated (last 7 days)</h2>
  <table><thead><tr><th>Project</th><th>Status</th><th>Owner</th><th>Updated</th><th>Comment</th></tr></thead><tbody>${recentRows || '<tr><td colspan="5">No recent updates.</td></tr>'}</tbody></table>
</section>
</body>
</html>`;
}

export default function ProjectsDashboardPage() {
  const [snapshot, setSnapshot] = useState<ProjectDashboardSnapshot | null>(
    null,
  );
  const [loading, setLoading] = useState(true);

  const fetchSnapshot = useCallback(async () => {
    try {
      setLoading(true);
      const res = await getProjectsDashboard("general");
      setSnapshot(res.data);
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

  function handleExportHtml() {
    if (!snapshot) return;
    const html = buildDashboardHtml(snapshot, new Date());
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const stamp = new Date().toISOString().slice(0, 10);
    a.download = `project-crm-dashboard-${stamp}.html`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <PageHeader
        title="Project Dashboard"
        subtitle="Snapshot of the Project CRM workspace for the management team"
      >
        <Button asChild variant="ghost" size="sm">
          <Link href="/projects">Back to list</Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportHtml}
          disabled={loading || !snapshot}
        >
          <Download className="size-3.5" />
          Export HTML
        </Button>
      </PageHeader>

      <div className="flex flex-col gap-4">
        <div
          className={`
            grid gap-4
            md:grid-cols-4
          `}
        >
          {loading || !snapshot ? (
            Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[112px] rounded-xl" />
            ))
          ) : (
            <>
              <StatCard
                label="Total projects"
                value={snapshot.total.toLocaleString()}
                change="Across the BD workspace"
                changeType="neutral"
                icon={FolderKanban}
                accent="primary"
                href="/projects"
              />
              <StatCard
                label="In progress"
                value={snapshot.inProgress.toLocaleString()}
                change="Active rows in this team"
                changeType="neutral"
                icon={Loader2}
                accent="info"
              />
              <StatCard
                label="Production live"
                value={snapshot.productionLive.toLocaleString()}
                change="Projects with a Production Live date"
                changeType="up"
                icon={Rocket}
                accent="success"
              />
              <StatCard
                label="At risk"
                value={snapshot.atRisk.toLocaleString()}
                change="Go-Live revised + not yet done"
                changeType={snapshot.atRisk > 0 ? "down" : "neutral"}
                icon={AlertTriangle}
                accent="warning"
              />
            </>
          )}
        </div>

        <div
          className={`
            grid gap-4
            md:grid-cols-2
          `}
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">By status</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[240px] w-full rounded-md" />
              ) : statusChartData.length === 0 ? (
                <p className="text-muted-foreground py-12 text-center text-xs">
                  No status data yet.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <PieChart>
                    <Pie
                      data={statusChartData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={95}
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">By department</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <Skeleton className="h-[240px] w-full rounded-md" />
              ) : departmentChartData.length === 0 ? (
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
                    <Bar dataKey="count" fill="var(--color-primary)" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Upcoming go-lives (next 14 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[160px] w-full" />
            ) : !snapshot?.upcomingGoLives.length ? (
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
                    </tr>
                  </thead>
                  <tbody>
                    {snapshot.upcomingGoLives.map((p) => (
                      <tr key={p.id} className="border-border/40 border-t">
                        <td className="py-2 pr-3">
                          <Link
                            href={`/projects/${p.slug || p.id}`}
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
                          {formatGoLive(p.goLiveDate)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              Recently updated (last 7 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-[160px] w-full" />
            ) : !snapshot?.recentUpdates.length ? (
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
                            href={`/projects/${p.slug || p.id}`}
                            className="hover:underline"
                          >
                            {p.name}
                          </Link>
                        </td>
                        <td className="py-2 pr-3">
                          {projectStatusLabel(p.status)}
                        </td>
                        <td className="py-2 pr-3">{p.owner?.name ?? "—"}</td>
                        <td className="py-2 pr-3">
                          {formatGoLive(p.updatedAt)}
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
          </CardContent>
        </Card>

        {!loading ? (
          <CheckCircle2
            className="text-muted-foreground/40 mx-auto size-3"
            aria-hidden
          />
        ) : null}
      </div>
    </div>
  );
}
