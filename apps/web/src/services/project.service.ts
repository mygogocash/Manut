import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// ─── Types ──────────────────────────────────────────────

export interface ProjectMember {
  id: string;
  userId: string;
  role: string;
  user: { id: string; name: string; email: string };
}

export interface ProjectColumn {
  id: string;
  key: string;
  label: string;
  color: string;
  sortOrder: number;
}

export interface ProjectCustomField {
  id: string;
  label: string;
  value: string;
}

export type ProjectTeam =
  | "general"
  | "it"
  | "product"
  | "legal"
  | "accounting"
  | "hr";

/**
 * Owning Department on a Project. Mirrors `PROJECT_DEPARTMENT_VALUES`
 * in `apps/api/src/modules/projects/projects.validation.ts` — keep both
 * lists in lockstep when adding a new department; server rejects
 * unknown values on writes.
 */
export const PROJECT_DEPARTMENT_OPTIONS = [
  "Management",
  "Business Team",
  "Marketing",
  "Product",
  "Project",
  "IT",
  "HR",
  "Accounting",
  "Finance",
  "Finance & Accounting",
  "Legal",
  "Digital Social",
  "Operations",
  "Other",
] as const;
export type ProjectDepartment = (typeof PROJECT_DEPARTMENT_OPTIONS)[number];

// Project-team feedback (2026-06-10) — Agreement signing state, shown
// after Rev. GoLive on the Project CRM list and edited in the project
// dialog. `null` = not set.
export const AGREEMENT_OPTIONS = [
  { value: "signed", label: "Signed" },
  { value: "not_signed", label: "Not Signed" },
] as const;
export type AgreementValue = (typeof AGREEMENT_OPTIONS)[number]["value"];

export interface Project {
  id: string;
  name: string;
  slug: string | null;
  description: string | null;
  status: string;
  team?: ProjectTeam;
  progress: number;
  owner: { id: string; name: string; email: string } | string;
  entity: { id: string; name: string } | string;
  startDate: string | null;
  endDate: string | null;
  customFields?: ProjectCustomField[];
  createdAt: string;
  taskCount: number;
  members?: ProjectMember[];
  // BD feedback (May 2026) — structured roll-out tracking columns.
  // Round #2 retyped productionLive boolean → date (when it went live).
  productionLiveDate?: string | null;
  goLiveDate?: string | null;
  revisedGoLiveDate?: string | null;
  agreement?: AgreementValue | null;
  dependency?: string | null;
  comment?: string | null;
  /**
   * Approval state. Null on projects that predate the workflow, which read as
   * drafts and are never blocked.
   */
  workflowStatus?: string | null;
  /** Primary department, always `departments[0]`, kept for filters and charts. */
  department?: ProjectDepartment | null;
  /** Full multi-select. Empty on legacy rows that only ever had the scalar. */
  departments?: ProjectDepartment[];
  // Legal team (2026-05-25) — Workstream tag. Free-text, surfaced
  // only in the Legal CRM list + form.
  workstream?: string | null;
  // Legal team (2026-05-26) — long-form details (counterparty notes,
  // deal mechanics, drive links). Surfaced as a dedicated column in
  // the Legal CRM list, right of `Legal Task`.
  details?: string | null;
  // HR team (2026-05-26) — Task Type + Assigned Team categorise HR
  // CRM rows. Frontend constrains to a fixed whitelist; backend
  // stores free-text.
  taskType?: string | null;
  assignedTeam?: string | null;
  // Auto-assign default for new tasks (shared-board CRMs).
  defaultAssigneeMode?: "none" | "creator" | "owner" | "user";
  defaultAssigneeId?: string | null;
  sortOrder?: number;
  // Active/Archived board tabs. `null` = active; a timestamp = archived.
  archivedAt?: string | null;
}

export interface TaskAssignee {
  id: string;
  userId: string;
  allocationPct: number | null;
  user: { id: string; name: string; email: string };
}

export interface Task {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  order: number;
  assigneeId: string | null;
  assigneeName: string | null;
  owner?: { id: string; name: string; email: string } | null;
  ownerId?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  milestoneId?: string | null;
  assignees?: TaskAssignee[];
  projectId: string;
  createdAt: string;
  updatedAt?: string;
  parentTaskId?: string | null;
  sortOrder?: number;
  parent?: { id: string; title: string } | null;
}

