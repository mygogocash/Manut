import { api, apiBaseUrl } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// ─── Types ──────────────────────────────────────────────

export interface Job {
  id: string;
  title: string;
  slug: string | null;
  type: string;
  location: string;
  department: string;
  description: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { applications: number };
}

export interface JobTitle {
  id: string;
  title: string;
  department: string;
}

export interface CreateJobInput {
  title: string;
  slug?: string;
  type: string;
  location: string;
  department: string;
  description: string;
  active?: boolean;
}

export interface UpdateJobInput {
  title?: string;
  slug?: string;
  type?: string;
  location?: string;
  department?: string;
  description?: string;
  active?: boolean;
}

export interface JobParams {
  page?: number;
  limit?: number;
  department?: string;
  type?: string;
  active?: boolean;
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

export async function listJobs(
  params: JobParams = {},
): Promise<ApiPaginatedResponse<Job>> {
  return api.get(`/career${buildQuery(params)}`);
}

export async function getJob(id: string): Promise<ApiSuccessResponse<Job>> {
  return api.get(`/career/${id}`);
}

export async function createJob(
  input: CreateJobInput,
): Promise<ApiSuccessResponse<Job>> {
  return api.post("/career", input);
}

export async function updateJob(
  id: string,
  input: UpdateJobInput,
): Promise<ApiSuccessResponse<Job>> {
  return api.put(`/career/${id}`, input);
}

export async function deleteJob(
  id: string,
): Promise<ApiSuccessResponse<{ success: boolean }>> {
  return api.delete(`/career/${id}`);
}

export async function getJobTitles(): Promise<ApiSuccessResponse<JobTitle[]>> {
  return api.get("/career/titles");
}

export async function downloadJobsExport(): Promise<void> {
  const res = await fetch(`${apiBaseUrl}/career/export`, {
    credentials: "include",
  });
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
  a.download = `jobs-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
