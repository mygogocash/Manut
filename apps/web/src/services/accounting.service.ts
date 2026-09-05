import { api, apiBaseUrl, ApiError, authFetchInit } from "@/lib/api-client";
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
  description: string | null;
  descriptionTh: string | null;
  type: string;
  parentId: string | null;
  balance: string;
  isActive: boolean;
  warnings?: AccountReuseWarning[];
}

export interface JournalEntry {
  id: string;
  entity: { id: string; name: string; code: string; currency: string };
  entryNo: string;
  draftNo: string | null;
  sourceType: string | null;
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
  rejector: { id: string; name: string } | null;
  canceller: { id: string; name: string } | null;
  rejectReason: string | null;
  cancelReason: string | null;
  rejectedAt: string | null;
  approvedAt: string | null;
  cancelledAt: string | null;
  deletedAt?: string | null;
  deletedBy?: string | null;
  reversesEntryId: string | null;
  reversedByEntryId: string | null;
  createdAt: string;
}

export interface CorporatePnlAccount {
  accountId: string;
  code: string;
  name: string;
  type: "revenue" | "expense";
  amount: number;
}

export interface CorporatePnlEntity {
  entityId: string;
  entityName: string;
  entityCode: string;
  currency: string;
  revenue: number;
  expenses: number;
  netProfit: number;
  margin: number | null;
  revenueUsd: number;
  expensesUsd: number;
  netProfitUsd: number;
  previousNetProfitUsd: number;
  netProfitChangePct: number | null;
  fxRate: number;
  fxSource: string;
  accounts: CorporatePnlAccount[];
}