export interface ProjectMilestone {
  id: string;
  projectId: string;
  title: string;
  description: string | null;
  status: "not_started" | "in_progress" | "done" | "blocked";
  ownerId: string | null;
  owner: { id: string; name: string; email: string } | null;
  startDate: string | null;
  endDate: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  _count?: { tasks: number };
}

export type DependencyType =
  | "finish_to_start"
  | "start_to_start"
  | "finish_to_finish"
  | "start_to_finish";

export interface TaskDependency {
  id: string;
  taskId: string;
  dependsOnTaskId: string;
  type: DependencyType;
  createdAt: string;
}

export interface TaskDependencyWithTask extends TaskDependency {
  task?: { id: string; title: string; status: string };
  dependsOnTask?: { id: string; title: string; status: string };
}

export interface TaskResource {
  id: string;
  taskId: string;
  kind: "file" | "link" | "doc";
  label: string;
  url: string;
  docId: string | null;
  createdAt: string;
  creator: { id: string; name: string; email: string };
}

export interface TimelineSnapshot {
  milestones: ProjectMilestone[];
  tasks: Task[];
  dependencies: TaskDependency[];
}

export interface TaskComment {
  id: string;
  taskId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string; email: string };
}

export interface TaskActivity {
  id: string;
  taskId: string;
  kind: string;
  field: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: string;
  actor: { id: string; name: string; email: string };
}

export interface TaskDetailPayload {
  task: Task & {
    // findTaskForDetail eagerly includes these relations so the
    // detail sheet has the full multi-assign / dependency / resource
    // surface without extra round-trips.
    assignees?: TaskAssignee[];
    dependencies?: TaskDependencyWithTask[];
    dependents?: TaskDependencyWithTask[];
    resources?: TaskResource[];
  };
  subtasks: Task[];
  comments: TaskComment[];
  activities: TaskActivity[];
}

export interface ProjectDetail extends Project {
  tasks: Task[];
  columns?: ProjectColumn[];
}

export interface CreateProjectInput {
  name: string;
  description?: string;
  status?: string;
  team?: ProjectTeam;
  partnerId?: string;
  ownerId?: string;
  startDate?: string;
  endDate?: string;
  budget?: number;
  progress?: number;
  memberIds?: string[];
  customFields?: ProjectCustomField[];
  // BD feedback (May 2026)
  productionLiveDate?: string | null;
  goLiveDate?: string | null;
  revisedGoLiveDate?: string | null;
  agreement?: AgreementValue | null;
  dependency?: string | null;
  comment?: string | null;
  department?: ProjectDepartment | null;
  /** Send this to set several. The server derives `department` from its head. */
  departments?: ProjectDepartment[];
  workstream?: string | null;
  details?: string | null;
  taskType?: string | null;
  assignedTeam?: string | null;
  defaultAssigneeMode?: "none" | "creator" | "owner" | "user";
  defaultAssigneeId?: string | null;
}

/**
 * Single source of truth for project statuses (mirrors
 * `PROJECT_STATUS_VALUES` in `apps/api/src/modules/projects/projects.validation.ts`).
 * Update both lists together.
 */
export const PROJECT_STATUS_OPTIONS = [
  { value: "not_yet_started", label: "Not Yet Started" },
  { value: "in_progress", label: "In Progress" },
  { value: "uat", label: "UAT" },
  { value: "staging_integrated", label: "Staging Integrated" },
  { value: "prod_integrated", label: "Prod. Integrated" },
  { value: "on_hold", label: "On Hold" },
  { value: "completed", label: "Completed" },
  // HR-only statuses (2026-05-26). The HR form picker surfaces a
  // subset of this list; other CRMs continue to render the shared
  // BD-style statuses.
  { value: "pending_documents", label: "Pending Documents" },
  { value: "pending_approval", label: "Pending Approval" },
  { value: "closed", label: "Closed" },
  { value: "cancelled", label: "Cancelled" },
  // Legal-team status (2026-05-26) — third state in their three-pill
  // workflow alongside Complete / In progress.
  { value: "pending_dept_info", label: "Pending Dept. Info" },
] as const;

export type ProjectStatusValue =
  (typeof PROJECT_STATUS_OPTIONS)[number]["value"];

export function projectStatusLabel(value: string): string {
  return (
    PROJECT_STATUS_OPTIONS.find((o) => o.value === value)?.label ??
    value.replace(/_/g, " ")
  );
}

// HR-team feedback (2026-05-26) — HR Workflow Status whitelist.
// Subset of PROJECT_STATUS_OPTIONS, in the order the HR team
// requested. Used by the HR CRM form picker and the HR layout list
// status badge.
export const HR_WORKFLOW_STATUS_VALUES = [
  "not_yet_started",
  "in_progress",
  "pending_documents",
  "pending_approval",
  "completed",
  "closed",
  "cancelled",
] as const;

