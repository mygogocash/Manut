import { api, apiBaseUrl } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// ─── Types ──────────────────────────────────────────────

export interface Application {
  id: string;
  name: string;
  email: string;
  mobile: string;
  linkedin: string | null;
  website: string | null;
  attachment: string;
  job: {
    id: string;
    title: string;
    department: string;
    location: string;
  };
  createdAt: string;
}

export interface ApplicationParams {
  page?: number;
  limit?: number;
  jobId?: string;
  search?: string;
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

export async function listApplications(
  params: ApplicationParams = {},
): Promise<ApiPaginatedResponse<Application>> {
  return api.get(`/applications${buildQuery(params)}`);
}

export async function getApplication(
  id: string,
): Promise<ApiSuccessResponse<Application>> {
  return api.get(`/applications/${id}`);
}

export async function deleteApplication(
  id: string,
): Promise<ApiSuccessResponse<{ success: boolean }>> {
  return api.delete(`/applications/${id}`);
}

export async function downloadApplicationsExport(params?: {
  jobId?: string;
  search?: string;
}): Promise<void> {
  const qs = new URLSearchParams();
  if (params?.jobId) qs.set("jobId", params.jobId);
  if (params?.search) qs.set("search", params.search);
  const queryStr = qs.toString();

  const res = await fetch(
    `${apiBaseUrl}/applications/export${queryStr ? `?${queryStr}` : ""}`,
    { credentials: "include" },
  );
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg =
      typeof body?.error === "string"
        ? body.error
        : (body?.error?.message ?? "Export failed");
    throw new Error(msg);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `applications-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
