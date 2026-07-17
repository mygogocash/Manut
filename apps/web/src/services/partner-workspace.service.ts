import { api } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api.type";

// Phase 3 of the Partner ↔ Project decouple. Typed client for the
// Phase 2 backend endpoints (#605). Replaces the redirect-shim that
// pointed every Partner detail click into the legacy `/projects/<id>`
// page.

export interface PartnerWorkspaceUser {
  id: string;
  name: string;
  email: string;
}

export interface PartnerColumn {
  id: string;
  partnerId: string;
  key: string;
  label: string;
  color: string;
  sortOrder: number;
}

export interface PartnerTaskAssignee {
  id: string;
  taskId: string;
  userId: string;
  allocationPct: number | null;
  user: PartnerWorkspaceUser;
}

export interface PartnerTaskResource {
  id: string;
  taskId: string;
  kind: string;
  label: string;
  url: string;
  createdAt: string;
  createdBy: string;
}

export interface PartnerTask {
  id: string;
  partnerId: string;
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
  owner: PartnerWorkspaceUser | null;
  assignees: PartnerTaskAssignee[];
  resources?: PartnerTaskResource[];
}

export interface PartnerMember {
  id: string;
  partnerId: string;
  userId: string;
  role: string;
  createdAt: string;
  user: PartnerWorkspaceUser;
}

export interface PartnerBoardSummary {
  id: string;
  slug: string;
  company: string;
  ownerId: string | null;
}

export interface PartnerBoard {
  partner: PartnerBoardSummary;
  columns: PartnerColumn[];
  tasks: PartnerTask[];
  members: PartnerMember[];
}

export interface PartnerTaskComment {
  id: string;
  taskId: string;
  authorId: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  author: PartnerWorkspaceUser;
}

export interface CreatePartnerTaskInput {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  ownerId?: string;
  startDate?: string;
  endDate?: string;
  assigneeIds?: string[];
  sortOrder?: number;
  parentTaskId?: string;
  columnKey?: string;
}

export type UpdatePartnerTaskInput = Omit<
  Partial<CreatePartnerTaskInput>,
  "parentTaskId"
>;

export interface CreatePartnerColumnInput {
  key: string;
  label: string;
  color?: string;
  sortOrder?: number;
}

export type UpdatePartnerColumnInput = Omit<
  Partial<CreatePartnerColumnInput>,
  "key"
>;

export interface ManagePartnerMembersInput {
  userIds: string[];
}

export interface ManagePartnerTaskAssigneesInput {
  assignees: Array<{ userId: string; allocationPct?: number }>;
}

// ─── Endpoints ─────────────────────────────────────────────

export async function getPartnerBoard(
  partnerId: string,
): Promise<ApiSuccessResponse<PartnerBoard>> {
  return api.get(`/partners/${partnerId}/board`);
}

export async function createPartnerTask(
  partnerId: string,
  input: CreatePartnerTaskInput,
): Promise<ApiSuccessResponse<PartnerTask>> {
  return api.post(`/partners/${partnerId}/tasks`, input);
}

export async function updatePartnerTask(
  partnerId: string,
  taskId: string,
  input: UpdatePartnerTaskInput,
): Promise<ApiSuccessResponse<PartnerTask>> {
  return api.put(`/partners/${partnerId}/tasks/${taskId}`, input);
}

export async function deletePartnerTask(
  partnerId: string,
  taskId: string,
): Promise<ApiSuccessResponse<{ success: true }>> {
  return api.delete(`/partners/${partnerId}/tasks/${taskId}`);
}

// ─── Task resources (attachments) ──────────────────────────
export async function getPartnerTaskResources(
  partnerId: string,
  taskId: string,
): Promise<ApiSuccessResponse<PartnerTaskResource[]>> {
  return api.get(`/partners/${partnerId}/tasks/${taskId}/resources`);
}

export async function addPartnerTaskResource(
  partnerId: string,
  taskId: string,
  input: { kind: "file" | "link"; label: string; url: string },
): Promise<ApiSuccessResponse<PartnerTaskResource>> {
  return api.post(`/partners/${partnerId}/tasks/${taskId}/resources`, input);
}

export async function removePartnerTaskResource(
  partnerId: string,
  taskId: string,
  resourceId: string,
): Promise<ApiSuccessResponse<{ success: true }>> {
  return api.delete(
    `/partners/${partnerId}/tasks/${taskId}/resources/${resourceId}`,
  );
}

export async function createPartnerColumn(
  partnerId: string,
  input: CreatePartnerColumnInput,
): Promise<ApiSuccessResponse<PartnerColumn>> {
  return api.post(`/partners/${partnerId}/columns`, input);
}

export async function updatePartnerColumn(
  partnerId: string,
  columnId: string,
  input: UpdatePartnerColumnInput,
): Promise<ApiSuccessResponse<PartnerColumn>> {
  return api.put(`/partners/${partnerId}/columns/${columnId}`, input);
}

export async function deletePartnerColumn(
  partnerId: string,
  columnId: string,
): Promise<ApiSuccessResponse<{ success: true }>> {
  return api.delete(`/partners/${partnerId}/columns/${columnId}`);
}

export async function listPartnerMembers(
  partnerId: string,
): Promise<ApiSuccessResponse<PartnerMember[]>> {
  return api.get(`/partners/${partnerId}/members`);
}

export async function setPartnerMembers(
  partnerId: string,
  input: ManagePartnerMembersInput,
): Promise<ApiSuccessResponse<PartnerMember[]>> {
  return api.put(`/partners/${partnerId}/members`, input);
}

export async function createPartnerTaskComment(
  partnerId: string,
  taskId: string,
  body: string,
): Promise<ApiSuccessResponse<PartnerTaskComment>> {
  return api.post(`/partners/${partnerId}/tasks/${taskId}/comments`, { body });
}

export async function setPartnerTaskAssignees(
  partnerId: string,
  taskId: string,
  input: ManagePartnerTaskAssigneesInput,
): Promise<ApiSuccessResponse<PartnerTaskAssignee[]>> {
  return api.put(`/partners/${partnerId}/tasks/${taskId}/assignees`, input);
}
