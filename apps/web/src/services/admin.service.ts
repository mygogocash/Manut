import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// ─── Types ──────────────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  action: string;
  resource: string;
  resourceId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  userId: string | null;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
  createdAt: string;
}

export interface AuditLogParams {
  page?: number;
  limit?: number;
  resource?: string;
  action?: string;
  userId?: string;
}

export interface SystemSettings {
  [key: string]: unknown;
}

// ─── Service ────────────────────────────────────────────

function buildQuery<T extends object>(params: T): string {
  const qs = new URLSearchParams();
  for (const [key, val] of Object.entries(params)) {
    if (val !== undefined && val !== null && val !== "") {
      qs.set(key, String(val));
    }
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}

export async function listAuditLogs(
  params: AuditLogParams = {},
): Promise<ApiPaginatedResponse<AuditLogEntry>> {
  return api.get(`/admin/audit-log${buildQuery(params)}`);
}

export async function getSettings(): Promise<
  ApiSuccessResponse<SystemSettings>
> {
  return api.get("/admin/settings");
}

export async function updateSettings(
  settings: Array<{ key: string; value: unknown }>,
): Promise<ApiSuccessResponse<SystemSettings>> {
  return api.put("/admin/settings", { settings });
}

// ─── Module Access ──────────────────────────────────────

export interface ModuleAccessEntry {
  moduleId: string;
  granted: boolean;
  grantedAt: string;
}

export async function getModuleAccess(
  userId: string,
): Promise<ApiSuccessResponse<ModuleAccessEntry[]>> {
  return api.get(`/admin/module-access/${userId}`);
}

export async function updateModuleAccess(
  userId: string,
  modules: Array<{ moduleId: string; granted: boolean }>,
): Promise<ApiSuccessResponse<ModuleAccessEntry[]>> {
  return api.put("/admin/module-access", { userId, modules });
}

// ─── Departments (Form Configuration) ──────────────────

export interface AdminDepartment {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDepartmentInput {
  name: string;
  code?: string;
  description?: string;
}

export type UpdateDepartmentInput = Partial<CreateDepartmentInput> & {
  isActive?: boolean;
};

export async function listAdminDepartments(): Promise<
  ApiSuccessResponse<AdminDepartment[]>
> {
  return api.get("/admin/departments");
}

export async function createAdminDepartment(
  input: CreateDepartmentInput,
): Promise<ApiSuccessResponse<AdminDepartment>> {
  return api.post("/admin/departments", input);
}

export async function updateAdminDepartment(
  id: string,
  input: UpdateDepartmentInput,
): Promise<ApiSuccessResponse<AdminDepartment>> {
  return api.put(`/admin/departments/${id}`, input);
}

export async function deactivateAdminDepartment(
  id: string,
): Promise<ApiSuccessResponse<AdminDepartment>> {
  return api.delete(`/admin/departments/${id}`);
}
