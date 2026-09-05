import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// Phase 3 of the IT CRM standalone workspace (Option A per-CRM
// schema isolation, 2026-05-26). Typed client for the Phase 2
// backend endpoints (#610). Mounted at `/api/it-crm`.

export interface ItCrmUser {
  id: string;
  name: string;
  email: string;
}

export interface ItProject {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  ownerId: string;
  owner: ItCrmUser | null;
  startDate: string | null;
  endDate: string | null;
  productionLiveDate: string | null;
  goLiveDate: string | null;
  revisedGoLiveDate: string | null;
  dependency: string | null;
  comment: string | null;
  sortOrder: number;
  department: string | null;
  // Intelligence fields (dashboard redesign, 2026-05-30). `healthStatus`
  // is the RAG rating; `effortPoints` is relative sizing. `statusChangedAt`
  // is server-managed and not surfaced on the list shape.
  healthStatus: "green" | "yellow" | "red" | null;
  effortPoints: number | null;
  // Auto-assign default for new tasks (IT CRM only).
  defaultAssigneeMode: "none" | "creator" | "owner" | "user";
  defaultAssigneeId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ItProjectColumn {
  id: string;
  projectId: string;
  key: string;
  label: string;
  color: string;
  sortOrder: number;
}

export interface ItProjectTaskAssignee {
  id: string;
  taskId: string;
  userId: string;
  allocationPct: number | null;
  user: ItCrmUser;
}

export interface ItProjectTask {
  id: string;
  projectId: string;
  parentTaskId: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  ownerId: string | null;
  startDate: string | null;
  endDate: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  owner: ItCrmUser | null;
  assignees: ItProjectTaskAssignee[];
}

export interface ItProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: string;
  createdAt: string;
  user: ItCrmUser;
}

export interface ItProjectBoard {
  columns: ItProjectColumn[];
  tasks: ItProjectTask[];
  members: ItProjectMember[];
}

export interface CreateItProjectInput {
  name: string;
  description?: string;
  status?: string;
  ownerId?: string;
  startDate?: string;
  endDate?: string;
  productionLiveDate?: string | null;
  goLiveDate?: string | null;
  revisedGoLiveDate?: string | null;
  dependency?: string | null;
  comment?: string | null;
  department?: string | null;
  healthStatus?: "green" | "yellow" | "red" | null;
  effortPoints?: number | null;
  defaultAssigneeMode?: "none" | "creator" | "owner" | "user";
  defaultAssigneeId?: string | null;
  sortOrder?: number;
}

export type UpdateItProjectInput = Partial<CreateItProjectInput>;

export interface ItProjectListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  department?: string;
  // When true, return ONLY archived projects; omit/false shows active only.
  archived?: boolean;
}

// ─── Project CRUD ──────────────────────────────────────────

export async function listItProjects(
  params: ItProjectListParams = {},
): Promise<ApiPaginatedResponse<ItProject>> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const tail = qs.toString() ? `?${qs.toString()}` : "";
  return api.get(`/it-crm${tail}`);
}

export async function createItProject(
  input: CreateItProjectInput,
): Promise<ApiSuccessResponse<ItProject>> {
  return api.post("/it-crm", input);
}

export async function getItProject(
  id: string,
): Promise<ApiSuccessResponse<ItProject & { role: string }>> {
  return api.get(`/it-crm/${id}`);
}

export async function updateItProject(
  id: string,
  input: UpdateItProjectInput,
): Promise<ApiSuccessResponse<ItProject>> {
  return api.put(`/it-crm/${id}`, input);
}

export async function deleteItProject(
  id: string,
): Promise<ApiSuccessResponse<{ success: true }>> {
  return api.delete(`/it-crm/${id}`);
}

export async function archiveItProject(
  id: string,
): Promise<ApiSuccessResponse<ItProject>> {
  return api.post(`/it-crm/${id}/archive`, {});
}

export async function unarchiveItProject(
  id: string,
): Promise<ApiSuccessResponse<ItProject>> {
  return api.post(`/it-crm/${id}/unarchive`, {});
}

export async function reorderItProjects(
  orderedIds: string[],
): Promise<ApiSuccessResponse<{ success: true }>> {
  return api.put("/it-crm/reorder", { orderedIds });
}

// ─── Deadline-reminder recipients ──────────────────────────

export interface ReminderSettings {
  recipients: string[];
}

export async function getReminderSettings(): Promise<
  ApiSuccessResponse<ReminderSettings>
> {
  return api.get("/it-crm/reminder-settings");
}

export async function updateReminderSettings(
  input: ReminderSettings,
): Promise<ApiSuccessResponse<ReminderSettings>> {
  return api.put("/it-crm/reminder-settings", input);
}

export async function importItProjects(
  rows: CreateItProjectInput[],
): Promise<ApiSuccessResponse<{ created: number }>> {
  return api.post("/it-crm/import", { rows });
}

// ─── Dashboard ─────────────────────────────────────────────

