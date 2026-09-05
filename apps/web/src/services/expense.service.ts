import { api, apiBaseUrl } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// ─── Types ──────────────────────────────────────────────

export interface Expense {
  id: string;
  employee: {
    id: string;
    name: string;
    email: string;
    department: string | null;
  };
  entity: { id: string; name: string } | null;
  category: { id: string; name: string } | null;
  description: string;
  amount: string;
  currency: string;
  // Per-line FX (report-detail view). `fxRate` is THB per 1 unit of
  // `currency` at the line's own date; `fxConvertedThb` is this line in
  // THB. Both null for THB lines. `fxRateMissing` is true when a non-THB
  // line has no rate on file (UI shows "rate missing", mirroring the
  // report Total).
  fxRate: number | null;
  fxConvertedThb: number | null;
  fxRateMissing: boolean;
  date: string;
  receiptUrl: string | null;
  status: "pending" | "approved" | "rejected" | "reimbursed";
  approver: { id: string; name: string; email: string } | null;
  approvedAt: string | null;
  reimbursedAt: string | null;
  rejectReason: string | null;
  travelRequestId: string | null;
  notes: string | null;
  createdAt: string;
}

export interface ExpenseCategory {
  id: string;
  name: string;
  description: string | null;
  glAccountId: string | null;
  isActive: boolean;
  isAllowance: boolean;
}

export interface CreateExpenseInput {
  entityId: string;
  categoryId?: string;
  travelRequestId?: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  receiptUrl?: string;
  notes?: string;
}

export interface ExchangeRate {
  id: string;
  baseCurrency: string;
  currency: string;
  rate: number;
  effectiveDate: string;
  source: string | null;
}