export const HR_TASK_TYPE_OPTIONS = ["Visa", "HR", "Admin", "F&A"] as const;

export const HR_ASSIGNED_TEAM_OPTIONS = ["HR", "Visa", "Admin", "F&A"] as const;

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  ownerId?: string;
  startDate?: string;
  endDate?: string;
  milestoneId?: string;
  assigneeIds?: string[];
  parentTaskId?: string;
}

export interface CreateMilestoneInput {
  title: string;
  description?: string;
  status?: "not_started" | "in_progress" | "done" | "blocked";
  ownerId?: string;
  startDate?: string;
  endDate?: string;
  sortOrder?: number;
}

export interface ProjectParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  team?: ProjectTeam;
  department?: ProjectDepartment;
  /** Agreement signing state filter (Signed / Not Signed). */
  agreement?: AgreementValue;
  partnerId?: string;
  // When true, return ONLY archived projects; omit/false shows active only.
  archived?: boolean;
}

// ─── Projects ───────────────────────────────────────────

export function getProjects(params?: ProjectParams) {
  const qs = new URLSearchParams();
  if (params?.page) qs.set("page", String(params.page));
  if (params?.limit) qs.set("limit", String(params.limit));
  if (params?.search) qs.set("search", params.search);
  if (params?.status) qs.set("status", params.status);
  if (params?.team) qs.set("team", params.team);
  if (params?.department) qs.set("department", params.department);
  if (params?.agreement) qs.set("agreement", params.agreement);
  if (params?.partnerId) qs.set("partnerId", params.partnerId);
  // Serialize only when true, a falsy value is dropped so the default
  // (active-only) view sends no `archived` param.
  if (params?.archived) qs.set("archived", "true");
  const query = qs.toString();
  return api.get<ApiPaginatedResponse<Project>>(
    `/projects${query ? `?${query}` : ""}`,
  );
}

export function getProject(idOrSlug: string) {
  return api.get<ApiSuccessResponse<ProjectDetail>>(`/projects/${idOrSlug}`);
}

export function createProject(data: CreateProjectInput) {
  return api.post<ApiSuccessResponse<ProjectDetail>>("/projects", data);
}

export function updateProject(id: string, data: Partial<CreateProjectInput>) {
  return api.put<ApiSuccessResponse<ProjectDetail>>(`/projects/${id}`, data);
}

export function deleteProject(id: string) {
  return api.delete(`/projects/${id}`);
}

export function reorderProjects(orderedIds: string[]) {
  return api.put<ApiSuccessResponse<{ updated: number }>>("/projects/reorder", {
    orderedIds,
  });
}

// Active/Archived board tabs (mirrors IT CRM). Archive/restore is owner-or-
// manage on the backend, same gate as update/delete. Both return the updated
// project row.
export function archiveProject(id: string) {
  return api.post<ApiSuccessResponse<ProjectDetail>>(
    `/projects/${id}/archive`,
    {},
  );
}

export function unarchiveProject(id: string) {
  return api.post<ApiSuccessResponse<ProjectDetail>>(
    `/projects/${id}/unarchive`,
    {},
  );
}

// Move a project into another CRM module. Partner is the only
// cross-table target today — the project + board migrate into the
// native partner_* tables and the source project is deleted. `company`
// overrides the partner Company (defaults to the project name).
export function moveProjectToPartner(id: string, company?: string) {
  return api.post<ApiSuccessResponse<{ id: string; company: string }>>(
    `/projects/${id}/move`,
    { target: "partner", company },
  );
}

export function importProjects(rows: CreateProjectInput[]) {
  return api.post<ApiSuccessResponse<{ created: number }>>("/projects/import", {
    rows,
  });
}

// ─── Task export / import ───────────────────────────────

export interface ProjectTaskExportRow {
  project: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  owner: string;
  startDate: string;
  endDate: string;
  parentTitle: string;
}

export interface ImportProjectTaskRow {
  project: string;
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  startDate?: string;
  endDate?: string;
  parentTitle?: string;
}

export function exportProjectTasks(params?: ProjectParams) {
  const qs = new URLSearchParams();
  if (params?.team) qs.set("team", params.team);
  if (params?.search) qs.set("search", params.search);
  if (params?.status) qs.set("status", params.status);
  if (params?.department) qs.set("department", params.department);
  if (params?.agreement) qs.set("agreement", params.agreement);
  const query = qs.toString();
  return api.get<ApiSuccessResponse<ProjectTaskExportRow[]>>(
    `/projects/tasks/export${query ? `?${query}` : ""}`,
  );
}

