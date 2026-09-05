export type ApprovalDocType = "invoice" | "bill" | "journal";

export interface SecondApprovalConfig {
  enabled: boolean;
  thresholds: Partial<Record<ApprovalDocType, number | null>>;
  staleDays: number;
}

export const DEFAULT_SECOND_APPROVAL: SecondApprovalConfig = {
  enabled: false,
  thresholds: { invoice: 100000, bill: 100000, journal: 100000 },
  staleDays: 7,
};

export const SECOND_APPROVAL_KEY = "accounting.second_approval";