export interface ExpenseParams {
  page?: number;
  limit?: number;
  employeeId?: string;
  entityId?: string;
  categoryId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
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

export async function listExpenses(
  params: ExpenseParams = {},
): Promise<ApiPaginatedResponse<Expense>> {
  return api.get(`/expenses${buildQuery(params)}`);
}

export async function getExpense(
  id: string,
): Promise<ApiSuccessResponse<Expense>> {
  return api.get(`/expenses/${id}`);
}

export async function createExpense(
  input: CreateExpenseInput,
): Promise<ApiSuccessResponse<Expense>> {
  return api.post("/expenses", input);
}

export async function approveExpense(
  id: string,
): Promise<ApiSuccessResponse<Expense>> {
  return api.put(`/expenses/${id}/approve`);
}

export async function rejectExpense(
  id: string,
  reason: string,
): Promise<ApiSuccessResponse<Expense>> {
  return api.put(`/expenses/${id}/reject`, { reason });
}

export async function reimburseExpense(
  id: string,
): Promise<ApiSuccessResponse<Expense>> {
  return api.put(`/expenses/${id}/reimburse`);
}

// ── Categories ──

export async function listExpenseCategories(): Promise<
  ApiSuccessResponse<ExpenseCategory[]>
> {
  return api.get("/expenses/categories");
}

export async function createExpenseCategory(
  input: Omit<ExpenseCategory, "id">,
): Promise<ApiSuccessResponse<ExpenseCategory>> {
  return api.post("/expenses/categories", input);
}

export async function updateExpenseCategory(
  id: string,
  input: Partial<Omit<ExpenseCategory, "id">>,
): Promise<ApiSuccessResponse<ExpenseCategory>> {
  return api.put(`/expenses/categories/${id}`, input);
}

export async function deleteExpenseCategory(
  id: string,
): Promise<ApiSuccessResponse<{ success: boolean }>> {
  return api.delete(`/expenses/categories/${id}`);
}

// ── Exchange Rates ──

export async function listExchangeRates(params: {
  baseCurrency?: string;
  date?: string;
}): Promise<ApiSuccessResponse<ExchangeRate[]>> {
  return api.get(`/expenses/exchange-rates${buildQuery(params)}`);
}

export async function upsertExchangeRate(input: {
  baseCurrency: string;
  currency: string;
  rate: number;
  effectiveDate: string;
  source?: string;
}): Promise<ApiSuccessResponse<ExchangeRate>> {
  return api.post("/expenses/exchange-rates", input);
}

export async function convertAmount(params: {
  amount: number;
  fromCurrency: string;
  toCurrency: string;
}): Promise<ApiSuccessResponse<{ converted: number; rate: number }>> {
  return api.get(`/expenses/convert${buildQuery(params)}`);
}

// ── Export ──

export function getExpenseExportUrl(
  params: Omit<ExpenseParams, "page" | "limit"> = {},
): string {
  return `${apiBaseUrl}/expenses/export${buildQuery(params)}`;
}

export async function downloadExpenseExport(
  params: Omit<ExpenseParams, "page" | "limit"> = {},
): Promise<void> {
  const res = await fetch(getExpenseExportUrl(params), {
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
  a.download = `expenses-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ─── Expense reports (monthly approval flow) ──────────────

export type ExpenseReportStatus =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "payroll_processed"
  | "reimbursed";

// Human-facing status labels (Title Case). The raw enum is snake_case,
// which renders as the unreadable "PAYROLL_PROCESSED" when upper-cased
// in a badge. Use this everywhere a report status is shown so the list
// and detail views read consistently. Mirrors CASH_ADVANCE_STATUS_LABELS.
export const EXPENSE_STATUS_LABELS: Record<ExpenseReportStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  payroll_processed: "Payroll Processed",
  reimbursed: "Reimbursed",
};

export interface ExpenseReportSummary {
  id: string;
  employee: {
    id: string;
    name: string;
    email: string;
    department: string | null;
  };
  entity: { id: string; name: string };
  period: string;
  title: string;
  category: ExpenseCategoryKey;
  status: ExpenseReportStatus;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectReason: string | null;
  reimbursedAt: string | null;
  notes: string | null;
  approver: { id: string; name: string; email: string } | null;
  totalAmount: number;
  /**
   * Currency the `totalAmount` is expressed in — always "THB", the
   * entity base. A single foreign-currency report (all-INR, all-LKR)
   * converts just like a mixed one; only a THB-only report skips the
   * FX table. Line items keep their native code, the total never does.
   * Read it with `reportTotalCurrency` rather than falling back to a
   * line's currency — that printed "INR" over a THB figure.
   */
  totalCurrency: string;
  /**
   * False when a mixed-currency report has a line whose currency has no
   * THB exchange rate on file — the THB total can't be computed, so the
   * UI shows "— (rate missing)" and submit/approve are blocked until a
   * rate is added. `missingRates` lists the offending currency codes.
   */
  converted: boolean;
  missingRates: string[];
  /**
   * Finance-adjusted total set by the final-step approver. Null = the
   * approver accepted the submitted total. When non-null the value is
   * what payroll / desk emails / the reimbursement notice use.
   */
  approvedTotal: number | null;
  createdAt: string;
  updatedAt: string;
  _count: { expenses: number };
}

export interface ExpenseReportDetail extends ExpenseReportSummary {
  expenses: Expense[];
  // Computed server-side; mirrors approveReport/rejectReport
  // authorisation so the UI doesn't need to second-guess role perms.
  canApprove?: boolean;
}

export interface ExpenseReportParams {
  page?: number;
  limit?: number;
  employeeId?: string;
  status?: ExpenseReportStatus;
  period?: string;
  pendingForMe?: boolean;
  includeAll?: boolean;
  /**
   * Free-text match over title, period and employee name, applied by the server.
   *
   * Server-side because it has to span every page and every month: as a browser
   * filter over the fetched page a name only matched when its row happened to be
   * on screen, so searching an employee found nothing until a month was also
   * picked — which shrank the set enough to pull the row onto page one.
   */
  search?: string;
}

// `allowance` is reserved for the IT-15 chain (Sarah → Payroll →
// Kit) and is set by the API at submit time — never picked manually.
// We still expose it so the admin approval-step dialog can route
// steps by the allowance bucket and report-detail views can render
// a label for already-submitted allowance reports.
export const EXPENSE_CATEGORIES = [
  "general",
  "business_or_bd",
  "allowance",
  "office",
] as const;
export type ExpenseCategoryKey = (typeof EXPENSE_CATEGORIES)[number];
export const EXPENSE_CATEGORY_LABEL: Record<ExpenseCategoryKey, string> = {
  general: "General",
  business_or_bd: "Business travel / BD",
  allowance: "Allowance",
  office: "Office",
};

// Label shown in list / detail views for the submitter column. Office
// reports mask the operator behind "Office Admin" so the actual HR
// person filing shared-spend isn't surfaced to every viewer.
export const OFFICE_ADMIN_SUBMITTER_LABEL = "Office Admin";

export function submitterDisplayName(report: {
  category?: ExpenseCategoryKey | null;
  employee: { name: string };
}): string {
  return report.category === "office"
    ? OFFICE_ADMIN_SUBMITTER_LABEL
    : report.employee.name;
}

export interface CreateExpenseReportInput {
  entityId: string;
  period: string;
  title: string;
  category?: ExpenseCategoryKey;
  notes?: string;
}

export interface UpdateExpenseReportInput {
  title?: string;
  period?: string;
  category?: ExpenseCategoryKey;
  notes?: string;
}

export interface AddExpenseToReportInput {
  categoryId?: string;
  travelRequestId?: string;
  description: string;
  amount: number;
  currency: string;
  date: string;
  receiptUrl?: string;
  notes?: string;
}

export type UpdateExpenseInReportInput = Partial<AddExpenseToReportInput>;

export async function listExpenseReports(
  params: ExpenseReportParams = {},
): Promise<ApiPaginatedResponse<ExpenseReportSummary>> {
  return api.get(`/expenses/reports${buildQuery(params)}`);
}

// ── Monthly overview (workspace-wide roll-up, Admin/HR) ──

export interface MonthlyExpenseSummaryRow {
  period: string; // YYYY-MM
  reportCount: number;
  expenseCount: number;
  totalThb: number;
  converted: boolean; // false → at least one line had a missing FX rate
  missingRates: string[];
  byStatus: Partial<Record<ExpenseReportStatus, number>>;
}

export interface MonthlyExpenseSummary {
  data: MonthlyExpenseSummaryRow[];
  totals: {
    reportCount: number;
    expenseCount: number;
    totalThb: number;
    converted: boolean;
    missingRates: string[];
  };
}

export interface MonthlyExpenseSummaryParams {
  status?: ExpenseReportStatus;
  year?: string;
  employeeId?: string;
}

export async function getMonthlyExpenseSummary(
  params: MonthlyExpenseSummaryParams = {},
): Promise<MonthlyExpenseSummary> {
  return api.get(`/expenses/reports/monthly-summary${buildQuery(params)}`);
}

export async function getExpenseReport(
  id: string,
): Promise<ApiSuccessResponse<ExpenseReportDetail>> {
  return api.get(`/expenses/reports/${id}`);
}

export async function createExpenseReport(
  input: CreateExpenseReportInput,
): Promise<ApiSuccessResponse<ExpenseReportSummary>> {
  return api.post("/expenses/reports", input);
}

export async function updateExpenseReport(
  id: string,
  input: UpdateExpenseReportInput,
): Promise<ApiSuccessResponse<ExpenseReportSummary>> {
  return api.put(`/expenses/reports/${id}`, input);
}

export async function deleteExpenseReport(id: string): Promise<void> {
  await api.delete(`/expenses/reports/${id}`);
}

export async function addExpenseToReport(
  reportId: string,
  input: AddExpenseToReportInput,
): Promise<ApiSuccessResponse<Expense>> {
  return api.post(`/expenses/reports/${reportId}/expenses`, input);
}

/**
 * Asks the API for a freshly-signed Supabase URL for the receipt and
 * returns it. Used by the "View" button so a click always hits a live
 * token instead of a 24h-stale one stored alongside the report.
 */
export async function getExpenseReceiptUrl(
  reportId: string,
  expenseId: string,
): Promise<ApiSuccessResponse<{ url: string }>> {
  return api.get(`/expenses/reports/${reportId}/expenses/${expenseId}/receipt`);
}

export async function updateExpenseInReport(
  reportId: string,
  expenseId: string,
  input: UpdateExpenseInReportInput,
): Promise<ApiSuccessResponse<Expense>> {
  return api.put(`/expenses/reports/${reportId}/expenses/${expenseId}`, input);
}

export async function removeExpenseFromReport(
  reportId: string,
  expenseId: string,
): Promise<void> {
  await api.delete(`/expenses/reports/${reportId}/expenses/${expenseId}`);
}

export async function submitExpenseReport(
  id: string,
): Promise<ApiSuccessResponse<ExpenseReportSummary>> {
  return api.post(`/expenses/reports/${id}/submit`, {});
}

export async function approveExpenseReport(
  id: string,
  opts: { approvedAmount?: number; notes?: string } = {},
): Promise<ApiSuccessResponse<ExpenseReportSummary>> {
  return api.post(`/expenses/reports/${id}/approve`, opts);
}

export async function rejectExpenseReport(
  id: string,
  reason: string,
): Promise<ApiSuccessResponse<ExpenseReportSummary>> {
  return api.post(`/expenses/reports/${id}/reject`, { reason });
}

export async function reimburseExpenseReport(
  id: string,
): Promise<ApiSuccessResponse<ExpenseReportSummary>> {
  return api.post(`/expenses/reports/${id}/reimburse`, {});
}

/**
 * Flips an approved report into the intermediate `payroll_processed`
 * state. Same `expense:hr-approve` gate as reimburse. From this state
 * the same Mark reimbursed action moves the report to `reimbursed`.
 */
export async function markExpenseReportPayrollProcessed(
  id: string,
): Promise<ApiSuccessResponse<ExpenseReportSummary>> {
  return api.post(`/expenses/reports/${id}/mark-payroll-processed`, {});
}

/**
 * Reverses an accidental "mark reimbursed" action. Requires
 * `expense:hr-approve` on the server. Moves the report (and any
 * child expense rows that share its prior terminal state) back from
 * `reimbursed` to `approved` and clears `reimbursedAt`.
 */
export async function revertExpenseReportReimbursement(
  id: string,
): Promise<ApiSuccessResponse<ExpenseReportSummary>> {
  return api.post(`/expenses/reports/${id}/revert-reimbursement`, {});
}

// ─── Approval chain (admin) ──────────────────────────────

export type ExpenseApproverType = "manager" | "manager_l2" | "user";

/**
 * A `review` step validates and passes the report forward (accept/reject)
 * but never finalises it and cannot reduce the approved amount; `approve`
 * is the final-sign-off gate.
 */
export type ExpenseStageRole = "review" | "approve";

export const EXPENSE_STAGE_ROLE_LABEL: Record<ExpenseStageRole, string> = {
  review: "Review",
  approve: "Approval",
};

export interface ExpenseApprovalStep {
  id: string;
  order: number;
  name: string;
  description: string | null;
  approverType: ExpenseApproverType;
  stageRole: ExpenseStageRole;
  approverUserId: string | null;
  approverUser: { id: string; name: string; email: string } | null;
  skipWhenSubmitterIds: string[];
  onlyWhenSubmitterIds: string[];
  categoryFilter: ExpenseCategoryKey[];
  amountMinBaht: string | null;
  amountMaxBaht: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ExpenseApprovalDecision {
  id: string;
  expenseReportId: string;
  order: number;
  name: string;
  approverType: ExpenseApproverType;
  stageRole: ExpenseStageRole;
  approverUserId: string | null;
  approverUser: { id: string; name: string; email: string } | null;
  status: "pending" | "approved" | "rejected" | "skipped";
  decidedById: string | null;
  decidedBy: { id: string; name: string; email: string } | null;
  decidedAt: string | null;
  notes: string | null;
  createdAt: string;
}

export interface CreateExpenseApprovalStepInput {
  name: string;
  description?: string;
  approverType: ExpenseApproverType;
  stageRole: ExpenseStageRole;
  approverUserId?: string | null;
  skipWhenSubmitterIds?: string[];
  onlyWhenSubmitterIds?: string[];
  categoryFilter?: ExpenseCategoryKey[];
  amountMinBaht?: number | null;
  amountMaxBaht?: number | null;
  isActive: boolean;
}

export type UpdateExpenseApprovalStepInput =
  Partial<CreateExpenseApprovalStepInput> & {
    /** Direct slot edit; rows re-sort by this on every list. */
    order?: number;
  };

export async function listExpenseApprovalSteps(): Promise<
  ApiSuccessResponse<ExpenseApprovalStep[]>
> {
  return api.get("/expenses/approval-steps");
}

export async function createExpenseApprovalStep(
  input: CreateExpenseApprovalStepInput,
): Promise<ApiSuccessResponse<ExpenseApprovalStep>> {
  return api.post("/expenses/approval-steps", input);
}

export async function updateExpenseApprovalStep(
  id: string,
  input: UpdateExpenseApprovalStepInput,
): Promise<ApiSuccessResponse<ExpenseApprovalStep>> {
  return api.put(`/expenses/approval-steps/${id}`, input);
}

export async function deleteExpenseApprovalStep(
  id: string,
): Promise<ApiSuccessResponse<{ success: boolean }>> {
  return api.delete(`/expenses/approval-steps/${id}`);
}

export async function reorderExpenseApprovalSteps(
  orderedIds: string[],
): Promise<ApiSuccessResponse<ExpenseApprovalStep[]>> {
  return api.post("/expenses/approval-steps/reorder", { orderedIds });
}

export async function listExpenseDecisions(
  reportId: string,
): Promise<ApiSuccessResponse<ExpenseApprovalDecision[]>> {
  return api.get(`/expenses/reports/${reportId}/decisions`);
}

export type ExpenseRecipientMode = "approved" | "everything";

export interface ExpenseRecipient {
  email: string;
  mode: ExpenseRecipientMode;
}

export interface ExpenseNotificationRecipients {
  recipients: ExpenseRecipient[];
}

export async function getExpenseNotificationRecipients(): Promise<
  ApiSuccessResponse<ExpenseNotificationRecipients>
> {
  return api.get("/expenses/notification-recipients");
}

export async function setExpenseNotificationRecipients(
  recipients: ExpenseRecipient[],
): Promise<ApiSuccessResponse<ExpenseNotificationRecipients>> {
  return api.put("/expenses/notification-recipients", { recipients });
}

// ─── Monthly reminder settings ───────────────────────────────────

export interface ExpenseReminderSettings {
  reminderDay: number;
  reminderTime: string;
  reminderTimezone: string;
  enableThailand: boolean;
  enableInternational: boolean;
}

export async function getExpenseReminderSettings(): Promise<
  ApiSuccessResponse<{ settings: ExpenseReminderSettings }>
> {
  return api.get("/expenses/reminder-settings");
}

export async function setExpenseReminderSettings(
  settings: ExpenseReminderSettings,
): Promise<ApiSuccessResponse<{ settings: ExpenseReminderSettings }>> {
  return api.put("/expenses/reminder-settings", settings);
}
