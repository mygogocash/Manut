import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// ─── Types ──────────────────────────────────────────────

export type LeaveCategory =
  | "sick"
  | "casual"
  | "earned"
  | "paid"
  | "unpaid"
  | "other";

export const LEAVE_CATEGORY_ORDER: LeaveCategory[] = [
  "earned",
  "sick",
  "casual",
  "paid",
  "unpaid",
  "other",
];

export const LEAVE_CATEGORY_LABEL: Record<LeaveCategory, string> = {
  earned: "Earned leave",
  sick: "Sick leave",
  casual: "Casual leave",
  paid: "Paid leave",
  unpaid: "Unpaid leave",
  other: "Other",
};

export function normalizeLeaveCategory(
  value: string | null | undefined,
): LeaveCategory {
  if (
    value === "sick" ||
    value === "casual" ||
    value === "earned" ||
    value === "paid" ||
    value === "unpaid"
  ) {
    return value;
  }
  return "other";
}

export interface LeaveType {
  id: string;
  entityId: string | null;
  entity: { id: string; name: string; code: string } | null;
  name: string;
  code: string;
  description: string | null;
  category: LeaveCategory;
  daysPerYear: number;
  requiresApproval: boolean;
  isPaid: boolean;
  isActive: boolean;
}

export interface CreateLeaveTypeInput {
  /** null / undefined = global policy applied to every entity. */
  entityId?: string | null;
  name: string;
  code: string;
  description?: string;
  category: LeaveCategory;
  daysPerYear: number;
  requiresApproval: boolean;
  isPaid: boolean;
  isActive: boolean;
}

export type UpdateLeaveTypeInput = Partial<CreateLeaveTypeInput>;

export type LeaveApproverType = "manager" | "user";

export interface LeavePolicyApprover {
  id: string;
  leaveTypeId: string;
  order: number;
  approverType: LeaveApproverType;
  approverUserId: string | null;
  approverUser: {
    id: string;
    name: string;
    email: string;
  } | null;
  skipWhenSubmitterIds: string[];
  onlyWhenSubmitterIds: string[];
  minDays: number | null;
  maxDays: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SetLeavePolicyApproversInput {
  approvers: Array<{
    approverType: LeaveApproverType;
    approverUserId?: string | null;
    skipWhenSubmitterIds?: string[];
    onlyWhenSubmitterIds?: string[];
    minDays?: number | null;
    maxDays?: number | null;
  }>;
}

interface LeaveTypeRef {
  id: string;
  name: string;
  code: string;
  category: LeaveCategory;
}

export interface LeaveBalance {
  id: string;
  leaveType: LeaveTypeRef;
  year: number;
  entitled: number;
  used: number;
  carried: number;
  /** Days already consumed from the carried bucket. */
  carriedUsed: number;
  /**
   * Date (YYYY-MM-DD) after which the carried bucket can no longer be
   * used. Null when HR hasn't set an expiry.
   */
  carriedExpiry: string | null;
  /** Server-side: today > carriedExpiry. */
  carriedExpired: boolean;
  /** Carried bucket remainder available to the employee right now. */
  carriedRemaining: number;
  adjustment: number;
  /** Entitlement bucket remainder — `entitled + adjustment - used`. */
  remaining: number;
  /** Synthesized from the leave type's daysPerYear when no real row exists. */
  synthesized?: boolean;
}

export interface TeamBalanceRow {
  employee: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    department: string | null;
    jobTitle: string | null;
    entityId?: string | null;
    entity?: { id: string; code: string; name: string } | null;
  };
  year: number;
  balances: LeaveBalance[];
}

export interface LeaveRequest {
  id: string;
  employee: {
    id: string;
    name: string;
    avatarUrl: string | null;
    department?: string | null;
  };
  leaveType: LeaveTypeRef;
  startDate: string;
  endDate: string;
  durationType?: LeaveDurationType;
  halfDayPeriod?: HalfDayPeriod | null;
  days: string;
  reason: string | null;
  status:
    | "pending"
    | "approved"
    | "rejected"
    | "cancelled"
    | "pending_cancellation";
  approver: { id: string; name: string } | null;
  delegatedToId?: string | null;
  delegate?: { id: string; name: string; email: string | null } | null;
  approvedAt: string | null;
  rejectReason: string | null;
  createdAt: string;
}

