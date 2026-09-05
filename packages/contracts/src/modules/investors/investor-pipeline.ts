/**
 * Fundraising pipeline stages for the Investor Dashboard / CRM.
 * Keep in sync with `INVESTOR_PIPELINE_STAGES` in
 * `apps/web/src/services/investor.service.ts`.
 */
export const INVESTOR_PIPELINE_STAGES = [
  { key: "lead", label: "Lead" },
  {
    key: "discovery_call",
    label: "Discovery Call / Ongoing Communication",
  },
  { key: "dd", label: "DD" },
  { key: "verbal_commitment", label: "Verbal Commitment" },
  { key: "agreement_signed", label: "Agreement Signed" },
  { key: "funds_cleared", label: "Funds Cleared" },
  { key: "relationship_management", label: "Relationship Management" },
] as const;

export type InvestorPipelineStatus =
  (typeof INVESTOR_PIPELINE_STAGES)[number]["key"];

export const INVESTOR_STATUS_VALUES = INVESTOR_PIPELINE_STAGES.map(
  (s) => s.key,
) as [InvestorPipelineStatus, ...InvestorPipelineStatus[]];

export const INVESTOR_STATUS_LABELS: Record<InvestorPipelineStatus, string> =
  Object.fromEntries(
    INVESTOR_PIPELINE_STAGES.map((s) => [s.key, s.label]),
  ) as Record<InvestorPipelineStatus, string>;

/** Pre-pipeline enum labels — shown when legacy rows have not been migrated yet. */
export const LEGACY_INVESTOR_STATUS_LABELS: Record<string, string> = {
  new: "New",
  prospect: "Prospect",
  active: "Active",
  inactive: "Inactive",
  declined: "Declined",
};

const LEGACY_STATUS_MAP: Record<string, InvestorPipelineStatus> = {
  new: "lead",
  prospect: "lead",
  active: "relationship_management",
  inactive: "relationship_management",
  declined: "lead",
};

/**
 * Map spreadsheet / free-text status cells to a canonical pipeline slug.
 */
export function normalizeInvestorStatus(
  raw: string | null | undefined,
): string {
  const s = (raw ?? "").trim().toLowerCase();
  // Default intake stage for blank / unrecognised import cells.
  if (!s) return "investors";
  if (s === "investors") return "investors";

  if (LEGACY_STATUS_MAP[s]) return LEGACY_STATUS_MAP[s];

  if (INVESTOR_STATUS_VALUES.includes(s as InvestorPipelineStatus)) {
    return s as InvestorPipelineStatus;
  }

  if (s.includes("relationship") || s === "rm") {
    return "relationship_management";
  }
  if (s.includes("fund") && s.includes("clear")) return "funds_cleared";
  if (s.includes("agreement") && s.includes("sign")) return "agreement_signed";
  if (
    s.includes("verbal") ||
    (s.includes("commit") && !s.includes("agreement"))
  ) {
    return "verbal_commitment";
  }
  if (s === "dd" || s.includes("due diligence") || s.includes("diligence")) {
    return "dd";
  }
  if (
    s.includes("discovery") ||
    s.includes("ongoing") ||
    s.includes("communication") ||
    s.includes("on going")
  ) {
    return "discovery_call";
  }
  if (s === "lead" || s.includes("prospect")) return "lead";

  return "investors";
}

export function investorStatusLabel(status: string): string {
  if (status in INVESTOR_STATUS_LABELS) {
    return INVESTOR_STATUS_LABELS[status as InvestorPipelineStatus];
  }
  return LEGACY_INVESTOR_STATUS_LABELS[status] ?? status;
}
