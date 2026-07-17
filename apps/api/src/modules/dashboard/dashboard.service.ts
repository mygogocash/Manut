import { PERMISSIONS } from "@/common/constants/permissions";
import { dashboardRepository } from "@/modules/dashboard/dashboard.repository";
import { expenseReportsService } from "@/modules/expenses/expense-reports.service";

const PENDING_ACTIONS_LIMIT = 10;

export class DashboardService {
  async getStats(actorId: string, actorPermissions: string[]) {
    // "Awaiting your approval" needs to actually be the caller's
    // pendings — HR/admin sees the system-wide queue, everyone else
    // only sees requests they can act on (delegated to them, or
    // submitted by their direct reports).
    const leaveScope = actorPermissions.includes(PERMISSIONS.LEAVE_HR_READ)
      ? null
      : actorId;
    const travelScope = actorPermissions.includes(PERMISSIONS.TRAVEL_HR_READ)
      ? null
      : actorId;
    // Active Projects widget should mirror the /projects list scope so
    // the dashboard doesn't surface projects the caller can't open.
    // `projects:read-all` (Admin / Manager) sees workspace-wide;
    // everyone else gets the owner-or-member filter.
    const projectScope = actorPermissions.includes(
      PERMISSIONS.PROJECTS_READ_ALL,
    )
      ? null
      : actorId;

    const [
      totalEmployees,
      activeProjects,
      pendingLeaves,
      pendingTravels,
      expensesThisMonth,
      recentWallPosts,
      recentNews,
      upcomingDates,
      pendingLeaveRequests,
      pendingTravelRequests,
      pendingExpenseResult,
      expenseSummary,
      projectStatusBreakdown,
      employeesByDepartment,
      activeProjectsWithProgress,
      urgentItems,
      openSurveys,
      openStandaloneSurveys,
      upcomingBirthdays,
      itCrmReminders,
      itCrmUpdates,
    ] = await Promise.all([
      dashboardRepository.countActiveEmployees(),
      dashboardRepository.countActiveProjects(projectScope),
      dashboardRepository.countPendingLeaveRequests(leaveScope),
      dashboardRepository.countPendingTravelRequests(travelScope),
      dashboardRepository.sumExpensesCurrentMonth(),
      dashboardRepository.getRecentWallPosts(5),
      dashboardRepository.getRecentNews(5),
      dashboardRepository.getUpcomingCompanyDates(5),
      dashboardRepository.getPendingLeaveRequests(5, leaveScope),
      dashboardRepository.getPendingTravelRequests(5, travelScope),
      // Reuse the vetted v1 approver query (chain decisions + manager
      // parallel-approver fallback + legacy no-chain reports). Prod runs
      // Expenses; the old read hit the dark-shipped v2 `Expense`
      // table and linked to `/expenses` (404 in prod).
      expenseReportsService.listReports(actorId, actorPermissions, {
        pendingForMe: true,
        page: 1,
        limit: PENDING_ACTIONS_LIMIT,
      }),
      dashboardRepository.getExpenseSummaryByMonth(6),
      dashboardRepository.getProjectStatusBreakdown(projectScope),
      dashboardRepository.getEmployeesByDepartment(),
      dashboardRepository.getActiveProjectsWithProgress(4, projectScope),
      dashboardRepository.getUrgentItems(),
      dashboardRepository.getOpenSurveyFormsForUser(actorId, 5),
      dashboardRepository.getOpenSurveysForUser(actorId, 5),
      dashboardRepository.getUpcomingBirthdays(),
      dashboardRepository.getCrmRemindersForUser(actorId, 8),
      dashboardRepository.getCrmNotificationsForUser(actorId, 10),
    ]);

    // v1 listReports yields both the list (top pending reports for this
    // approver) and the count (meta.total) from one query, keeping the
    // KPI badge and the list on the same source.
    const pendingExpenseRequests = pendingExpenseResult.data;
    const pendingExpensesCount = pendingExpenseResult.meta.total;

    type PendingActionKind = "leave" | "travel" | "expense";
    const pendingActionsRaw: Array<{
      kind: PendingActionKind;
      id: string;
      title: string;
      subtitle: string;
      href: string;
      createdAt: Date;
    }> = [];

    for (const req of pendingLeaveRequests) {
      pendingActionsRaw.push({
        kind: "leave",
        id: req.id,
        title: `${req.employee.name} — ${req.leaveType.name}`,
        subtitle: req.employee.department
          ? `${req.employee.department} · Leave`
          : "Leave",
        href: "/leave",
        createdAt: req.createdAt,
      });
    }
    for (const req of pendingTravelRequests) {
      pendingActionsRaw.push({
        kind: "travel",
        id: req.id,
        title: `${req.employee.name} — ${req.destination}`,
        subtitle: req.employee.department
          ? `${req.employee.department} · Travel`
          : "Travel",
        href: "/travel",
        createdAt: req.createdAt,
      });
    }
    for (const report of pendingExpenseRequests) {
      pendingActionsRaw.push({
        kind: "expense",
        id: report.id,
        title: `${report.employee.name} — ${report.title}`,
        subtitle: report.employee.department
          ? `${report.employee.department} · Expenses · ${report.period}`
          : `Expenses · ${report.period}`,
        href: "/expenses",
        createdAt: report.createdAt,
      });
    }

    pendingActionsRaw.sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );
    const pendingActions = pendingActionsRaw
      .slice(0, PENDING_ACTIONS_LIMIT)
      .map((a) => ({
        kind: a.kind,
        id: a.id,
        title: a.title,
        subtitle: a.subtitle,
        href: a.href,
        createdAt: a.createdAt.toISOString(),
      }));

