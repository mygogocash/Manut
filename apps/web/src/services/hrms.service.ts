import { api, apiBaseUrl, authFetchInit } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// ─── Types ──────────────────────────────────────────────

// Sheet-aligned KPIs (see Shahab's Equity Summary): grandTotal = all shares,
// vested = immediate (no-schedule) shares, vesting = scheduled shares,
// vestedToDate = vested-so-far of the scheduled instruments.
export interface EsopPool {
  grandTotal: number;
  vesting: number;
  vested: number;
  vestedToDate: number;
}

export const ESOP_GRANT_TYPES = [
  "equity",
  "tokens",
  "sign_up_bonus",
  "cxo_equity",
  "golden_handcuff",
  "annual_review",
  "shark_tank",
  "myv_advisory",
  "fando",
  "other",
] as const;
export type EsopGrantType = (typeof ESOP_GRANT_TYPES)[number];

export const ESOP_GRANT_TYPE_LABELS: Record<EsopGrantType, string> = {
  equity: "Equity (contract)",
  tokens: "BNRY Tokens (contract)",
  sign_up_bonus: "Sign-up Equity Bonus",
  cxo_equity: "CXO Equity",
  golden_handcuff: "Golden Handcuff",
  annual_review: "Annual review uplift",
  shark_tank: "Shark Tank winner",
  myv_advisory: "MYV Advisory shares",
  fando: "Fando shares",
  other: "Other",
};

export const ESOP_VALUE_TYPES = ["shares", "currency", "percent"] as const;
export type EsopValueType = (typeof ESOP_VALUE_TYPES)[number];

export const ESOP_ALLOCATION_MODES = ["one_time", "monthly_recurring"] as const;
export type EsopAllocationMode = (typeof ESOP_ALLOCATION_MODES)[number];

export const ESOP_CURRENCIES = [
  "THB",
  "USD",
  "INR",
  "SGD",
  "EUR",
  "IDR",
  "VND",
  "BDT",
  "AED",
] as const;
export type EsopCurrency = (typeof ESOP_CURRENCIES)[number];

export interface EsopGrant {
  id: string;
  employee: { id: string; name: string; email: string; department: string };
  grantDate: string;
  grantType: EsopGrantType;
  valueType: EsopValueType;
  shares: number;
  currencyCode: EsopCurrency | null;
  currencyAmount: number | null;
  percentOfBase: number | null;
  vestingMonths: number;
  cliffMonths: number;
  lockMonths: number;
  strikePrice: number;
  allocationMode: EsopAllocationMode;
  monthlyAmount: number | null;
  allocationStartMonth: string | null;
  allocationEndMonth: string | null;
  // Manual override for "Total Vesting to date"; null = auto-computed.
  vestedToDateOverride: number | null;
  // Computed server-side (override ?? linear for scheduled, else full
  // shares) so the column and the pool KPI cards share one source.
  vestedToDate: number;
  scheduled: boolean;
  source: string | null;
  status: string;
  exercisedShares: number;
  notes: string | null;
  createdAt: string;
}

export interface OnboardingTask {
  key: string;
  label: string;
  /** Free-form HR-defined part (section). Drives the grouped checklist. */
  part: string;
  done: boolean;
  doneAt?: string;
}

export interface OnboardingRun {
  id: string;
  employee: { id: string; name: string; email: string } | null;
  employeeName: string;
  department: string;
  startDate: string;
  tasks: OnboardingTask[];
  status: string;
  entity: { id: string; name: string } | null;
  createdAt: string;
}

export interface CreateEsopGrantInput {
  employeeId: string;
  grantDate: string;
  grantType: EsopGrantType;
  valueType: EsopValueType;
  shares?: number;
  currencyCode?: EsopCurrency | null;
  currencyAmount?: number | null;
  percentOfBase?: number | null;
  // Nullable so the UI can render "—" for grants whose source xlsx
  // cell was empty (HR's "blank in xlsx → blank in UI" rule).
  vestingMonths?: number | null;
  cliffMonths?: number | null;
  lockMonths?: number | null;
  strikePrice?: number;
  allocationMode: EsopAllocationMode;
  monthlyAmount?: number | null;
  allocationStartMonth?: string | null;
  allocationEndMonth?: string | null;
  // null clears the override (back to auto); a number pins the figure.
  vestedToDateOverride?: number | null;
  source?: string;
  status?: string;
  notes?: string;
}

export type UpdateEsopGrantInput = Partial<CreateEsopGrantInput> & {
  exercisedShares?: number;
};

