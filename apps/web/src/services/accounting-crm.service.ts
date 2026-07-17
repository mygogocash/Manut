import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// Typed client for the Accounting CRM standalone workspace.
// Mounted at `/api/accounting-crm`.

export interface AccountingCrmUser {
  id: string;
  name: string;
  email: string;
}

export interface AccountingProject {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  ownerId: string;
  owner: AccountingCrmUser | null;
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

export interface AccountingProjectColumn {
  id: string;
  projectId: string;
  key: string;
  label: string;
  color: string;
  sortOrder: number;
}

export interface AccountingProjectTaskAssignee {
  id: string;
  taskId: string;
  userId: string;
  allocationPct: number | null;
  user: AccountingCrmUser;
}

export interface AccountingProjectTask {
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
  owner: AccountingCrmUser | null;
  assignees: AccountingProjectTaskAssignee[];
}

export interface AccountingProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: string;
  createdAt: string;
  user: AccountingCrmUser;
}

export interface AccountingProjectBoard {
  columns: AccountingProjectColumn[];
  tasks: AccountingProjectTask[];
  members: AccountingProjectMember[];
}

export interface CreateAccountingProjectInput {
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

export type UpdateAccountingProjectInput =
  Partial<CreateAccountingProjectInput>;

export interface AccountingProjectListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  department?: string;
}

// ─── Project CRUD ──────────────────────────────────────────

export async function listAccountingProjects(
  params: AccountingProjectListParams = {},
): Promise<ApiPaginatedResponse<AccountingProject>> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const tail = qs.toString() ? `?${qs.toString()}` : "";
  return api.get(`/accounting-crm${tail}`);
}

export async function createAccountingProject(
  input: CreateAccountingProjectInput,
): Promise<ApiSuccessResponse<AccountingProject>> {
  return api.post("/accounting-crm", input);
}

export async function getAccountingProject(
  id: string,
): Promise<ApiSuccessResponse<AccountingProject & { role: string }>> {
  return api.get(`/accounting-crm/${id}`);
}

export async function updateAccountingProject(
  id: string,
  input: UpdateAccountingProjectInput,
): Promise<ApiSuccessResponse<AccountingProject>> {
  return api.put(`/accounting-crm/${id}`, input);
}

export async function deleteAccountingProject(
  id: string,
): Promise<ApiSuccessResponse<{ success: true }>> {
  return api.delete(`/accounting-crm/${id}`);
}

export async function reorderAccountingProjects(
  orderedIds: string[],
): Promise<ApiSuccessResponse<{ success: true }>> {
  return api.put("/accounting-crm/reorder", { orderedIds });
}

export async function importAccountingProjects(
  rows: CreateAccountingProjectInput[],
): Promise<ApiSuccessResponse<{ created: number }>> {
  return api.post("/accounting-crm/import", { rows });
}

// ─── Board ─────────────────────────────────────────────────

export async function getAccountingProjectBoard(
  id: string,
): Promise<ApiSuccessResponse<AccountingProjectBoard>> {
  return api.get(`/accounting-crm/${id}/board`);
}
