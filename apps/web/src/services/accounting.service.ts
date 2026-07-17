import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// ─── Types ──────────────────────────────────────────────

export interface ChartOfAccount {
  id: string;
  entityId: string;
  code: string;
  name: string;
  nameTh: string | null;
  type: string;
  parentId: string | null;
  balance: string;
  isActive: boolean;
}

export interface JournalEntry {
  id: string;
  entity: { id: string; name: string; code: string };
  reference: string;
  date: string;
  /** English description. Null when only the Thai variant has been imported. */
  description: string | null;
  /** Thai description. Null when only the English variant has been imported. */
  descriptionTh: string | null;
  status: string;
  totalDebit: string;
  totalCredit: string;
  creator: { id: string; name: string };
  approver: { id: string; name: string } | null;
  createdAt: string;
}

export interface JournalEntryLine {
  id: string;
  account: { id: string; code: string; name: string };
  memo: string | null;
  debit: string;
  credit: string;
}

export interface JournalEntryDetail extends JournalEntry {
  lines: JournalEntryLine[];
}

export interface Invoice {
  id: string;
  entity: { id: string; name: string };
  invoiceNo: string;
  type: string;
  counterparty: string;
  amount: string;
  currency: string;
  status: string;
  issueDate: string;
  dueDate: string;
  linkedJeId: string | null;
  notes: string | null;
  paidDate: string | null;
}

export interface BankTransaction {
  id: string;
  entity: { id: string; name: string };
  date: string;
  description: string;
  amount: string;
  currency: string;
  mapped: { id: string; code: string; name: string } | null;
  status: string;
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

export const ACCOUNT_SORT_FIELDS = ["code", "name", "type", "balance"] as const;
export type AccountSortField = (typeof ACCOUNT_SORT_FIELDS)[number];

export async function listAccounts(params: {
  entityId?: string;
  type?: string;
  sortBy?: AccountSortField;
  sortOrder?: "asc" | "desc";
}): Promise<ApiSuccessResponse<ChartOfAccount[]>> {
  return api.get(`/accounting/accounts${buildQuery(params)}`);
}

export async function createAccount(input: {
  entityId: string;
  code: string;
  name: string;
  nameTh?: string;
  type: string;
  parentId?: string;
  currency?: string;
}): Promise<ApiSuccessResponse<ChartOfAccount>> {
  return api.post("/accounting/accounts", input);
}

export type AccountImportType =
  "asset" | "liability" | "equity" | "revenue" | "expense";

export interface AccountImportRow {
  code: string;
  name: string;
  nameTh?: string;
  type: AccountImportType;
}

export type AccountImportAction = "insert" | "update-th" | "skip";

export interface AccountImportPreviewRow extends AccountImportRow {
  action: AccountImportAction;
}

export interface AccountImportPreview {
  rows: AccountImportPreviewRow[];
  summary: {
    total: number;
    unique: number;
    duplicateInPayload: number;
    inserts: number;
    updates: number;
    skipped: number;
  };
}

export interface AccountImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  total: number;
}

export async function previewAccountImport(input: {
  entityId: string;
  rows: AccountImportRow[];
}): Promise<ApiSuccessResponse<AccountImportPreview>> {
  return api.post("/accounting/accounts/import/preview", input);
}

export async function commitAccountImport(input: {
  entityId: string;
  rows: AccountImportRow[];
}): Promise<ApiSuccessResponse<AccountImportResult>> {
  return api.post("/accounting/accounts/import/commit", input);
}

export type JournalImportStatus = "draft" | "approved" | "posted";

/** Language carried by the GL xlsx — controls which description column the importer writes. */
export type JournalImportLanguage = "en" | "th";

export type JournalImportAction =
  "insert" | "update" | "skip-duplicate" | "skip-unbalanced" | "skip-missing";

export interface JournalImportLine {
  accountCode: string;
  debit: number;
  credit: number;
  memo?: string;
}

export interface JournalImportEntry {
  reference: string;
  date: string;
  description?: string;
  lines: JournalImportLine[];
}

export interface JournalImportPreviewRow {
  reference: string;
  date: string;
  description?: string;
  lineCount: number;
  totalDebit: number;
  totalCredit: number;
  missingCodes: string[];
  action: JournalImportAction;
}

