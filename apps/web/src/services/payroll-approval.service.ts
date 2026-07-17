import { api } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api.type";

export interface PayrollApprovalApprover {
  id: string;
  name: string;
  email: string;
  jobTitle: string | null;
}

export interface PayrollApprovalStep {
  id: string;
  order: number;
  name: string;
  description: string | null;
  approverUserId: string;
  approverUser: PayrollApprovalApprover | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePayrollApprovalStepInput {
  name: string;
  description?: string;
  approverUserId: string;
  isActive?: boolean;
}

export interface UpdatePayrollApprovalStepInput {
  name?: string;
  description?: string | null;
  approverUserId?: string;
  isActive?: boolean;
}

const BASE = "/payroll/approval-chain";

export async function listPayrollApprovalSteps(): Promise<
  ApiSuccessResponse<PayrollApprovalStep[]>
> {
  return api.get(`${BASE}/steps`);
}

export async function createPayrollApprovalStep(
  input: CreatePayrollApprovalStepInput,
): Promise<ApiSuccessResponse<PayrollApprovalStep>> {
  return api.post(`${BASE}/steps`, input);
}

export async function updatePayrollApprovalStep(
  id: string,
  input: UpdatePayrollApprovalStepInput,
): Promise<ApiSuccessResponse<PayrollApprovalStep>> {
  return api.patch(`${BASE}/steps/${id}`, input);
}

export async function deletePayrollApprovalStep(
  id: string,
): Promise<ApiSuccessResponse<{ id: string }>> {
  return api.delete(`${BASE}/steps/${id}`);
}

export async function reorderPayrollApprovalSteps(
  orderedIds: string[],
): Promise<ApiSuccessResponse<PayrollApprovalStep[]>> {
  return api.post(`${BASE}/reorder`, { orderedIds });
}
