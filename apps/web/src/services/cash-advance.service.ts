import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

export const CASH_ADVANCE_STATUSES = [
  "draft",
  "submitted",
  "approved",
  "rejected",
  "disbursed",
  "cleared",
] as const;

export type CashAdvanceStatus = (typeof CASH_ADVANCE_STATUSES)[number];

export const CASH_ADVANCE_STATUS_LABELS: Record<CashAdvanceStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  disbursed: "Disbursed",
  cleared: "Cleared",
};

export const CASH_ADVANCE_PAYOUT_MODES = ["cash", "bank-transfer"] as const;
export type CashAdvancePayoutMode = (typeof CASH_ADVANCE_PAYOUT_MODES)[number];
export const CASH_ADVANCE_PAYOUT_LABELS: Record<CashAdvancePayoutMode, string> =
  {
    cash: "Cash",
    "bank-transfer": "Bank transfer",
  };

export interface CashAdvanceItem {
  id: string;
  position: number;
  description: string;
  categoryId: string | null;
  category: { id: string; name: string } | null;
  requestedAmount: number;
  approvedAmount: number;
  // Raw stored URL; fetch a signed one via getCashAdvanceItemReceiptUrl.
  receiptUrl: string | null;
}

export interface CashAdvanceEmployeeRef {
  id: string;
  name: string;
  email: string;
  department: string | null;
  jobTitle: string | null;
}

export interface CashAdvanceDecision {
  order: number;
  name: string;
  approverType: string;
  approverUser: { id: string; name: string; email: string } | null;
  status: string;
  decidedBy: { id: string; name: string; email: string } | null;
  decidedAt: string | null;
  notes: string | null;
}

export interface CashAdvanceRequest {
  id: string;
  requestNumber: number;
  employeeId: string;
  employee: CashAdvanceEmployeeRef;
  entityId: string | null;
  entity: { id: string; name: string; code: string } | null;
  requestDate: string;
  position: string | null;
  department: string | null;
  directManager: string | null;
  payoutMode: CashAdvancePayoutMode;
  bankName: string | null;
  bankCountry: string | null;
  bankAccountNo: string | null;
  swiftCode: string | null;
  currency: string;
  status: CashAdvanceStatus;
  currentStepOrder: number | null;
  approvalChain: CashAdvanceDecision[];
  requestedTotal: number;
  approvedTotal: number;
  notes: string | null;
  rejectReason: string | null;
  submittedAt: string | null;
  approvedById: string | null;
  approver: { id: string; name: string; email: string } | null;
  approvedAt: string | null;
  disbursedAt: string | null;
  disbursementProofUrl: string | null;
  clearedAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: CashAdvanceItem[];
}

export interface CashAdvanceItemInput {
  description: string;
  requestedAmount: number;
  categoryId?: string | null;
  receiptUrl?: string | null;
}

export interface CreateCashAdvanceInput {
  entityId?: string;
  requestDate?: string;
  position?: string;
  department?: string;
  directManager?: string;
  payoutMode: CashAdvancePayoutMode;
  bankName?: string;
  bankCountry?: string;
  bankAccountNo?: string;
  swiftCode?: string;
  currency: string;
  notes?: string;
  items: CashAdvanceItemInput[];
}

export interface UpdateCashAdvanceInput {
  entityId?: string | null;
  requestDate?: string;
  position?: string | null;
  department?: string | null;
  directManager?: string | null;
  payoutMode?: CashAdvancePayoutMode;
  bankName?: string | null;
  bankCountry?: string | null;
  bankAccountNo?: string | null;
  swiftCode?: string | null;
  currency?: string;
  notes?: string | null;
  items?: CashAdvanceItemInput[];
}

export interface ListCashAdvancesQuery {
  scope?: "mine" | "all";
  page?: number;
  limit?: number;
  status?: CashAdvanceStatus;
  employeeId?: string;
}

function toSearch(query: ListCashAdvancesQuery): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    params.set(k, String(v));
  });
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function listCashAdvances(
  query: ListCashAdvancesQuery = {},
): Promise<ApiPaginatedResponse<CashAdvanceRequest>> {
  return api.get(`/cash-advance${toSearch(query)}`);
}

export function getCashAdvance(
  id: string,
): Promise<ApiSuccessResponse<CashAdvanceRequest>> {
  return api.get(`/cash-advance/${id}`);
}

// Fresh 5-min signed URL for a line item's receipt. Call on click so the
// link never outlives its Supabase JWT (mirrors the expense receipt flow).
export function getCashAdvanceItemReceiptUrl(
  requestId: string,
  itemId: string,
): Promise<ApiSuccessResponse<{ url: string }>> {
  return api.get(`/cash-advance/${requestId}/items/${itemId}/receipt`);
}

