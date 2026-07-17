import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// ─── Types ──────────────────────────────────────────────

export interface LearningModule {
  id: string;
  title: string;
  description: string | null;
  category: string;
  duration: number | null;
  url: string | null;
  fileUrl: string | null;
  fileName: string | null;
  isMandatory: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LearningCompletion {
  id: string;
  moduleId: string;
  employeeId: string;
  completedAt: string;
  score: number | null;
  module: Pick<LearningModule, "id" | "title" | "category">;
  employee: { id: string; name: string; email: string };
}

export interface CreateModuleInput {
  title: string;
  description?: string;
  category: string;
  duration?: number;
  url?: string;
  fileUrl?: string;
  fileName?: string;
  isMandatory?: boolean;
}

export type UpdateModuleInput = Partial<CreateModuleInput>;

export interface ModuleParams {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
}

export interface CompletionParams {
  page?: number;
  limit?: number;
  employeeId?: string;
}

export const MODULE_CATEGORIES = [
  "onboarding",
  "compliance",
  "technical",
  "leadership",
  "soft_skills",
  "product",
  "marketing",
  "sales",
  "other",
] as const;

export const CATEGORY_LABELS: Record<string, string> = {
  onboarding: "Onboarding",
  compliance: "Compliance",
  technical: "Technical",
  leadership: "Leadership",
  soft_skills: "Soft Skills",
  product: "Product",
  marketing: "Marketing",
  sales: "Sales",
  other: "Other",
};

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

export async function listModules(
  params: ModuleParams = {},
): Promise<ApiPaginatedResponse<LearningModule>> {
  return api.get(`/learning/modules${buildQuery(params)}`);
}

export async function createModule(
  input: CreateModuleInput,
): Promise<ApiSuccessResponse<LearningModule>> {
  return api.post("/learning/modules", input);
}

export async function updateModule(
  id: string,
  input: UpdateModuleInput,
): Promise<ApiSuccessResponse<LearningModule>> {
  return api.put(`/learning/modules/${id}`, input);
}

export async function listCompletions(
  params: CompletionParams = {},
): Promise<ApiPaginatedResponse<LearningCompletion>> {
  return api.get(`/learning/completions${buildQuery(params)}`);
}

export async function markComplete(
  moduleId: string,
): Promise<ApiSuccessResponse<LearningCompletion>> {
  return api.post("/learning/completions", { moduleId });
}

export async function importModules(
  rows: CreateModuleInput[],
): Promise<ApiSuccessResponse<{ created: number; skipped: number }>> {
  return api.post("/learning/modules/import", { rows });
}
