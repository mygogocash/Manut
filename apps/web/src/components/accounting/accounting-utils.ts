export const ALL_FILTER = "__all__";

export const JOURNAL_STATUSES = ["draft", "approved", "posted"] as const;
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
  "paid",
  "overdue",
  "cancelled",
] as const;
export const INVOICE_TYPES = ["receivable", "payable"] as const;
export const BANK_STATUSES = ["unmatched", "matched", "reconciled"] as const;

export const TABS = [
  { id: "journals", label: "Journal Entries" },
  { id: "coa", label: "Chart of Accounts" },
  { id: "invoices", label: "Invoices" },
  { id: "bank", label: "Bank Reconciliation" },
  { id: "vendors", label: "Vendors" },
];

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
