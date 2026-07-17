export const ALL_FILTER = "__all__";

export const RUN_STATUSES = ["draft", "approved", "paid"] as const;
export const INVOICE_STATUSES = ["pending", "approved", "paid"] as const;

export const PAYROLL_TABS = [
  { id: "runs", label: "Payroll Runs" },
  { id: "consultants", label: "Consultant Invoices" },
];

export function formatCurrency(value: string | number): string {
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