export interface JournalImportPreview {
  rows: JournalImportPreviewRow[];
  summary: {
    total: number;
    unique: number;
    duplicateInPayload: number;
    inserts: number;
    updates: number;
    skipDuplicates: number;
    skipUnbalanced: number;
    skipMissing: number;
  };
}

export interface JournalImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  total: number;
}

export async function previewJournalImport(input: {
  entityId: string;
  status: JournalImportStatus;
  language: JournalImportLanguage;
  entries: JournalImportEntry[];
}): Promise<ApiSuccessResponse<JournalImportPreview>> {
  return api.post("/accounting/journals/import/preview", input);
}

export async function commitJournalImport(input: {
  entityId: string;
  status: JournalImportStatus;
  language: JournalImportLanguage;
  entries: JournalImportEntry[];
}): Promise<ApiSuccessResponse<JournalImportResult>> {
  return api.post("/accounting/journals/import/commit", input);
}

export const JOURNAL_SORT_FIELDS = [
  "reference",
  "date",
  "entity",
  "description",
  "totalDebit",
  "totalCredit",
  "status",
] as const;
export type JournalSortField = (typeof JOURNAL_SORT_FIELDS)[number];

export async function listJournals(params: {
  page?: number;
  limit?: number;
  entityId?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  descriptionLang?: "en" | "th";
  sortBy?: JournalSortField;
  sortOrder?: "asc" | "desc";
}): Promise<ApiPaginatedResponse<JournalEntry>> {
  return api.get(`/accounting/journals${buildQuery(params)}`);
}

export async function getJournal(
  id: string,
): Promise<ApiSuccessResponse<JournalEntryDetail>> {
  return api.get(`/accounting/journals/${id}`);
}

export async function createJournal(input: {
  entityId: string;
  reference: string;
  date: string;
  description: string;
  lines: Array<{
    accountId: string;
    memo?: string;
    debit: number;
    credit: number;
  }>;
}): Promise<ApiSuccessResponse<JournalEntryDetail>> {
  return api.post("/accounting/journals", input);
}

export async function approveJournal(
  id: string,
): Promise<ApiSuccessResponse<JournalEntry>> {
  return api.put(`/accounting/journals/${id}/approve`);
}

export async function postJournal(
  id: string,
): Promise<ApiSuccessResponse<JournalEntry>> {
  return api.put(`/accounting/journals/${id}/post`);
}

export interface BulkDeleteJournalsResult {
  deletedCount: number;
  mode: "ids" | "all";
}

export async function bulkDeleteJournals(
  ids: string[],
): Promise<ApiSuccessResponse<BulkDeleteJournalsResult>> {
  return api.post("/accounting/journals/bulk-delete", { ids });
}

export async function deleteAllJournals(): Promise<
  ApiSuccessResponse<BulkDeleteJournalsResult>
> {
  return api.post("/accounting/journals/bulk-delete", { all: true });
}

export const INVOICE_SORT_FIELDS = [
  "invoiceNo",
  "type",
  "counterparty",
  "amount",
  "issueDate",
  "dueDate",
  "status",
] as const;
export type InvoiceSortField = (typeof INVOICE_SORT_FIELDS)[number];

export async function listInvoices(params: {
  page?: number;
  limit?: number;
  entityId?: string;
  status?: string;
  type?: string;
  sortBy?: InvoiceSortField;
  sortOrder?: "asc" | "desc";
}): Promise<ApiPaginatedResponse<Invoice>> {
  return api.get(`/accounting/invoices${buildQuery(params)}`);
}

export async function createInvoice(input: {
  entityId: string;
  invoiceNo: string;
  type: string;
  counterparty: string;
  amount: number;
  currency: string;
  issueDate: string;
  dueDate: string;
  linkedJeId?: string;
  notes?: string;
}): Promise<ApiSuccessResponse<Invoice>> {
  return api.post("/accounting/invoices", input);
}

export const BANK_TX_SORT_FIELDS = [
  "date",
  "description",
  "entity",
  "amount",
  "status",
] as const;
export type BankTxSortField = (typeof BANK_TX_SORT_FIELDS)[number];

export async function listBankTransactions(params: {
  page?: number;
  limit?: number;
  entityId?: string;
  status?: string;
  sortBy?: BankTxSortField;
  sortOrder?: "asc" | "desc";
}): Promise<ApiPaginatedResponse<BankTransaction>> {
  return api.get(`/accounting/bank${buildQuery(params)}`);
}
