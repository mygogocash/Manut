import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// ─── Types ──────────────────────────────────────────────

export interface DirectoryEntity {
  id: string;
  name: string;
  code: string;
}

export interface DirectoryManager {
  id: string;
  name: string;
  email: string;
  jobTitle: string | null;
  avatarUrl: string | null;
}

export interface DirectoryEmployee {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  phone: string | null;
  department: string | null;
  jobTitle: string | null;
  employeeId: string | null;
  employmentType: string;
  location: string | null;
  country: string | null;
  isActive: boolean;
  startDate: string | null;
  salary: number | null;
  currency: string | null;
  entity: DirectoryEntity | null;
  manager: DirectoryManager | null;
}

export interface DirectoryEmployeeDetail extends DirectoryEmployee {
  timezone: string | null;
  metadata: unknown;
  createdAt: string;
  directReports: {
    id: string;
    name: string;
    jobTitle: string | null;
    avatarUrl: string | null;
    department: string | null;
  }[];
  userRoles: { role: { id: string; name: string } }[];
}

export interface Department {
  name: string;
  count: number;
}

export interface OrgChartNode {
  id: string;
  name: string;
  jobTitle: string | null;
  department: string | null;
  avatarUrl: string | null;
  reportingTo: string | null;
  entity: DirectoryEntity | null;
}

export interface DirectoryParams {
  page?: number;
  limit?: number;
  search?: string;
  entityId?: string;
  department?: string;
}

// ─── Helpers ────────────────────────────────────────────

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

// ─── Service ────────────────────────────────────────────

export async function listDirectory(
  params: DirectoryParams = {},
): Promise<ApiPaginatedResponse<DirectoryEmployee>> {
  return api.get(`/directory${buildQuery(params)}`);
}

// Lean projection — never returns HR-sensitive fields. Use this for
// Owner / Approver / Reporter pickers so roles without
// `directory:read` (custom Legal roles, etc.) can still resolve users.
export interface AssignableUser {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  jobTitle: string | null;
}

export async function listAssignableUsers(
  params: DirectoryParams = {},
): Promise<ApiPaginatedResponse<AssignableUser>> {
  return api.get(`/directory/assignable${buildQuery(params)}`);
}

export async function getAssignableUser(
  id: string,
): Promise<ApiSuccessResponse<AssignableUser>> {
  return api.get(`/directory/assignable/${id}`);
}

export async function getDirectoryEmployee(
  id: string,
): Promise<ApiSuccessResponse<DirectoryEmployeeDetail>> {
  return api.get(`/directory/${id}`);
}

export async function getDirectoryDepartments(): Promise<
  ApiSuccessResponse<Department[]>
> {
  return api.get("/directory/departments");
}

export async function getDirectoryOrgChart(): Promise<
  ApiSuccessResponse<OrgChartNode[]>
> {
  return api.get("/directory/org-chart");
}
