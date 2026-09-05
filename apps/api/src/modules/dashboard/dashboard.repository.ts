import type { Prisma } from "@nexora/database";

import { prisma } from "@/infrastructure/database/prisma";
import {
  CRM_MODULES,
  moduleForTeam,
  SHARED_PROJECT_REMINDER_TEAMS,
  TASK_REMINDER_TEAMS,
} from "@/modules/crm-shared/crm-modules";
import {
  isTerminalTaskStatus,
  loadTerminalTaskKeysByProject,
  TASK_TERMINAL_ALIASES,
} from "@/modules/crm-shared/crm-task-terminal";
import {
  birthdayWindowLabel,
  daysUntilBirthday,
  getBirthdayWindowDays,
} from "@/modules/dashboard/birthday.utils";

function asStringArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string")
    : [];
}

// Local mirror of survey-forms' targetsUser — kept here so the repository
// layer doesn't import a service. A published form reaches a user if it
// targets everyone, their id, their entity, or their department.
function formTargetsUser(
  form: {
    targetAll: boolean;
    targetEntityIds: unknown;
    targetDepartments: unknown;
    targetUserIds: unknown;
  },
  user: { id: string; entityId: string | null; department: string | null },
): boolean {
  if (form.targetAll) return true;
  if (asStringArray(form.targetUserIds).includes(user.id)) return true;
  const entityIds = asStringArray(form.targetEntityIds);
  if (user.entityId && entityIds.includes(user.entityId)) return true;
  const departments = asStringArray(form.targetDepartments);
  if (user.department && departments.includes(user.department)) return true;
  return false;
}

/**
 * Build the `where` clause for "pending requests this user can act on".
 * `approverId === null` returns the system-wide queue (HR / admin).
 * Otherwise we match the request when:
 *   - it has been delegated to the user, or
 *   - it has not been delegated and the submitter reports to the user.
 *
 * The leave + travel models share the same `delegatedToId` shape; expense
 * has no delegation field today so it falls back to the manager rule.
 */
function pendingApproverWhereWithDelegate(
  approverId: string | null,
): Prisma.LeaveRequestWhereInput {
  const base = { status: "pending" };
  if (approverId === null) return base;
  return {
    ...base,
    OR: [
      { delegatedToId: approverId },
      { delegatedToId: null, employee: { reportingTo: approverId } },
    ],
  };
}

export class DashboardRepository {
  async countActiveEmployees(): Promise<number> {
    // Exclude payroll-bulk-import placeholders so the dashboard KPI
    // matches the Employees directory page (which filters them too).
    return prisma.user.count({
      where: {
        isActive: true,
        NOT: { email: { endsWith: "@placeholder.local" } },
      },
    });
  }

  // `scopeUserId` — when provided, scopes the count to projects the
  // user owns or is a member of. Null = no scope (the caller has
  // `projects:read-all` or is on a workspace-wide dashboard view).
  async countActiveProjects(
    scopeUserId: string | null = null,
  ): Promise<number> {
    const where: Prisma.ProjectWhereInput = { status: "active" };
    if (scopeUserId) {
      where.OR = [
        { ownerId: scopeUserId },
        { members: { some: { userId: scopeUserId } } },
      ];
    }
    return prisma.project.count({ where });
  }

  async countPendingLeaveRequests(
    approverId: string | null = null,
  ): Promise<number> {
    return prisma.leaveRequest.count({
      where: pendingApproverWhereWithDelegate(
        approverId,
      ) as Prisma.LeaveRequestWhereInput,
    });
  }

  async countPendingTravelRequests(
    approverId: string | null = null,
  ): Promise<number> {
    return prisma.travelRequest.count({
      where: pendingApproverWhereWithDelegate(
        approverId,
      ) as Prisma.TravelRequestWhereInput,
    });
  }

  async sumExpensesCurrentMonth(): Promise<number> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const result = await prisma.expense.aggregate({
      _sum: { amount: true },
      where: {
        date: { gte: startOfMonth, lte: endOfMonth },
        status: { not: "rejected" },
      },
    });