export interface CreateOnboardingInput {
  employeeId?: string;
  employeeName: string;
  department: string;
  startDate: string;
  entityId?: string;
  tasks: { key: string; label: string; part: string; done?: boolean }[];
}

export const ESOP_SORT_FIELDS = [
  "employee",
  "grantType",
  "usd",
  "thb",
  "shares",
  "lockMonths",
  "vestingMonths",
  "cliffMonths",
  "status",
] as const;
export type EsopSortField = (typeof ESOP_SORT_FIELDS)[number];

export interface EsopInstrument {
  id: string;
  grantType: EsopGrantType;
  scheduled: boolean;
  shares: number;
  vestedToDate: number;
  vestedToDateOverride: number | null;
  vestingMonths: number | null;
  cliffMonths: number | null;
  lockMonths: number | null;
  grantDate: string;
  allocationStartMonth: string | null;
  allocationEndMonth: string | null;
  currencyCode: EsopCurrency | null;
  currencyAmount: number | null;
  source: string | null;
  status: string;
}

export interface EsopEmployeeSummary {
  employee: { id: string; name: string; department: string | null };
  kpis: EsopPool;
  instruments: EsopInstrument[];
}

export interface EsopGrantParams {
  page?: number;
  limit?: number;
  status?: string;
  employeeId?: string;
  sortBy?: EsopSortField;
  sortOrder?: "asc" | "desc";
}

export interface OnboardingParams {
  page?: number;
  limit?: number;
  status?: string;
  // When true, return ONLY soft-deleted runs (the Deleted view).
  deleted?: boolean;
}

export interface OffboardingTask {
  key: string;
  label: string;
  /** Free-form HR-defined part (section). Drives the grouped checklist. */
  part: string;
  done: boolean;
  doneAt?: string;
}

export interface OffboardingRun {
  id: string;
  employee: { id: string; name: string; email: string } | null;
  employeeName: string;
  position: string | null;
  department: string;
  lastWorkingDay: string;
  tasks: OffboardingTask[];
  status: string;
  employeeSignName: string | null;
  employeeSignedAt: string | null;
  hrSignName: string | null;
  hrSignedAt: string | null;
  entity: { id: string; name: string } | null;
  createdAt: string;
}

export interface CreateOffboardingInput {
  employeeId?: string;
  employeeName: string;
  position?: string;
  department: string;
  lastWorkingDay: string;
  entityId?: string;
  tasks: {
    key: string;
    label: string;
    part: string;
    done?: boolean;
  }[];
}

export interface OffboardingParams {
  page?: number;
  limit?: number;
  status?: string;
  // When true, return ONLY soft-deleted runs (the Deleted view).
  deleted?: boolean;
}

export interface OffboardingTaskInput {
  /** Existing tasks send their current key; new tasks omit it. */
  key?: string;
  label: string;
  part: string;
  done: boolean;
  doneAt?: string;
}

/** Admin-managed default parts + tasks new offboarding runs start from. */
export interface OffboardingTemplate {
  parts: Array<{ name: string; tasks: string[] }>;
}

export const AGREEMENT_TYPES = [
  "employment_contract",
  "contract_amendment",
  "increment_letter",
  "equity_agreement",
  "passport",
  "id_card",
  "work_permit",
  "work_visa",
  "other_visas",
  "tax_id",
  "other",
] as const;

export type AgreementType = (typeof AGREEMENT_TYPES)[number];

export const AGREEMENT_TYPE_LABELS: Record<AgreementType, string> = {
  employment_contract: "Employment Contract",
  contract_amendment: "Contract Amendment",
  increment_letter: "Increment Letter",
  equity_agreement: "Equity Agreement",
  passport: "Passport",
  id_card: "ID Card",
  work_permit: "Work Permit",
  work_visa: "Work Visa",
  other_visas: "Other Visas",
  tax_id: "Tax ID",
  other: "Other",
};

