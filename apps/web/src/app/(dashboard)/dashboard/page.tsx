"use client";

import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  CalendarClock,
  CalendarDays,
  FolderKanban,
  MapPin,
  MessageSquare,
  Newspaper,
  Plus,
  Receipt,
  TrendingUp,
  Users,
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
  XAxis,
  YAxis,
} from "recharts";
import { toast } from "sonner";

import { BirthdayComingSoonWidget } from "@/components/dashboard/birthday-coming-soon-widget";
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton";
import {
  deptConfig,
  formatCurrency,
  formatDate,
  formatMonthLabel,
  projectStatusConfig,
  revenueConfig,
  STATUS_COLORS,
  timeAgo,
} from "@/components/dashboard/dashboard-utils";
import {
  CompanyDateComposeDialog,
  NewsComposeDialog,
  WallPostComposeDialog,
} from "@/components/dashboard/home-compose-dialogs";
import { DashboardQuickActions } from "@/components/dashboard/quick-actions";
import { SectionCard } from "@/components/dashboard/section-card";
import { StatCard } from "@/components/dashboard/stat-card";
import { Avatar } from "@/components/shared/avatar";
import { Badge } from "@/components/shared/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/providers/auth-provider";
import {
  type DashboardStats,
  getDashboardStats,
} from "@/services/dashboard.service";