    return result._sum.amount?.toNumber() ?? 0;
  }

  async getRecentWallPosts(limit: number) {
    return prisma.wallPost.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, name: true, avatarUrl: true } },
        _count: { select: { comments: true } },
      },
    });
  }

  async getRecentNews(limit: number) {
    return prisma.companyNews.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        author: { select: { id: true, name: true } },
      },
    });
  }

  async getUpcomingCompanyDates(limit: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return prisma.companyDate.findMany({
      where: { date: { gte: today } },
      take: limit,
      orderBy: { date: "asc" },
    });
  }

  // Published survey forms the user is targeted by and hasn't answered —
  // powers the notification bell's "survey" group. Anonymous forms are
  // excluded (respondentId is null, so per-user completion can't be
  // tracked and they would nag forever).
  async getOpenSurveyFormsForUser(userId: string, limit: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, entityId: true, department: true },
    });
    if (!user) return [];

    const forms = await prisma.surveyForm.findMany({
      where: { status: "published", isAnonymous: false, archivedAt: null },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        title: true,
        publishedAt: true,
        targetAll: true,
        targetEntityIds: true,
        targetDepartments: true,
        targetUserIds: true,
        startDate: true,
        endDate: true,
      },
    });

    // Inclusive [startDate, endDate] window, day granularity, UTC compare.
    const today = new Date().toISOString().slice(0, 10);
    const isOpen = (f: { startDate: Date | null; endDate: Date | null }) =>
      (!f.startDate || f.startDate.toISOString().slice(0, 10) <= today) &&
      (!f.endDate || f.endDate.toISOString().slice(0, 10) >= today);

    const targeted = forms.filter((f) => formTargetsUser(f, user) && isOpen(f));
    if (targeted.length === 0) return [];

    const responded = await prisma.surveyFormResponse.findMany({
      where: {
        respondentId: userId,
        surveyFormId: { in: targeted.map((f) => f.id) },
      },
      select: { surveyFormId: true },
    });
    const done = new Set(responded.map((r) => r.surveyFormId));

    return targeted
      .filter((f) => !done.has(f.id))
      .slice(0, limit)
      .map((f) => ({ id: f.id, title: f.title, publishedAt: f.publishedAt }));
  }

  // Same as getOpenSurveyFormsForUser but over the standalone Survey module
  // (the /survey form builder) — published, non-anonymous, in-window surveys
  // the user is targeted by and hasn't answered. Powers the bell alongside
  // the Awards forms.
  async getOpenSurveysForUser(userId: string, limit: number) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, entityId: true, department: true },
    });
    if (!user) return [];

    const surveys = await prisma.survey.findMany({
      where: { status: "published", isAnonymous: false, archivedAt: null },
      orderBy: { publishedAt: "desc" },
      select: {
        id: true,
        title: true,
        publishedAt: true,
        targetAll: true,
        targetEntityIds: true,
        targetDepartments: true,
        targetUserIds: true,
        startDate: true,
        endDate: true,
      },
    });

    const today = new Date().toISOString().slice(0, 10);
    const isOpen = (s: { startDate: Date | null; endDate: Date | null }) =>
      (!s.startDate || s.startDate.toISOString().slice(0, 10) <= today) &&
      (!s.endDate || s.endDate.toISOString().slice(0, 10) >= today);

    const targeted = surveys.filter(
      (s) => formTargetsUser(s, user) && isOpen(s),
    );
    if (targeted.length === 0) return [];

    const responded = await prisma.surveyResponse.findMany({
      where: {
        respondentId: userId,
        surveyId: { in: targeted.map((s) => s.id) },
      },
      select: { surveyId: true },
    });
    const done = new Set(responded.map((r) => r.surveyId));

    return targeted
      .filter((s) => !done.has(s.id))
      .slice(0, limit)
      .map((s) => ({ id: s.id, title: s.title, publishedAt: s.publishedAt }));
  }

  // CRM deadline reminders for the bell — project go-lives + task due dates
  // that are upcoming (<= 7 days) or overdue, across every enabled board CRM
  // (IT + Project + HR …), SELF-SCOPED to what the caller owns / is a member of
  // / is assigned to (the /dashboard/stats route only checks home:read, so this
  // must scope itself). Stateless — derived from the date columns, so the
  // localStorage seen-set governs read/unread; each item carries its `module`
  // so the bell labels the source CRM. IT go-lives live on native it_projects;
  // Project/HR go-lives live on the shared `projects` table.
  async getCrmRemindersForUser(userId: string, limit: number) {
    const now = Date.now();
    const soon = new Date(now + 7 * 24 * 60 * 60 * 1000);
    const dayStr = (d: Date) => d.toISOString().slice(0, 10);
    const daysLeft = (d: Date) =>
      Math.ceil((d.getTime() - now) / (24 * 60 * 60 * 1000));
    const PROJECT_TERMINAL = [
      "completed",
      "prod_integrated",
      "closed",
      "cancelled",
    ];
    // Legal/Accounting native boards add "done" (Accounting's terminal column).
    const NATIVE_PROJECT_TERMINAL = [...PROJECT_TERMINAL, "done"];
    // IT reminder ids keep the legacy `itcrm-` prefix so existing seen-sets
    // don't reset; every other CRM uses `crm-`. Both are unique (cuid ids).
    const idp = (module: string) => (module === "it" ? "itcrm" : "crm");
    const slug = (module: string) =>
      CRM_MODULES[module as keyof typeof CRM_MODULES]?.listSlug ?? module;
    // Native-mirror go-live scans (Legal / Accounting) below are self-scoped to
    // owner or member. Their projects live on native tables, so scan those
    // directly (the shared mirror is lazy + carries no go-live state).
    const nativeGoLiveWhere = {
      status: { notIn: NATIVE_PROJECT_TERMINAL },
      OR: [{ ownerId: userId }, { members: { some: { userId } } }],
    };
    const nativeGoLiveSelect = {
      id: true,
      name: true,
      goLiveDate: true,
      revisedGoLiveDate: true,
    };

    const [
      itProjects,
      boardProjects,
      legalProjects,
      accountingProjects,
      productProjects,
      qaProjects,
      qaTasks,
      tasks,
    ] = await Promise.all([
      prisma.itProject.findMany({
        where: {
          archivedAt: null,
          status: { notIn: PROJECT_TERMINAL },
          OR: [{ ownerId: userId }, { members: { some: { userId } } }],
        },
        select: {
          id: true,
          name: true,
          goLiveDate: true,
          revisedGoLiveDate: true,
        },
      }),
      prisma.project.findMany({
        where: {
          team: { in: [...SHARED_PROJECT_REMINDER_TEAMS] },
          status: { notIn: PROJECT_TERMINAL },
          OR: [{ ownerId: userId }, { members: { some: { userId } } }],
        },
        select: {
          id: true,
          name: true,
          team: true,
          goLiveDate: true,
          revisedGoLiveDate: true,
        },
      }),
      prisma.legalProject.findMany({
        where: nativeGoLiveWhere,
        select: nativeGoLiveSelect,
      }),
      prisma.accountingProject.findMany({
        where: nativeGoLiveWhere,
        select: nativeGoLiveSelect,
      }),
      prisma.productProject.findMany({
        where: nativeGoLiveWhere,
        select: nativeGoLiveSelect,
      }),
      // QA is pure-native with no go-live — its project deadline is endDate
      // and its tasks live only in qa_project_tasks.
      prisma.qaProject.findMany({
        where: {
          status: { notIn: NATIVE_PROJECT_TERMINAL },
          endDate: { lte: soon },
          OR: [{ ownerId: userId }, { members: { some: { userId } } }],
        },
        select: { id: true, name: true, endDate: true },
      }),
      prisma.qaProjectTask.findMany({
        where: {
          status: { notIn: [...TASK_TERMINAL_ALIASES] },
          endDate: { lte: soon },
          OR: [{ ownerId: userId }, { assignees: { some: { userId } } }],
        },
        select: { id: true, title: true, endDate: true, projectId: true },
      }),
      prisma.projectTask.findMany({
        where: {
          project: { team: { in: [...TASK_REMINDER_TEAMS] } },
          status: { notIn: [...TASK_TERMINAL_ALIASES] },
          endDate: { lte: soon },
          OR: [{ ownerId: userId }, { assignees: { some: { userId } } }],
        },
        select: {
          id: true,
          title: true,
          status: true,
          endDate: true,
          projectId: true,
          project: { select: { team: true } },
        },
      }),
    ]);

    const terminalByProject =
      await loadTerminalTaskKeysByProject(TASK_REMINDER_TEAMS);

    const goLiveItem = (
      module: string,
      p: {
        id: string;
        name: string;
        goLiveDate: Date | null;
        revisedGoLiveDate: Date | null;
      },
    ) => {
      const deadline = p.revisedGoLiveDate ?? p.goLiveDate;
      if (deadline === null || deadline > soon) return null;
      return {
        id: `${idp(module)}-golive-${p.id}`,
        module,
        kind: "project" as const,
        title: p.name,
        dueDate: dayStr(deadline),
        daysLeft: daysLeft(deadline),
        linkUrl: `/projects/${p.id}?from=${slug(module)}`,
      };
    };

    const items = [
      ...itProjects.map((p) => goLiveItem("it", p)),
      ...boardProjects.map((p) => {
        const module = moduleForTeam(p.team);
        return module ? goLiveItem(module, p) : null;
      }),
      ...legalProjects.map((p) => goLiveItem("legal", p)),
      ...accountingProjects.map((p) => goLiveItem("accounting", p)),
      ...productProjects.map((p) => goLiveItem("product", p)),
      ...qaProjects
        .filter((p) => p.endDate !== null)
        .map((p) => ({
          id: `crm-due-${p.id}`,
          module: "qa",
          kind: "project" as const,
          title: p.name,
          dueDate: dayStr(p.endDate as Date),
          daysLeft: daysLeft(p.endDate as Date),
          linkUrl: `/qa-crm/${p.id}`,
        })),
      ...qaTasks
        .filter((t) => t.endDate !== null)
        .map((t) => ({
          id: `crm-task-${t.id}`,
          module: "qa",
          kind: "task" as const,
          title: t.title,
          dueDate: dayStr(t.endDate as Date),
          daysLeft: daysLeft(t.endDate as Date),
          linkUrl: `/qa-crm/${t.projectId}`,
        })),
      ...tasks
        .filter(
          (t) =>
            t.endDate !== null &&
            !isTerminalTaskStatus(t.status, terminalByProject.get(t.projectId)),
        )
        .map((t) => {
          const module = moduleForTeam(t.project.team);
          if (!module) return null;
          return {
            id: `${idp(module)}-task-${t.id}`,
            module,
            kind: "task" as const,
            title: t.title,
            dueDate: dayStr(t.endDate as Date),
            daysLeft: daysLeft(t.endDate as Date),
            linkUrl: `/projects/${t.projectId}?task=${t.id}&from=${slug(module)}`,
          };
        }),
    ].filter((x): x is NonNullable<typeof x> => x !== null);

    // Overdue (most negative) first, then soonest.
    return items.sort((a, b) => a.daysLeft - b.daysLeft).slice(0, limit);
  }

  // CRM update notifications for the bell (task status / assignment /
  // comment), across every CRM module. Stored per-user rows — already
  // self-scoped by userId. Recent first; the bell's localStorage seen-set
  // governs read/unread. `module` lets the bell label the source CRM.
  async getCrmNotificationsForUser(userId: string, limit: number) {
    return prisma.crmNotification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        module: true,
        type: true,
        title: true,
        body: true,
        linkUrl: true,
        createdAt: true,
      },
    });
  }

  async getPendingLeaveRequests(
    limit: number,
    approverId: string | null = null,
  ) {
    return prisma.leaveRequest.findMany({
      where: pendingApproverWhereWithDelegate(
        approverId,
      ) as Prisma.LeaveRequestWhereInput,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        employee: {
          select: { id: true, name: true, avatarUrl: true, department: true },
        },
        leaveType: { select: { id: true, name: true, code: true } },
      },
    });
  }

  async getPendingTravelRequests(
    limit: number,
    approverId: string | null = null,
  ) {
    return prisma.travelRequest.findMany({
      where: pendingApproverWhereWithDelegate(
        approverId,
      ) as Prisma.TravelRequestWhereInput,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        employee: {
          select: { id: true, name: true, avatarUrl: true, department: true },
        },
      },
    });
  }

  async getExpenseSummaryByMonth(months: number) {
    const now = new Date();
    const startDate = new Date(
      now.getFullYear(),
      now.getMonth() - months + 1,
      1,
    );

    const expenses = await prisma.expense.findMany({
      where: {
        date: { gte: startDate },
        status: { not: "rejected" },
      },
      select: { amount: true, date: true },
      orderBy: { date: "asc" },
    });

    const grouped = new Map<string, number>();

    for (let i = 0; i < months; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - months + 1 + i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      grouped.set(key, 0);
    }

    for (const exp of expenses) {
      const d = new Date(exp.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const current = grouped.get(key) ?? 0;
      grouped.set(key, current + exp.amount.toNumber());
    }

    return Array.from(grouped.entries()).map(([month, expenses]) => ({
      month,
      expenses,
    }));
  }

  async getProjectStatusBreakdown(scopeUserId: string | null = null) {
    const where: Prisma.ProjectWhereInput = {};
    if (scopeUserId) {
      where.OR = [
        { ownerId: scopeUserId },
        { members: { some: { userId: scopeUserId } } },
      ];
    }
    const projects = await prisma.project.groupBy({
      by: ["status"],
      where,
      _count: { id: true },
    });

    return projects.map((p) => ({
      status: p.status,
      count: p._count.id,
    }));
  }

  async getEmployeesByDepartment() {
    const users = await prisma.user.groupBy({
      by: ["department"],
      where: {
        isActive: true,
        department: { not: null },
        NOT: { email: { endsWith: "@placeholder.local" } },
      },
      _count: { id: true },
    });

    return users.map((u) => ({
      department: u.department ?? "Unknown",
      count: u._count.id,
    }));
  }

  async getActiveProjectsWithProgress(
    limit: number,
    scopeUserId: string | null = null,
  ) {
    const where: Prisma.ProjectWhereInput = { status: "active" };
    if (scopeUserId) {
      where.OR = [
        { ownerId: scopeUserId },
        { members: { some: { userId: scopeUserId } } },
      ];
    }
    const projects = await prisma.project.findMany({
      where,
      take: limit,
      orderBy: { updatedAt: "desc" },
      include: {
        _count: { select: { tasks: true } },
        tasks: { select: { status: true } },
      },
    });

    return projects.map((p) => {
      const totalTasks = p._count.tasks;
      const doneTasks = p.tasks.filter((t) => t.status === "done").length;
      const progress =
        totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;

      return {
        id: p.id,
        name: p.name,
        status: p.status,
        progress,
        totalTasks,
        doneTasks,
      };
    });
  }

  async getUrgentItems() {
    const now = new Date();
    const thirtyDaysOut = new Date(now);
    thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);

    const [expiringVisas, pendingExpenses, pendingLeaves, pendingTravels] =
      await Promise.all([
        prisma.visaRecord.count({
          where: {
            expiryDate: { gte: now, lte: thirtyDaysOut },
            status: "active",
          },
        }),
        prisma.expense.aggregate({
          _count: { id: true },
          _sum: { amount: true },
          where: { status: "pending" },
        }),
        prisma.leaveRequest.count({ where: { status: "pending" } }),
        prisma.travelRequest.count({ where: { status: "pending" } }),
      ]);

    const items: Array<{ label: string; severity: "urgent" | "pending" }> = [];

    if (expiringVisas > 0) {
      items.push({
        label: `${expiringVisas} visa${expiringVisas > 1 ? "s" : ""} expiring within 30 days`,
        severity: "urgent",
      });
    }

    if (pendingExpenses._count.id > 0) {
      const total = pendingExpenses._sum.amount?.toNumber() ?? 0;
      items.push({
        label: `${pendingExpenses._count.id} pending expense claim${pendingExpenses._count.id > 1 ? "s" : ""} ($${total.toLocaleString()})`,
        severity: "pending",
      });
    }

    if (pendingLeaves > 0) {
      items.push({
        label: `${pendingLeaves} leave request${pendingLeaves > 1 ? "s" : ""} awaiting approval`,
        severity: "pending",
      });
    }

    if (pendingTravels > 0) {
      items.push({
        label: `${pendingTravels} travel request${pendingTravels > 1 ? "s" : ""} awaiting approval`,
        severity: "pending",
      });
    }

    return items;
  }

  // Teammates whose birthday falls within today + the next 3 days.
  // dateOfBirth is a Date column (birth year), so the window is matched on
  // month/day in memory — Prisma can't express MONTH()/DAY() on a Date.
  // Excludes payroll placeholder accounts to match the Employees directory.
  async getUpcomingBirthdays(refDate: Date = new Date()) {
    const window = getBirthdayWindowDays(refDate);
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        dateOfBirth: { not: null },
        NOT: { email: { endsWith: "@placeholder.local" } },
      },
      select: {
        id: true,
        name: true,
        avatarUrl: true,
        department: true,
        dateOfBirth: true,
      },
    });

    return users
      .map((user) => {
        if (!user.dateOfBirth) return null;
        const offset = daysUntilBirthday(user.dateOfBirth, window);
        if (offset == null) return null;
        return {
          id: user.id,
          name: user.name,
          avatarUrl: user.avatarUrl,
          department: user.department,
          dateOfBirth: user.dateOfBirth,
          daysUntil: offset,
          label: birthdayWindowLabel(offset),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row != null)
      .sort(
        (a, b) => a.daysUntil - b.daysUntil || a.name.localeCompare(b.name),
      );
  }
}

export const dashboardRepository = new DashboardRepository();
