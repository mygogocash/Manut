import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

export const INVESTOR_TASK_STATUSES = ["open", "done", "cancelled"] as const;
export type InvestorTaskStatus = (typeof INVESTOR_TASK_STATUSES)[number];

export const INVESTOR_TASK_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  done: "Done",
  cancelled: "Cancelled",
};

export interface InvestorTask {
  id: string;
  subject: string;
  status: string;
  dueDate: string;
  investorId: string;
  ownerId: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  owner: { id: string; name: string; email: string };
  investor: { id: string; name: string };
}

export interface CreateInvestorTaskInput {
  subject: string;
  dueDate: string;
  investorId: string;
}

export interface UpdateInvestorTaskInput {
  subject?: string;
  dueDate?: string;
  status?: InvestorTaskStatus;
}

export interface ListInvestorTasksParams {
  page?: number;
  limit?: number;
  status?: string;
  investorId?: string;
  ownerId?: string;
  bucket?: "overdue" | "today" | "soon";
}

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

export async function listInvestorTasks(
  params: ListInvestorTasksParams = {},
): Promise<ApiPaginatedResponse<InvestorTask>> {
  return api.get(`/investor/tasks${buildQuery(params)}`);
}

export async function createInvestorTask(
  input: CreateInvestorTaskInput,
): Promise<ApiSuccessResponse<InvestorTask>> {
  return api.post("/investor/tasks", input);
}

export async function updateInvestorTask(
  id: string,
  input: UpdateInvestorTaskInput,
): Promise<ApiSuccessResponse<InvestorTask>> {
  return api.put(`/investor/tasks/${id}`, input);
}

export async function completeInvestorTask(
  id: string,
): Promise<ApiSuccessResponse<InvestorTask>> {
  return api.put(`/investor/tasks/${id}/complete`, {});
}

export async function deleteInvestorTask(
  id: string,
): Promise<ApiSuccessResponse<{ success: boolean }>> {
  return api.delete(`/investor/tasks/${id}`);
}
