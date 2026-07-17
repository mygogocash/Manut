import { api, apiBaseUrl, authFetchInit } from "@/lib/api-client";
import type { Entity } from "@/services/entity.service";
import type { RoleListItem } from "@/services/role.service";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// ─── Types ──────────────────────────────────────────────

export const EMPLOYMENT_TYPES = [
  "full_time",
  "part_time",
  "contract",
  "intern",
  "consultant",
] as const;

export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  full_time: "Full-time",
  part_time: "Part-time",
  contract: "Contract",
  intern: "Intern",
  consultant: "Consultant",
};

export const DEPARTMENTS = [
  "Management",
  "Legal",
  "Marketing",
  "HR",
  "Accounting",
  "Finance",
  "Finance & Accounting",
  "Product",
  "Project Management",
  "Digital Social",
  "Business Team",
  "IT",
] as const;

export interface UserListItem {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  phone: string | null;
  department: string | null;
  jobTitle: string | null;
  employeeId: string | null;
  employmentType: string;
  /** YYYY-MM-DD or ISO from API — used by employee form when editing from directory. */
  startDate: string | null;
  location: string | null;
  country: string | null;
  isActive: boolean;
  entity: { id: string; name: string } | null;
  manager: { id: string; name: string; email: string } | null;
  roles: Array<{ id: string; name: string }>;
  createdAt: string;
}

export interface UserDetail extends UserListItem {
  reportingTo: string | null;
  endDate: string | null;
  dateOfBirth: string | null;
  salary: string | null;
  currency: string | null;
  timezone: string | null;
  passportNumber: string | null;
  thaiId: string | null;
  taxId: string | null;
  aadhaarNumber: string | null;
  panCardNumber: string | null;
  workPermitType: string | null;
  visaType: string | null;
  permitNumber: string | null;
  updatedAt: string;
}

export interface UserStats {
  total: number;
  active: number;
  inactive: number;
  newThisMonth: number;
  byEmploymentType: Record<string, number>;
}

export interface CreateUserInput {
  email: string;
  name: string;
  password: string;
  phone?: string;
  avatarUrl?: string;
  entityId?: string;
  department?: string;
  jobTitle?: string;
  employeeId?: string;
  reportingTo?: string;
  employmentType?: EmploymentType;
  startDate?: string;
  dateOfBirth?: string;
  salary?: number;
  currency?: string;
  location?: string;
  country?: string;
  timezone?: string;
  passportNumber?: string;
  thaiId?: string;
  taxId?: string;
  aadhaarNumber?: string;
  panCardNumber?: string;
  workPermitType?: string;
  visaType?: string;
  permitNumber?: string;
  roleIds?: string[];
  /** When false, the new user starts dormant — used by payroll quick-create
   *  so a one-off employee can be referenced from a payslip without showing
   *  up in the active employee directory. */
  isActive?: boolean;
  /** When true, the welcome email + temp password is not sent. Combined
   *  with `isActive=false` for payroll-only placeholders. */
  skipWelcomeEmail?: boolean;
}

export interface UpdateUserInput {
  name?: string;
  phone?: string | null;
  avatarUrl?: string | null;
  entityId?: string | null;
  department?: string | null;
  jobTitle?: string | null;
  employeeId?: string | null;
  reportingTo?: string | null;
  employmentType?: EmploymentType;
  startDate?: string | null;
  dateOfBirth?: string | null;
  endDate?: string | null;
  salary?: number | null;
  currency?: string | null;
  location?: string | null;
  country?: string | null;
  timezone?: string | null;
  passportNumber?: string | null;
  thaiId?: string | null;
  taxId?: string | null;
  aadhaarNumber?: string | null;
  panCardNumber?: string | null;
  workPermitType?: string | null;
  visaType?: string | null;
  permitNumber?: string | null;
  isActive?: boolean;
}