export interface LeaveCalendarRow {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  status: string;
  employee: { id: string; name: string; department: string | null };
  leaveType: LeaveTypeRef;
}

export interface LeaveAnalyticsPayload {
  year: number;
  byStatus: Array<{ status: string; count: number }>;
  byLeaveType: Array<{
    leaveTypeId: string;
    leaveTypeName: string;
    count: number;
  }>;
}

export interface LeaveApproverPreview {
  step: number;
  userId: string;
  name: string;
  email: string | null;
  role: string;
}

export interface BalanceTransaction {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  year: number;
  type: string;
  amount: number;
  description: string | null;
  referenceId: string | null;
  leaveType: LeaveTypeRef;
  createdAt: string;
}

export type LeaveSource = "entitled" | "carried";

export type LeaveDurationType = "full_day" | "half_day";
export type HalfDayPeriod = "am" | "pm";

export interface CreateLeaveRequestInput {
  leaveTypeId: string;
  startDate: string;
  endDate: string;
  durationType?: LeaveDurationType;
  halfDayPeriod?: HalfDayPeriod;
  reason?: string;
  /** Which bucket the days are drawn from on approval. Defaults to "entitled". */
  source?: LeaveSource;
  /** HR on-behalf only; requires `leave:hr-on-behalf`. */
  employeeId?: string;
}

