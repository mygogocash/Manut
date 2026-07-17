import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// Typed client for the Legal CRM standalone workspace.
// Mounted at `/api/legal-crm`.

export interface LegalCrmUser {
  id: string;
  name: string;
  email: string;
}

export interface LegalProject {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  ownerId: string;
  owner: LegalCrmUser | null;
  startDate: string | null;
  endDate: string | null;
  productionLiveDate: string | null;
  goLiveDate: string | null;
  revisedGoLiveDate: string | null;
  dependency: string | null;
  comment: string | null;
  sortOrder: number;
  department: string | null;
  workstream: string | null;
  details: string | null;
  priority: string;
  // Auto-assign default for new tasks: none | creator | owner | user.
  defaultAssigneeMode: string;
  defaultAssigneeId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LegalProjectColumn {
  id: string;
  projectId: string;
  key: string;
  label: string;
  color: string;
  sortOrder: number;
}

export interface LegalProjectTaskAssignee {
  id: string;
  taskId: string;
  userId: string;
  allocationPct: number | null;
  user: LegalCrmUser;
}

export interface LegalProjectTask {
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
  owner: LegalCrmUser | null;
  assignees: LegalProjectTaskAssignee[];
}

export interface LegalProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: string;
  createdAt: string;
  user: LegalCrmUser;
}

export interface LegalProjectBoard {
  columns: LegalProjectColumn[];
  tasks: LegalProjectTask[];
  members: LegalProjectMember[];
}

export interface CreateLegalProjectInput {
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
  workstream?: string | null;
  details?: string | null;
  priority?: string;
  sortOrder?: number;
  defaultAssigneeMode?: "none" | "creator" | "owner" | "user";
  defaultAssigneeId?: string | null;
}

export type UpdateLegalProjectInput = Partial<CreateLegalProjectInput>;

export interface LegalProjectListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  department?: string;
}

// ─── Project CRUD ──────────────────────────────────────────

export async function listLegalProjects(
  params: LegalProjectListParams = {},
): Promise<ApiPaginatedResponse<LegalProject>> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const tail = qs.toString() ? `?${qs.toString()}` : "";
  return api.get(`/legal-crm${tail}`);
}

export async function createLegalProject(
  input: CreateLegalProjectInput,
): Promise<ApiSuccessResponse<LegalProject>> {
  return api.post("/legal-crm", input);
}

export async function getLegalProject(
  id: string,
): Promise<ApiSuccessResponse<LegalProject & { role: string }>> {
  return api.get(`/legal-crm/${id}`);
}

export async function updateLegalProject(
  id: string,
  input: UpdateLegalProjectInput,
): Promise<ApiSuccessResponse<LegalProject>> {
  return api.put(`/legal-crm/${id}`, input);
}

export async function deleteLegalProject(
  id: string,
): Promise<ApiSuccessResponse<{ success: true }>> {
  return api.delete(`/legal-crm/${id}`);
}

export async function reorderLegalProjects(
  orderedIds: string[],
): Promise<ApiSuccessResponse<{ success: true }>> {
  return api.put("/legal-crm/reorder", { orderedIds });
}

export async function importLegalProjects(
  rows: CreateLegalProjectInput[],
): Promise<ApiSuccessResponse<{ created: number }>> {
  return api.post("/legal-crm/import", { rows });
}

// ─── Board ─────────────────────────────────────────────────

export async function getLegalProjectBoard(
  id: string,
): Promise<ApiSuccessResponse<LegalProjectBoard>> {
  return api.get(`/legal-crm/${id}/board`);
}
