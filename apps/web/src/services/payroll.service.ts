import { api, apiBaseUrl, authFetchInit } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// ─── Types ──────────────────────────────────────────────

export interface CurrencyTotals {
  /** Pre-tax pay summed across rows in the same currency. */
  gross: number;
  /** Income tax summed across rows in the same currency. */
  tax: number;
  /** Take-home pay summed across rows in the same currency. */
  net: number;
  /** Number of payslips contributing to this bucket. */
  count: number;
}

export interface PayrollRun {
  id: string;
  entity: { id: string; name: string; code: string; currency?: string };
  period: string;
  status: string;
  /**
   * Headline totals are entity-currency-only. The full per-currency
   * breakdown lives in `currencyTotals` — populated by the bulk
   * import + payslip edit flows. Older runs without a re-commit may
   * keep this null.
   */
  totalGross: string;
  totalNet: string;
  totalTax: string;
  currencyTotals: Record<string, CurrencyTotals> | null;
  payslipCount: number;
  runner: { id: string; name: string };
  approver: { id: string; name: string } | null;
  createdAt: string;
}

export interface Payslip {
  id: string;
  employee: {
    id: string;
    name: string;
    email?: string | null;
    department?: string | null;
    jobTitle?: string | null;
    /** ISO date string of when the employee joined, or null. */
    startDate?: string | null;
  };
  /**
   * Snapshots captured from the HR spreadsheet at import time. Survive
   * later edits to the live employee profile so the historical payroll
   * record stays accurate. Run Details prefers these over `employee.*`.
   */
  positionSnapshot?: string | null;
  departmentSnapshot?: string | null;
  startDateSnapshot?: string | null;
  baseSalary: string;
  grossPay: string;
  netPay: string;
  currency: string;
  /**
   * Gross / net converted into the run's entity currency at the latest
   * FX rate. NULL when no rate exists for the (slip currency → entity
   * currency) pair, in which case the UI shows a dash rather than a
   * phantom 1:1 conversion.
   */
  grossPayInEntityCurrency?: number | null;
  netPayInEntityCurrency?: number | null;
  fxRate?: number | null;
  /**
   * Where the per-row entity-currency conversion came from.
   * - `identity`: row was already priced in the entity currency.
   * - `direct` / `inverse` / `triangulated`: resolved via ExchangeRate.
   * - `import`: HR's bulk template supplied a pre-converted "Total Payout
   *   (entityCurrency)" cell, used verbatim with no ExchangeRate lookup.
   * - `missing`: no path to the entity currency — UI renders a dash.
   */
  fxSource?:
    | "identity"
    | "direct"
    | "inverse"
    | "triangulated"
    | "import"
    | "missing";
  /** Bridge currency when fxSource === "triangulated". */
  fxBridge?: string | null;
  /**
   * Free-form JSON map matching the import template — keys like meal,
   * transportation, telephone, wifi, otherIncome, reimbursement,
   * flatAllowance, plus any ad-hoc keys HR adds.
   */
  allowances: Record<string, number> | null;
  /**
   * Free-form JSON map: tax, ssf, otherDeduction, flatDeduction, etc.
   */
  deductions: Record<string, number> | null;
  /**
   * HR-uploaded payslip PDF / document URL on the `documents` Supabase
   * bucket. Nullable when no document is attached yet. Employees view
   * their own via `GET /api/payroll/my-payslips/:id/download` (signed
   * URL); HR uploads via `POST /api/payroll/runs/:runId/payslips/:id/document`.
   */
  documentUrl?: string | null;
}

export interface PayrollRunDetail extends PayrollRun {
  payslips: Payslip[];
  notes: string | null;
  /**
   * Run's entity currency exposed at the top level so the detail sheet
   * can label the "Total Payout (X)" column without having to dig into
   * `entity.currency` (which the older list-row shape omits).
   */
  entityCurrency?: string;
  /**
   * Currencies present on this run that lack an FX rate to the entity
   * currency (direct, inverse, and bridge-via-USD all failed). Those
   * payslips contribute 0 to the headline `totalNet` — the detail
   * sheet renders an inline warning so HR can add a rate via
   * /admin/exchange-rates.
   */
  missingFxFor?: string[];
}

