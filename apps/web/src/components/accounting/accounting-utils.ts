export const ALL_FILTER = "__all__";

export const JOURNAL_STATUSES = [
  "draft",
  "approved",
  "posted",
  "cancelled",
  "reversed",
  "deleted",
] as const;
export const JOURNAL_IMPORT_STATUSES = ["draft", "approved", "posted"] as const;
export const ACCOUNT_TYPES = [
  "asset",
  "liability",
  "equity",
  "revenue",
  "expense",
] as const;
export const INVOICE_STATUSES = [
  "draft",
  "sent",
  "partial",
  "paid",
  "overdue",
  "cancelled",
  "deleted",
] as const;
export const INVOICE_TYPES = ["receivable", "payable"] as const;
export const BANK_STATUSES = ["unmatched", "matched", "reconciled"] as const;

export const FIXED_ASSET_STATUSES = [
  "active",
  "idle",
  "pending_disposal",
  "disposed",
  "written_off",
  "transferred",
] as const;
export const FIXED_ASSET_CLASSES = ["IT", "PFA", "FF"] as const;

// Ship-dark gate for the Fixed Asset tab. NEXT_PUBLIC_* is inlined at
// `next build`, so this travels via --build-arg (not runtime env) and
// fail-closes: any value other than "true" hides the tab.
export const FIXED_ASSETS_ENABLED =
  process.env.NEXT_PUBLIC_ACCOUNTING_FIXED_ASSETS === "true";

// Quotes / Purchase Orders stay off the tab nav (components remain). Vendors
// and Credit Notes are on the bar. The "Expense" tab is the AP bills list;
// "Invoices" is the AR side.
export const TABS = [
  { id: "overview", label: "Overview" },
  { id: "journals", label: "Journal Entries" },
  { id: "coa", label: "Chart of Accounts" },
  { id: "invoices", label: "Invoices" },
  { id: "receipts", label: "Receipts" },
  { id: "expense", label: "Bills" },
  { id: "payments", label: "Payments" },
  ...(FIXED_ASSETS_ENABLED
    ? [{ id: "fixed-assets", label: "Fixed Asset" }]
    : []),
  { id: "vendors", label: "Vendors" },
  { id: "credit-notes", label: "Credit Notes" },
  { id: "bank", label: "Bank Reconciliation" },
  { id: "reports", label: "Reports" },
];

// Admin-only config tab: company setup, opening balances, tax codes, period
// locks, maker-checker and posting-account mapping. Appended to TABS for
// accounting:admin holders only — see the accounting page. The id stays
// "posting-setup" so existing deep links keep working.
export const POSTING_SETUP_TAB = {
  id: "posting-setup",
  label: "Setup",
};

export function formatCurrency(value: string | number): string {
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
