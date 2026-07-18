import type { CashAdvanceStatus } from "@manut/app-core";

export function cashAdvanceStatusLabel(status: CashAdvanceStatus): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "submitted":
      return "Submitted";
    case "approved":
      return "Approved";
    case "rejected":
      return "Rejected";
    case "disbursed":
      return "Disbursed";
    case "cleared":
      return "Cleared";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