export interface UserListParams {
  page?: number;
  limit?: number;
  search?: string;
  entityId?: string;
  department?: string;
  employmentType?: string;
  isActive?: boolean;
  roleId?: string;
  sortBy?: "name" | "email" | "createdAt" | "employeeId";
  sortOrder?: "asc" | "desc";
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

export async function listUsers(
  params: UserListParams = {},
): Promise<ApiPaginatedResponse<UserListItem>> {
  return api.get(`/admin/users${buildQuery(params)}`);
}

export async function getUserStats(): Promise<ApiSuccessResponse<UserStats>> {
  return api.get(`/admin/users/stats`);
}

export interface UnactivatedUser {
  id: string;
  email: string;
  name: string;
  employeeId: string | null;
  department: string | null;
  jobTitle: string | null;
  avatarUrl: string | null;
  createdAt: string;
  hasAuthAccount: boolean;
}

export async function listUnactivatedUsers(): Promise<
  ApiSuccessResponse<UnactivatedUser[]> & { meta?: { total: number } }
> {
  return api.get(`/admin/users/unactivated`);
}

export interface ResendInvitesResult {
  sent: number;
  failed: Array<{ id: string; reason: string }>;
}

export async function resendInvites(
  userIds: string[],
): Promise<ApiSuccessResponse<ResendInvitesResult>> {
  return api.post(`/admin/users/resend-invites`, { userIds });
}

export interface UserFormLookups {
  entities: Entity[];
  roles: RoleListItem[];
}

export async function getUserFormLookups(): Promise<
  ApiSuccessResponse<UserFormLookups>
> {
  return api.get("/admin/users/form-lookups");
}

export async function getUser(
  id: string,
): Promise<ApiSuccessResponse<UserDetail>> {
  return api.get(`/admin/users/${id}`);
}

export async function createUser(
  input: CreateUserInput,
): Promise<ApiSuccessResponse<UserDetail>> {
  return api.post("/admin/users", input);
}

export async function updateUser(
  id: string,
  input: UpdateUserInput,
): Promise<ApiSuccessResponse<UserDetail>> {
  return api.put(`/admin/users/${id}`, input);
}

export async function deleteUser(
  id: string,
): Promise<{ data: { id: string } }> {
  return api.delete(`/admin/users/${id}`);
}

export async function resetUserPassword(
  id: string,
  newPassword: string,
): Promise<{ data: { id: string } }> {
  return api.post(`/admin/users/${id}/reset-password`, { newPassword });
}

export async function assignUserRoles(
  id: string,
  roleIds: string[],
): Promise<
  ApiSuccessResponse<{
    userId: string;
    roles: Array<{ id: string; name: string }>;
  }>
> {
  return api.put(`/admin/users/${id}/roles`, { roleIds });
}

// ─── Bulk import (CSV / XLSX) ───────────────────────────

export interface BulkImportRowResult {
  rowNumber: number;
  email: string;
  status: "created" | "failed";
  error?: string;
}

export interface BulkImportResult {
  successCount: number;
  failureCount: number;
  results: BulkImportRowResult[];
}

// Triggers a browser download of the CSV / XLSX template. Auth cookies
// ride along via credentials:'include' from authFetchInit().
export async function downloadEmployeeImportTemplate(
  format: "csv" | "xlsx" = "xlsx",
): Promise<void> {
  const res = await fetch(
    `${apiBaseUrl}/admin/users/import-template?format=${format}`,
    { ...authFetchInit() },
  );
  if (!res.ok) {
    throw new Error("Failed to download template");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `employees-import-template.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function bulkImportEmployees(
  file: File,
): Promise<ApiSuccessResponse<BulkImportResult>> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${apiBaseUrl}/admin/users/bulk-import`, {
    ...authFetchInit(),
    method: "POST",
    body: formData,
  });
  const json = (await res.json()) as
    ApiSuccessResponse<BulkImportResult> | { error?: string };
  if (!res.ok) {
    const message = ("error" in json && json.error) || "Bulk import failed";
    throw new Error(
      typeof message === "string" ? message : "Bulk import failed",
    );
  }
  return json as ApiSuccessResponse<BulkImportResult>;
}
