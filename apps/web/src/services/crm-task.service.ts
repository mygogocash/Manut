import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// ─── Constants ──────────────────────────────────────────────────────────

export const TASK_STATUSES = ["open", "done", "cancelled"] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
  open: "Open",
  done: "Done",
  cancelled: "Cancelled",
};

// "Today list" UX bucket from PRD §10. Maps server-side to a UTC date range.
export const TASK_BUCKETS = ["overdue", "today", "soon"] as const;

export type TaskBucket = (typeof TASK_BUCKETS)[number];

export const TASK_BUCKET_LABELS: Record<TaskBucket, string> = {
  overdue: "Overdue",
  today: "Today",
  soon: "Soon (next 7 days)",
};

// ─── Types ──────────────────────────────────────────────────────────────

export interface TaskOwner {
  id: string;
  name: string;
  email: string;
}

export interface TaskLeadRef {
  id: string;
  company: string;
}

export interface TaskOpportunityRef {
  id: string;
  name: string;
}

export interface CrmTask {
  id: string;
  subject: string;
  status: string;
  dueDate: string;
  ownerId: string;
  leadId: string | null;
  opportunityId: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  owner: TaskOwner;
  lead: TaskLeadRef | null;
  opportunity: TaskOpportunityRef | null;
}

// At least one of leadId / opportunityId is required by the API.
// Owner defaults to the creator; assigning another user emails them.
export interface CreateCrmTaskInput {
  subject: string;
  dueDate: string;
  ownerId?: string;
  leadId?: string;
  opportunityId?: string;
}

export interface UpdateCrmTaskInput {
  subject?: string;
  dueDate?: string;
  status?: TaskStatus;
  ownerId?: string;
}

export interface ListCrmTasksParams {
  page?: number;
  limit?: number;
  status?: TaskStatus;
  ownerId?: string;
  leadId?: string;
  opportunityId?: string;
  bucket?: TaskBucket;
}

// ─── Helpers ────────────────────────────────────────────────────────────

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

// ─── Service ────────────────────────────────────────────────────────────

export async function listCrmTasks(
  params: ListCrmTasksParams = {},
): Promise<ApiPaginatedResponse<CrmTask>> {
  return api.get(`/crm/tasks${buildQuery(params)}`);
}

export async function getCrmTask(
  id: string,
): Promise<ApiSuccessResponse<CrmTask>> {
  return api.get(`/crm/tasks/${id}`);
}

export async function createCrmTask(
  input: CreateCrmTaskInput,
): Promise<ApiSuccessResponse<CrmTask>> {
  return api.post("/crm/tasks", input);
}

export async function updateCrmTask(
  id: string,
  input: UpdateCrmTaskInput,
): Promise<ApiSuccessResponse<CrmTask>> {
  return api.put(`/crm/tasks/${id}`, input);
}

export async function completeCrmTask(
  id: string,
): Promise<ApiSuccessResponse<CrmTask>> {
  return api.put(`/crm/tasks/${id}/complete`, {});
}

export async function deleteCrmTask(id: string): Promise<void> {
  await api.delete(`/crm/tasks/${id}`);
}