    return {
      kpis: {
        totalEmployees,
        activeProjects,
        pendingLeaves,
        pendingTravels,
        pendingExpenses: pendingExpensesCount,
        expensesThisMonth,
      },
      recentWallPosts: recentWallPosts.map((post) => ({
        id: post.id,
        author: post.author.name,
        authorAvatar: post.author.avatarUrl,
        content: post.content,
        type: post.type,
        commentsCount: post._count.comments,
        attachments: post.attachments,
        linkUrl: post.linkUrl,
        createdAt: post.createdAt.toISOString(),
      })),
      recentNews: recentNews.map((news) => ({
        id: news.id,
        title: news.title,
        category: news.category,
        author: news.author.name,
        attachments: news.attachments,
        linkUrl: news.linkUrl,
        createdAt: news.createdAt.toISOString(),
      })),
      upcomingDates: upcomingDates.map((d) => ({
        id: d.id,
        title: d.title,
        date: d.date.toISOString(),
        type: d.type,
        attachments: d.attachments,
        linkUrl: d.linkUrl,
      })),
      pendingLeaveRequests: pendingLeaveRequests.map((req) => ({
        id: req.id,
        employee: {
          id: req.employee.id,
          name: req.employee.name,
          avatarUrl: req.employee.avatarUrl,
          department: req.employee.department,
        },
        leaveType: req.leaveType.name,
        startDate: req.startDate.toISOString(),
        endDate: req.endDate.toISOString(),
        days: Number(req.days),
        createdAt: req.createdAt.toISOString(),
      })),
      pendingTravelRequests: pendingTravelRequests.map((req) => ({
        id: req.id,
        employee: {
          id: req.employee.id,
          name: req.employee.name,
          avatarUrl: req.employee.avatarUrl,
          department: req.employee.department,
        },
        destination: req.destination,
        departureDate: req.departureDate.toISOString(),
        returnDate: req.returnDate.toISOString(),
        createdAt: req.createdAt.toISOString(),
      })),
      pendingExpenseRequests: pendingExpenseRequests.map((report) => ({
        id: report.id,
        employee: {
          id: report.employee.id,
          name: report.employee.name,
          department: report.employee.department,
        },
        title: report.title,
        period: report.period,
        expenseCount: report._count.expenses,
        createdAt: report.createdAt.toISOString(),
      })),
      pendingActions,
      expenseSummary,
      projectStatusBreakdown,
      employeesByDepartment,
      activeProjectsWithProgress,
      urgentItems,
      openSurveys: [
        ...openSurveys.map((s) => ({
          id: s.id,
          title: s.title,
          href: `/survey-forms/${s.id}/respond`,
          createdAt: (s.publishedAt ?? new Date()).toISOString(),
        })),
        ...openStandaloneSurveys.map((s) => ({
          id: s.id,
          title: s.title,
          href: `/survey/${s.id}/respond`,
          createdAt: (s.publishedAt ?? new Date()).toISOString(),
        })),
      ],
      upcomingBirthdays: upcomingBirthdays.map((b) => ({
        id: b.id,
        name: b.name,
        avatarUrl: b.avatarUrl,
        department: b.department,
        birthdayDate: b.dateOfBirth.toISOString().slice(0, 10),
        daysUntil: b.daysUntil,
        label: b.label,
      })),
      itCrmReminders: itCrmReminders.map((r) => ({
        id: r.id,
        module: r.module,
        kind: r.kind,
        title: r.title,
        href: r.linkUrl,
        dueDate: r.dueDate,
        daysLeft: r.daysLeft,
      })),
      itCrmUpdates: itCrmUpdates.map((n) => ({
        id: n.id,
        module: n.module,
        type: n.type,
        title: n.title,
        body: n.body,
        href: n.linkUrl,
        createdAt: n.createdAt.toISOString(),
      })),
    };
  }
}

export const dashboardService = new DashboardService();
