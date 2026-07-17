import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// Typed client for the Product CRM standalone workspace.
// Mounted at `/api/product-crm`.

export interface ProductCrmUser {
  id: string;
  name: string;
  email: string;
}

export interface ProductProject {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: string;
  ownerId: string;
  owner: ProductCrmUser | null;
  startDate: string | null;
  endDate: string | null;
  productionLiveDate: string | null;
  goLiveDate: string | null;
  revisedGoLiveDate: string | null;
  dependency: string | null;
  comment: string | null;
  sortOrder: number;
  department: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProductProjectColumn {
  id: string;
  projectId: string;
  key: string;
  label: string;
  color: string;
  sortOrder: number;
}

export interface ProductProjectTaskAssignee {
  id: string;
  taskId: string;
  userId: string;
  allocationPct: number | null;
  user: ProductCrmUser;
}

export interface ProductProjectTask {
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
  owner: ProductCrmUser | null;
  assignees: ProductProjectTaskAssignee[];
}

export interface ProductProjectMember {
  id: string;
  projectId: string;
  userId: string;
  role: string;
  createdAt: string;
  user: ProductCrmUser;
}

export interface ProductProjectBoard {
  columns: ProductProjectColumn[];
  tasks: ProductProjectTask[];
  members: ProductProjectMember[];
}

export interface CreateProductProjectInput {
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
  sortOrder?: number;
}

export type UpdateProductProjectInput = Partial<CreateProductProjectInput>;

export interface ProductProjectListParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  department?: string;
}

// ─── Project CRUD ──────────────────────────────────────────

export async function listProductProjects(
  params: ProductProjectListParams = {},
): Promise<ApiPaginatedResponse<ProductProject>> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") qs.set(k, String(v));
  }
  const tail = qs.toString() ? `?${qs.toString()}` : "";
  return api.get(`/product-crm${tail}`);
}

export async function createProductProject(
  input: CreateProductProjectInput,
): Promise<ApiSuccessResponse<ProductProject>> {
  return api.post("/product-crm", input);
}

export async function getProductProject(
  id: string,
): Promise<ApiSuccessResponse<ProductProject & { role: string }>> {
  return api.get(`/product-crm/${id}`);
}

export async function updateProductProject(
  id: string,
  input: UpdateProductProjectInput,
): Promise<ApiSuccessResponse<ProductProject>> {
  return api.put(`/product-crm/${id}`, input);
}

export async function deleteProductProject(
  id: string,
): Promise<ApiSuccessResponse<{ success: true }>> {
  return api.delete(`/product-crm/${id}`);
}

export async function reorderProductProjects(
  orderedIds: string[],
): Promise<ApiSuccessResponse<{ success: true }>> {
  return api.put("/product-crm/reorder", { orderedIds });
}

export async function importProductProjects(
  rows: CreateProductProjectInput[],
): Promise<ApiSuccessResponse<{ created: number }>> {
  return api.post("/product-crm/import", { rows });
}

// ─── Board ─────────────────────────────────────────────────

export async function getProductProjectBoard(
  id: string,
): Promise<ApiSuccessResponse<ProductProjectBoard>> {
  return api.get(`/product-crm/${id}/board`);
}
