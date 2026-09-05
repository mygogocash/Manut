import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// ─── Types ──────────────────────────────────────────────

export interface AppraisalCycle {
  id: string;
  name: string;
  description: string | null;
  startDate: string;
  endDate: string;
  status: "draft" | "active" | "closed";
  createdBy: string;
  creator: { id: string; name: string; email: string };
  _count: { appraisals: number };
  createdAt: string;
  updatedAt: string;
}

export interface Goal {
  id: string;
  appraisalId: string;
  title: string;
  description: string | null;
  weight: number;
  selfScore: number | null;
  managerScore: number | null;
  status: "not_started" | "in_progress" | "completed";
  createdAt: string;
  updatedAt: string;
}

export interface Appraisal {
  id: string;
  cycleId: string;
  employeeId: string;
  managerId: string | null;
  status: "pending" | "self_review" | "manager_review" | "completed";
  selfRating: number | null;
  selfComment: string | null;
  managerRating: number | null;
  managerComment: string | null;
  finalRating: number | null;
  completedAt: string | null;
  cycle: { id: string; name: string; status: string };
  employee: {
    id: string;
    name: string;
    email: string;
    department: string | null;
  };
  manager: { id: string; name: string; email: string } | null;
  goals: Goal[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateCycleInput {
  name: string;
  description?: string;
  startDate: string;
  endDate: string;
}

export interface UpdateCycleInput {
  name?: string;
  description?: string | null;
  startDate?: string;
  endDate?: string;
  status?: "draft" | "active" | "closed";
}

export interface CreateAppraisalInput {
  cycleId: string;
  employeeId: string;
  managerId?: string;
}

export interface SelfReviewInput {
  selfRating: number;
  selfComment?: string;
}

export interface ManagerReviewInput {
  managerRating: number;
  managerComment?: string;
  finalRating?: number;
}

export interface CreateGoalInput {
  appraisalId: string;
  title: string;
  description?: string;
  weight?: number;
}

export interface UpdateGoalInput {
  title?: string;
  description?: string | null;
  weight?: number;
  selfScore?: number;
  managerScore?: number;
  status?: "not_started" | "in_progress" | "completed";
}

export interface CycleQueryParams {
  page?: number;
  limit?: number;
  status?: string;
}

export interface AppraisalQueryParams {
  page?: number;
  limit?: number;
  cycleId?: string;
  employeeId?: string;
  managerId?: string;
  status?: string;
  /** Matches the employee's name or email, applied by the server. */
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

// ─── Cycles ─────────────────────────────────────────────

export async function listCycles(
  params: CycleQueryParams = {},
): Promise<ApiPaginatedResponse<AppraisalCycle>> {
  return api.get(`/performance/cycles${buildQuery(params)}`);
}

export async function getCycle(
  id: string,
): Promise<ApiSuccessResponse<AppraisalCycle>> {
  return api.get(`/performance/cycles/${id}`);
}

export async function createCycle(
  input: CreateCycleInput,
): Promise<ApiSuccessResponse<AppraisalCycle>> {
  return api.post("/performance/cycles", input);
}

export async function updateCycle(
  id: string,
  input: UpdateCycleInput,
): Promise<ApiSuccessResponse<AppraisalCycle>> {
  return api.put(`/performance/cycles/${id}`, input);
}

// ─── Appraisals ─────────────────────────────────────────

export async function listAppraisals(
  params: AppraisalQueryParams = {},
): Promise<ApiPaginatedResponse<Appraisal>> {
  return api.get(`/performance/appraisals${buildQuery(params)}`);
}

export async function getAppraisal(
  id: string,
): Promise<ApiSuccessResponse<Appraisal>> {
  return api.get(`/performance/appraisals/${id}`);
}

export async function submitSelfReview(
  id: string,
  input: SelfReviewInput,
): Promise<ApiSuccessResponse<Appraisal>> {
  return api.put(`/performance/appraisals/${id}/self-review`, input);
}

export async function submitManagerReview(
  id: string,
  input: ManagerReviewInput,
): Promise<ApiSuccessResponse<Appraisal>> {
  return api.put(`/performance/appraisals/${id}/manager-review`, input);
}

// ─── Goals ──────────────────────────────────────────────

export async function listGoals(
  appraisalId: string,
): Promise<ApiSuccessResponse<Goal[]>> {
  return api.get(`/performance/appraisals/${appraisalId}/goals`);
}

export async function createGoal(
  input: CreateGoalInput,
): Promise<ApiSuccessResponse<Goal>> {
  return api.post("/performance/goals", input);
}

export async function updateGoal(
  goalId: string,
  input: UpdateGoalInput,
): Promise<ApiSuccessResponse<Goal>> {
  return api.put(`/performance/goals/${goalId}`, input);
}

export async function deleteGoal(goalId: string): Promise<void> {
  return api.delete(`/performance/goals/${goalId}`);
}
