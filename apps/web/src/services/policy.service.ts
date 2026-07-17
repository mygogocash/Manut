import { api } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api.type";

export const POLICY_CATEGORIES = [
  "handbook",
  "code_of_conduct",
  "hr_policy",
  "it_policy",
  "travel_policy",
  "leave_policy",
  "expense_policy",
  "security_policy",
  "privacy_policy",
  "compliance",
  "other",
] as const;

export type PolicyCategory = (typeof POLICY_CATEGORIES)[number];

export const POLICY_CATEGORY_LABELS: Record<PolicyCategory, string> = {
  handbook: "Employee Handbook",
  code_of_conduct: "Code of Conduct",
  hr_policy: "HR Policy",
  it_policy: "IT Policy",
  travel_policy: "Travel Policy",
  leave_policy: "Leave Policy",
  expense_policy: "Expense Policy",
  security_policy: "Security Policy",
  privacy_policy: "Privacy Policy",
  compliance: "Compliance",
  other: "Other",
};

export interface CompanyPolicy {
  id: string;
  title: string;
  category: PolicyCategory;
  description: string | null;
  fileUrl: string;
  fileName: string;
  mimeType: string | null;
  fileSize: number | null;
  version: string | null;
  effectiveDate: string | null;
  entityId: string | null;
  entity: { id: string; name: string; code: string } | null;
  isActive: boolean;
  uploadedById: string | null;
  uploadedBy: { id: string; name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePolicyInput {
  title: string;
  category: PolicyCategory;
  description?: string;
  fileUrl: string;
  fileName: string;
  mimeType?: string;
  fileSize?: number;
  version?: string;
  effectiveDate?: string;
  entityId?: string | null;
  isActive?: boolean;
}

export type UpdatePolicyInput = Partial<CreatePolicyInput>;

export interface ListPoliciesQuery {
  category?: PolicyCategory;
  entityId?: string;
  includeInactive?: boolean;
  q?: string;
}

function buildQuery(q: ListPoliciesQuery): string {
  const params = new URLSearchParams();
  if (q.category) params.set("category", q.category);
  if (q.entityId) params.set("entityId", q.entityId);
  if (q.includeInactive) params.set("includeInactive", "true");
  if (q.q) params.set("q", q.q);
  const s = params.toString();
  return s ? `?${s}` : "";
}

export async function listPolicies(
  query: ListPoliciesQuery = {},
): Promise<ApiSuccessResponse<CompanyPolicy[]>> {
  return api.get(`/policies${buildQuery(query)}`);
}

export async function getPolicy(
  id: string,
): Promise<ApiSuccessResponse<CompanyPolicy>> {
  return api.get(`/policies/${id}`);
}

export async function getPolicyDownloadUrl(
  id: string,
): Promise<ApiSuccessResponse<{ url: string }>> {
  return api.get(`/policies/${id}/download`);
}

export async function createPolicy(
  input: CreatePolicyInput,
): Promise<ApiSuccessResponse<CompanyPolicy>> {
  return api.post("/policies", input);
}

export async function updatePolicy(
  id: string,
  input: UpdatePolicyInput,
): Promise<ApiSuccessResponse<CompanyPolicy>> {
  return api.put(`/policies/${id}`, input);
}

export async function deletePolicy(
  id: string,
): Promise<ApiSuccessResponse<{ success: boolean }>> {
  return api.delete(`/policies/${id}`);
}