export interface ConsultantInvoice {
  id: string;
  entity: { id: string; name: string };
  consultant: { id: string; name: string };
  invoiceNo: string;
  amount: string;
  whtRate: string;
  whtAmount: string;
  netAmount: string;
  period: string;
  status: string;
  certIssued: boolean;
  createdAt: string;
}

export interface PayrollRunParams {
  page?: number;
  limit?: number;
  entityId?: string;
  status?: string;
  period?: string;
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

export async function listPayrollRuns(
  params: PayrollRunParams = {},
): Promise<ApiPaginatedResponse<PayrollRun>> {
  return api.get(`/payroll/runs${buildQuery(params)}`);
}

export async function getPayrollRun(
  id: string,
): Promise<ApiSuccessResponse<PayrollRunDetail>> {
  return api.get(`/payroll/runs/${id}`);
}

export async function createPayrollRun(input: {
  entityId: string;
  period: string;
  notes?: string;
  /** When set, payslips are generated for this full-time employee only. */
  employeeId?: string;
}): Promise<ApiSuccessResponse<PayrollRunDetail>> {
  return api.post("/payroll/runs", input);
}

export async function approvePayrollRun(
  id: string,
): Promise<ApiSuccessResponse<PayrollRun>> {
  return api.put(`/payroll/runs/${id}/approve`);
}

export interface RecalculateRunTotalsResult {
  runId: string;
  totalGross: number;
  totalNet: number;
  totalTax: number;
  currencyTotals: Record<string, CurrencyTotals> | null;
  /** Currencies whose conversion rate was not found in `exchange_rates`. */
  missingFxFor: string[];
}

export async function recalculatePayrollRunTotals(
  id: string,
): Promise<ApiSuccessResponse<RecalculateRunTotalsResult>> {
  return api.post(`/payroll/runs/${id}/recalculate-totals`, {});
}

export async function deletePayrollRun(
  id: string,
): Promise<ApiSuccessResponse<{ id: string }>> {
  return api.delete(`/payroll/runs/${id}`);
}

export interface UpdatePayslipInput {
  baseSalary?: number;
  allowances?: Record<string, number> | null;
  deductions?: Record<string, number> | null;
  currency?: string;
  grossPay?: number;
  netPay?: number;
}

export async function updatePayslip(
  runId: string,
  payslipId: string,
  input: UpdatePayslipInput,
): Promise<ApiSuccessResponse<Payslip>> {
  return api.put(`/payroll/runs/${runId}/payslips/${payslipId}`, input);
}

export async function listConsultantInvoices(
  params: PayrollRunParams = {},
): Promise<ApiPaginatedResponse<ConsultantInvoice>> {
  return api.get(`/payroll/consultants${buildQuery(params)}`);
}

export async function createConsultantInvoice(input: {
  entityId: string;
  consultantId: string;
  invoiceNo: string;
  amount: number;
  whtRate: number;
  period: string;
}): Promise<ApiSuccessResponse<ConsultantInvoice>> {
  return api.post("/payroll/consultants", input);
}

export interface PayslipImportPreview {
  valid: Array<Record<string, unknown>>;
  errors: Array<{ row: number; message: string }>;
  /**
   * Non-blocking notices — typically rows that were merged with an
   * earlier row for the same employee. The commit endpoint accepts a
   * preview that has warnings.
   */
  warnings: Array<{ row: number; message: string }>;
  totalRows: number;
  validCount: number;
  errorCount: number;
  warningCount: number;
}

export interface PayslipImportResult {
  imported: number;
  totalGross: number;
  totalNet: number;
  totalTax: number;
}

export async function previewPayslipImport(
  runId: string,
  rows: Array<Record<string, unknown>>,
): Promise<ApiSuccessResponse<PayslipImportPreview>> {
  return api.post(`/payroll/runs/${runId}/payslips/import/preview`, { rows });
}

export async function commitPayslipImport(
  runId: string,
  rows: Array<Record<string, unknown>>,
): Promise<ApiSuccessResponse<PayslipImportResult>> {
  return api.post(`/payroll/runs/${runId}/payslips/import/commit`, { rows });
}

export interface PrepareImportRunResult {
  runId: string;
  entityId: string;
  entityCode: string | null;
  entityName: string | null;
  period: string;
  matchedCount: number;
  totalRows: number;
  reused: boolean;
}

export async function prepareImportRun(input: {
  period: string;
  identifiers: Array<{ name?: string; email?: string }>;
}): Promise<ApiSuccessResponse<PrepareImportRunResult>> {
  return api.post("/payroll/runs/import-prepare", input);
}

// ─── Employee-facing /my-portal payslips ────────────────────────────────

/** Per-employee payslip row returned from `GET /payroll/my-payslips`.
 *  Slim by design — strips the entity-FX fields the run-detail sheet
 *  cares about and adds a flat `payrollRun.period` for table display. */
export interface MyPayslip {
  id: string;
  baseSalary: string;
  grossPay: string;
  netPay: string;
  currency: string;
  documentUrl: string | null;
  payrollRun: {
    id: string;
    period: string;
    entity: { id: string; name: string };
    status: string;
  };
}

export async function listMyPayslips(): Promise<
  ApiSuccessResponse<MyPayslip[]>
> {
  return api.get("/payroll/my-payslips");
}

// HR-facing flat list — every payslip across employees / runs, with
// the same metadata `MyPayslip` carries plus an `employee` block so HR
// can keep one searchable table in HRMS → Payslip Management.
export interface HrPayslip extends MyPayslip {
  employee: {
    id: string;
    name: string;
    email: string;
    department: string | null;
  };
}

export interface HrPayslipQuery {
  employeeId?: string;
  entityId?: string;
  period?: string;
  hasDocument?: boolean;
}

export async function listHrPayslips(
  query: HrPayslipQuery = {},
): Promise<ApiSuccessResponse<HrPayslip[]>> {
  const qs = new URLSearchParams();
  if (query.employeeId) qs.set("employeeId", query.employeeId);
  if (query.entityId) qs.set("entityId", query.entityId);
  if (query.period) qs.set("period", query.period);
  if (query.hasDocument !== undefined) {
    qs.set("hasDocument", String(query.hasDocument));
  }
  const tail = qs.toString() ? `?${qs.toString()}` : "";
  return api.get(`/payroll/payslips${tail}`);
}

// HR-side signed-URL download — bypasses the employee-id ownership
// check the /my-payslips endpoint does. Route is gated by payroll:read.
export async function getHrPayslipDownloadUrl(
  payslipId: string,
): Promise<ApiSuccessResponse<{ url: string }>> {
  return api.get(`/payroll/payslips/${payslipId}/download`);
}

// HR-side single-row create — used by the HRMS Payslip Management
// tab's "+ New payslip" form. Server computes gross/net when omitted
// so the dialog can stay focused on the structured Thai payroll fields.
export interface CreatePayslipInput {
  employeeId: string;
  baseSalary: number;
  allowances?: Record<string, number> | null;
  deductions?: Record<string, number> | null;
  currency?: string;
  grossPay?: number;
  netPay?: number;
}

export async function createPayslipForRun(
  runId: string,
  input: CreatePayslipInput,
): Promise<ApiSuccessResponse<Payslip>> {
  return api.post(`/payroll/runs/${runId}/payslips`, input);
}

export async function getMyPayslipDownloadUrl(
  payslipId: string,
): Promise<ApiSuccessResponse<{ url: string }>> {
  return api.get(`/payroll/my-payslips/${payslipId}/download`);
}

// HR-side upload. Multipart so the file streams through multer on the
// API side rather than a JSON base64 round-trip.
export async function uploadPayslipDocument(
  runId: string,
  payslipId: string,
  file: File,
): Promise<ApiSuccessResponse<Payslip>> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(
    `${apiBaseUrl}/payroll/runs/${runId}/payslips/${payslipId}/document`,
    {
      ...authFetchInit(),
      method: "POST",
      body: formData,
    },
  );
  const json = (await res.json()) as
    | ApiSuccessResponse<Payslip>
    | { error?: { message?: string } | string };
  if (!res.ok) {
    const message =
      ("error" in json &&
        (typeof json.error === "string" ? json.error : json.error?.message)) ||
      "Upload failed";
    throw new Error(typeof message === "string" ? message : "Upload failed");
  }
  return json as ApiSuccessResponse<Payslip>;
}

