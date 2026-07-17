import { api } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api.type";

// ─── Types ──────────────────────────────────────────────

export interface DashboardKpis {
  totalEmployees: number;
  activeProjects: number;
  pendingLeaves: number;
  pendingTravels: number;
  pendingExpenses: number;
  expensesThisMonth: number;
}

export interface DashboardAttachment {
  name: string;
  url: string;
  mimeType?: string;
  size?: number;
}

export interface DashboardWallPost {
  id: string;
  author: string;
  authorAvatar: string | null;
  content: string;
  type: string;
  commentsCount: number;
  attachments?: DashboardAttachment[] | null;
  linkUrl?: string | null;
  createdAt: string;
}

export interface DashboardNewsItem {
  id: string;
  title: string;
  category: string | null;
  author: string;
  attachments?: DashboardAttachment[] | null;
  linkUrl?: string | null;
  createdAt: string;
}

export interface DashboardCompanyDate {
  id: string;
  title: string;
  date: string;
  type: string;
  attachments?: DashboardAttachment[] | null;
  linkUrl?: string | null;
}

export interface DashboardLeaveRequest {
  id: string;
  employee: {
    id: string;
    name: string;
    avatarUrl: string | null;
    department: string | null;
  };
  leaveType: string;
  startDate: string;
  endDate: string;
  days: number;
  createdAt: string;
}

export interface DashboardTravelRequest {
  id: string;
  employee: {
    id: string;
    name: string;
    avatarUrl: string | null;
    department: string | null;
  };
  destination: string;
  departureDate: string;
  returnDate: string;
  createdAt: string;
}

export interface DashboardExpenseRequest {
  id: string;
  employee: {
    id: string;
    name: string;
    department: string | null;
  };
  title: string;
  period: string;
  expenseCount: number;
  createdAt: string;
}

export interface DashboardPendingAction {
  kind: "leave" | "travel" | "expense";
  id: string;
  title: string;
  subtitle: string;
  href: string;
  createdAt: string;
}

export interface DashboardExpenseSummary {
  month: string;
  expenses: number;
}

export interface DashboardProjectStatus {
  status: string;
  count: number;
}

export interface DashboardDepartment {
  department: string;
  count: number;
}

export interface DashboardActiveProject {
  id: string;
  name: string;
  status: string;
  progress: number;
  totalTasks: number;
  doneTasks: number;
}

export interface DashboardUrgentItem {
  label: string;
  severity: "urgent" | "pending";
}

export interface DashboardOpenSurvey {
  id: string;
  title: string;
  href: string;
  createdAt: string;
}

export interface DashboardUpcomingBirthday {
  id: string;
  name: string;
  avatarUrl: string | null;
  department: string | null;
  birthdayDate: string;
  daysUntil: number;
  label: string;
}

export interface DashboardItCrmReminder {
  id: string;
  module: string; // it | general | hr … (source CRM, for the bell label)
  kind: "project" | "task";
  title: string;
  href: string;
  dueDate: string;
  // Days until the deadline; negative = overdue, 0 = due today.
  daysLeft: number;
}

export interface DashboardItCrmUpdate {
  id: string;
  module: string; // it | general | product | legal | accounting | hr | qa | marketing
  type: string; // task_status | task_assigned | task_comment
  title: string;
  body: string | null;
  href: string | null;
  createdAt: string;
}

export interface DashboardStats {
  kpis: DashboardKpis;
  recentWallPosts: DashboardWallPost[];
  recentNews: DashboardNewsItem[];
  upcomingDates: DashboardCompanyDate[];
  pendingLeaveRequests: DashboardLeaveRequest[];
  pendingTravelRequests: DashboardTravelRequest[];
  pendingExpenseRequests: DashboardExpenseRequest[];
  pendingActions: DashboardPendingAction[];
  expenseSummary: DashboardExpenseSummary[];
  projectStatusBreakdown: DashboardProjectStatus[];
  employeesByDepartment: DashboardDepartment[];
  activeProjectsWithProgress: DashboardActiveProject[];
  urgentItems: DashboardUrgentItem[];
  openSurveys: DashboardOpenSurvey[];
  upcomingBirthdays: DashboardUpcomingBirthday[];
  itCrmReminders: DashboardItCrmReminder[];
  itCrmUpdates: DashboardItCrmUpdate[];
}

// ─── Service ────────────────────────────────────────────

export async function getDashboardStats(): Promise<
  ApiSuccessResponse<DashboardStats>
> {
  return api.get("/dashboard/stats");
}
