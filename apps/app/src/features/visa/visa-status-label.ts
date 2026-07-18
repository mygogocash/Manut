import type { VisaStatus } from "@manut/app-core";

export function visaStatusLabel(status: VisaStatus): string {
  switch (status) {
    case "active":
      return "Active";
    case "expired":
      return "Expired";
    case "pending":
      return "Pending";
    case "processing":
      return "Processing";
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}