export interface LeaveRequestParams {
  page?: number;
  limit?: number;
  employeeId?: string;
  entityId?: string;
  status?: string;
  leaveTypeId?: string;
  startDate?: string;
  endDate?: string;
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

export async function getLeaveTypes(
  entityId?: string | "global",
): Promise<ApiSuccessResponse<LeaveType[]>> {
  return api.get(
    `/leave/types${entityId ? `?entityId=${encodeURIComponent(entityId)}` : ""}`,
  );
}

export async function getAllLeaveTypes(
  entityId?: string | "global",
): Promise<ApiSuccessResponse<LeaveType[]>> {
  return api.get(
    `/leave/types/all${entityId ? `?entityId=${encodeURIComponent(entityId)}` : ""}`,
  );
}

export async function createLeaveType(
  input: CreateLeaveTypeInput,
): Promise<ApiSuccessResponse<LeaveType>> {
  return api.post("/leave/types", input);
}

export async function updateLeaveType(
  id: string,
  input: UpdateLeaveTypeInput,
): Promise<ApiSuccessResponse<LeaveType>> {
  return api.put(`/leave/types/${id}`, input);
}

export async function deleteLeaveType(
  id: string,
): Promise<ApiSuccessResponse<{ id: string }>> {
  return api.delete(`/leave/types/${id}`);
}

export interface BulkImportBalanceRow {
  employeeEmail: string;
  leaveTypeCode: string;
  year: number;
  /**
   * Omit `entitled` when the source has no allotted data — the backend
   * keeps the existing entitled rather than wiping it to 0.
   */
  entitled?: number;
  carried?: number;
  adjustment?: number;
  used?: number;
}

export interface BulkImportPreviewRow {
  row: number;
  employeeEmail: string;
  employeeName: string | null;
  leaveTypeCode: string;
  leaveTypeName: string | null;
  year: number;
  entitled: number | null;
  carried: number;
  adjustment: number;
  used: number;
  errors: string[];
}

export interface BulkImportPreviewResult {
  data: BulkImportPreviewRow[];
  meta: { total: number; valid: number; invalid: number };
}

export interface BulkImportCommitResult {
  data: { created: number; updated: number; skipped: number };
}

export async function previewBulkImportBalances(
  rows: BulkImportBalanceRow[],
): Promise<BulkImportPreviewResult> {
  return api.post("/leave/balances/import/preview", { rows });
}

export async function commitBulkImportBalances(
  rows: BulkImportBalanceRow[],
): Promise<BulkImportCommitResult> {
  return api.post("/leave/balances/import/commit", { rows });
}

export async function getLeavePolicyApprovers(
  leaveTypeId: string,
): Promise<ApiSuccessResponse<LeavePolicyApprover[]>> {
  return api.get(`/leave/types/${leaveTypeId}/approvers`);
}

export async function setLeavePolicyApprovers(
  leaveTypeId: string,
  input: SetLeavePolicyApproversInput,
): Promise<ApiSuccessResponse<LeavePolicyApprover[]>> {
  return api.put(`/leave/types/${leaveTypeId}/approvers`, input);
}

export async function getLeaveBalances(
  employeeId?: string,
  year?: number,
): Promise<ApiSuccessResponse<LeaveBalance[]>> {
  return api.get(`/leave/balances${buildQuery({ employeeId, year })}`);
}

export async function getTeamBalances(
  year?: number,
): Promise<ApiSuccessResponse<TeamBalanceRow[]>> {
  return api.get(`/leave/team-balances${buildQuery({ year })}`);
}

/**
 * One balance whose stored `used` counter disagrees with the sum of the
 * employee's visible approved requests. See `getBalanceDrift`.
 */
export interface BalanceDriftRow {
  balanceId: string;
  employee: { id: string; name: string; email: string };
  leaveType: { id: string; name: string };
  year: number;
  entitled: number;
  used: number;
  carriedUsed: number;
  approvedDays: number;
  approvedCarriedDays: number;
  drift: number;
  carriedDrift: number;
  /** Days on soft-deleted approved requests — invisible to the employee. */
  deletedApprovedDays: number;
  /** Visible approved days never charged to the balance. */
  undeductedApprovedDays: number;
  /** How many times HR wrote this balance by hand or by xlsx import. */
  ledgerRowCount: number;
  ledgerDelta: number;
}

export interface BalanceDriftResult {
  data: BalanceDriftRow[];
  meta: {
    year: number | null;
    scanned: number;
    drifted: number;
    untouchedByHr: number;
  };
}

export async function getBalanceDrift(
  year?: number,
): Promise<BalanceDriftResult> {
  return api.get(`/leave/balances/drift${buildQuery({ year })}`);
}

export interface UpdateLeaveBalanceInput {
  entitled?: number;
  used?: number;
  carried?: number;
  carriedUsed?: number;
  /** YYYY-MM-DD or null to clear. Omit to leave unchanged. */
  carriedExpiry?: string | null;
  adjustment?: number;
  reason?: string;
}

export async function updateLeaveBalance(
  balanceId: string,
  input: UpdateLeaveBalanceInput,
): Promise<ApiSuccessResponse<LeaveBalance>> {
  return api.put(`/leave/balances/${balanceId}`, input);
}

export interface UpsertLeaveBalanceInput {
  employeeId: string;
  leaveTypeId: string;
  year: number;
  entitled: number;
  used?: number;
  carried?: number;
  carriedUsed?: number;
  carriedExpiry?: string | null;
  adjustment?: number;
  reason?: string;
}

export async function upsertLeaveBalance(
  input: UpsertLeaveBalanceInput,
): Promise<ApiSuccessResponse<LeaveBalance>> {
  return api.post("/leave/balances", input);
}

export async function getLeaveRequests(
  params: LeaveRequestParams = {},
): Promise<ApiPaginatedResponse<LeaveRequest>> {
  return api.get(`/leave/requests${buildQuery(params)}`);
}

export async function createLeaveRequest(
  input: CreateLeaveRequestInput,
): Promise<ApiSuccessResponse<LeaveRequest>> {
  return api.post("/leave/requests", input);
}

export async function approveLeaveRequest(
  id: string,
): Promise<ApiSuccessResponse<LeaveRequest>> {
  return api.put(`/leave/requests/${id}/approve`);
}

export async function rejectLeaveRequest(
  id: string,
  reason: string,
): Promise<ApiSuccessResponse<LeaveRequest>> {
  return api.put(`/leave/requests/${id}/reject`, { reason });
}

export async function cancelLeaveRequest(
  id: string,
): Promise<ApiSuccessResponse<LeaveRequest>> {
  return api.put(`/leave/requests/${id}/cancel`);
}

export async function getLeaveCalendar(params: {
  from: string;
  to: string;
  department?: string;
}): Promise<ApiSuccessResponse<LeaveCalendarRow[]>> {
  return api.get(`/leave/calendar${buildQuery(params)}`);
}

export async function getLeaveAnalytics(
  year?: number,
): Promise<ApiSuccessResponse<LeaveAnalyticsPayload>> {
  return api.get(`/leave/analytics${buildQuery({ year })}`);
}

export async function previewLeaveApprovers(
  employeeId: string,
): Promise<ApiSuccessResponse<LeaveApproverPreview[]>> {
  return api.get(`/leave/preview-approvers${buildQuery({ employeeId })}`);
}

export async function forwardLeaveRequest(
  id: string,
  delegateUserId: string,
): Promise<ApiSuccessResponse<LeaveRequest>> {
  return api.post(`/leave/requests/${id}/forward`, { delegateUserId });
}

export async function getBalanceTransactions(params: {
  employeeId: string;
  year: number;
  leaveTypeId?: string;
}): Promise<ApiSuccessResponse<BalanceTransaction[]>> {
  return api.get(`/leave/balance-transactions${buildQuery(params)}`);
}

// ─── Approval chain (admin) ──────────────────────────────

export interface LeaveApprovalStep {
  id: string;
  order: number;
  name: string;
  description: string | null;
  approverType: LeaveApproverType;
  approverUserId: string | null;
  approverUser: { id: string; name: string; email: string } | null;
  skipWhenSubmitterIds: string[];
  onlyWhenSubmitterIds: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeaveApprovalStepInput {
  name: string;
  description?: string;
  approverType: LeaveApproverType;
  approverUserId?: string | null;
  skipWhenSubmitterIds?: string[];
  onlyWhenSubmitterIds?: string[];
  isActive: boolean;
}

export type UpdateLeaveApprovalStepInput =
  Partial<CreateLeaveApprovalStepInput>;

export async function listLeaveApprovalSteps(): Promise<
  ApiSuccessResponse<LeaveApprovalStep[]>
> {
  return api.get("/leave/approval-steps");
}

export async function createLeaveApprovalStep(
  input: CreateLeaveApprovalStepInput,
): Promise<ApiSuccessResponse<LeaveApprovalStep>> {
  return api.post("/leave/approval-steps", input);
}

export async function updateLeaveApprovalStep(
  id: string,
  input: UpdateLeaveApprovalStepInput,
): Promise<ApiSuccessResponse<LeaveApprovalStep>> {
  return api.put(`/leave/approval-steps/${id}`, input);
}

export async function deleteLeaveApprovalStep(
  id: string,
): Promise<ApiSuccessResponse<{ success: boolean }>> {
  return api.delete(`/leave/approval-steps/${id}`);
}

export async function reorderLeaveApprovalSteps(
  orderedIds: string[],
): Promise<ApiSuccessResponse<LeaveApprovalStep[]>> {
  return api.post("/leave/approval-steps/reorder", { orderedIds });
}

export interface LeaveNotificationRecipients {
  emails: string[];
}

export async function getLeaveNotificationRecipients(): Promise<
  ApiSuccessResponse<LeaveNotificationRecipients>
> {
  return api.get("/leave/notification-recipients");
}

export async function setLeaveNotificationRecipients(
  emails: string[],
): Promise<ApiSuccessResponse<LeaveNotificationRecipients>> {
  return api.put("/leave/notification-recipients", { emails });
}