export async function removePayslipDocument(
  runId: string,
  payslipId: string,
): Promise<ApiSuccessResponse<Payslip>> {
  return api.delete(`/payroll/runs/${runId}/payslips/${payslipId}/document`);
}

// HRMS Payslip Management bulk delete. Backend enforces a 500-id cap;
// callers expecting larger selections should chunk before calling.
export async function bulkDeletePayslips(
  ids: string[],
): Promise<ApiSuccessResponse<{ deletedCount: number }>> {
  return api.post("/payroll/payslips/bulk-delete", { ids });
}

// ─── Payslip document generation ────────────────────────

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Stream-download a freshly rendered payslip document. Server builds
 * the file on-the-fly from the persisted payroll numbers.
 */
export async function downloadGeneratedPayslip(
  payslipId: string,
  format: "xlsx" | "pdf",
): Promise<void> {
  const res = await fetch(
    `${apiBaseUrl}/payroll/payslips/${payslipId}/export?format=${format}`,
    authFetchInit(),
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Failed to generate payslip (${res.status})`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition") ?? "";
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const filename = match?.[1] ?? `payslip.${format}`;
  triggerBlobDownload(blob, filename);
}

/**
 * HRMS → Payslip Management "Export data". Streams the full-breakdown payslip
 * list as Excel / CSV, honouring the tab's server-side period + PDF filters.
 */
export async function downloadPayslipsExport(
  format: "xlsx" | "csv",
  query: HrPayslipQuery = {},
): Promise<void> {
  const qs = new URLSearchParams({ format });
  if (query.period) qs.set("period", query.period);
  if (query.entityId) qs.set("entityId", query.entityId);
  if (query.employeeId) qs.set("employeeId", query.employeeId);
  if (query.hasDocument !== undefined) {
    qs.set("hasDocument", String(query.hasDocument));
  }
  const res = await fetch(
    `${apiBaseUrl}/payroll/payslips/export?${qs.toString()}`,
    authFetchInit(),
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Failed to export payslips (${res.status})`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition") ?? "";
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const filename = match?.[1] ?? `payslips.${format}`;
  triggerBlobDownload(blob, filename);
}

/**
 * Employee-facing on-demand download. Server gates on payslip
 * ownership + run status (approved / paid), so a 403 surfaces when
 * the run is still in draft.
 */
export async function downloadMyGeneratedPayslip(
  payslipId: string,
  format: "xlsx" | "pdf",
): Promise<void> {
  const res = await fetch(
    `${apiBaseUrl}/payroll/my-payslips/${payslipId}/export?format=${format}`,
    authFetchInit(),
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    let message = text;
    try {
      const parsed = JSON.parse(text);
      if (parsed?.message) message = parsed.message;
    } catch {
      // text body, keep as-is
    }
    throw new Error(message || `Failed to generate payslip (${res.status})`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition") ?? "";
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const filename = match?.[1] ?? `payslip.${format}`;
  triggerBlobDownload(blob, filename);
}

/**
 * Bulk-download every payslip in a payroll run as a zip archive.
 */
export async function downloadGeneratedRunPayslips(
  runId: string,
  format: "xlsx" | "pdf",
): Promise<void> {
  const res = await fetch(
    `${apiBaseUrl}/payroll/runs/${runId}/payslips/export?format=${format}`,
    authFetchInit(),
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `Failed to generate payslips (${res.status})`);
  }
  const blob = await res.blob();
  const disposition = res.headers.get("content-disposition") ?? "";
  const match = /filename="?([^";]+)"?/i.exec(disposition);
  const filename = match?.[1] ?? `payslips-${runId}.zip`;
  triggerBlobDownload(blob, filename);
}

// ─── Payslip company block (footer legal details) ───────────

export interface PayslipCompany {
  legalName: string;
  address: string;
  phone: string;
}

export async function getPayslipCompany(): Promise<
  ApiSuccessResponse<PayslipCompany>
> {
  return api.get("/payroll/payslips/company");
}

export async function updatePayslipCompany(
  input: PayslipCompany,
): Promise<ApiSuccessResponse<PayslipCompany>> {
  return api.put("/payroll/payslips/company", input);
}
