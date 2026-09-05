import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// Phase 3 of the QA CRM standalone workspace (Option A per-CRM
// schema isolation, 2026-05-26). Typed client for the Phase 2
// backend endpoints (#612 chain). Mounted at `/api/qa-crm`. The
// task model extends with the QA team's Excel template fields
// (issueDate / product / issueType / observation / expectation /
// eta / qaComment) — see qa-crm.service.ts in the API.

export type QaPriority = "P0" | "P1" | "P2";
export type QaTaskStatus = "open" | "clarified" | "exception" | "closed";

export interface QaCrmUser {
  id: string;
  name: string;
  email: string;
}

export interface QaProject {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  ownerId: string;
  owner: QaCrmUser | null;
  startDate: string | null;
  endDate: string | null;
  comment: string | null;
  sortOrder: number;
  department: string | null;
  // Auto-assign default for new tasks: none | creator | owner | user.
  defaultAssigneeMode: string;
  defaultAssigneeId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface QaProjectColumn {
  id: string;
  projectId: string;
  key: string;
  label: string;
  color: string;
  sortOrder: number;
}

export interface QaProjectTaskAssignee {
  id: string;
  taskId: string;
  userId: string;
  allocationPct: number | null;
  user: QaCrmUser;
}

export interface QaProjectTask {
  id: string;
  projectId: string;
  parentTaskId: string | null;
  title: string;
  description: string | null;
  status: QaTaskStatus;
  priority: QaPriority;
  ownerId: string | null;
  startDate: string | null;
  endDate: string | null;
  sortOrder: number;
  // QA template fields
  issueDate: string | null;
  partner: string | null;
  product: string | null;
  issueType: string | null;
  observation: string | null;
  expectation: string | null;
  eta: string | null;
  qaComment: string | null;
  createdAt: string;
  updatedAt: string;
  owner: QaCrmUser | null;
  assignees: QaProjectTaskAssignee[];
}

export interface QaProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: string;
  createdAt: string;
  user: QaCrmUser;
}

export interface QaProjectBoard {
  columns: QaProjectColumn[];
  tasks: QaProjectTask[];
  members: QaProjectMember[];
}

export interface CreateQaProjectInput {
  name: string;
  description?: string;
  status?: string;
  ownerId?: string;
  startDate?: string;
  endDate?: string;
  comment?: string | null;
  department?: string | null;
  sortOrder?: number;
  defaultAssigneeMode?: "none" | "creator" | "owner" | "user";
  defaultAssigneeId?: string | null;
}

export type UpdateQaProjectInput = Partial<CreateQaProjectInput>;

export interface QaProjectListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  department?: string;
  // When true, return ONLY archived projects; omit/false shows active only.
  archived?: boolean;
}

export interface CreateQaProjectTaskInput {
  title: string;
  description?: string;
  status?: QaTaskStatus;
  priority?: QaPriority;
  ownerId?: string;
  startDate?: string;
  endDate?: string;
  assigneeIds?: string[];
  sortOrder?: number;
  parentTaskId?: string;
  issueDate?: string | null;
  partner?: string | null;
  product?: string | null;
  issueType?: string | null;
  observation?: string | null;
  expectation?: string | null;
  eta?: string | null;
  qaComment?: string | null;
}

export type UpdateQaProjectTaskInput = Omit<
  Partial<CreateQaProjectTaskInput>,
  "parentTaskId"
>;

// ─── Project CRUD ──────────────────────────────────────────

export async function listQaProjects(
  params: QaProjectListParams = {},
): Promise<ApiPaginatedResponse<QaProject>> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const tail = qs.toString() ? `?${qs.toString()}` : "";
  return api.get(`/qa-crm${tail}`);
}

export async function createQaProject(
  input: CreateQaProjectInput,
): Promise<ApiSuccessResponse<QaProject>> {
  return api.post("/qa-crm", input);
}

export async function getQaProject(
  id: string,
): Promise<ApiSuccessResponse<QaProject & { role: string }>> {
  return api.get(`/qa-crm/${id}`);
}

export async function updateQaProject(
  id: string,
  input: UpdateQaProjectInput,
): Promise<ApiSuccessResponse<QaProject>> {
  return api.put(`/qa-crm/${id}`, input);
}

export async function deleteQaProject(
  id: string,
): Promise<ApiSuccessResponse<{ success: true }>> {
  return api.delete(`/qa-crm/${id}`);
}

export async function archiveQaProject(
  id: string,
): Promise<ApiSuccessResponse<QaProject>> {
  return api.post(`/qa-crm/${id}/archive`, {});
}

export async function unarchiveQaProject(
  id: string,
): Promise<ApiSuccessResponse<QaProject>> {
  return api.post(`/qa-crm/${id}/unarchive`, {});
}

export async function reorderQaProjects(
  orderedIds: string[],
): Promise<ApiSuccessResponse<{ success: true }>> {
  return api.put("/qa-crm/reorder", { orderedIds });
}

// Reorder QA issues (tasks) within a project.
export async function reorderQaTasks(
  projectId: string,
  orderedIds: string[],
): Promise<ApiSuccessResponse<{ success: true }>> {
  return api.put(`/qa-crm/${projectId}/tasks/reorder`, { orderedIds });
}

// ─── Board ─────────────────────────────────────────────────

export async function getQaProjectBoard(
  id: string,
): Promise<ApiSuccessResponse<QaProjectBoard>> {
  return api.get(`/qa-crm/${id}/board`);
}

// ─── Tasks (QA issues) ─────────────────────────────────────

export async function createQaTask(
  projectId: string,
  input: CreateQaProjectTaskInput,
): Promise<ApiSuccessResponse<QaProjectTask>> {
  return api.post(`/qa-crm/${projectId}/tasks`, input);
}

export async function updateQaTask(
  projectId: string,
  taskId: string,
  input: UpdateQaProjectTaskInput,
): Promise<ApiSuccessResponse<QaProjectTask>> {
  return api.put(`/qa-crm/${projectId}/tasks/${taskId}`, input);
}

export async function deleteQaTask(
  projectId: string,
  taskId: string,
): Promise<ApiSuccessResponse<{ success: true }>> {
  return api.delete(`/qa-crm/${projectId}/tasks/${taskId}`);
}

export async function importQaTasks(
  projectId: string,
  rows: CreateQaProjectTaskInput[],
): Promise<ApiSuccessResponse<{ created: number }>> {
  return api.post(`/qa-crm/${projectId}/tasks/import`, { rows });
}