export function importProjectTasks(rows: ImportProjectTaskRow[]) {
  return api.post<ApiSuccessResponse<{ created: number; skipped: number }>>(
    "/projects/tasks/import",
    { rows },
  );
}

// ─── Combined import (projects + their tasks in one file) ───

export interface CombinedImportTask {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  startDate?: string;
  endDate?: string;
  parentTitle?: string;
}

export interface CombinedImportProject {
  /**
   * Project display name. For Legal CRM imports this is the "Legal
   * Task" column (often blank); the server falls back to `workstream`
   * when this is empty so a row without a category still imports.
   */
  name: string;
  status?: string;
  department?: string;
  dependency?: string;
  comment?: string;
  goLiveDate?: string;
  /** Legal CRM: the long "Workstream" task title from the checklist xlsx. */
  workstream?: string;
  /** Legal CRM: free-text "Description" column; maps to `project.details`. */
  details?: string;
  tasks: CombinedImportTask[];
}

// Always create-new on the server, so re-importing existing data yields
// a duplicate project (with its own task tree).
export function importCombinedProjects(
  team: ProjectTeam,
  groups: CombinedImportProject[],
) {
  return api.post<
    ApiSuccessResponse<{
      projectsCreated: number;
      tasksCreated: number;
      created: number;
    }>
  >("/projects/import-combined", { team, groups });
}

// ─── Members ────────────────────────────────────────────

export function getProjectMembers(projectId: string) {
  return api.get<ApiSuccessResponse<ProjectMember[]>>(
    `/projects/${projectId}/members`,
  );
}

export function setProjectMembers(projectId: string, memberIds: string[]) {
  return api.put<ApiSuccessResponse<ProjectMember[]>>(
    `/projects/${projectId}/members`,
    { memberIds },
  );
}

// ─── Columns ────────────────────────────────────────────

export function createColumn(
  projectId: string,
  data: { key: string; label: string; color?: string; sortOrder?: number },
) {
  return api.post<ApiSuccessResponse<ProjectColumn>>(
    `/projects/${projectId}/columns`,
    data,
  );
}

export function updateColumn(
  projectId: string,
  columnId: string,
  data: { label?: string; color?: string; sortOrder?: number },
) {
  return api.put<ApiSuccessResponse<ProjectColumn>>(
    `/projects/${projectId}/columns/${columnId}`,
    data,
  );
}

export function deleteColumn(projectId: string, columnId: string) {
  return api.delete(`/projects/${projectId}/columns/${columnId}`);
}

// ─── Tasks ──────────────────────────────────────────────

export function createTask(projectId: string, data: CreateTaskInput) {
  return api.post<ApiSuccessResponse<Task>>(
    `/projects/${projectId}/tasks`,
    data,
  );
}

export function updateTask(
  projectId: string,
  taskId: string,
  data: Partial<CreateTaskInput>,
) {
  return api.put<ApiSuccessResponse<Task>>(
    `/projects/${projectId}/tasks/${taskId}`,
    data,
  );
}

export function deleteTask(projectId: string, taskId: string) {
  return api.delete(`/projects/${projectId}/tasks/${taskId}`);
}