export default function DashboardPage() {
  const { user, hasAnyPermission } = useAuth();

  const canViewLeave = hasAnyPermission(
    "leave:read",
    "leave:approve",
    "leave:hr-read",
  );
  const canViewTravel = hasAnyPermission(
    "travel:read",
    "travel:approve",
    "travel:hr-read",
  );
  const canViewExpense = hasAnyPermission(
    "expense:read",
    "expense:approve",
    "expense:hr-read",
  );
  const canViewProjects = hasAnyPermission("projects:read");
  const canViewEmployees = hasAnyPermission("user:read");

  // Inline-compose gates for the three home-page sections. Each maps to
  // the create permission on the underlying module so HR / admin can
  // add a wall post / news headline / calendar date without leaving the
  // dashboard.
  const canCreateWallPost = hasAnyPermission("wall:create");
  const canCreateNews = hasAnyPermission("news:create");
  const canCreateCompanyDate = hasAnyPermission("admin:manage");

  const [wallComposeOpen, setWallComposeOpen] = useState(false);
  const [newsComposeOpen, setNewsComposeOpen] = useState(false);
  const [dateComposeOpen, setDateComposeOpen] = useState(false);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await getDashboardStats();
      setStats(res.data);
    } catch {
      toast.error("Failed to load dashboard data");
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStats();
  }, [fetchStats]);

  // `new Date()` during SSR uses the server's clock/timezone and would
  // mismatch the browser on hydration ("Text content does not match").
  // Server and the first client render both show the fallback; the real
  // date/greeting fill in post-mount.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => setNow(new Date()), []);

  const today = now
    ? now.toLocaleDateString("en-US", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "";

  const greeting = !now
    ? "Hello"
    : now.getHours() < 12
      ? "Good morning"
      : now.getHours() < 18
        ? "Good afternoon"
        : "Good evening";

  const firstName = useMemo(() => {
    const n = user?.name?.trim();
    if (!n) return "there";
    return n.split(/\s+/)[0] ?? "there";
  }, [user?.name]);

  if (loading) {
    return (
      <div className="w-full space-y-8 pb-10">
        <PageHeader
          title="Dashboard"
          subtitle={`${today} · Loading your workspace snapshot`}
        />
        <DashboardSkeleton />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="w-full space-y-8 pb-10">
        <PageHeader title="Dashboard" subtitle={today} />
        <Card
          className={`
            border-border/80 bg-card/90 flex flex-col items-center
            justify-center rounded-xl border border-dashed py-16 shadow-sm
            backdrop-blur-sm
          `}
        >
          <div
            className={`
              bg-destructive/10 text-destructive mb-4 flex size-14 items-center
              justify-center rounded-2xl
            `}
          >
            <AlertTriangle className="size-7" aria-hidden />
          </div>
          <p className="text-foreground text-center text-sm font-medium">
            Unable to load dashboard data
          </p>
          <p
            className={`
              text-muted-foreground mt-1 max-w-sm px-6 text-center text-xs
              leading-relaxed
            `}
          >
            Check your connection or try again. If the problem continues,
            contact an administrator.
          </p>
          <Button
            variant="default"
            className="mt-6"
            onClick={() => void fetchStats()}
          >
            Try again
          </Button>
        </Card>
      </div>
    );
  }

  const { kpis } = stats;

  const chartData = stats.expenseSummary.map((item) => ({
    month: formatMonthLabel(item.month),
    expenses: Math.round(item.expenses / 1000),
  }));

  const projectPieData = stats.projectStatusBreakdown.map((p) => ({
    name: p.status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    value: p.count,
    color: STATUS_COLORS[p.status] ?? "hsl(var(--muted-foreground))",
  }));

  const deptData = stats.employeesByDepartment
    .sort((a, b) => b.count - a.count)
    .slice(0, 7)
    .map((d) => ({
      dept:
        d.department.length > 8 ? d.department.slice(0, 7) + "." : d.department,
      count: d.count,
    }));

  return (
    <div className="w-full space-y-8 pb-10">
      <PageHeader
        title="Dashboard"
        subtitle={`${today} · KPIs, charts, and activity across the workspace`}
      />

      <Card className="border-border/70 bg-card overflow-hidden shadow-sm">
        <CardContent
          className={`
            flex flex-col gap-5 p-6
            sm:flex-row sm:items-end sm:justify-between sm:p-7
          `}
        >
          <div className="min-w-0">
            <p
              className={`
                text-muted-foreground text-[11px] font-semibold
                tracking-[0.08em] uppercase
              `}
            >
              Overview
            </p>
            <h2
              className={`
                text-foreground mt-2 font-serif text-[34px] leading-tight
                font-normal tracking-tight
                sm:text-[40px]
              `}
            >
              {greeting}, {firstName}.
            </h2>
            <p
              className={`
                text-muted-foreground mt-2 max-w-xl text-sm leading-relaxed
              `}
            >
              Quick read on spend, approvals, delivery, and headcount — drill
              down from the modules anytime.
            </p>
          </div>
          <div
            className={`
              flex shrink-0 flex-wrap gap-2
              sm:justify-end
            `}
          >
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <Link href="/my-portal">
                My portal
                <ArrowUpRight className="size-3.5 opacity-60" />
              </Link>
            </Button>
            {canViewProjects && (
              <Button variant="outline" size="sm" asChild className="gap-1.5">
                <Link href="/projects">
                  Projects
                  <ArrowUpRight className="size-3.5 opacity-60" />
                </Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <BirthdayComingSoonWidget birthdays={stats.upcomingBirthdays ?? []} />

      <DashboardQuickActions actions={stats.pendingActions} />

      <section aria-label="Key metrics">
        <h2 className="text-muted-foreground sr-only">Key metrics</h2>
        <div
          className={`
            grid grid-cols-2 gap-3
            lg:grid-cols-4
          `}
        >
          {canViewExpense && (
            <StatCard
              label="Expenses (this month)"
              value={formatCurrency(kpis.expensesThisMonth)}
              change="Current month total"
              changeType="neutral"
              icon={Banknote}
              accent="info"
              href="/expenses"
            />
          )}
          {canViewLeave && (
            <StatCard
              label="Pending leave"
              value={String(kpis.pendingLeaves)}
              change={
                kpis.pendingLeaves > 0
                  ? `${kpis.pendingLeaves} awaiting approval`
                  : "All clear"
              }
              changeType={kpis.pendingLeaves > 0 ? "down" : "up"}
              icon={CalendarClock}
              accent="warning"
              // Pending-* cards link to the approval queue rather than the
              // module landing because the labelled subtext ("N awaiting
              // approval") matches that surface; only users with approve
              // permission see a non-zero count anyway.
              href={
                hasAnyPermission("leave:approve", "leave:hr-read")
                  ? "/leave/approval"
                  : "/leave"
              }
            />
          )}
          {canViewProjects && (
            <StatCard
              label="Active projects"
              value={String(kpis.activeProjects)}
              change={`${stats.projectStatusBreakdown.reduce((s, p) => s + p.count, 0)} total projects`}
              changeType="neutral"
              icon={FolderKanban}
              accent="primary"
              href="/projects"
            />
          )}
          {canViewEmployees && (
            <StatCard
              label="Team size"
              value={String(kpis.totalEmployees)}
              change="Active employees"
              changeType="neutral"
              icon={Users}
              accent="success"
              href="/employees"
            />
          )}
        </div>
        {(canViewTravel || canViewExpense) && (
          <div
            className={`
              mt-3 grid grid-cols-2 gap-3
              lg:grid-cols-3
            `}
          >
            {canViewTravel && (
              <StatCard
                label="Pending travel"
                value={String(kpis.pendingTravels)}
                change={
                  kpis.pendingTravels > 0
                    ? `${kpis.pendingTravels} awaiting approval`
                    : "All clear"
                }
                changeType={kpis.pendingTravels > 0 ? "down" : "up"}
                icon={MapPin}
                accent="warning"
                href={
                  hasAnyPermission("travel:approve", "travel:hr-read")
                    ? "/travel/approval"
                    : "/travel"
                }
              />
            )}
            {canViewExpense && (
              <StatCard
                label="Pending expenses"
                value={String(kpis.pendingExpenses)}
                change={
                  kpis.pendingExpenses > 0
                    ? `${kpis.pendingExpenses} claims to review`
                    : "All clear"
                }
                changeType={kpis.pendingExpenses > 0 ? "down" : "up"}
                icon={Receipt}
                accent="warning"
                href="/expenses"
              />
            )}
          </div>
        )}
      </section>

      {canViewLeave && (
        <div className="grid grid-cols-1 gap-5">
          {canViewLeave && (
            <SectionCard
              title="Leave queue"
              description="Pending leave requests (newest first)."
              icon={<CalendarClock className="size-4" aria-hidden />}
            >
              {stats.pendingLeaveRequests.length > 0 ? (
                <ul className="flex flex-col gap-2">
                  {stats.pendingLeaveRequests.map((req) => (
                    <li key={req.id}>
                      <Link
                        href="/leave"
                        className={`
                          border-border/60 bg-muted/10 flex items-center gap-3
                          rounded-xl border px-3 py-2.5 transition-colors
                          hover:bg-muted/25
                        `}
                      >
                        <Avatar name={req.employee.name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p
                            className={`
                              text-foreground-secondary truncate text-xs
                              font-medium
                            `}
                          >
                            {req.employee.name}
                          </p>
                          <p className="text-muted-foreground text-[11px]">
                            {req.leaveType} · {formatDate(req.startDate)} –{" "}
                            {formatDate(req.endDate)} · {req.days}d
                          </p>
                        </div>
                        <span
                          className={`
                            text-muted-foreground shrink-0 text-[10px]
                          `}
                        >
                          {timeAgo(req.createdAt)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  compact
                  icon={<CalendarClock />}
                  title="Queue is clear"
                  description="No leave requests awaiting approval."
                />
              )}
            </SectionCard>
          )}
        </div>
      )}

      {(canViewExpense || canViewProjects) && (
        <div
          className={`
            grid grid-cols-1 gap-5
            md:grid-cols-2
            lg:grid-cols-3
          `}
        >
          {canViewExpense && (
            <SectionCard
              title="Monthly expenses"
              description="Last six months, thousands USD (K)."
              icon={<TrendingUp className="size-4" aria-hidden />}
              className={canViewProjects ? "lg:col-span-2" : "lg:col-span-3"}
            >
              {chartData.length > 0 ? (
                <ChartContainer
                  config={revenueConfig}
                  className="aspect-2.5/1 w-full"
                >
                  <BarChart data={chartData} barGap={4}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="month"
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                      tickFormatter={(v: number) => `$${v}K`}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar
                      dataKey="expenses"
                      fill="var(--color-expenses)"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ChartContainer>
              ) : (
                <EmptyState
                  compact
                  icon={<TrendingUp />}
                  title="No expenses logged"
                  description="Once expenses come in, you'll see them charted here."
                />
              )}
            </SectionCard>
          )}

          {canViewProjects && (
            <SectionCard
              title="Projects by status"
              description="Distribution of project records by workflow state."
              icon={<FolderKanban className="size-4" aria-hidden />}
              className={canViewExpense ? "" : "lg:col-span-3"}
            >
              {projectPieData.length > 0 ? (
                <>
                  <ChartContainer
                    config={projectStatusConfig}
                    className="mx-auto aspect-square max-h-[180px]"
                  >
                    <PieChart>
                      <ChartTooltip
                        content={<ChartTooltipContent nameKey="name" />}
                      />
                      <Pie
                        data={projectPieData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={3}
                      >
                        {projectPieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  <div className="mt-3 flex flex-wrap justify-center gap-3">
                    {projectPieData.map((item) => (
                      <div
                        key={item.name}
                        className="flex items-center gap-1.5 text-[11px]"
                      >
                        <div
                          className="size-2 rounded-full"
                          style={{ background: item.color }}
                        />
                        <span className="text-muted-foreground">
                          {item.name}
                        </span>
                        <span className="text-foreground font-medium">
                          {item.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState
                  compact
                  icon={<FolderKanban />}
                  title="No projects yet"
                  description="Status breakdown appears once projects are created."
                />
              )}
            </SectionCard>
          )}
        </div>
      )}

      {(canViewProjects || canViewEmployees) && (
        <div
          className={`
            grid grid-cols-1 gap-5
            md:grid-cols-2
            lg:grid-cols-3
          `}
        >
          {canViewProjects && (
            <SectionCard
              title="Active projects"
              description="In-flight work with task completion progress."
              icon={<FolderKanban className="size-4" aria-hidden />}
            >
              {stats.activeProjectsWithProgress.length > 0 ? (
                <ul className="flex flex-col gap-2.5">
                  {stats.activeProjectsWithProgress.map((p) => (
                    <li
                      key={p.id}
                      className={`
                        border-border/60 bg-muted/15 rounded-xl border px-3 py-3
                        transition-colors
                        hover:bg-muted/30
                      `}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={`
                            text-foreground-secondary truncate text-xs
                            font-semibold
                          `}
                        >
                          {p.name}
                        </span>
                        <span
                          className={`
                            text-success shrink-0 text-xs font-semibold
                            tabular-nums
                          `}
                        >
                          {p.progress}%
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        <Progress value={p.progress} className="h-2 flex-1" />
                        <span
                          className={`
                            text-muted-foreground shrink-0 text-[10px]
                            tabular-nums
                          `}
                        >
                          {p.doneTasks}/{p.totalTasks}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState
                  compact
                  icon={<FolderKanban />}
                  title="No projects in flight"
                  description="Active work and progress will show up here."
                />
              )}
            </SectionCard>
          )}

          {canViewEmployees && (
            <SectionCard
              title="Team by department"
              description="Headcount in top departments (truncated labels)."
              icon={<Users className="size-4" aria-hidden />}
            >
              {deptData.length > 0 ? (
                <ChartContainer
                  config={deptConfig}
                  className="aspect-2/1 w-full"
                >
                  <BarChart data={deptData} layout="vertical" barSize={14}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      fontSize={10}
                    />
                    <YAxis
                      dataKey="dept"
                      type="category"
                      tickLine={false}
                      axisLine={false}
                      fontSize={10}
                      width={45}
                    />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar
                      dataKey="count"
                      fill="var(--color-count)"
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ChartContainer>
              ) : (
                <EmptyState
                  compact
                  icon={<Users />}
                  title="No headcount data"
                  description="Department breakdown appears once people are assigned."
                />
              )}
            </SectionCard>
          )}

          <SectionCard
            title="Urgent items"
            description="Items that may need attention soon."
            icon={<AlertTriangle className="size-4" aria-hidden />}
          >
            {stats.urgentItems.length > 0 ? (
              <ul className="flex flex-col gap-2">
                {stats.urgentItems.map((item, i) => (
                  <li
                    key={i}
                    className={`
                      border-border/60 bg-muted/10 flex items-start gap-3
                      rounded-xl border px-3 py-2.5 transition-colors
                      hover:bg-muted/25
                    `}
                  >
                    <div
                      className={`
                        bg-destructive mt-1.5 h-2 w-1 shrink-0 rounded-full
                      `}
                      aria-hidden
                    />
                    <span
                      className={`
                        text-foreground-secondary min-w-0 flex-1 text-xs
                        leading-snug
                      `}
                    >
                      {item.label}
                    </span>
                    <Badge
                      status={
                        item.severity === "urgent" ? "expired" : "pending"
                      }
                      className="shrink-0"
                    >
                      {item.severity === "urgent" ? "Urgent" : "Pending"}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                compact
                icon={<AlertTriangle />}
                title="Nothing urgent"
                description="You're all caught up."
              />
            )}
          </SectionCard>
        </div>
      )}

      {/* Row 3: Company Wall + News + Dates */}
      <div
        className={`
          grid grid-cols-1 gap-5
          md:grid-cols-2
          lg:grid-cols-3
        `}
      >
        <SectionCard
          title="Company wall"
          description="Latest internal posts from your colleagues."
          icon={<MessageSquare className="size-4" aria-hidden />}
          className="lg:col-span-2"
          action={
            canCreateWallPost ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setWallComposeOpen(true)}
              >
                <Plus className="mr-1 size-3.5" />
                Add post
              </Button>
            ) : null
          }
        >
          {stats.recentWallPosts.length > 0 ? (
            <ul
              className={`
                divide-border/60 border-border/50 bg-muted/10 flex flex-col
                divide-y rounded-xl border
              `}
            >
              {stats.recentWallPosts.map((post) => (
                <li
                  key={post.id}
                  className={`
                    flex gap-3 px-3 py-3.5
                    first:pt-3
                  `}
                >
                  <Avatar
                    name={post.author}
                    size="md"
                    className="ring-background ring-2"
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className={`
                        flex flex-wrap items-baseline gap-x-2 gap-y-0.5
                      `}
                    >
                      <span
                        className={`
                          text-foreground-secondary text-xs font-semibold
                        `}
                      >
                        {post.author}
                      </span>
                      <span className="text-muted-foreground text-[11px]">
                        {timeAgo(post.createdAt)}
                      </span>
                    </div>
                    <p
                      className={`
                        text-foreground-secondary mt-1 text-xs leading-relaxed
                      `}
                    >
                      {post.content}
                    </p>
                    {post.linkUrl && (
                      <Link
                        href={post.linkUrl}
                        className={`
                          text-primary mt-1 inline-block text-xs font-medium
                          hover:underline
                        `}
                      >
                        Open survey →
                      </Link>
                    )}
                    <AttachmentChips attachments={post.attachments ?? null} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              compact
              icon={<MessageSquare />}
              title="No wall posts yet"
              description="Be the first to share an update with the team."
            />
          )}
        </SectionCard>

        <div className="flex flex-col gap-5">
          <SectionCard
            title="Company news"
            description="Announcements and updates."
            icon={<Newspaper className="size-4" aria-hidden />}
            action={
              canCreateNews ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setNewsComposeOpen(true)}
                >
                  <Plus className="mr-1 size-3.5" />
                  Add news
                </Button>
              ) : null
            }
          >
            {stats.recentNews.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {stats.recentNews.map((item) => (
                  <li
                    key={item.id}
                    className={`
                      border-border/40 rounded-lg border px-2 py-1.5
                      transition-colors
                      hover:bg-muted/25
                    `}
                  >
                    <p
                      className={`
                        text-foreground-secondary text-xs leading-snug
                        font-semibold
                      `}
                    >
                      {item.linkUrl ? (
                        <Link
                          href={item.linkUrl}
                          className="hover:text-primary hover:underline"
                        >
                          {item.title}
                        </Link>
                      ) : (
                        item.title
                      )}
                    </p>
                    <p className="text-muted-foreground mt-1 text-[11px]">
                      {formatDate(item.createdAt)}
                    </p>
                    <AttachmentChips attachments={item.attachments ?? null} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                compact
                icon={<Newspaper />}
                title="No company news"
                description="Announcements from leadership will appear here."
              />
            )}
          </SectionCard>

          <SectionCard
            title="Company dates"
            description="Upcoming milestones on the calendar."
            icon={<CalendarDays className="size-4" aria-hidden />}
            action={
              canCreateCompanyDate ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDateComposeOpen(true)}
                >
                  <Plus className="mr-1 size-3.5" />
                  Add date
                </Button>
              ) : null
            }
          >
            {stats.upcomingDates.length > 0 ? (
              <ul className="flex flex-col gap-2.5">
                {stats.upcomingDates.map((item) => (
                  <li
                    key={item.id}
                    className={`
                      hover:bg-muted/25
                      flex items-start gap-3 rounded-lg px-2 py-2
                      transition-colors
                    `}
                  >
                    <div
                      className={`
                        bg-primary/12 text-primary mt-0.5 flex size-9 shrink-0
                        items-center justify-center rounded-lg
                      `}
                    >
                      <CalendarDays className="size-4" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={`
                          text-foreground-secondary text-xs leading-snug
                          font-medium
                        `}
                      >
                        {item.linkUrl ? (
                          <Link
                            href={item.linkUrl}
                            className="hover:text-primary hover:underline"
                          >
                            {item.title}
                          </Link>
                        ) : (
                          item.title
                        )}
                      </p>
                      <p className="text-muted-foreground mt-0.5 text-[11px]">
                        {formatDate(item.date)}
                      </p>
                      <AttachmentChips attachments={item.attachments ?? null} />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                compact
                icon={<CalendarDays />}
                title="No upcoming dates"
                description="Milestones and holidays will show up here."
              />
            )}
          </SectionCard>
        </div>
      </div>

      <WallPostComposeDialog
        open={wallComposeOpen}
        onOpenChange={setWallComposeOpen}
        onCreated={() => void fetchStats()}
      />
      <NewsComposeDialog
        open={newsComposeOpen}
        onOpenChange={setNewsComposeOpen}
        onCreated={() => void fetchStats()}
      />
      <CompanyDateComposeDialog
        open={dateComposeOpen}
        onOpenChange={setDateComposeOpen}
        onCreated={() => void fetchStats()}
      />
    </div>
  );
}

// Inline attachment chip list — rendered under each home-page item. Image
// attachments preview as a small thumbnail link; everything else (PDFs)
// renders as a paperclip-prefixed text link. Mirrors the IT-helpdesk
// detail-sheet chip styling so the dashboard feels consistent with the
// rest of the app.
function AttachmentChips({
  attachments,
}: {
  attachments:
    | Array<{
        name: string;
        url: string;
        mimeType?: string;
        size?: number;
      }>
    | null
    | undefined;
}) {
  if (!attachments || attachments.length === 0) return null;
  return (
    <ul className="mt-2 flex flex-wrap items-center gap-1.5">
      {attachments.map((att, idx) => {
        const isImage = (att.mimeType ?? "").startsWith("image/");
        return (
          <li key={`${att.url}-${idx}`}>
            <a
              href={att.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`
                bg-muted/40 border-border/60 inline-flex max-w-[12rem]
                items-center gap-1.5 truncate rounded-md border px-2 py-0.5
                text-[10px]
                hover:bg-muted/70
              `}
              title={att.name}
            >
              {isImage ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={att.url}
                  alt=""
                  className="size-4 shrink-0 rounded-sm object-cover"
                />
              ) : (
                <span aria-hidden>📎</span>
              )}
              <span className="truncate">{att.name}</span>
            </a>
          </li>
        );
      })}
    </ul>
  );
}