export interface EmployeeAgreement {
  id: string;
  employee: { id: string; name: string; email: string };
  type: AgreementType;
  title: string;
  fileUrl: string;
  fileName: string;
  mimeType: string | null;
  fileSize: number | null;
  effectiveDate: string | null;
  expiryDate: string | null;
  notes: string | null;
  uploadedBy: { id: string; name: string; email: string } | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAgreementInput {
  employeeId: string;
  type: AgreementType;
  title: string;
  fileUrl: string;
  fileName: string;
  mimeType?: string;
  fileSize?: number;
  effectiveDate?: string;
  expiryDate?: string;
  notes?: string;
}

export type UpdateAgreementInput = Partial<
  Omit<CreateAgreementInput, "employeeId">
>;

export interface AgreementParams {
  page?: number;
  limit?: number;
  employeeId?: string;
  type?: AgreementType;
}

export interface AgreementFolder {
  employee: {
    id: string;
    name: string;
    email: string;
    avatarUrl: string | null;
    department: string | null;
    jobTitle: string | null;
    employeeId: string | null;
  };
  total: number;
  byType: Partial<Record<AgreementType, number>>;
  lastUpdatedAt: string | null;
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

// ─── ESOP ───────────────────────────────────────────────

export async function getEsopPool(): Promise<ApiSuccessResponse<EsopPool>> {
  return api.get("/hrms/esop-pool");
}

export async function getEsopEmployeeSummary(
  employeeId: string,
): Promise<ApiSuccessResponse<EsopEmployeeSummary>> {
  return api.get(`/hrms/esop-grants/by-employee/${employeeId}`);
}

export async function getEsopGrants(
  params: EsopGrantParams = {},
): Promise<ApiPaginatedResponse<EsopGrant>> {
  return api.get(`/hrms/esop-grants${buildQuery(params)}`);
}

export async function createEsopGrant(
  input: CreateEsopGrantInput,
): Promise<ApiSuccessResponse<EsopGrant>> {
  return api.post("/hrms/esop-grants", input);
}

export async function updateEsopGrant(
  id: string,
  input: UpdateEsopGrantInput,
): Promise<ApiSuccessResponse<EsopGrant>> {
  return api.put(`/hrms/esop-grants/${id}`, input);
}

export async function deleteEsopGrant(
  id: string,
): Promise<ApiSuccessResponse<{ success: boolean }>> {
  return api.delete(`/hrms/esop-grants/${id}`);
}

export interface BulkDeleteEsopGrantsResult {
  deletedCount: number;
  mode: "ids" | "all";
}

export async function bulkDeleteEsopGrants(
  ids: string[],
): Promise<ApiSuccessResponse<BulkDeleteEsopGrantsResult>> {
  return api.post("/hrms/esop-grants/bulk-delete", { ids });
}

export async function deleteAllEsopGrants(): Promise<
  ApiSuccessResponse<BulkDeleteEsopGrantsResult>
> {
  return api.post("/hrms/esop-grants/bulk-delete", { all: true });
}

// ─── ESOP bulk import ───────────────────────────────────

export interface EsopBulkImportRowResult {
  rowNumber: number;
  employeeName: string;
  status: "imported" | "skipped" | "failed";
  grantsCreated: number;
  error?: string;
}

export interface EsopBulkImportResult {
  importedRows: number;
  skippedRows: number;
  failedRows: number;
  totalGrants: number;
  results: EsopBulkImportRowResult[];
  parseErrors: { rowNumber: number; errors: string[] }[];
}

export async function downloadEsopImportTemplate(
  format: "csv" | "xlsx" = "xlsx",
): Promise<void> {
  const res = await fetch(
    `${apiBaseUrl}/hrms/esop-grants/import-template?format=${format}`,
    { ...authFetchInit() },
  );
  if (!res.ok) {
    throw new Error("Failed to download template");
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `esop-grants-import-template.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function bulkImportEsopGrants(
  file: File,
  opts: { replace: boolean } = { replace: false },
): Promise<ApiSuccessResponse<EsopBulkImportResult>> {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("replace", String(opts.replace));
  const res = await fetch(`${apiBaseUrl}/hrms/esop-grants/bulk-import`, {
    ...authFetchInit(),
    method: "POST",
    body: formData,
  });
  const json = (await res.json()) as
    | ApiSuccessResponse<EsopBulkImportResult>
    | { error?: string };
  if (!res.ok) {
    const message = ("error" in json && json.error) || "Bulk import failed";
    throw new Error(
      typeof message === "string" ? message : "Bulk import failed",
    );
  }
  return json as ApiSuccessResponse<EsopBulkImportResult>;
}

// ─── Onboarding ─────────────────────────────────────────

export async function getOnboardingRuns(
  params: OnboardingParams = {},
): Promise<ApiPaginatedResponse<OnboardingRun>> {
  return api.get(`/hrms/onboarding${buildQuery(params)}`);
}

export async function createOnboardingRun(
  input: CreateOnboardingInput,
): Promise<ApiSuccessResponse<OnboardingRun>> {
  return api.post("/hrms/onboarding", input);
}

export async function updateOnboardingTask(
  id: string,
  taskKey: string,
  done: boolean,
): Promise<ApiSuccessResponse<OnboardingRun>> {
  return api.put(`/hrms/onboarding/${id}/task`, { taskKey, done });
}

export interface OnboardingTaskInput {
  /** Existing tasks send their current key; new tasks omit it. */
  key?: string;
  label: string;
  part: string;
  done: boolean;
  doneAt?: string;
}

export async function replaceOnboardingTasks(
  id: string,
  tasks: OnboardingTaskInput[],
): Promise<ApiSuccessResponse<OnboardingRun>> {
  return api.put(`/hrms/onboarding/${id}/tasks`, { tasks });
}

export async function deleteOnboardingRun(
  id: string,
): Promise<ApiSuccessResponse<{ success: true }>> {
  return api.delete(`/hrms/onboarding/${id}`);
}

export async function restoreOnboardingRun(
  id: string,
): Promise<ApiSuccessResponse<{ success: true }>> {
  return api.post(`/hrms/onboarding/${id}/restore`, {});
}

/** Admin-managed default parts + tasks new onboarding runs start from. */
export interface OnboardingTemplate {
  parts: Array<{ name: string; tasks: string[] }>;
}

export async function getOnboardingTemplate(): Promise<
  ApiSuccessResponse<OnboardingTemplate>
> {
  return api.get("/hrms/onboarding/template");
}

export async function updateOnboardingTemplate(
  input: OnboardingTemplate,
): Promise<ApiSuccessResponse<OnboardingTemplate>> {
  return api.put("/hrms/onboarding/template", input);
}

// ─── Offboarding (exit checklist) ───────────────────────

export async function getOffboardingRuns(
  params: OffboardingParams = {},
): Promise<ApiPaginatedResponse<OffboardingRun>> {
  return api.get(`/hrms/offboarding${buildQuery(params)}`);
}

export async function createOffboardingRun(
  input: CreateOffboardingInput,
): Promise<ApiSuccessResponse<OffboardingRun>> {
  return api.post("/hrms/offboarding", input);
}

export async function updateOffboardingTask(
  id: string,
  taskKey: string,
  done: boolean,
): Promise<ApiSuccessResponse<OffboardingRun>> {
  return api.put(`/hrms/offboarding/${id}/task`, { taskKey, done });
}

export async function replaceOffboardingTasks(
  id: string,
  tasks: OffboardingTaskInput[],
): Promise<ApiSuccessResponse<OffboardingRun>> {
  return api.put(`/hrms/offboarding/${id}/tasks`, { tasks });
}

export async function signOffboarding(
  id: string,
  party: "employee" | "hr",
  name: string,
): Promise<ApiSuccessResponse<OffboardingRun>> {
  return api.put(`/hrms/offboarding/${id}/sign`, { party, name });
}

export async function deleteOffboardingRun(
  id: string,
): Promise<ApiSuccessResponse<{ success: true }>> {
  return api.delete(`/hrms/offboarding/${id}`);
}

export async function restoreOffboardingRun(
  id: string,
): Promise<ApiSuccessResponse<{ success: true }>> {
  return api.post(`/hrms/offboarding/${id}/restore`, {});
}

export async function getOffboardingTemplate(): Promise<
  ApiSuccessResponse<OffboardingTemplate>
> {
  return api.get("/hrms/offboarding/template");
}

export async function updateOffboardingTemplate(
  input: OffboardingTemplate,
): Promise<ApiSuccessResponse<OffboardingTemplate>> {
  return api.put("/hrms/offboarding/template", input);
}

// ─── Agreements ─────────────────────────────────────────

export async function getAgreements(
  params: AgreementParams = {},
): Promise<ApiPaginatedResponse<EmployeeAgreement>> {
  return api.get(`/hrms/agreements${buildQuery(params)}`);
}

export async function getAgreement(
  id: string,
): Promise<ApiSuccessResponse<EmployeeAgreement>> {
  return api.get(`/hrms/agreements/${id}`);
}

export async function createAgreement(
  input: CreateAgreementInput,
): Promise<ApiSuccessResponse<EmployeeAgreement>> {
  return api.post("/hrms/agreements", input);
}

export async function updateAgreement(
  id: string,
  input: UpdateAgreementInput,
): Promise<ApiSuccessResponse<EmployeeAgreement>> {
  return api.put(`/hrms/agreements/${id}`, input);
}

export async function deleteAgreement(
  id: string,
): Promise<ApiSuccessResponse<{ id: string }>> {
  return api.delete(`/hrms/agreements/${id}`);
}

export async function getAgreementFolders(): Promise<
  ApiSuccessResponse<AgreementFolder[]>
> {
  return api.get("/hrms/agreements/folders");
}

export async function getAgreementDownloadUrl(
  id: string,
): Promise<ApiSuccessResponse<{ url: string }>> {
  return api.get(`/hrms/agreements/${id}/download`);
}
