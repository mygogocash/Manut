import { api } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api.type";

// ─── Types ──────────────────────────────────────────────

export interface PermissionDef {
  code: string;
  module: string;
  action: string;
  description: string;
}

export interface PermissionsResponse {
  data: PermissionDef[];
  byModule: Record<string, PermissionDef[]>;
}

export interface RoleListItem {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissionCount: number;
  permissions: string[];
  userCount: number;
  createdAt: string;
}

export interface RoleDetail {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateRoleInput {
  name: string;
  description?: string;
  permissions: string[];
}

export interface UpdateRoleInput {
  name?: string;
  description?: string;
  permissions?: string[];
}

export interface CloneRoleInput {
  name: string;
  description?: string;
}

// ─── Service ────────────────────────────────────────────

/** In-memory cache: permission definitions rarely change; avoids refetch on every dialog open. */
let permissionsCatalogPromise: Promise<PermissionsResponse> | null = null;

export async function listPermissions(): Promise<PermissionsResponse> {
  if (!permissionsCatalogPromise) {
    permissionsCatalogPromise = api
      .get<PermissionsResponse>("/roles/permissions")
      .catch((err) => {
        permissionsCatalogPromise = null;
        throw err;
      });
  }
  return permissionsCatalogPromise;
}

/** Drop cached permission catalog (e.g. after a hypothetical admin rebuild of permissions). */
export function clearRolePermissionsCatalogCache(): void {
  permissionsCatalogPromise = null;
}

export async function listRoles(): Promise<ApiSuccessResponse<RoleListItem[]>> {
  return api.get("/roles");
}

export async function getRole(
  id: string,
): Promise<ApiSuccessResponse<RoleDetail>> {
  return api.get(`/roles/${id}`);
}

export async function createRole(
  input: CreateRoleInput,
): Promise<ApiSuccessResponse<RoleDetail>> {
  return api.post("/roles", input);
}

export async function updateRole(
  id: string,
  input: UpdateRoleInput,
): Promise<ApiSuccessResponse<RoleDetail>> {
  return api.put(`/roles/${id}`, input);
}

export async function deleteRole(id: string): Promise<void> {
  await api.delete(`/roles/${id}`);
}

export async function cloneRole(
  id: string,
  input: CloneRoleInput,
): Promise<ApiSuccessResponse<RoleDetail>> {
  return api.post(`/roles/${id}/clone`, input);
}

export interface RoleMember {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  jobTitle: string | null;
  department: string | null;
  employeeId: string | null;
  entity: { id: string; name: string; code: string } | null;
}

export async function listRoleMembers(
  id: string,
): Promise<ApiSuccessResponse<RoleMember[]>> {
  return api.get(`/roles/${id}/users`);
}