export function createCashAdvance(
  input: CreateCashAdvanceInput,
): Promise<ApiSuccessResponse<CashAdvanceRequest>> {
  return api.post("/cash-advance", input);
}

export function updateCashAdvance(
  id: string,
  input: UpdateCashAdvanceInput,
): Promise<ApiSuccessResponse<CashAdvanceRequest>> {
  return api.patch(`/cash-advance/${id}`, input);
}

export function deleteCashAdvance(id: string): Promise<void> {
  return api.delete(`/cash-advance/${id}`);
}

export function submitCashAdvance(
  id: string,
): Promise<ApiSuccessResponse<CashAdvanceRequest>> {
  return api.post(`/cash-advance/${id}/submit`);
}

export function withdrawCashAdvance(
  id: string,
): Promise<ApiSuccessResponse<CashAdvanceRequest>> {
  return api.post(`/cash-advance/${id}/withdraw`);
}

export function approveCashAdvance(
  id: string,
  input: {
    items?: Array<{ id: string; approvedAmount: number }>;
    notes?: string;
  } = {},
): Promise<ApiSuccessResponse<CashAdvanceRequest>> {
  return api.post(`/cash-advance/${id}/approve`, input);
}

export function rejectCashAdvance(
  id: string,
  reason: string,
): Promise<ApiSuccessResponse<CashAdvanceRequest>> {
  return api.post(`/cash-advance/${id}/reject`, { reason });
}

export function disburseCashAdvance(
  id: string,
  proofUrl: string,
): Promise<ApiSuccessResponse<CashAdvanceRequest>> {
  return api.post(`/cash-advance/${id}/disburse`, { proofUrl });
}

export function getCashAdvanceDisbursementProofUrl(
  id: string,
): Promise<ApiSuccessResponse<{ url: string }>> {
  return api.get(`/cash-advance/${id}/disbursement-proof`);
}

export function clearCashAdvance(
  id: string,
): Promise<ApiSuccessResponse<CashAdvanceRequest>> {
  return api.post(`/cash-advance/${id}/clear`);
}

// ── Approval chain config ──
export interface CashAdvanceApprovalStep {
  id: string;
  order: number;
  name: string;
  description: string | null;
  approverType: "manager" | "user";
  approverUserId: string | null;
  approverUser: { id: string; name: string; email: string } | null;
  skipWhenSubmitterIds: string[];
  onlyWhenSubmitterIds: string[];
  payoutModeFilter: CashAdvancePayoutMode[];
  amountMin: number | null;
  amountMax: number | null;
  isActive: boolean;
}

export interface CashAdvanceStepInput {
  name: string;
  description?: string | null;
  approverType: "manager" | "user";
  approverUserId?: string | null;
  skipWhenSubmitterIds?: string[];
  onlyWhenSubmitterIds?: string[];
  payoutModeFilter?: CashAdvancePayoutMode[];
  amountMin?: number | null;
  amountMax?: number | null;
  isActive?: boolean;
}

export function listCashAdvanceSteps(): Promise<
  ApiSuccessResponse<CashAdvanceApprovalStep[]>
> {
  return api.get("/cash-advance/approval-steps");
}

export function createCashAdvanceStep(
  input: CashAdvanceStepInput,
): Promise<ApiSuccessResponse<CashAdvanceApprovalStep>> {
  return api.post("/cash-advance/approval-steps", input);
}

export function updateCashAdvanceStep(
  id: string,
  input: Partial<CashAdvanceStepInput>,
): Promise<ApiSuccessResponse<CashAdvanceApprovalStep>> {
  return api.put(`/cash-advance/approval-steps/${id}`, input);
}

export function deleteCashAdvanceStep(
  id: string,
): Promise<ApiSuccessResponse<{ success: boolean }>> {
  return api.delete(`/cash-advance/approval-steps/${id}`);
}

export function reorderCashAdvanceSteps(
  orderedIds: string[],
): Promise<ApiSuccessResponse<CashAdvanceApprovalStep[]>> {
  return api.put("/cash-advance/approval-steps/reorder", { orderedIds });
}

export function getCashAdvanceRecipients(): Promise<
  ApiSuccessResponse<{ emails: string[] }>
> {
  return api.get("/cash-advance/notification-recipients");
}

export function setCashAdvanceRecipients(
  emails: string[],
): Promise<ApiSuccessResponse<{ emails: string[] }>> {
  return api.put("/cash-advance/notification-recipients", { emails });
}
