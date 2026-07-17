import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// ─── Types ──────────────────────────────────────────────

export interface Benefit {
  id: string;
  name: string;
  category: string;
  description: string | null;
  provider: string | null;
  cost: string;
  currency: string;
  entityId: string | null;
  entity: { id: string; name: string } | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count: { enrollments: number };
}

export interface BenefitDetail extends Omit<Benefit, "_count"> {
  enrollments: BenefitEnrollment[];
}

export interface BenefitEnrollment {
  id: string;
  benefitId: string;
  employeeId: string;
  employee: { id: string; name: string; email: string };
  startDate: string;
  endDate: string | null;
  status: string;
  benefit?: {
    id: string;
    name: string;
    category: string;
    provider: string | null;
    cost: string;
    currency: string;
  };
}

export interface CreateBenefitInput {
  name: string;
  category: string;
  description?: string;
  provider?: string;
  cost: number;
  currency?: string;
  entityId?: string | null;
  isActive?: boolean;
}

export interface EnrollInput {
  benefitId: string;
  employeeId?: string;
  startDate: string;
}

export interface ListBenefitsParams {
  page?: number;
  limit?: number;
  category?: string;
  entityId?: string;
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

export async function getBenefits(
  params: ListBenefitsParams = {},
): Promise<ApiPaginatedResponse<Benefit>> {
  return api.get(`/benefits${buildQuery(params)}`);
}

export async function getBenefitById(
  id: string,
): Promise<ApiSuccessResponse<BenefitDetail>> {
  return api.get(`/benefits/${id}`);
}

export async function createBenefit(
  input: CreateBenefitInput,
): Promise<ApiSuccessResponse<Benefit>> {
  return api.post("/benefits", input);
}

export async function updateBenefit(
  id: string,
  input: Partial<CreateBenefitInput>,
): Promise<ApiSuccessResponse<Benefit>> {
  return api.put(`/benefits/${id}`, input);
}

export async function deleteBenefit(id: string): Promise<void> {
  return api.delete(`/benefits/${id}`);
}

export async function enrollInBenefit(
  input: EnrollInput,
): Promise<ApiSuccessResponse<BenefitEnrollment>> {
  return api.post("/benefits/enroll", input);
}

export async function unenrollFromBenefit(
  enrollmentId: string,
): Promise<ApiSuccessResponse<BenefitEnrollment>> {
  return api.put(`/benefits/enrollments/${enrollmentId}/unenroll`);
}

export async function getMyEnrollments(): Promise<
  ApiSuccessResponse<BenefitEnrollment[]>
> {
  return api.get("/benefits/my-enrollments");
}

// ─── Bulk import ────────────────────────────────────────

export interface BenefitImportRow {
  name: string;
  category: string;
  description?: string | null;
  provider?: string | null;
  cost?: number;
  currency?: string | null;
  entityCode?: string | null;
  entityName?: string | null;
  entityId?: string | null;
  isActive?: boolean;
}

export interface BenefitImportPreviewRow {
  row: number;
  name: string;
  category: string;
  description: string | null;
  provider: string | null;
  cost: number;
  currency: string;
  isActive: boolean;
  entityId: string | null;
  entityLabel: string | null;
  action: "insert" | "update";
  matchedBenefitId: string | null;
  errors: string[];
}

export interface BenefitImportPreview {
  rows: BenefitImportPreviewRow[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
    inserts: number;
    updates: number;
  };
}

export interface BenefitImportCommitResult {
  inserts: number;
  updates: number;
  skipped: number;
  errors: Array<{ row: number; errors: string[] }>;
}

export async function previewBenefitImport(
  rows: BenefitImportRow[],
): Promise<ApiSuccessResponse<BenefitImportPreview>> {
  return api.post("/benefits/import/preview", { rows });
}

export async function commitBenefitImport(
  rows: BenefitImportRow[],
): Promise<ApiSuccessResponse<BenefitImportCommitResult>> {
  return api.post("/benefits/import/commit", { rows });
}
