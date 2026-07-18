import type { PayrollRunStatus } from "@manut/app-core";

const LABELS: Record<PayrollRunStatus, string> = {
  draft: "Draft",
  approved: "Approved",
  paid: "Paid",
};

export function payrollStatusLabel(status: PayrollRunStatus): string {
  return LABELS[status];
}