export interface ItCrmDashboardSnapshot {
  total: number;
  productionLive: number;
  atRisk: number;
  completed: number;
  inProgress: number;
  byStatus: Array<{ status: string; count: number }>;
  byDepartment: Array<{ department: string | null; count: number }>;
  ownerWorkload: Array<{
    ownerId: string;
    ownerName: string;
    count: number;
  }>;
  throughput: Array<{ month: string; count: number }>;
  upcomingGoLives: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    department: string | null;
    goLiveDate: string | null;
    revisedGoLiveDate: string | null;
    dependency: string | null;
    owner: { id: string; name: string } | null;
  }>;
  blockedProjects: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    dependency: string | null;
    comment: string | null;
    owner: { id: string; name: string } | null;
  }>;
  recentUpdates: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    department: string | null;
    comment: string | null;
    updatedAt: string;
    owner: { id: string; name: string } | null;
  }>;
  // Task / subtask rollup (2026-05-28). Splits top-level tasks from
  // subtasks (`parentTaskId IS NULL` vs not) so management sees
  // execution work distinct from breakdown granularity.
  tasks: {
    total: number;
    subtasks: number;
    inProgress: number;
    done: number;
    overdue: number;
    byStatus: Array<{ status: string; count: number }>;
    overdueList: Array<{
      id: string;
      title: string;
      status: string;
      endDate: string | null;
      isSubtask: boolean;
      owner: { id: string; name: string } | null;
      project: { id: string; name: string; slug: string };
    }>;
  };
  // Daily Catchup block (2026-05-28). Surfaces yesterday's wins,
  // today's active execution, and the next things to chase — built
  // for the management standup view.
  dailyCatchup: {
    yesterdayDone: {
      tasks: Array<{
        id: string;
        title: string;
        status: string;
        isSubtask: boolean;
        owner: { id: string; name: string } | null;
        project: { id: string; name: string; slug: string };
      }>;
      projects: Array<{
        id: string;
        name: string;
        slug: string;
        status: string;
        department: string | null;
        owner: { id: string; name: string } | null;
      }>;
    };
    todayInProgress: {
      tasks: Array<{
        id: string;
        title: string;
        status: string;
        isSubtask: boolean;
        owner: { id: string; name: string } | null;
        project: { id: string; name: string; slug: string };
      }>;
    };
    nextSteps: {
      upcomingGoLives: Array<{
        id: string;
        name: string;
        slug: string;
        goLiveDate: string | null;
        owner: { id: string; name: string } | null;
      }>;
      overdueTasks: Array<{
        id: string;
        title: string;
        endDate: string | null;
        owner: { id: string; name: string } | null;
        project: { id: string; name: string; slug: string };
      }>;
    };
  };
  // Portfolio health RAG mix (heat-map exhibit). `health` is the stored
  // RAG rating; "unrated" buckets projects not yet scored.
  health: {
    distribution: Array<{ health: string; count: number }>;
  };
  // Flow intelligence (dashboard redesign, 2026-05-30) — the metrics the
  // old updatedAt approximations couldn't reach.
  flow: {
    leadTimeDays: number | null;
    taskCycleDays: number | null;
    avgDaysInStage: number | null;
    stageAgingOldest: Array<{
      id: string;
      name: string;
      slug: string;
      status: string;
      department: string | null;
      daysInStage: number | null;
      owner: { id: string; name: string } | null;
    }>;
    slippage: {
      avgSlipDays: number | null;
      projects: Array<{
        id: string;
        name: string;
        slug: string;
        status: string;
        originalGoLive: string | null;
        revisedGoLive: string | null;
        slipDays: number;
        owner: { id: string; name: string } | null;
      }>;
    };
  };
  // Helpdesk SLA attainment. Percentages are 0-100 or null (render "—"
  // when the denominator is 0). `targets` echoes the policy thresholds so
  // the UI can show the bar each tier was measured against.
  sla: {
    response: {
      total: number;
      met: number;
      breached: number;
      attainmentPct: number | null;
    };
    resolution: {
      total: number;
      met: number;
      breached: number;
      attainmentPct: number | null;
    };
    firstFix: { total: number; clean: number; firstFixPct: number | null };
    targets: Record<string, { response: number; resolution: number }>;
  };
  // Helpdesk insights — gives management a single-pane view of IT
  // support load alongside the project work.
  helpdesk: {
    created: { today: number; yesterday: number; thisWeek: number };
    resolved: { today: number; yesterday: number; thisWeek: number };
    open: number;
    openHighPriority: number;
    avgResolutionHours: number | null;
    avgResolutionHoursByPriority: Record<string, number | null>;
    byStatus: Array<{ status: string; count: number }>;
    byPriority: Array<{ priority: string; count: number }>;
    byCategory: Array<{ category: string; count: number }>;
    dailySeries: Array<{ day: string; created: number; resolved: number }>;
    openSpotlight: Array<{
      id: string;
      ticketNumber: number;
      title: string;
      status: string;
      priority: string;
      category: string;
      createdAt: string;
      ageHours: number;
      assignee: { id: string; name: string } | null;
    }>;
  };
}

export async function getItCrmDashboard(): Promise<
  ApiSuccessResponse<ItCrmDashboardSnapshot>
> {
  return api.get("/it-crm/dashboard");
}

// ─── Board ─────────────────────────────────────────────────

export async function getItProjectBoard(
  id: string,
): Promise<ApiSuccessResponse<ItProjectBoard>> {
  return api.get(`/it-crm/${id}/board`);
}