export interface CorporateFinanceOverview {
  reportingCurrency: "USD";
  fxCompleteness: {
    isComplete: boolean;
    excludedEntityCount: number;
    missingCurrencies: string[];
  };
  period: {
    startDate: string;
    endDate: string;
    previousStartDate: string;
    previousEndDate: string;
  };
  totals: {
    revenue: number;
    expenses: number;
    netProfit: number;
    margin: number | null;
    previousNetProfit: number;
    netProfitChangePct: number | null;
  };
  entities: CorporatePnlEntity[];
  review: {
    counts: {
      draft: number;
      rejected: number;
      approved: number;
      staleDrafts: number;
    };
    journals: JournalEntryDetail[];
  };
  exceptions: {
    overdueInvoices: {
      count: number;
      items: Array<Invoice & { amount: number }>;
    };
    unmatchedBank: {
      count: number;
      items: Array<BankTransaction & { amount: number }>;
    };
  };
  /** Invoice-based PRD figures (pre-VAT document totals). Not USD GL. */
  prdExhibits: {
    accrualRevenue: number;
    operatingExpense: number;
    capex: number;
    /** operatingExpense − capex. What actually reaches the income statement;
     *  the capitalised part arrives later as depreciation. */
    expenseInProfitAndLoss: number;
  };
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

export interface InvoiceLineItem {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  sortOrder: number;
  /**
   * Optional "category" GL account this line posts to (M-per-category). Null →
   * the send falls back to the entity's `revenue_default` / `expense_default`
   * mapping. Surfaced on the Expense workspace as the bill's category column.
   */
  glAccountId: string | null;
  lineDiscount?: string;
  vatRate?: string | null;
  vatReason?: string | null;
  taxBase?: string | null;
  vatAmount?: string | null;
  capitalised?: boolean;
}

export interface Invoice {
  id: string;
  entity: { id: string; name: string };
  invoiceNo: string;
  type: string;
  counterparty: string;
  amount: string;
  amountPaid: string;
  currency: string;
  status: string;
  billToAddress: string | null;
  reference: string | null;
  paymentTerms: string | null;
  vatRate: string;
  taxLabel: string | null;
  taxRate: string;
  whtRate: string;
  issueDate: string;
  dueDate: string;
  linkedJeId: string | null;
  notes: string | null;
  paidDate: string | null;
  draftNo?: string | null;
  headerDiscount?: string;
  roundingAmount?: string;
  fxSide?: string | null;
  fxRateDate?: string | null;
  vendorTaxInvoiceNo?: string | null;
  taxInvoiceReceived?: boolean;
  deletedAt?: string | null;
  deletedBy?: string | null;
  attachments?: Array<{
    id: string;
    originalName: string;
    mimeType: string;
    size: number;
    createdAt: string;
  }>;
  lineItems: InvoiceLineItem[];
}

/** Admin-editable company + bank block that heads every generated invoice. */
export interface InvoiceCompany {
  name: string;
  addressLines: string[];
  taxId: string;
  email: string;
  tel: string;
  bankName: string;
  bankAccountType: string;
  bankBranch: string;
  bankAccountName: string;
  bankAccountNo: string;
  bankSwift: string;
  footerNote: string;
}

export interface InvoiceLineItemInput {
  description: string;
  quantity: number;
  unitPrice: number;
  /**
   * Category GL account to debit/credit on send (M-per-category). Omit to fall
   * back to the entity's `expense_default` / `revenue_default` mapping. The
   * Expense workspace sets this from the category picker.
   */
  glAccountId?: string;
  lineDiscount?: number;
  vatRate?: number;
  vatReason?: string;
  capitalised?: boolean;
}

export interface InvoiceInput {
  entityId: string;
  /**
   * Omit on create so the server allocates DRAFT-INV-*. Statutory INV/EXP
   * numbers are assigned at send. Do not send on edit of an issued document.
   */
  invoiceNo?: string;
  type: string;
  counterparty: string;
  billToAddress?: string;
  reference?: string;
  paymentTerms?: string;
  currency: string;
  /** Manual FX rate (document currency → entity base). Auto-resolved if omitted. */
  exchangeRate?: number;
  vatRate: number;
  taxLabel?: string;
  taxRate: number;
  whtRate: number;
  headerDiscount?: number;
  /** Optional satang tweak vs computed grand total (±1.00). */
  userTotal?: number;
  issueDate: string;
  dueDate: string;
  linkedJeId?: string;
  notes?: string;
  lineItems: InvoiceLineItemInput[];
}

export const INVOICE_STATUSES = [
  "draft",
  "sent",
  "paid",
  "overdue",
  "cancelled",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export interface BankTransaction {
  id: string;
  entity: { id: string; name: string; code?: string; currency?: string };
  date: string;
  description: string;
  amount: string;
  currency: string;
  mapped: { id: string; code: string; name: string } | null;
  status: string;
  reconciled?: boolean;
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

// ─── GL posting: account-role mapping + readiness ──────────────────────────

export const MAPPING_ROLES = [
  "ar_control",
  "ap_control",
  "revenue_default",
  "expense_default",
  "vat_output",
  "vat_output_deferred",
  "vat_input",
  "vat_input_deferred",
  "wht_payable",
  "wht_receivable",
  "retained_earnings",
  "rounding",
  "fx_gain",
  "fx_loss",
  "bank_charges",
  "customer_advances",
  "vendor_advances",
  "sales_returns",
  "settlement_writeoff",
  "opening_balance_equity",
  // Fixed Asset posting (Phase 2). Situational — they do not gate posting
  // readiness, so an entity with no fixed assets is unaffected. Mirrors
  // MAPPING_ROLES in apps/api/src/modules/accounting/gl-posting.service.ts.
  "fa_asset_cost",
  "fa_depreciation_expense",
  "fa_accumulated_depreciation",
  "fa_disposal_gain",
  "fa_disposal_loss",
] as const;
export type MappingRole = (typeof MAPPING_ROLES)[number];

export interface MappedAccountRef {
  id: string;
  code: string;
  name: string;
  type: string;
}
export interface RoleMappingView {
  role: MappingRole;
  chartOfAccountId: string | null;
  account: MappedAccountRef | null;
}
export interface AccountMappings {
  entityId: string;
  roles: RoleMappingView[];
}
export interface PostingReadiness {
  entityId: string;
  postingFlagEnabled: boolean;
  totalRoles: number;
  mappedCount: number;
  unmappedRoles: MappingRole[];
  mappingComplete: boolean;
  ready: boolean;
}

export async function listAccountMappings(
  entityId: string,
): Promise<ApiSuccessResponse<AccountMappings>> {
  return api.get(`/accounting/account-mappings${buildQuery({ entityId })}`);
}

export async function setAccountMapping(input: {
  entityId: string;
  role: MappingRole;
  chartOfAccountId: string | null;
}): Promise<ApiSuccessResponse<unknown>> {
  return api.put("/accounting/account-mappings", input);
}

export async function getPostingReadiness(
  entityId: string,
): Promise<ApiSuccessResponse<PostingReadiness>> {
  return api.get(`/accounting/posting-readiness${buildQuery({ entityId })}`);
}

// ─── Financial reports (M21) ───────────────────────────────────────────────

export interface TrialBalance {
  asOf: string;
  rows: Array<{
    accountId: string;
    code: string;
    name: string;
    type: string;
    debit: number;
    credit: number;
  }>;
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
}
export interface ProfitAndLoss {
  startDate: string;
  endDate: string;
  revenue: Array<{
    accountId: string;
    code: string;
    name: string;
    amount: number;
  }>;
  expenses: Array<{
    accountId: string;
    code: string;
    name: string;
    amount: number;
  }>;
  totalRevenue: number;
  totalExpenses: number;
  netProfit: number;
}
export interface BalanceSheet {
  asOf: string;
  fiscalYearStart: string;
  assets: Array<{
    accountId: string;
    code: string;
    name: string;
    amount: number;
  }>;
  liabilities: Array<{
    accountId: string;
    code: string;
    name: string;
    amount: number;
  }>;
  equity: Array<{
    accountId: string;
    code: string;
    name: string;
    amount: number;
  }>;
  totalAssets: number;
  totalLiabilities: number;
  retainedEarnings: number;
  currentYearEarnings: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  balanced: boolean;
  difference: number;
}
export interface CashFlow {
  startDate: string;
  endDate: string;
  openingCash: number;
  closingCash: number;
  netChange: number;
  operating: number;
  investing: number;
  financing: number;
  reconciles: boolean;
  note: string;
}
export interface TaxSummary {
  entityId: string;
  startDate: string;
  endDate: string;
  outputVat: number;
  inputVat: number;
  netVatPayable: number;
  whtPayable: number;
  whtReceivable: number;
  note: string;
}

// ── Tax-filing registers (M9): RD output/input VAT + PP.30 + PND.3/PND.53 ────
export interface VatRegisterRow {
  seq: number;
  docNo: string;
  date: string;
  counterparty: string;
  taxId: string;
  branch: string;
  currency: string;
  exchangeRate: number;
  base: number;
  vat: number;
  vatRate: number;
  zeroRatedOrExempt: boolean;
}
export interface VatRegister {
  rows: VatRegisterRow[];
  totalBase: number;
  totalVat: number;
  standardRatedBase: number;
  zeroRatedOrExemptBase: number;
}
export interface Pp30Summary {
  standardRatedSales: number;
  zeroRatedOrExemptSales: number;
  totalSales: number;
  outputVat: number;
  totalPurchases: number;
  inputVat: number;
  netVatPayable: number;
  vatCredit: number;
}
export interface WhtPayeeGroup {
  payeeId: string;
  payee: string;
  taxId: string;
  base: number;
  whtAmount: number;
  count: number;
}
export interface WhtReturn {
  form: "PND.3" | "PND.53";
  payees: WhtPayeeGroup[];
  totalBase: number;
  totalWht: number;
}
export interface WhtSummary {
  pnd3: WhtReturn;
  pnd53: WhtReturn;
}
export interface TaxRegisters {
  entityId: string;
  startDate: string;
  endDate: string;
  output: VatRegister;
  input: VatRegister;
  pp30: Pp30Summary;
  wht: WhtSummary;
  note: string;
}

export async function getTrialBalance(params: {
  entityId?: string;
  asOf?: string;
}): Promise<ApiSuccessResponse<TrialBalance>> {
  return api.get(`/accounting/reports/trial-balance${buildQuery(params)}`);
}
export async function getProfitAndLoss(params: {
  entityId?: string;
  startDate: string;
  endDate: string;
}): Promise<ApiSuccessResponse<ProfitAndLoss>> {
  return api.get(`/accounting/reports/profit-and-loss${buildQuery(params)}`);
}
export async function getBalanceSheet(params: {
  entityId?: string;
  asOf?: string;
}): Promise<ApiSuccessResponse<BalanceSheet>> {
  return api.get(`/accounting/reports/balance-sheet${buildQuery(params)}`);
}
export async function getCashFlow(params: {
  entityId?: string;
  startDate: string;
  endDate: string;
}): Promise<ApiSuccessResponse<CashFlow>> {
  return api.get(`/accounting/reports/cash-flow${buildQuery(params)}`);
}
export async function getTaxReport(params: {
  entityId: string;
  startDate: string;
  endDate: string;
}): Promise<ApiSuccessResponse<TaxSummary>> {
  return api.get(`/accounting/reports/tax-summary${buildQuery(params)}`);
}
export async function getTaxRegisters(params: {
  entityId: string;
  startDate: string;
  endDate: string;
}): Promise<ApiSuccessResponse<TaxRegisters>> {
  return api.get(`/accounting/reports/tax-registers${buildQuery(params)}`);
}

export interface StatutoryReports {
  entityId: string;
  startDate: string;
  endDate: string;
  numberControl: Record<
    string,
    {
      first: string | null;
      last: string | null;
      issuedCount: number;
      cancelledCount: number;
      gaps: Array<{ expected: string; reason: "gap" | "cancelled" }>;
    }
  >;
  deferredVatRecon: {
    issuedDeferredVat: number;
    collectedRecognisedVat: number;
    remainingDeferredVat: number;
    reconDifference: number;
  };
  pendingWhtCertificates: Array<{
    paymentId: string;
    receiptNo: string | null;
    date: string;
    counterparty: string;
    invoiceNo: string;
    whtAmount: number;
  }>;
  zeroAttachmentJournals: string[];
  attachmentDeletions: Array<{
    id: string;
    originalName: string;
    linkedTo: string | null;
    linkedId: string | null;
    deletedAt: string | null;
    deletedBy: string | null;
  }>;
}

export async function getStatutoryReports(params: {
  entityId: string;
  startDate: string;
  endDate: string;
}): Promise<ApiSuccessResponse<StatutoryReports>> {
  return api.get(`/accounting/reports/statutory${buildQuery(params)}`);
}

export async function markWhtCertificateReceived(
  paymentId: string,
): Promise<ApiSuccessResponse<unknown>> {
  return api.post(
    `/accounting/payments/${paymentId}/wht-certificate-received`,
    {},
  );
}

// ─── Tax filings + tax-month lock (M9) ─────────────────────────────────────

export interface TaxFiling {
  id: string;
  entityId: string;
  filingType: string;
  year: number;
  month: number;
  status: string;
  notes: string | null;
  filedAt: string;
  filedBy: string;
  reopenedAt: string | null;
  reopenedBy: string | null;
}

export async function listTaxFilings(params: {
  entityId: string;
  filingType?: string;
  year?: number;
}): Promise<ApiSuccessResponse<TaxFiling[]>> {
  return api.get(`/accounting/tax-filings${buildQuery(params)}`);
}

export async function fileTaxPeriod(input: {
  entityId: string;
  filingType?: string;
  year: number;
  month: number;
  notes?: string;
}): Promise<ApiSuccessResponse<TaxFiling>> {
  return api.post("/accounting/tax-filings/file", input);
}

export async function reopenTaxPeriod(input: {
  entityId: string;
  filingType?: string;
  year: number;
  month: number;
}): Promise<ApiSuccessResponse<TaxFiling>> {
  return api.post("/accounting/tax-filings/reopen", input);
}

// ─── Accounting audit-log viewer (M12) ─────────────────────────────────────

export interface AuditLogEntry {
  id: string;
  userId: string | null;
  user: { id: string; name: string; email: string } | null;
  action: string;
  resource: string;
  resourceId: string | null;
  details: Record<string, unknown> | null;
  timestamp: string;
}

export async function listAccountingAuditLogs(params: {
  resource?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<ApiSuccessResponse<AuditLogEntry[]>> {
  return api.get(`/accounting/audit-log${buildQuery(params)}`);
}

// ─── Statement of account (M1) ─────────────────────────────────────────────
// Authed binary fetch → object URL → click (auth header can't ride an <a href>).

export async function downloadStatement(params: {
  entityId: string;
  counterparty: string;
  type?: "receivable" | "payable";
  asOf?: string;
}): Promise<void> {
  const res = await fetch(
    `${apiBaseUrl}/accounting/statements/download${buildQuery(params)}`,
    authFetchInit(),
  );
  if (!res.ok) throw new Error("Failed to download statement");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `statement-${params.counterparty}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── Customer advances (M3) ────────────────────────────────────────────────

export interface CustomerAdvance {
  id: string;
  entityId: string;
  counterparty: string;
  currency: string;
  originalAmount: string;
  balance: string;
  status: string;
  sourcePaymentId: string | null;
  notes: string | null;
  createdAt: string;
}

export async function listCustomerAdvances(params: {
  entityId: string;
  counterparty?: string;
  status?: string;
}): Promise<ApiSuccessResponse<CustomerAdvance[]>> {
  return api.get(`/accounting/customer-advances${buildQuery(params)}`);
}

export async function applyCustomerAdvance(
  id: string,
  input: { invoiceId: string; amount: number; date?: string },
): Promise<
  ApiSuccessResponse<{
    applied: number;
    remainingBalance: number;
    posted: boolean;
  }>
> {
  return api.post(`/accounting/customer-advances/${id}/apply`, input);
}

// ─── Bank accounts + payments (M4 / M6 / M9) ───────────────────────────────

export interface BankAccount {
  id: string;
  entityId: string;
  name: string;
  kind: string;
  currency: string;
  currentBalance: string;
  glAccountId: string | null;
  glAccount: { id: string; code: string; name: string } | null;
}

export interface PaymentInvoiceRef {
  id: string;
  invoiceNo: string;
  counterparty: string;
  currency: string;
  type: string;
  amount?: string;
  amountPaid?: string;
  status?: string;
  vendorTaxInvoiceNo?: string | null;
}

export interface Payment {
  id: string;
  invoiceId: string;
  bankAccountId: string | null;
  date: string;
  amount: string;
  whtAmount: string;
  bankFee?: string;
  receiptNo?: string | null;
  vatRecognised?: string;
  method: string;
  reference: string | null;
  linkedJeId: string | null;
  currency?: string | null;
  bankAccount: { id: string; name: string } | null;
  invoice?: PaymentInvoiceRef;
  entity?: { id: string; name: string };
}

export async function listBankAccounts(params: {
  entityId?: string;
  includeInactive?: boolean;
}): Promise<ApiSuccessResponse<BankAccount[]>> {
  return api.get(`/accounting/bank-accounts${buildQuery(params)}`);
}

export async function recordPayment(
  invoiceId: string,
  input: {
    bankAccountId: string;
    date: string;
    amount: number;
    whtAmount?: number;
    /** Stored on the payment row; GL bank-charge wiring may land later. */
    bankFee?: number;
    method?: string;
    reference?: string;
    notes?: string;
    /** Payment currency (defaults to the invoice's). */
    currency?: string;
    /** Manual settlement FX rate (payment currency → entity base). Auto-resolved if omitted. */
    exchangeRate?: number;
    /** Overpayment → customer advance (M3): capture the excess instead of rejecting. */
    allowOverpayment?: boolean;
    writeOffRemainder?: boolean;
    writeOffReason?: string;
  },
): Promise<
  ApiSuccessResponse<{
    invoice: Invoice;
    posted: boolean;
    advanceCaptured: number | null;
  }>
> {
  return api.post(`/accounting/invoices/${invoiceId}/payments`, input);
}

export async function listPaymentsForInvoice(
  invoiceId: string,
): Promise<ApiSuccessResponse<Payment[]>> {
  return api.get(`/accounting/invoices/${invoiceId}/payments`);
}

export async function listPayments(params: {
  page?: number;
  limit?: number;
  entityId?: string;
  type?: "receivable" | "payable";
}): Promise<ApiPaginatedResponse<Payment>> {
  try {
    const result = await api.get<ApiPaginatedResponse<Payment>>(
      `/accounting/payments${buildQuery(params)}`,
    );
    const rows = Array.isArray(result.data) ? result.data : [];
    const matching = params.type
      ? rows.filter(
          (row) => !row.invoice?.type || row.invoice.type === params.type,
        )
      : rows;
    if (params.type && rows.length > 0 && matching.length === 0) {
      return listPaymentsFromInvoices(params);
    }
    if (result.meta && matching.length === rows.length) return result;
    return {
      data: matching,
      meta: result.meta ?? {
        page: params.page ?? 1,
        limit: params.limit ?? matching.length,
        total: matching.length,
        totalPages: 1,
      },
    };
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 405)) {
      return listPaymentsFromInvoices(params);
    }
    throw err;
  }
}

async function listPaymentsFromInvoices(params: {
  page?: number;
  limit?: number;
  entityId?: string;
  type?: "receivable" | "payable";
}): Promise<ApiPaginatedResponse<Payment>> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 10;
  const collected: Payment[] = [];
  let invoicePage = 1;
  const invoicePageSize = 50;
  let more = true;

  while (more && invoicePage <= 2) {
    const invoices = await listInvoices({
      page: invoicePage,
      limit: invoicePageSize,
      entityId: params.entityId,
      type: params.type,
    });
    const withPaid = invoices.data.filter((inv) => Number(inv.amountPaid) > 0);
    const batches = await Promise.all(
      withPaid.map(async (inv) => {
        const res = await listPaymentsForInvoice(inv.id);
        return res.data.map((payment) => ({
          ...payment,
          invoice: {
            id: inv.id,
            invoiceNo: inv.invoiceNo,
            counterparty: inv.counterparty,
            currency: inv.currency,
            type: inv.type,
            amount: inv.amount,
            amountPaid: inv.amountPaid,
            status: inv.status,
            vendorTaxInvoiceNo: inv.vendorTaxInvoiceNo ?? null,
          },
        }));
      }),
    );
    collected.push(...batches.flat());
    more = invoicePage * invoicePageSize < invoices.meta.total;
    invoicePage += 1;
  }

  collected.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  );
  const total = collected.length;
  const start = (page - 1) * limit;
  return {
    data: collected.slice(start, start + limit),
    meta: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit) || 1),
    },
  };
}

export async function voidPayment(
  paymentId: string,
): Promise<ApiSuccessResponse<Invoice>> {
  return api.post(`/accounting/payments/${paymentId}/void`);
}

// ─── Multi-invoice settlement + payment runs (M3/M6, ACCOUNTING_SETTLEMENT_V2) ─
export interface AllocatedPaymentResult {
  paymentId: string;
  invoicesSettled: number;
  totalCash: number;
  totalWht: number;
  posted: boolean;
}
export async function recordAllocatedPayment(input: {
  bankAccountId: string;
  date: string;
  method?: string;
  reference?: string;
  currency?: string;
  exchangeRate?: number;
  allocations: { invoiceId: string; amount: number; whtAmount?: number }[];
}): Promise<ApiSuccessResponse<AllocatedPaymentResult>> {
  return api.post(`/accounting/payments/allocated`, input);
}

export interface PaymentRunResult {
  paymentsCreated: number;
  totalCash: number;
  totalWht: number;
  payments: {
    payeeKey: string;
    paymentId: string;
    invoicesSettled: number;
    totalCash: number;
    totalWht: number;
    posted: boolean;
  }[];
}
export async function runPaymentBatch(input: {
  bankAccountId: string;
  date: string;
  method?: string;
  reference?: string;
  lines: { invoiceId: string; amount: number; whtAmount?: number }[];
}): Promise<ApiSuccessResponse<PaymentRunResult>> {
  return api.post(`/accounting/payment-runs`, input);
}

export async function createAccount(input: {
  entityId: string;
  code: string;
  name: string;
  nameTh: string;
  description: string;
  descriptionTh: string;
  type: string;
  parentId?: string;
  currency?: string;
  acknowledgeInactiveReuse?: boolean;
}): Promise<ApiSuccessResponse<ChartOfAccount>> {
  return api.post("/accounting/accounts", input);
}

export async function updateAccount(
  id: string,
  input: {
    code?: string;
    name?: string;
    nameTh?: string;
    description?: string;
    descriptionTh?: string;
    type?: string;
    parentId?: string;
    isActive?: boolean;
    acknowledgeInactiveReuse?: boolean;
  },
): Promise<ApiSuccessResponse<ChartOfAccount>> {
  return api.put(`/accounting/accounts/${id}`, input);
}

/** What a deactivated account's leftover code / English name looks like to the
 *  form, before anything is saved. */
export interface AccountReuseWarning {
  code: "inactive_code_reuse" | "inactive_name_reuse";
  message: string;
  messageTh?: string;
  detail?: {
    accountId: string;
    accountCode: string;
    accountName: string;
    accountNameTh: string | null;
    deactivatedAt: string | null;
    balance: number;
    lastMovementYear: number | null;
  };
}

export interface AccountReuseCheck {
  /** allow → nothing in the way · acknowledge → warn and require a tick ·
   *  block → the old account still has a balance or a statement mapping */
  outcome: "allow" | "acknowledge" | "block";
  warnings: AccountReuseWarning[];
  blockers: Array<{ field?: string; message: string; messageTh?: string }>;
}

export async function checkAccountReuse(input: {
  entityId: string;
  code?: string;
  name?: string;
  excludeAccountId?: string;
}): Promise<ApiSuccessResponse<AccountReuseCheck>> {
  return api.post("/accounting/accounts/reuse-check", input);
}

export type AccountImportType =
  "asset" | "liability" | "equity" | "revenue" | "expense";

export interface AccountImportRow {
  code: string;
  name: string;
  nameTh?: string;
  description?: string;
  descriptionTh?: string;
  type: AccountImportType;
}

export type AccountImportAction = "insert" | "update-th" | "skip" | "invalid";

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
    invalid?: number;
  };
}

export interface AccountImportResult {
  inserted: number;
  updated: number;
  skipped: number;
  invalid?: number;
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
  "entryNo",
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

export async function rejectJournal(
  id: string,
  reason: string,
): Promise<ApiSuccessResponse<JournalEntry>> {
  return api.put(`/accounting/journals/${id}/reject`, { reason });
}

export async function bulkApproveJournals(
  ids: string[],
): Promise<ApiSuccessResponse<{ updatedCount: number }>> {
  return api.post("/accounting/journals/bulk-approve", { ids });
}

export async function bulkRejectJournals(
  ids: string[],
  reason: string,
): Promise<ApiSuccessResponse<{ updatedCount: number }>> {
  return api.post("/accounting/journals/bulk-reject", { ids, reason });
}

export async function postJournal(
  id: string,
): Promise<ApiSuccessResponse<JournalEntry>> {
  return api.put(`/accounting/journals/${id}/post`);
}

/** Raised after a reversal lands in a later month than the entry it undoes.
 *  Never blocks — the cancellation has already happened. */
export interface JournalReversalWarning {
  code: "reversal_affects_tax_filing" | "reversal_affects_retained_earnings";
  message: string;
  messageTh: string;
}

export async function cancelJournal(
  id: string,
  input: { reason: string; reverseDate?: string },
): Promise<
  ApiSuccessResponse<JournalEntry & { warnings: JournalReversalWarning[] }>
> {
  return api.put(`/accounting/journals/${id}/cancel`, input);
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

export async function getCorporateFinanceOverview(params: {
  period: "mtd" | "qtd" | "ytd" | "custom";
  entityId?: string;
  startDate?: string;
  endDate?: string;
}): Promise<ApiSuccessResponse<CorporateFinanceOverview>> {
  return api.get(`/accounting/overview${buildQuery(params)}`);
}

export interface VendorDuplicateVendor {
  id: string;
  name: string;
  taxId: string | null;
  entityId: string;
  contactId?: string | null;
  email?: string | null;
  phone?: string | null;
  branch?: string | null;
  isActive?: boolean;
}

export type VendorDuplicateGroup = VendorDuplicateVendor[];

export interface MergeVendorsInput {
  survivingVendorId: string;
  sourceVendorId: string;
  missingTaxIdReason?: string;
  /** Required when merging without a tax ID — the identity is a judgement call
   *  at that point and the merge cannot be undone. */
  acknowledgedSameParty?: boolean;
  keepFields?: Record<string, "surviving" | "source">;
}

export interface MergeVendorsResult {
  survivingVendorId: string;
  sourceVendorId: string;
  mergedBy: string;
  warning?: string;
  documents?: { invoices: number; payments: number };
  duplicatePayments?: Array<
    Array<{
      id: string;
      date: string;
      amount: number;
      reference: string | null;
      invoiceNo: string;
    }>
  >;
}

export interface VendorMergePreview {
  surviving: {
    id: string;
    name: string;
    taxId: string | null;
    contactId: string | null;
  };
  source: {
    id: string;
    name: string;
    taxId: string | null;
    contactId: string | null;
  };
  fields: Array<{
    field: string;
    surviving: unknown;
    source: unknown;
    different: boolean;
  }>;
  documents: {
    invoices: number;
    quotes: number;
    purchaseOrders: number;
    creditNotes: number;
    payments: number;
  };
  // Split by control account and never netted: a contact can be both a customer
  // and a supplier, and the merge ties each side to the trial balance separately.
  outstanding: {
    surviving: { receivable: number; payable: number };
    source: { receivable: number; payable: number };
  };
  /** How many independent identifiers agree. Without a tax ID at least two
   *  must, because a merge cannot be undone. */
  identity: {
    score: number;
    required: number;
    sufficient: boolean;
    matches: Array<{
      component: "name" | "contact" | "address";
      matched: boolean;
      detail: string;
    }>;
  };
  requiresTaxIdReason: boolean;
  /** Non-null when the merge is impossible whatever the user types. */
  blocked: string | null;
}

export async function listVendorDuplicateSuggestions(params: {
  entityId?: string;
}): Promise<ApiSuccessResponse<VendorDuplicateGroup[]>> {
  return api.get(
    `/accounting/vendors/duplicate-suggestions${buildQuery(params)}`,
  );
}

export async function mergeVendors(
  input: MergeVendorsInput,
): Promise<ApiSuccessResponse<MergeVendorsResult>> {
  return api.post("/accounting/vendors/merge", input);
}

export async function previewVendorMerge(params: {
  survivingVendorId: string;
  sourceVendorId: string;
}): Promise<ApiSuccessResponse<VendorMergePreview>> {
  return api.get(`/accounting/vendors/merge-preview${buildQuery(params)}`);
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

export async function getInvoice(
  id: string,
): Promise<ApiSuccessResponse<Invoice>> {
  return api.get(`/accounting/invoices/${id}`);
}

// ─── Expense workspace: AP spend roll-up ──────────────────────────────────
// Server-side total + by-category breakdown of payable-bill spend for a
// month/year (paginated-aggregate rule — never sum a page of loaded rows).
// Each bill is attributed to its single category GL account; mixed-account
// bills fall into "Uncategorized".

export interface ExpenseCategoryTotal {
  accountId: string | null;
  label: string;
  total: number;
}

export interface ExpenseSummary {
  entityId: string;
  year: number;
  month: number | null;
  total: number;
  byCategory: ExpenseCategoryTotal[];
}

export async function getExpenseSummary(params: {
  entityId: string;
  year: number;
  month?: number;
}): Promise<ApiSuccessResponse<ExpenseSummary>> {
  return api.get(`/accounting/expense-summary${buildQuery(params)}`);
}

// ─── Global accounting search (header omnibox) ─────────────────────────────
// One term across invoices/bills, journals, chart of accounts, bank lines and
// payments. Server-side (owner-scoped for invoices/payments); each group is
// capped. Feeds the accounting-search omnibox.

export interface AccountingSearchInvoice {
  id: string;
  invoiceNo: string;
  type: string;
  counterparty: string;
  amount: number;
  currency: string;
  status: string;
  date: string;
}
export interface AccountingSearchJournal {
  id: string;
  reference: string | null;
  description: string | null;
  date: string;
  status: string;
}
export interface AccountingSearchAccount {
  id: string;
  code: string;
  name: string;
  type: string;
}
export interface AccountingSearchBank {
  id: string;
  description: string;
  amount: number;
  date: string;
  status: string;
  entityName: string;
}
export interface AccountingSearchPayment {
  id: string;
  invoiceId: string;
  invoiceNo: string;
  counterparty: string;
  amount: number;
  method: string;
  date: string;
}
export interface AccountingSearchResults {
  q: string;
  results: {
    invoices: AccountingSearchInvoice[];
    journals: AccountingSearchJournal[];
    accounts: AccountingSearchAccount[];
    bank: AccountingSearchBank[];
    payments: AccountingSearchPayment[];
  };
  total: number;
}

export async function searchAccounting(
  params: {
    q: string;
    entityId?: string;
    limit?: number;
  },
  signal?: AbortSignal,
): Promise<ApiSuccessResponse<AccountingSearchResults>> {
  return api.get(
    `/accounting/search${buildQuery(params)}`,
    signal ? { signal } : undefined,
  );
}

export async function createInvoice(
  input: InvoiceInput,
): Promise<ApiSuccessResponse<Invoice>> {
  return api.post("/accounting/invoices", input);
}

export async function updateInvoice(
  id: string,
  input: Partial<InvoiceInput>,
): Promise<ApiSuccessResponse<Invoice>> {
  return api.put(`/accounting/invoices/${id}`, input);
}

export async function deleteInvoice(
  id: string,
): Promise<ApiSuccessResponse<{ success: true }>> {
  return api.delete(`/accounting/invoices/${id}`);
}

export async function updateInvoiceStatus(
  id: string,
  status: InvoiceStatus,
): Promise<ApiSuccessResponse<Invoice>> {
  return api.patch(`/accounting/invoices/${id}/status`, { status });
}

// ─── Invoice company block (admin-editable letterhead + bank details) ─────

export async function getInvoiceCompany(): Promise<
  ApiSuccessResponse<InvoiceCompany>
> {
  return api.get("/accounting/invoices/company");
}

export async function updateInvoiceCompany(
  input: InvoiceCompany,
): Promise<ApiSuccessResponse<InvoiceCompany>> {
  return api.put("/accounting/invoices/company", input);
}

// ─── Invoice document downloads (PDF / Word) ──────────────────────────────
// Authed binary fetch → object URL → click, mirroring the export helpers
// elsewhere (auth header can't ride a plain <a href> to the API).

async function downloadInvoiceDoc(id: string, ext: "pdf" | "docx" | "xlsx") {
  const res = await fetch(
    `${apiBaseUrl}/accounting/invoices/${id}/${ext}`,
    authFetchInit(),
  );
  if (!res.ok) throw new Error(`Failed to download invoice ${ext}`);
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `invoice-${id}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadInvoicePdf(id: string): Promise<void> {
  return downloadInvoiceDoc(id, "pdf");
}

export function downloadInvoiceDocx(id: string): Promise<void> {
  return downloadInvoiceDoc(id, "docx");
}

export function downloadInvoiceXlsx(id: string): Promise<void> {
  return downloadInvoiceDoc(id, "xlsx");
}

// WHT certificate (Form 50 Bis) PDF for a supplier payment (M6).
export async function downloadTaxInvoice(paymentId: string): Promise<void> {
  const res = await fetch(
    `${apiBaseUrl}/accounting/payments/${paymentId}/tax-invoice`,
    authFetchInit(),
  );
  if (!res.ok) throw new Error("Failed to download tax invoice");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `tax-invoice-${paymentId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function downloadWhtCertificate(paymentId: string): Promise<void> {
  const res = await fetch(
    `${apiBaseUrl}/accounting/payments/${paymentId}/wht-certificate`,
    authFetchInit(),
  );
  if (!res.ok) throw new Error("Failed to download WHT certificate");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `wht-certificate-${paymentId}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Web route for the on-screen print view of an invoice. */
export function invoicePrintPath(id: string): string {
  return `/accounting/invoices/${id}/print`;
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

// ─── Bank reconciliation (M7) ──────────────────────────────────────────────
export interface ReconciliationSummary {
  entityId: string;
  asOf: string | null;
  transactionCount: number;
  reconciledCount: number;
  unreconciledCount: number;
  reconciledAmount: number;
  unreconciledAmount: number;
  bookBalance: number;
  statementBalance: number | null;
  difference: number | null;
  balanced: boolean;
}

export async function reconcileBankTransaction(
  id: string,
  input: { mappedAccountId?: string } = {},
): Promise<ApiSuccessResponse<BankTransaction>> {
  return api.post(`/accounting/bank/${id}/reconcile`, input);
}

export async function unreconcileBankTransaction(
  id: string,
): Promise<ApiSuccessResponse<BankTransaction>> {
  return api.post(`/accounting/bank/${id}/unreconcile`);
}

export async function getReconciliationSummary(params: {
  entityId: string;
  asOf?: string;
  statementBalance?: number;
}): Promise<ApiSuccessResponse<ReconciliationSummary>> {
  return api.get(
    `/accounting/bank/reconciliation-summary${buildQuery(params)}`,
  );
}

// ─── Smart bank matching (auto-match + confirm-and-settle) ─────────────────
// Read-only suggestions: for each unmatched imported line, the single open
// document it settles (`matched`) or the candidate list when ambiguous.

export interface BankMatchDoc {
  invoiceId: string;
  invoiceNo: string;
  type: string;
  outstanding: number;
  date: string;
  counterparty: string;
}

export interface BankMatchSuggestion {
  transaction: {
    id: string;
    date: string;
    amount: number;
    description: string;
    direction: string | null;
    bankAccountId: string | null;
  };
  matched: BankMatchDoc | null;
  candidates: BankMatchDoc[];
}

export async function getBankMatchSuggestions(
  entityId: string,
): Promise<ApiSuccessResponse<BankMatchSuggestion[]>> {
  return api.get(
    `/accounting/bank/match-suggestions${buildQuery({ entityId })}`,
  );
}

// Confirm a match: settle an imported line against an open invoice. Records the
// payment for the line's amount and adopts the imported row (no duplicate).
export async function settleBankTransaction(
  id: string,
  input: {
    invoiceId: string;
    bankAccountId: string;
    date?: string;
    method?: string;
    reference?: string;
  },
): Promise<ApiSuccessResponse<{ invoice: Invoice; posted: boolean }>> {
  return api.post(`/accounting/bank/${id}/settle`, input);
}

// ─── Aging + liquidity dashboard (M11) ─────────────────────────────────────

export interface AgingSideSummary {
  buckets: Record<string, number>;
  total: number;
  count: number;
}

export interface AgingSummary {
  entityId: string;
  asOf: string;
  baseCurrency: string;
  buckets: Array<{ key: string; label: string }>;
  receivable: AgingSideSummary;
  payable: AgingSideSummary;
  bankBalance: number;
  excludedBankAccounts: number;
}

export async function getAgingSummary(params: {
  entityId: string;
  asOf?: string;
}): Promise<ApiSuccessResponse<AgingSummary>> {
  return api.get(`/accounting/aging-summary${buildQuery(params)}`);
}

// ─── Company setup, fiscal year & activation (M0) ──────────────────────────

export const VAT_REGISTRATION_STATUSES = [
  "registered",
  "not_registered",
  "exempt",
] as const;
export type VatRegistrationStatus = (typeof VAT_REGISTRATION_STATUSES)[number];

export const RATE_SOURCES = ["bot", "commercial_bank"] as const;
export type RateSource = (typeof RATE_SOURCES)[number];

/** Reporting/consolidation currency — every entity must keep it enabled. */
export const REPORTING_CURRENCY = "THB";

export interface CompanySetup {
  id: string;
  name: string;
  code: string;
  country: string | null;
  currency: string | null;
  taxId: string | null;
  address: string | null;
  nameTh: string | null;
  branchCode: string | null;
  logoUrl: string | null;
  vatRegistrationStatus: string | null;
  boiType: string | null;
  boiPeriod: string | null;
  fiscalYearStartMonth: number | null;
  firstFiscalYearStart: string | null;
  firstFiscalYearEnd: string | null;
  defaultRateSource: string | null;
  enabledCurrencies: string[] | null;
  /** "setup" until activated, then "active". */
  setupState: string;
}

export interface UpdateCompanySetupInput {
  entityId: string;
  nameTh?: string | null;
  branchCode?: string | null;
  logoUrl?: string | null;
  vatRegistrationStatus?: VatRegistrationStatus | null;
  boiType?: string | null;
  boiPeriod?: string | null;
  fiscalYearStartMonth?: number;
  firstFiscalYearStart?: string | null;
  firstFiscalYearEnd?: string | null;
  defaultRateSource?: RateSource;
  enabledCurrencies?: string[];
}

export async function getCompanySetup(
  entityId: string,
): Promise<ApiSuccessResponse<CompanySetup>> {
  return api.get(`/accounting/company-setup${buildQuery({ entityId })}`);
}

export async function updateCompanySetup(
  input: UpdateCompanySetupInput,
): Promise<ApiSuccessResponse<CompanySetup>> {
  return api.put("/accounting/company-setup", input);
}

export async function activateCompany(
  entityId: string,
): Promise<ApiSuccessResponse<CompanySetup & { activated: boolean }>> {
  return api.post("/accounting/company-setup/activate", { entityId });
}

// ─── Opening balances (M0) ─────────────────────────────────────────────────

export interface OpeningBalanceStatus {
  entityId: string;
  exists: boolean;
  entry: {
    id: string;
    entryNo: string;
    date: string;
    description: string | null;
    status: string;
    postedAt: string | null;
    createdAt: string;
  } | null;
}

export interface OpeningAccountLine {
  chartOfAccountId: string;
  debit?: number;
  credit?: number;
}
export interface OpeningCounterpartyLine {
  vendorId?: string | null;
  counterpartyName?: string | null;
  amount: number;
}
export interface OpeningBankLine {
  chartOfAccountId: string;
  amount: number;
}

export interface ImportOpeningBalancesInput {
  entityId: string;
  asOfDate: string;
  accounts?: OpeningAccountLine[];
  openReceivables?: OpeningCounterpartyLine[];
  openPayables?: OpeningCounterpartyLine[];
  bankBalances?: OpeningBankLine[];
}

export interface ImportOpeningBalancesResult {
  entryId: string;
  entryNo: string;
  asOfDate: string;
}

export async function getOpeningBalances(
  entityId: string,
): Promise<ApiSuccessResponse<OpeningBalanceStatus>> {
  return api.get(`/accounting/opening-balances${buildQuery({ entityId })}`);
}

export async function importOpeningBalances(
  input: ImportOpeningBalancesInput,
): Promise<ApiSuccessResponse<ImportOpeningBalancesResult>> {
  return api.post("/accounting/opening-balances", input);
}

// ─── Maker-checker config (M0) ─────────────────────────────────────────────

export interface MakerCheckerConfig {
  blockSelfApproval: boolean;
}

export async function getMakerChecker(): Promise<
  ApiSuccessResponse<MakerCheckerConfig>
> {
  return api.get("/accounting/maker-checker");
}

export async function setMakerChecker(
  blockSelfApproval: boolean,
): Promise<ApiSuccessResponse<MakerCheckerConfig>> {
  return api.put("/accounting/maker-checker", { blockSelfApproval });
}

// ─── Tax codes (M0 / M9) ───────────────────────────────────────────────────

export const TAX_CODE_KINDS = ["vat-output", "vat-input", "wht"] as const;
export type TaxCodeKind = (typeof TAX_CODE_KINDS)[number];

export interface TaxCode {
  id: string;
  entityId: string;
  code: string;
  name: string;
  kind: string;
  /** Fractional rate serialized as a decimal string, e.g. "0.0700" for 7%. */
  rate: string;
  glAccountId: string | null;
  isActive: boolean;
}

export interface UpsertTaxCodeInput {
  entityId: string;
  code: string;
  name: string;
  kind: TaxCodeKind;
  /** Fractional rate (0..1), e.g. 0.07 for VAT 7%. */
  rate: number;
  glAccountId?: string | null;
  isActive?: boolean;
}

export type UpdateTaxCodeInput = Partial<Omit<UpsertTaxCodeInput, "entityId">>;

export async function listTaxCodes(params: {
  entityId: string;
  includeInactive?: boolean;
}): Promise<ApiSuccessResponse<TaxCode[]>> {
  return api.get(`/accounting/tax-codes${buildQuery(params)}`);
}

export async function createTaxCode(
  input: UpsertTaxCodeInput,
): Promise<ApiSuccessResponse<TaxCode>> {
  return api.post("/accounting/tax-codes", input);
}

export async function updateTaxCode(
  id: string,
  input: UpdateTaxCodeInput,
): Promise<ApiSuccessResponse<TaxCode>> {
  return api.put(`/accounting/tax-codes/${id}`, input);
}

export async function deleteTaxCode(
  id: string,
): Promise<ApiSuccessResponse<{ id: string }>> {
  return api.delete(`/accounting/tax-codes/${id}`);
}

// ─── Fiscal periods (M10) ──────────────────────────────────────────────────

export interface FiscalPeriod {
  id: string;
  entityId: string;
  year: number;
  month: number;
  status: string;
  note: string | null;
  closedAt: string | null;
  closedBy: string | null;
}

export async function listFiscalPeriods(
  entityId?: string,
): Promise<ApiSuccessResponse<FiscalPeriod[]>> {
  return api.get(`/accounting/fiscal-periods${buildQuery({ entityId })}`);
}

export async function closeFiscalPeriod(input: {
  entityId: string;
  year: number;
  month: number;
  note?: string;
}): Promise<ApiSuccessResponse<FiscalPeriod>> {
  return api.post("/accounting/fiscal-periods/close", input);
}

export async function reopenFiscalPeriod(input: {
  entityId: string;
  year: number;
  month: number;
}): Promise<ApiSuccessResponse<FiscalPeriod>> {
  return api.post("/accounting/fiscal-periods/reopen", input);
}

export interface FxRevaluationResult {
  period: string;
  itemsRevalued: number;
  netFx: number;
  entryId: string | null;
  reversalEntryId: string | null;
}

export async function revaluePeriod(input: {
  entityId: string;
  year: number;
  month: number;
}): Promise<ApiSuccessResponse<FxRevaluationResult>> {
  return api.post("/accounting/fiscal-periods/revalue", input);
}

// ─── Credit notes / debit notes (M4) ───────────────────────────────────────

export const CREDIT_NOTE_TYPES = ["receivable", "payable"] as const;
export type CreditNoteType = (typeof CREDIT_NOTE_TYPES)[number];

// Adjustment kind (M4): credit reduces the balance, debit increases it.
export const CREDIT_NOTE_KINDS = ["credit", "debit"] as const;
export type CreditNoteKind = (typeof CREDIT_NOTE_KINDS)[number];

export const CREDIT_NOTE_STATUSES = [
  "draft",
  "issued",
  "applied",
  "cancelled",
] as const;
export type CreditNoteStatus = (typeof CREDIT_NOTE_STATUSES)[number];

export interface CreditNoteLine {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  taxRate: string;
  taxAmount: string;
  glAccountId: string | null;
  sortOrder: number;
}

export interface CreditNote {
  id: string;
  entityId: string;
  entity?: { id: string; name: string };
  creditNoteNo: string;
  type: string;
  noteKind: string;
  linkedInvoiceId: string | null;
  linkedInvoice?: { id: string; invoiceNo: string } | null;
  issueDate: string;
  subtotal: string;
  taxTotal: string;
  grandTotal: string;
  reason: string | null;
  notes: string | null;
  status: string;
  linkedJeId: string | null;
  createdAt: string;
  lines?: CreditNoteLine[];
}

export interface CreditNoteLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  glAccountId?: string;
}

export interface CreateCreditNoteInput {
  entityId: string;
  type: CreditNoteType;
  noteKind?: CreditNoteKind;
  linkedInvoiceId?: string;
  issueDate: string;
  reason?: string;
  notes?: string;
  lines: CreditNoteLineInput[];
}

export async function listCreditNotes(params: {
  entityId?: string;
  type?: CreditNoteType;
  noteKind?: CreditNoteKind;
  status?: CreditNoteStatus;
}): Promise<ApiSuccessResponse<CreditNote[]>> {
  return api.get(`/accounting/credit-notes${buildQuery(params)}`);
}

export async function getCreditNote(
  id: string,
): Promise<ApiSuccessResponse<CreditNote>> {
  return api.get(`/accounting/credit-notes/${id}`);
}

export async function createCreditNote(
  input: CreateCreditNoteInput,
): Promise<ApiSuccessResponse<CreditNote>> {
  return api.post("/accounting/credit-notes", input);
}

export async function issueCreditNote(
  id: string,
): Promise<ApiSuccessResponse<CreditNote>> {
  return api.post(`/accounting/credit-notes/${id}/issue`);
}

export async function voidCreditNote(
  id: string,
): Promise<ApiSuccessResponse<CreditNote>> {
  return api.post(`/accounting/credit-notes/${id}/void`);
}

// ─── Quotes (AR) ───────────────────────────────────────────────────────────

export const QUOTE_STATUSES = [
  "draft",
  "sent",
  "accepted",
  "declined",
  "expired",
  "converted",
] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

export interface QuoteLine {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
  taxRate: string;
  taxAmount: string;
  glAccountId: string | null;
  sortOrder: number;
}

export interface Quote {
  id: string;
  entityId: string;
  entity?: { id: string; name: string };
  quoteNo: string;
  vendorId: string | null;
  vendor?: { id: string; name: string } | null;
  issueDate: string;
  expiryDate: string | null;
  status: string;
  currency: string;
  subtotal: string;
  taxTotal: string;
  grandTotal: string;
  notes: string | null;
  convertedInvoiceId: string | null;
  createdAt: string;
  lines?: QuoteLine[];
}

export interface DocumentLineInput {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  glAccountId?: string;
}

export interface CreateQuoteInput {
  entityId: string;
  vendorId?: string;
  issueDate: string;
  expiryDate?: string;
  currency?: string;
  notes?: string;
  lines: DocumentLineInput[];
}

export type UpdateQuoteInput = Partial<Omit<CreateQuoteInput, "entityId">>;

export async function listQuotes(params: {
  entityId?: string;
  status?: QuoteStatus;
}): Promise<ApiSuccessResponse<Quote[]>> {
  return api.get(`/accounting/quotes${buildQuery(params)}`);
}

export async function getQuote(id: string): Promise<ApiSuccessResponse<Quote>> {
  return api.get(`/accounting/quotes/${id}`);
}

export async function createQuote(
  input: CreateQuoteInput,
): Promise<ApiSuccessResponse<Quote>> {
  return api.post("/accounting/quotes", input);
}

export async function updateQuote(
  id: string,
  input: UpdateQuoteInput,
): Promise<ApiSuccessResponse<Quote>> {
  return api.put(`/accounting/quotes/${id}`, input);
}

export async function deleteQuote(
  id: string,
): Promise<ApiSuccessResponse<unknown>> {
  return api.delete(`/accounting/quotes/${id}`);
}

export async function sendQuote(
  id: string,
): Promise<ApiSuccessResponse<Quote>> {
  return api.post(`/accounting/quotes/${id}/send`);
}

export async function convertQuote(
  id: string,
): Promise<ApiSuccessResponse<{ quote: Quote; invoiceId: string }>> {
  return api.post(`/accounting/quotes/${id}/convert`);
}

// ─── Purchase orders (AP) ──────────────────────────────────────────────────

export const PO_STATUSES = [
  "draft",
  "sent",
  "awaiting-delivery",
  "partially-received",
  "completed",
  "billed",
  "cancelled",
] as const;
export type PurchaseOrderStatus = (typeof PO_STATUSES)[number];

export interface PoLine {
  id: string;
  description: string;
  quantity: string;
  qtyReceived: string;
  unitPrice: string;
  lineTotal: string;
  taxRate: string;
  taxAmount: string;
  glAccountId: string | null;
  sortOrder: number;
}

export interface PurchaseOrder {
  id: string;
  entityId: string;
  entity?: { id: string; name: string };
  poNo: string;
  vendorId: string | null;
  vendor?: { id: string; name: string } | null;
  orderDate: string;
  expectedDate: string | null;
  status: string;
  currency: string;
  subtotal: string;
  taxTotal: string;
  grandTotal: string;
  notes: string | null;
  convertedInvoiceId: string | null;
  createdAt: string;
  lines?: PoLine[];
}

export interface CreatePurchaseOrderInput {
  entityId: string;
  vendorId?: string;
  orderDate: string;
  expectedDate?: string;
  currency?: string;
  notes?: string;
  lines: DocumentLineInput[];
}

export interface ReceivePurchaseOrderInput {
  lines?: Array<{ lineId: string; qtyReceived: number }>;
}

export async function listPurchaseOrders(params: {
  entityId?: string;
  status?: PurchaseOrderStatus;
}): Promise<ApiSuccessResponse<PurchaseOrder[]>> {
  return api.get(`/accounting/purchase-orders${buildQuery(params)}`);
}

export async function getPurchaseOrder(
  id: string,
): Promise<ApiSuccessResponse<PurchaseOrder>> {
  return api.get(`/accounting/purchase-orders/${id}`);
}

export async function createPurchaseOrder(
  input: CreatePurchaseOrderInput,
): Promise<ApiSuccessResponse<PurchaseOrder>> {
  return api.post("/accounting/purchase-orders", input);
}

export async function receivePurchaseOrder(
  id: string,
  input: ReceivePurchaseOrderInput,
): Promise<ApiSuccessResponse<PurchaseOrder>> {
  return api.post(`/accounting/purchase-orders/${id}/receive`, input);
}

export async function convertPoToBill(
  id: string,
): Promise<
  ApiSuccessResponse<{ purchaseOrder: PurchaseOrder; invoiceId: string }>
> {
  return api.post(`/accounting/purchase-orders/${id}/convert-to-bill`);
}

export async function deletePurchaseOrder(
  id: string,
): Promise<ApiSuccessResponse<unknown>> {
  return api.delete(`/accounting/purchase-orders/${id}`);
}

// ─── Fixed Asset Register ──────────────────────────────────────────────────

export interface FixedAsset {
  id: string;
  entityId: string;
  assetNo: string;
  name: string;
  nameTh: string | null;
  categoryCode: string;
  assetClass: string;
  location: string | null;
  assignedUser: string | null;
  supplier: string | null;
  serialNo: string | null;
  purchaseDate: string;
  startDate: string;
  usefulLifeMonths: number;
  quantity: number;
  /** Money fields serialize as decimal strings. */
  purchasePrice: string;
  openingBookValue: string | null;
  openingAsOfDate: string | null;
  status: string;
  disposalDate: string | null;
  sellingPrice: string | null;
  notes: string | null;
  linkGroup: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  // Computed server-side by the depreciation engine as at the query's asOf date.
  netBookValue: number;
  accumulatedDepreciation: number;
  dailyRate: number;
  totalDays: number;
}

export interface FixedAssetCategory {
  id: string;
  entityId: string;
  code: string;
  name: string;
  nameTh: string | null;
  assetClass: string;
  usefulLifeMonths: number;
  assetGlAccountId: string | null;
  depreciationGlAccountId: string | null;
  accumulatedDepreciationGlAccountId: string | null;
  disposalGainGlAccountId: string | null;
  disposalLossGlAccountId: string | null;
  isActive: boolean;
}

export interface CreateFixedAssetInput {
  entityId: string;
  assetNo?: string;
  name: string;
  nameTh?: string | null;
  categoryCode: string;
  assetClass?: string;
  location?: string | null;
  assignedUser?: string | null;
  supplier?: string | null;
  serialNo?: string | null;
  purchaseDate: string;
  startDate?: string;
  usefulLifeMonths?: number;
  quantity?: number;
  purchasePrice: number;
  openingBookValue?: number | null;
  openingAsOfDate?: string | null;
  notes?: string | null;
  linkGroup?: string | null;
}

export type UpdateFixedAssetInput = Partial<
  Omit<CreateFixedAssetInput, "entityId">
>;

export interface CreateFixedAssetCategoryInput {
  entityId: string;
  code: string;
  name: string;
  nameTh?: string | null;
  assetClass: string;
  usefulLifeMonths: number;
  assetGlAccountId?: string | null;
  depreciationGlAccountId?: string | null;
  accumulatedDepreciationGlAccountId?: string | null;
  disposalGainGlAccountId?: string | null;
  disposalLossGlAccountId?: string | null;
  isActive?: boolean;
}

export type UpdateFixedAssetCategoryInput = Partial<
  Omit<CreateFixedAssetCategoryInput, "entityId">
>;

export async function listFixedAssets(params: {
  page?: number;
  limit?: number;
  entityId?: string;
  status?: string;
  categoryCode?: string;
  assetClass?: string;
  search?: string;
  asOf?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}): Promise<ApiPaginatedResponse<FixedAsset>> {
  return api.get(`/accounting/fixed-assets${buildQuery(params)}`);
}

export async function getFixedAsset(
  id: string,
  asOf?: string,
): Promise<ApiSuccessResponse<FixedAsset>> {
  return api.get(`/accounting/fixed-assets/${id}${buildQuery({ asOf })}`);
}

export async function createFixedAsset(
  input: CreateFixedAssetInput,
): Promise<ApiSuccessResponse<FixedAsset>> {
  return api.post("/accounting/fixed-assets", input);
}

export async function updateFixedAsset(
  id: string,
  input: UpdateFixedAssetInput,
): Promise<ApiSuccessResponse<FixedAsset>> {
  return api.put(`/accounting/fixed-assets/${id}`, input);
}

export async function deleteFixedAsset(
  id: string,
): Promise<ApiSuccessResponse<{ success: boolean }>> {
  return api.delete(`/accounting/fixed-assets/${id}`);
}

export async function restoreFixedAsset(
  id: string,
): Promise<ApiSuccessResponse<FixedAsset>> {
  return api.post(`/accounting/fixed-assets/${id}/restore`, {});
}

export async function permanentDeleteFixedAsset(
  id: string,
): Promise<ApiSuccessResponse<{ success: boolean }>> {
  return api.delete(`/accounting/fixed-assets/${id}/permanent`);
}

export async function listFixedAssetCategories(params: {
  entityId: string;
  includeInactive?: boolean;
}): Promise<ApiSuccessResponse<FixedAssetCategory[]>> {
  return api.get(`/accounting/fixed-asset-categories${buildQuery(params)}`);
}

export async function createFixedAssetCategory(
  input: CreateFixedAssetCategoryInput,
): Promise<ApiSuccessResponse<FixedAssetCategory>> {
  return api.post("/accounting/fixed-asset-categories", input);
}

export async function updateFixedAssetCategory(
  id: string,
  input: UpdateFixedAssetCategoryInput,
): Promise<ApiSuccessResponse<FixedAssetCategory>> {
  return api.put(`/accounting/fixed-asset-categories/${id}`, input);
}

export async function deleteFixedAssetCategory(
  id: string,
): Promise<ApiSuccessResponse<{ success: boolean }>> {
  return api.delete(`/accounting/fixed-asset-categories/${id}`);
}

// ─── Fixed Asset disposals / write-offs ────────────────────────────────────

export interface FixedAssetDisposal {
  id: string;
  assetId: string;
  entityId: string;
  disposalType: string;
  disposalDate: string;
  unitsDisposed: number;
  proceeds: string;
  nbvDisposed: string | null;
  gainLoss: string | null;
  reason: string | null;
  linkGroupId: string | null;
  status: string;
  createdBy: string;
  requestedAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectReason: string | null;
  asset?: {
    id: string;
    assetNo: string;
    name: string;
    categoryCode: string;
    quantity: number;
    purchasePrice: string;
    status: string;
  };
}

export interface SubmitFixedAssetDisposalInput {
  disposalType: "disposal" | "write_off";
  disposalDate: string;
  unitsDisposed: number;
  proceeds: number;
  reason?: string | null;
  linkGroupId?: string | null;
}

export async function listFixedAssetDisposals(params: {
  entityId?: string;
  status?: string;
  assetId?: string;
}): Promise<ApiSuccessResponse<FixedAssetDisposal[]>> {
  return api.get(`/accounting/fixed-asset-disposals${buildQuery(params)}`);
}

export async function submitFixedAssetDisposal(
  assetId: string,
  input: SubmitFixedAssetDisposalInput,
): Promise<ApiSuccessResponse<FixedAssetDisposal>> {
  return api.post(`/accounting/fixed-assets/${assetId}/disposals`, input);
}

export async function approveFixedAssetDisposal(
  id: string,
): Promise<ApiSuccessResponse<FixedAssetDisposal>> {
  return api.put(`/accounting/fixed-asset-disposals/${id}/approve`, {});
}

export async function rejectFixedAssetDisposal(
  id: string,
  reason: string,
): Promise<ApiSuccessResponse<FixedAssetDisposal>> {
  return api.put(`/accounting/fixed-asset-disposals/${id}/reject`, { reason });
}

// ─── Fixed Asset reports ────────────────────────────────────────────────────

interface RegisterTotals {
  cost: number;
  accumulatedDepreciation: number;
  netBookValue: number;
}
export interface FixedAssetRegisterReport {
  entityId: string;
  asOf: string;
  groups: {
    categoryCode: string;
    rows: {
      assetNo: string;
      name: string;
      categoryCode: string;
      status: string;
      quantity: number;
      cost: number;
      accumulatedDepreciation: number;
      netBookValue: number;
    }[];
    subtotal: RegisterTotals;
  }[];
  usingTotal: RegisterTotals;
  notUsingTotal: RegisterTotals;
  grandTotal: RegisterTotals;
}

interface ScheduleTotals {
  openingNbv: number;
  depreciation: number;
  closingNbv: number;
}
export interface FixedAssetScheduleReport {
  entityId: string;
  period: string;
  groups: {
    categoryCode: string;
    rows: {
      assetNo: string;
      name: string;
      categoryCode: string;
      openingNbv: number;
      depreciation: number;
      closingNbv: number;
    }[];
    subtotal: ScheduleTotals;
  }[];
  total: ScheduleTotals;
}

export interface FixedAssetDisposalReport {
  entityId: string;
  from: string;
  to: string;
  rows: {
    assetNo: string;
    name: string;
    disposalDate: string;
    disposalType: string;
    proceeds: number;
    nbvDisposed: number;
    gainLoss: number;
  }[];
  total: { proceeds: number; nbvDisposed: number; gainLoss: number };
}

export interface FixedAssetMovementReport {
  entityId: string;
  from: string;
  to: string;
  rows: {
    categoryCode: string;
    opening: number;
    additions: number;
    disposals: number;
    depreciation: number;
    closing: number;
  }[];
  total: {
    categoryCode: string;
    opening: number;
    additions: number;
    disposals: number;
    depreciation: number;
    closing: number;
  };
}

export async function getFixedAssetRegisterReport(params: {
  entityId: string;
  asOf?: string;
}): Promise<ApiSuccessResponse<FixedAssetRegisterReport>> {
  return api.get(
    `/accounting/reports/fixed-assets/register${buildQuery(params)}`,
  );
}

export async function getFixedAssetDepreciationSchedule(params: {
  entityId: string;
  year: number;
  month: number;
}): Promise<ApiSuccessResponse<FixedAssetScheduleReport>> {
  return api.get(
    `/accounting/reports/fixed-assets/depreciation-schedule${buildQuery(params)}`,
  );
}

export async function getFixedAssetDisposalReport(params: {
  entityId: string;
  from: string;
  to: string;
}): Promise<ApiSuccessResponse<FixedAssetDisposalReport>> {
  return api.get(
    `/accounting/reports/fixed-assets/disposals${buildQuery(params)}`,
  );
}

export async function getFixedAssetMovementReport(params: {
  entityId: string;
  from: string;
  to: string;
}): Promise<ApiSuccessResponse<FixedAssetMovementReport>> {
  return api.get(
    `/accounting/reports/fixed-assets/movement${buildQuery(params)}`,
  );
}

// ─── Fixed Asset import / export ────────────────────────────────────────────

export interface FixedAssetImportRow {
  rowNumber: number;
  assetCode?: string | null;
  name?: string | null;
  nameTh?: string | null;
  quantity?: number | null;
  categoryCode?: string | null;
  location?: string | null;
  assignedUser?: string | null;
  supplier?: string | null;
  serialNo?: string | null;
  purchaseDate?: string | null;
  startDate?: string | null;
  usefulLifeMonths?: number | null;
  purchasePrice?: number | null;
  bookValue?: number | null;
  status?: string | null;
  disposalDate?: string | null;
  sellingPrice?: number | null;
  notes?: string | null;
  linkGroup?: string | null;
}

export interface FixedAssetImportResult {
  ok: boolean;
  errors: { rowNumber: number; messages: string[] }[];
  summary: {
    total: number;
    valid: number;
    inserts: number;
    updates: number;
    errorCount: number;
  };
  loaded?: number;
}

export async function previewFixedAssetImport(
  entityId: string,
  rows: FixedAssetImportRow[],
  asOf?: string,
): Promise<ApiSuccessResponse<FixedAssetImportResult>> {
  return api.post("/accounting/fixed-assets/import/preview", {
    entityId,
    asOf,
    rows,
  });
}

export async function commitFixedAssetImport(
  entityId: string,
  rows: FixedAssetImportRow[],
  asOf?: string,
): Promise<ApiSuccessResponse<FixedAssetImportResult>> {
  return api.post("/accounting/fixed-assets/import/commit", {
    entityId,
    asOf,
    rows,
  });
}

export async function downloadFixedAssetExport(
  entityId: string,
  asOf?: string,
): Promise<void> {
  const res = await fetch(
    `${apiBaseUrl}/accounting/fixed-assets/export.xlsx${buildQuery({ entityId, asOf })}`,
    authFetchInit(),
  );
  if (!res.ok) throw new Error("Failed to export fixed assets");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "fixed-assets.xlsx";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ─── Fixed Asset Phase 2 ────────────────────────────────────────────────────
//
// WS1 depreciation run, WS2 remeasurements, WS3 transfers, WS4 physical count,
// WS5 entity tax rates + the deferred tax schedule. Every route below mounts
// only when the API's ACCOUNTING_FIXED_ASSETS flag is on (fail-closed), so the
// callers must be behind FIXED_ASSETS_ENABLED on the web side too.
//
// Money: rows read straight off Prisma serialize their Decimal columns as
// STRINGS (same as FixedAsset.purchasePrice / FixedAssetDisposal.proceeds).
// Server-computed report payloads convert with .toNumber() and arrive as
// NUMBERS. Both are typed as they actually land — never coerce in the client;
// pass them to formatCurrency, which takes `string | number`.

/** Shared approval lifecycle used by the disposal, remeasurement and transfer queues. */
export type FixedAssetApprovalStatus = "pending" | "approved" | "rejected";

// ─── WS1: depreciation run ──────────────────────────────────────────────────

/** One asset's charge for the period. `charge` is a fixed-2 decimal string. */
export interface FixedAssetDepreciationRunLine {
  assetId: string;
  assetNo: string;
  name: string;
  categoryCode: string;
  charge: string;
}

/** Per-category roll-up. Rounded ONCE on the subtotal, server-side. */
export interface FixedAssetDepreciationRunCategory {
  categoryCode: string;
  assets: number;
  charge: string;
}

/**
 * The proposed journal for a period. `posted` discriminates: the GET preview is
 * always false and carries no entry; a POST with `post: true` returns true plus
 * the created entry. `alreadyPosted` is set when the period already has an
 * entry — the preview still renders, the post is refused with a 409.
 *
 * `total` is the server's roll-up over every asset: never re-sum `lines`, which
 * is the full set today but is the wrong number to trust if it is ever paged.
 */
export interface FixedAssetDepreciationRun {
  period: string;
  entityId: string;
  openingAsOf: string;
  closingAsOf: string;
  assetsCharged: number;
  categories: FixedAssetDepreciationRunCategory[];
  total: string;
  lines: FixedAssetDepreciationRunLine[];
  alreadyPosted: { entryId: string; entryNo: string } | null;
  posted: boolean;
  /** Present only on a successful post. */
  entryId?: string;
  entryNo?: string;
}

/** Preview only — never posts, safe to call on render. */
export async function previewFixedAssetDepreciationRun(params: {
  entityId: string;
  year: number;
  month: number;
}): Promise<ApiSuccessResponse<FixedAssetDepreciationRun>> {
  return api.get(
    `/accounting/fixed-assets/depreciation-run${buildQuery(params)}`,
  );
}

/**
 * Runs the period. `post` defaults to false, so calling this without it is
 * still a preview — pass `post: true` deliberately, it moves GL balances and
 * the entry blocks its own re-post.
 */
export async function runFixedAssetDepreciation(input: {
  entityId: string;
  year: number;
  month: number;
  post?: boolean;
}): Promise<ApiSuccessResponse<FixedAssetDepreciationRun>> {
  return api.post("/accounting/fixed-assets/depreciation-run", {
    ...input,
    post: input.post ?? false,
  });
}

// ─── WS2: revaluation / impairment (remeasurements) ─────────────────────────

export const FIXED_ASSET_REMEASUREMENT_KINDS = [
  "revaluation",
  "impairment",
  "impairment_reversal",
] as const;
export type FixedAssetRemeasurementKind =
  (typeof FIXED_ASSET_REMEASUREMENT_KINDS)[number];

export interface FixedAssetRemeasurement {
  id: string;
  assetId: string;
  entityId: string;
  kind: FixedAssetRemeasurementKind;
  effectiveDate: string;
  /** Decimal strings. carryingBefore + movement === carryingAfter. */
  carryingBefore: string;
  carryingAfter: string;
  movement: string;
  /** The recognition split: profitOrLoss + oci === movement, exactly. */
  profitOrLoss: string;
  oci: string;
  surplusAfter: string;
  plLossAfter: string;
  /** Set when IAS 36.117 clipped an impairment reversal. */
  cappedAt: string | null;
  remainingLifeMonths: number | null;
  reason: string | null;
  evidenceUrl: string | null;
  /** Point-in-time snapshot of the asset BEFORE this event (approved rows). */
  quantityBefore: number | null;
  costBefore: string | null;
  openingBookValueBefore: string | null;
  openingAsOfDateBefore: string | null;
  status: FixedAssetApprovalStatus;
  createdBy: string;
  requestedAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectReason: string | null;
  linkedJeId: string | null;
  createdAt: string;
  /** Absent on the per-asset trail, which does not join the asset back in. */
  asset?: {
    id: string;
    assetNo: string;
    name: string;
    categoryCode: string;
    quantity: number;
    purchasePrice: string;
    status: string;
    revaluationSurplus: string;
    impairmentPlLoss: string;
  };
}

/**
 * `carryingAfter` is the ONLY amount the client supplies — the revalued or
 * recoverable amount. The carrying amount BEFORE is computed server-side at the
 * effective date and is never accepted from here.
 */
export interface SubmitFixedAssetRemeasurementInput {
  kind: FixedAssetRemeasurementKind;
  effectiveDate: string;
  carryingAfter: number;
  reason?: string | null;
  evidenceUrl?: string | null;
}

export async function listFixedAssetRemeasurements(params: {
  entityId?: string;
  status?: FixedAssetApprovalStatus;
  assetId?: string;
  kind?: FixedAssetRemeasurementKind;
}): Promise<ApiSuccessResponse<FixedAssetRemeasurement[]>> {
  return api.get(`/accounting/fixed-asset-remeasurements${buildQuery(params)}`);
}

export async function getFixedAssetRemeasurement(
  id: string,
): Promise<ApiSuccessResponse<FixedAssetRemeasurement>> {
  return api.get(`/accounting/fixed-asset-remeasurements/${id}`);
}

/** The per-asset history, ordered by effective date (oldest first). */
export async function listFixedAssetRemeasurementsForAsset(
  assetId: string,
): Promise<ApiSuccessResponse<FixedAssetRemeasurement[]>> {
  return api.get(`/accounting/fixed-assets/${assetId}/remeasurements`);
}

export async function submitFixedAssetRemeasurement(
  assetId: string,
  input: SubmitFixedAssetRemeasurementInput,
): Promise<ApiSuccessResponse<FixedAssetRemeasurement>> {
  return api.post(`/accounting/fixed-assets/${assetId}/remeasurements`, input);
}

export async function approveFixedAssetRemeasurement(
  id: string,
): Promise<ApiSuccessResponse<FixedAssetRemeasurement>> {
  return api.put(`/accounting/fixed-asset-remeasurements/${id}/approve`, {});
}

export async function rejectFixedAssetRemeasurement(
  id: string,
  reason: string,
): Promise<ApiSuccessResponse<FixedAssetRemeasurement>> {
  return api.put(`/accounting/fixed-asset-remeasurements/${id}/reject`, {
    reason,
  });
}

// ─── WS3: transfers ─────────────────────────────────────────────────────────

export const FIXED_ASSET_TRANSFER_KINDS = [
  "location",
  "custodian",
  "entity",
] as const;
export type FixedAssetTransferKind =
  (typeof FIXED_ASSET_TRANSFER_KINDS)[number];

export interface FixedAssetTransfer {
  id: string;
  assetId: string;
  entityId: string;
  kind: FixedAssetTransferKind;
  transferDate: string;
  fromLocation: string | null;
  toLocation: string | null;
  fromCustodian: string | null;
  toCustodian: string | null;
  toEntityId: string | null;
  /** The row created in the destination entity (cross-entity only). */
  destinationAssetId: string | null;
  /** Decimal strings; both cross so the destination inherits the NBV. */
  costTransferred: string | null;
  accumulatedTransferred: string | null;
  remainingLifeMonths: number | null;
  reason: string | null;
  status: FixedAssetApprovalStatus;
  createdBy: string;
  requestedAt: string;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedBy: string | null;
  rejectedAt: string | null;
  rejectReason: string | null;
  /** Two entries for a cross-entity move: out of the source, into the destination. */
  linkedJeOutId: string | null;
  linkedJeInId: string | null;
  createdAt: string;
  /** Absent on the per-asset trail, which does not join the asset back in. */
  asset?: {
    id: string;
    entityId: string;
    assetNo: string;
    categoryCode: string;
    location: string | null;
    assignedUser: string | null;
    quantity: number;
    purchasePrice: string;
    status: string;
  };
}

/**
 * The submit response carries the derived plan on top of the stored row. It is
 * NOT persisted (it is re-derived at approval) — render it as a preview only.
 */
export interface FixedAssetTransferSubmitResult extends FixedAssetTransfer {
  /** Human summary of the move, e.g. "Location HQ → Warehouse". */
  summary: string;
  /** True only for a cross-entity move — the one kind that touches the GL. */
  movesValue: boolean;
}

/**
 * Only one destination field is meaningful per kind: `toLocation` for location,
 * `toCustodian` for custodian, `toEntityId` for entity. The server decides
 * which one a kind requires — do not branch on it twice.
 */
export interface SubmitFixedAssetTransferInput {
  kind: FixedAssetTransferKind;
  transferDate: string;
  toLocation?: string | null;
  toCustodian?: string | null;
  toEntityId?: string | null;
  reason?: string | null;
}

export async function listFixedAssetTransfers(params: {
  entityId?: string;
  status?: FixedAssetApprovalStatus;
  assetId?: string;
  kind?: FixedAssetTransferKind;
}): Promise<ApiSuccessResponse<FixedAssetTransfer[]>> {
  return api.get(`/accounting/fixed-asset-transfers${buildQuery(params)}`);
}

export async function getFixedAssetTransfer(
  id: string,
): Promise<ApiSuccessResponse<FixedAssetTransfer>> {
  return api.get(`/accounting/fixed-asset-transfers/${id}`);
}

/** The per-asset movement trail, ordered by transfer date (oldest first). */
export async function listFixedAssetTransfersForAsset(
  assetId: string,
): Promise<ApiSuccessResponse<FixedAssetTransfer[]>> {
  return api.get(`/accounting/fixed-assets/${assetId}/transfers`);
}

export async function submitFixedAssetTransfer(
  assetId: string,
  input: SubmitFixedAssetTransferInput,
): Promise<ApiSuccessResponse<FixedAssetTransferSubmitResult>> {
  return api.post(`/accounting/fixed-assets/${assetId}/transfers`, input);
}

export async function approveFixedAssetTransfer(
  id: string,
): Promise<ApiSuccessResponse<FixedAssetTransfer>> {
  return api.put(`/accounting/fixed-asset-transfers/${id}/approve`, {});
}

export async function rejectFixedAssetTransfer(
  id: string,
  reason: string,
): Promise<ApiSuccessResponse<FixedAssetTransfer>> {
  return api.put(`/accounting/fixed-asset-transfers/${id}/reject`, { reason });
}

// ─── WS4: physical count sessions ───────────────────────────────────────────

export const FIXED_ASSET_COUNT_SESSION_STATUSES = ["open", "closed"] as const;
export type FixedAssetCountSessionStatus =
  (typeof FIXED_ASSET_COUNT_SESSION_STATUSES)[number];

export const FIXED_ASSET_COUNT_LINE_STATUSES = [
  "matched",
  "shortfall",
  "surplus",
  "not-counted",
  "unregistered",
] as const;
export type FixedAssetCountLineStatus =
  (typeof FIXED_ASSET_COUNT_LINE_STATUSES)[number];

export interface FixedAssetCountSession {
  id: string;
  entityId: string;
  sessionNo: string;
  /** The date the count is AS AT — expectations resolve here, not at "today". */
  asOfDate: string;
  name: string | null;
  locationFilter: string | null;
  status: FixedAssetCountSessionStatus;
  createdBy: string;
  closedBy: string | null;
  closedAt: string | null;
  createdAt: string;
  /** Present on the list only. */
  _count?: { lines: number };
}

export interface CreateFixedAssetCountSessionInput {
  entityId: string;
  asOfDate: string;
  name?: string | null;
  locationFilter?: string | null;
}

/**
 * One scanned observation. Either `assetId` (picked) or `scannedTag` (typed /
 * scanned) identifies the asset. `countedQuantity: 0` is a positive assertion
 * that nothing was there — NOT the same as never reaching the asset, which is
 * simply the absence of a line.
 */
export interface SubmitFixedAssetCountLineInput {
  assetId?: string | null;
  scannedTag?: string | null;
  countedQuantity: number;
  note?: string | null;
}

export interface FixedAssetCountLine {
  id: string;
  sessionId: string;
  assetId: string | null;
  scannedTag: string | null;
  expectedQuantity: number;
  countedQuantity: number;
  note: string | null;
  countedBy: string;
  countedAt: string;
  /** How the scan resolved. "unregistered" = found, not in the register. */
  resolution: "matched" | "unregistered";
}

export interface FixedAssetCountVarianceLine {
  assetId: string | null;
  assetNo: string | null;
  name: string;
  categoryCode: string | null;
  location: string | null;
  expectedQuantity: number;
  countedQuantity: number;
  /** counted − expected. Negative = missing units. */
  variance: number;
  status: FixedAssetCountLineStatus;
  scannedTag?: string | null;
  note?: string | null;
  /**
   * True when the accountant should raise a write-off through the existing
   * disposal approval flow. The count itself never writes one.
   */
  suggestWriteOff: boolean;
}

/** Server-computed roll-up over the whole session — never re-derive from rows. */
export interface FixedAssetCountVarianceSummary {
  expectedAssets: number;
  countedAssets: number;
  matched: number;
  shortfall: number;
  surplus: number;
  notCounted: number;
  unregistered: number;
  /** Net units missing across the session (positive = units missing). */
  netUnitsMissing: number;
}

export interface FixedAssetCountVariance {
  session: {
    id: string;
    sessionNo: string;
    entityId: string;
    asOfDate: string;
    name: string | null;
    locationFilter: string | null;
    status: FixedAssetCountSessionStatus;
  };
  lines: FixedAssetCountVarianceLine[];
  summary: FixedAssetCountVarianceSummary;
}

export async function listFixedAssetCountSessions(params: {
  entityId?: string;
  status?: FixedAssetCountSessionStatus;
}): Promise<ApiSuccessResponse<FixedAssetCountSession[]>> {
  return api.get(
    `/accounting/fixed-assets/count-sessions${buildQuery(params)}`,
  );
}

export async function createFixedAssetCountSession(
  input: CreateFixedAssetCountSessionInput,
): Promise<ApiSuccessResponse<FixedAssetCountSession>> {
  return api.post("/accounting/fixed-assets/count-sessions", input);
}

export async function submitFixedAssetCountLine(
  sessionId: string,
  input: SubmitFixedAssetCountLineInput,
): Promise<ApiSuccessResponse<FixedAssetCountLine>> {
  return api.post(
    `/accounting/fixed-assets/count-sessions/${sessionId}/lines`,
    input,
  );
}

export async function getFixedAssetCountVariance(
  sessionId: string,
): Promise<ApiSuccessResponse<FixedAssetCountVariance>> {
  return api.get(
    `/accounting/fixed-assets/count-sessions/${sessionId}/variance`,
  );
}

/** Freezes the session. A closed session accepts no further lines (409). */
export async function closeFixedAssetCountSession(
  sessionId: string,
): Promise<ApiSuccessResponse<FixedAssetCountSession>> {
  return api.post(
    `/accounting/fixed-assets/count-sessions/${sessionId}/close`,
    {},
  );
}

// ─── WS5: entity tax rates + deferred tax ───────────────────────────────────

/**
 * Effective-dated corporate income tax rate. Periods must not overlap, so
 * exactly one rate is in force on any date; the API rejects an overlap with a
 * 409 naming the clashing period. `effectiveTo: null` = open-ended.
 *
 * `ratePercent` is a Decimal(6,3) string, e.g. "20.000". 0 is legitimate (a
 * BOI-promoted entity) and is NOT the same as "no rate configured", which is
 * the absence of a row.
 */
export interface EntityTaxRate {
  id: string;
  entityId: string;
  effectiveFrom: string;
  effectiveTo: string | null;
  ratePercent: string;
  label: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateEntityTaxRateInput {
  entityId: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  ratePercent: number;
  label?: string | null;
}

/**
 * Key presence is meaningful: omitting `effectiveTo` keeps the stored end date,
 * sending an explicit null makes the period open-ended.
 */
export type UpdateEntityTaxRateInput = Partial<
  Omit<CreateEntityTaxRateInput, "entityId">
>;

export async function listEntityTaxRates(params: {
  entityId: string;
}): Promise<ApiSuccessResponse<EntityTaxRate[]>> {
  return api.get(`/accounting/entity-tax-rates${buildQuery(params)}`);
}

export async function createEntityTaxRate(
  input: CreateEntityTaxRateInput,
): Promise<ApiSuccessResponse<EntityTaxRate>> {
  return api.post("/accounting/entity-tax-rates", input);
}

export async function updateEntityTaxRate(
  id: string,
  input: UpdateEntityTaxRateInput,
): Promise<ApiSuccessResponse<EntityTaxRate>> {
  return api.put(`/accounting/entity-tax-rates/${id}`, input);
}

export async function deleteEntityTaxRate(
  id: string,
): Promise<ApiSuccessResponse<{ success: boolean }>> {
  return api.delete(`/accounting/entity-tax-rates/${id}`);
}

export const DEFERRED_TAX_EXCLUSION_REASONS = [
  "no-tax-basis",
  "no-tax-rate",
] as const;
export type DeferredTaxExclusionReason =
  (typeof DEFERRED_TAX_EXCLUSION_REASONS)[number];

export interface FixedAssetDeferredTaxLine {
  assetId: string;
  assetNo: string | null;
  name: string;
  categoryCode: string;
  /** Report payload — server-converted, so these arrive as numbers. */
  bookCarrying: number;
  taxWdv: number;
  /** book − tax. Positive = taxable difference (DTL), negative = deductible (DTA). */
  temporaryDifference: number;
  ratePercent: number;
  /** Positive = liability, negative = asset. */
  deferredTax: number;
}

export interface FixedAssetDeferredTaxExclusion {
  assetId: string;
  assetNo: string | null;
  name: string;
  reason: DeferredTaxExclusionReason;
}

/**
 * The fixed-asset COMPONENT of deferred tax only — provisions, unrealised FX
 * and employee benefits are outside it. `scope` says so on the payload; never
 * present this as the entity's deferred tax position.
 *
 * `coverage` exists so a schedule covering 40 of 300 assets cannot read as
 * complete. `ratePercent` is null when no rate is in force at `asOf`, in which
 * case every asset lands in `exclusions`.
 */
export interface FixedAssetDeferredTaxReport {
  entityId: string;
  asOf: string;
  ratePercent: number | null;
  rateLabel: string | null;
  scope: "fixed-assets";
  lines: FixedAssetDeferredTaxLine[];
  exclusions: FixedAssetDeferredTaxExclusion[];
  totals: {
    bookCarrying: number;
    taxWdv: number;
    temporaryDifference: number;
    /** Net position: positive = net liability, negative = net asset. */
    deferredTax: number;
    deferredTaxLiability: number;
    deferredTaxAsset: number;
  };
  coverage: {
    assetsIncluded: number;
    assetsExcluded: number;
    /** 0-100, or null when there were no assets at all. */
    percentIncluded: number | null;
  };
}

export async function getFixedAssetDeferredTaxReport(params: {
  entityId: string;
  asOf?: string;
}): Promise<ApiSuccessResponse<FixedAssetDeferredTaxReport>> {
  return api.get(
    `/accounting/reports/fixed-assets/deferred-tax${buildQuery(params)}`,
  );
}