export interface ProjectDashboardSnapshot {
  total: number;
  productionLive: number;
  atRisk: number;
  inProgress: number;
  byStatus: Array<{ status: string; count: number }>;
  byDepartment: Array<{ department: string | null; count: number }>;
  upcomingGoLives: Array<{
    id: string;
    name: string;
    slug: string;
    status: string;
    department: string | null;
    goLiveDate: string | null;
    revisedGoLiveDate: string | null;
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
}

export function getProjectsDashboard(team: string = "general") {
  return api.get<ApiSuccessResponse<ProjectDashboardSnapshot>>(
    `/projects/dashboard?team=${encodeURIComponent(team)}`,
  );
}

export function reorderTasks(
  projectId: string,
  orderedIds: string[],
  status?: string,
) {
  return api.post<ApiSuccessResponse<{ updated: number }>>(
    `/projects/${projectId}/tasks/reorder`,
    { orderedIds, ...(status ? { status } : {}) },
  );
}

export function getTaskDetail(projectId: string, taskId: string) {
  return api.get<ApiSuccessResponse<TaskDetailPayload>>(
    `/projects/${projectId}/tasks/${taskId}/detail`,
  );
}

export function createTaskComment(
  projectId: string,
  taskId: string,
  data: { body: string },
) {
  return api.post<ApiSuccessResponse<TaskComment>>(
    `/projects/${projectId}/tasks/${taskId}/comments`,
    data,
  );
}

// ─── AI ──────────────────────────────────────────────────

export interface GeneratedTask {
  title: string;
  description: string;
  priority: string;
  status: string;
  sortOrder: number;
}

export interface GenerateTasksResponse {
  tasks: GeneratedTask[];
}

export interface AiSourceFile {
  name: string;
  mimeType: string;
  dataBase64: string;
}

export function generateTasksWithAI(
  projectId: string,
  data: {
    description: string;
    additionalContext?: string;
    files?: AiSourceFile[];
  },
) {
  return api.post<ApiSuccessResponse<GenerateTasksResponse>>(
    `/projects/${projectId}/ai/generate-tasks`,
    data,
  );
}

// ─── Milestones ─────────────────────────────────────────

export function getMilestones(projectId: string) {
  return api.get<ApiSuccessResponse<ProjectMilestone[]>>(
    `/projects/${projectId}/milestones`,
  );
}

export function createMilestone(projectId: string, data: CreateMilestoneInput) {
  return api.post<ApiSuccessResponse<ProjectMilestone>>(
    `/projects/${projectId}/milestones`,
    data,
  );
}

export function updateMilestone(
  projectId: string,
  milestoneId: string,
  data: Partial<CreateMilestoneInput>,
) {
  return api.put<ApiSuccessResponse<ProjectMilestone>>(
    `/projects/${projectId}/milestones/${milestoneId}`,
    data,
  );
}

export function deleteMilestone(projectId: string, milestoneId: string) {
  return api.delete(`/projects/${projectId}/milestones/${milestoneId}`);
}

// ─── Multi-assign ───────────────────────────────────────

export function setTaskAssignees(
  projectId: string,
  taskId: string,
  assignees: Array<{ userId: string; allocationPct?: number }>,
) {
  return api.put<ApiSuccessResponse<TaskAssignee[]>>(
    `/projects/${projectId}/tasks/${taskId}/assignees`,
    { assignees },
  );
}

// ─── Dependencies ───────────────────────────────────────

export function getTaskDependencies(projectId: string, taskId: string) {
  return api.get<
    ApiSuccessResponse<{
      blockedBy: TaskDependencyWithTask[];
      blocking: TaskDependencyWithTask[];
    }>
  >(`/projects/${projectId}/tasks/${taskId}/dependencies`);
}

export function addTaskDependency(
  projectId: string,
  taskId: string,
  data: { dependsOnTaskId: string; type?: DependencyType },
) {
  return api.post<ApiSuccessResponse<TaskDependency>>(
    `/projects/${projectId}/tasks/${taskId}/dependencies`,
    data,
  );
}

export function removeTaskDependency(
  projectId: string,
  taskId: string,
  dependencyId: string,
) {
  return api.delete(
    `/projects/${projectId}/tasks/${taskId}/dependencies/${dependencyId}`,
  );
}

// ─── Resources ──────────────────────────────────────────

export function getTaskResources(projectId: string, taskId: string) {
  return api.get<ApiSuccessResponse<TaskResource[]>>(
    `/projects/${projectId}/tasks/${taskId}/resources`,
  );
}

export function addTaskResource(
  projectId: string,
  taskId: string,
  data: {
    kind: "file" | "link" | "doc";
    label: string;
    url: string;
    docId?: string;
  },
) {
  return api.post<ApiSuccessResponse<TaskResource>>(
    `/projects/${projectId}/tasks/${taskId}/resources`,
    data,
  );
}

export function removeTaskResource(
  projectId: string,
  taskId: string,
  resourceId: string,
) {
  return api.delete(
    `/projects/${projectId}/tasks/${taskId}/resources/${resourceId}`,
  );
}

export function getResourceDownloadUrl(
  projectId: string,
  taskId: string,
  resourceId: string,
) {
  return api.get<ApiSuccessResponse<{ url: string }>>(
    `/projects/${projectId}/tasks/${taskId}/resources/${resourceId}/download`,
  );
}

// ─── Timeline ───────────────────────────────────────────

export function getTimeline(projectId: string) {
  return api.get<ApiSuccessResponse<TimelineSnapshot>>(
    `/projects/${projectId}/timeline`,
  );
}
