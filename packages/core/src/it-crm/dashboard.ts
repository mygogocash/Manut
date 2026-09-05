import type { Db } from "@nexora/db";
import { schema } from "@nexora/db";
import { and, count, desc, eq, isNotNull, isNull, ne, sql } from "drizzle-orm";

const projects = schema.itProjects;
const tasks = schema.itProjectTasks;

function avgDays(rows: { from: Date; to: Date }[]): number | null {
  if (rows.length === 0) return null;
  const total = rows.reduce((s, r) => s + (r.to.getTime() - r.from.getTime()) / 86_400_000, 0);
  return Math.round((total / rows.length) * 10) / 10;
}

/** Project + task intelligence snapshot (helpdesk/SLA exhibits omitted on edge). */
export async function buildDashboard(db: Db) {
  const now = new Date();
  const terminalStatuses = ["completed", "prod_integrated", "closed", "cancelled"];
  const taskTerminal = ["done"];

  const [
    [totalRow],
    [productionLiveRow],
    [atRiskRow],
    [completedRow],
    byStatus,
    byDepartment,
    [taskTotalRow],
    [taskSubtaskRow],
    [taskInProgressRow],
    [taskDoneRow],
    [taskOverdueRow],
    tasksByStatus,
    deliveredRows,
    doneCycleRows,
    stageAgingRows,
    slippageRows,
    throughputRows,
  ] = await Promise.all([
    db.select({ c: count() }).from(projects),
    db.select({ c: count() }).from(projects).where(isNotNull(projects.productionLiveDate)),
    db
      .select({ c: count() })
      .from(projects)
      .where(and(isNotNull(projects.revisedGoLiveDate), sql`${projects.status} NOT IN (${sql.join(terminalStatuses.map((s) => sql`${s}`), sql`, `)})`)),
    db
      .select({ c: count() })
      .from(projects)
      .where(sql`${projects.status} IN ('completed', 'prod_integrated')`),
    db
      .select({ status: projects.status, c: count() })
      .from(projects)
      .groupBy(projects.status),
    db
      .select({ department: projects.department, c: count() })
      .from(projects)
      .groupBy(projects.department),
    db.select({ c: count() }).from(tasks).where(isNull(tasks.parentTaskId)),
    db.select({ c: count() }).from(tasks).where(isNotNull(tasks.parentTaskId)),
    db.select({ c: count() }).from(tasks).where(eq(tasks.status, "in_progress")),
    db.select({ c: count() }).from(tasks).where(eq(tasks.status, "done")),
    db
      .select({ c: count() })
      .from(tasks)
      .where(and(isNotNull(tasks.endDate), sql`${tasks.endDate} < CURRENT_DATE`, sql`${tasks.status} NOT IN (${sql.join(taskTerminal.map((s) => sql`${s}`), sql`, `)})`)),
    db.select({ status: tasks.status, c: count() }).from(tasks).groupBy(tasks.status),
    db
      .select({ createdAt: projects.createdAt, startDate: projects.startDate, productionLiveDate: projects.productionLiveDate })
      .from(projects)
      .where(isNotNull(projects.productionLiveDate))
      .limit(500),
    db
      .select({ createdAt: tasks.createdAt, completedAt: tasks.completedAt })
      .from(tasks)
      .where(isNotNull(tasks.completedAt))
      .limit(500),
    db
      .select({
        id: projects.id,
        name: projects.name,
        slug: projects.slug,
        status: projects.status,
        department: projects.department,
        statusChangedAt: projects.statusChangedAt,
      })
      .from(projects)
      .where(sql`${projects.status} NOT IN (${sql.join(terminalStatuses.map((s) => sql`${s}`), sql`, `)})`)
      .orderBy(projects.statusChangedAt)
      .limit(20),
    db
      .select({
        id: projects.id,
        name: projects.name,
        slug: projects.slug,
        status: projects.status,
        goLiveDate: projects.goLiveDate,
        revisedGoLiveDate: projects.revisedGoLiveDate,
      })
      .from(projects)
      .where(and(isNotNull(projects.goLiveDate), isNotNull(projects.revisedGoLiveDate)))
      .limit(50),
    db.execute<{ month: string; count: string }>(sql`
      SELECT to_char(date_trunc('month', production_live_date), 'YYYY-MM') AS month,
             COUNT(*)::text AS count
      FROM it_projects
      WHERE production_live_date IS NOT NULL
        AND production_live_date >= date_trunc('month', CURRENT_DATE - interval '5 months')
      GROUP BY 1
      ORDER BY 1 ASC
    `),
  ]);

  const stageAgingList = stageAgingRows.map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    status: p.status,
    department: p.department,
    daysInStage: p.statusChangedAt
      ? Math.max(0, Math.round((now.getTime() - new Date(p.statusChangedAt).getTime()) / 86_400_000))
      : null,
  }));
  const agedValues = stageAgingList.map((p) => p.daysInStage).filter((d): d is number => d != null);
  const avgDaysInStage =
    agedValues.length > 0
      ? Math.round((agedValues.reduce((s, d) => s + d, 0) / agedValues.length) * 10) / 10
      : null;

  const slippage = slippageRows
    .map((p) => {
      const slipDays =
        p.goLiveDate && p.revisedGoLiveDate
          ? Math.round(
              (new Date(p.revisedGoLiveDate).getTime() - new Date(p.goLiveDate).getTime()) / 86_400_000,
            )
          : 0;
      return {
        id: p.id,
        name: p.name,
        slug: p.slug,
        status: p.status,
        originalGoLive: p.goLiveDate,
        revisedGoLive: p.revisedGoLiveDate,
        slipDays,
      };
    })
    .sort((a, b) => b.slipDays - a.slipDays);
  const positiveSlips = slippage.filter((s) => s.slipDays > 0);
  const avgSlipDays =
    positiveSlips.length > 0
      ? Math.round((positiveSlips.reduce((s, p) => s + p.slipDays, 0) / positiveSlips.length) * 10) / 10
      : null;

  const leadTimeDays = avgDays(
    deliveredRows
      .filter((p) => p.productionLiveDate)
      .map((p) => ({
        from: new Date(p.startDate ?? p.createdAt),
        to: new Date(p.productionLiveDate!),
      })),
  );
  const taskCycleDays = avgDays(
    doneCycleRows
      .filter((t) => t.completedAt)
      .map((t) => ({ from: new Date(t.createdAt), to: new Date(t.completedAt!) })),
  );

  const total = Number(totalRow?.c ?? 0);
  const inProgress = byStatus.find((s) => s.status === "in_progress")?.c ?? 0;

  return {
    total,
    productionLive: Number(productionLiveRow?.c ?? 0),
    atRisk: Number(atRiskRow?.c ?? 0),
    completed: Number(completedRow?.c ?? 0),
    inProgress: Number(inProgress),
    byStatus: byStatus.map((s) => ({ status: s.status, count: Number(s.c) })),
    byDepartment: byDepartment.map((d) => ({ department: d.department, count: Number(d.c) })),
    throughput: throughputRows.map((r) => ({ month: r.month, count: Number(r.count) })),
    flow: {
      leadTimeDays,
      taskCycleDays,
      avgDaysInStage,
      stageAgingOldest: stageAgingList.filter((p) => p.daysInStage != null).slice(0, 8),
      slippage: { avgSlipDays, projects: slippage.slice(0, 20) },
    },
    tasks: {
      total: Number(taskTotalRow?.c ?? 0),
      subtasks: Number(taskSubtaskRow?.c ?? 0),
      inProgress: Number(taskInProgressRow?.c ?? 0),
      done: Number(taskDoneRow?.c ?? 0),
      overdue: Number(taskOverdueRow?.c ?? 0),
      byStatus: tasksByStatus.map((s) => ({ status: s.status, count: Number(s.c) })),
    },
    exhibits: [
      { id: "project-flow", title: "Project flow", kind: "flow" },
      { id: "task-health", title: "Task health", kind: "tasks" },
    ],
  };
}
