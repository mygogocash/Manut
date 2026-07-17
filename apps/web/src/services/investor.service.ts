import { api } from "@/lib/api-client";
import type {
  ApiPaginatedResponse,
  ApiSuccessResponse,
} from "@/types/api.type";

// ─── Types ──────────────────────────────────────────────

export interface Investor {
  id: string;
  name: string;
  type: string;
  status: string;
  visibility: string;
  contactEmail: string | null;
  contactName: string | null;
  contactPhone: string | null;
  website: string | null;
  location: string | null;
  notes: Record<string, unknown> | null;
  // Pipeline import columns. All nullable so existing
  // rows render fine; the dashboard / form / table show "—" when
  // empty.
  title: string | null;
  linkedinUrl: string | null;
  revenueStream: string | null;
  lastContactDate: string | null;
  nextAction: string | null;
  actInvestment: string | null;
  estInvestment: string | null;
  crossSell: string | null;
  region: string | null;
  notesText: string | null;
  addedBy: string;
  adder: { id: string; name: string; avatarUrl: string | null };
  _count: { investments: number };
  createdAt: string;
}

export interface InvestorDetail extends Investor {
  investments: Investment[];
}

export interface Investment {
  id: string;
  round: string;
  amount: string;
  currency: string;
  equityPercent: string;
  date: string;
  status: string;
  notes: string | null;
}

export interface InvestorDashboard {
  totalInvestors: number;
  totalInvestments: number;
  totalCommitted: number;
  totalReceived: number;
  /** Sum of parsed `estInvestment` values on investor rows (pipeline sheet). */
  totalEstInvestment: number;
  /** Sum of parsed `actInvestment` values on investor rows (pipeline sheet). */
  totalActInvestment: number;
  /** Investor counts keyed by pipeline status slug. */
  statusBreakdown: Record<string, number>;
  byCurrency: Record<string, { committed: number; received: number }>;
}

/** Fundraising pipeline — keep in sync with API `investor-pipeline.ts`. */
export const INVESTOR_PIPELINE_STAGES = [
  { key: "lead", label: "Lead", color: "bg-slate-500" },
  {
    key: "discovery_call",
    label: "Discovery Call / Ongoing Communication",
    color: "bg-blue-500",
  },
  { key: "dd", label: "DD", color: "bg-violet-500" },
  {
    key: "verbal_commitment",
    label: "Verbal Commitment",
    color: "bg-amber-500",
  },
  {
    key: "agreement_signed",
    label: "Agreement Signed",
    color: "bg-purple-500",
  },
  { key: "funds_cleared", label: "Funds Cleared", color: "bg-emerald-500" },
  {
    key: "relationship_management",
    label: "Relationship Management",
    color: "bg-teal-500",
  },
] as const;

export type InvestorPipelineStatus =
  (typeof INVESTOR_PIPELINE_STAGES)[number]["key"];

/** Parse free-text est./act. investment cells for display and client-side checks. */
export function parseInvestmentAmount(raw: string | null | undefined): number {
  if (!raw) return 0;
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  if (
    trimmed === "-" ||
    trimmed === "—" ||
    /^tbd$/i.test(trimmed) ||
    /^n\/?a$/i.test(trimmed)
  ) {
    return 0;
  }

  const compact = trimmed.replace(/,/g, "").replace(/\s+/g, "");
  const suffixMatch = compact.match(/^[$£€]?([\d.]+)([kKmM])?$/);
  if (suffixMatch) {
    const base = Number(suffixMatch[1]);
    if (!Number.isFinite(base)) return 0;
    const suffix = suffixMatch[2]?.toLowerCase();
    if (suffix === "k") return base * 1_000;
    if (suffix === "m") return base * 1_000_000;
    return base;
  }

  const digitsOnly = compact.replace(/[^0-9.-]/g, "");
  if (!digitsOnly) return 0;
  const value = Number(digitsOnly);
  return Number.isFinite(value) ? value : 0;
}

export function formatInvestmentAmount(raw: string | null | undefined): string {
  const amount = parseInvestmentAmount(raw);
  if (amount > 0) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(amount);
  }
  if (!raw?.trim() || raw.trim() === "-") return "—";
  return raw.trim();
}

export interface CreateInvestorInput {
  name: string;
  type: string;
  status?: string;
  visibility?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  website?: string;
  location?: string;
  notes?: string;
  // Pipeline-master columns. All optional; empty strings clear on
  // edit (server normalises "" → null).
  title?: string | null;
  linkedinUrl?: string | null;
  revenueStream?: string | null;
  lastContactDate?: string | null;
  nextAction?: string | null;
  actInvestment?: string | null;
  estInvestment?: string | null;
  crossSell?: string | null;
  region?: string | null;
  notesText?: string | null;
}

export type UpdateInvestorInput = Partial<CreateInvestorInput>;

export interface InvestorParams {
  page?: number;
  limit?: number;
  search?: string;
  type?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export const INVESTOR_TYPES = [
  "angel",
  "vc",
  "corporate",
  "family_office",
  "other",
] as const;

export const INVESTOR_STATUSES = INVESTOR_PIPELINE_STAGES.map(
  (s) => s.key,
) as readonly InvestorPipelineStatus[];

export const INVESTOR_VISIBILITIES = ["team", "private", "public"] as const;

export const INVESTOR_TYPE_LABELS: Record<string, string> = {
  angel: "Angel",
  vc: "VC",
  corporate: "Corporate",
  family_office: "Family Office",
  introducer: "Introducer",
  other: "Other",
};

export const INVESTOR_STATUS_LABELS: Record<string, string> =
  Object.fromEntries(INVESTOR_PIPELINE_STAGES.map((s) => [s.key, s.label]));

export const LEGACY_INVESTOR_STATUS_LABELS: Record<string, string> = {
  new: "New",
  prospect: "Prospect",
  active: "Active",
  inactive: "Inactive",
  declined: "Declined",
};

export function investorStatusLabel(status: string): string {
  return (
    INVESTOR_STATUS_LABELS[status] ??
    LEGACY_INVESTOR_STATUS_LABELS[status] ??
    status
  );
}

const LEGACY_STATUS_MAP: Record<string, InvestorPipelineStatus> = {
  new: "lead",
  prospect: "lead",
  active: "relationship_management",
  inactive: "relationship_management",
  declined: "lead",
};

/** Map spreadsheet / free-text status cells to a canonical pipeline slug. */
export function normalizeInvestorStatus(
  raw: string | undefined,
): InvestorPipelineStatus {
  const s = (raw ?? "").trim().toLowerCase();
  if (!s) return "lead";

  if (LEGACY_STATUS_MAP[s]) return LEGACY_STATUS_MAP[s];

  if ((INVESTOR_STATUSES as readonly string[]).includes(s)) {
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

  return "lead";
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

export async function listInvestors(
  params: InvestorParams = {},
): Promise<ApiPaginatedResponse<Investor>> {
  return api.get(`/investors${buildQuery(params)}`);
}

export async function getInvestor(
  id: string,
): Promise<ApiSuccessResponse<InvestorDetail>> {
  return api.get(`/investors/${id}`);
}

export async function createInvestor(
  input: CreateInvestorInput,
): Promise<ApiSuccessResponse<Investor>> {
  return api.post("/investors", input);
}

export async function updateInvestor(
  id: string,
  input: UpdateInvestorInput,
): Promise<ApiSuccessResponse<Investor>> {
  return api.put(`/investors/${id}`, input);
}

export async function deleteInvestor(id: string): Promise<void> {
  await api.delete(`/investors/${id}`);
}

export async function getInvestorDashboard(): Promise<
  ApiSuccessResponse<InvestorDashboard>
> {
  return api.get("/investors/dashboard");
}

/** Per-stage roll-up keyed by status slug: count + summed est/act. */
export type InvestorPipelineTotals = Record<
  string,
  { count: number; est: number; act: number }
>;

export async function getInvestorPipelineTotals(): Promise<
  ApiSuccessResponse<InvestorPipelineTotals>
> {
  return api.get("/investors/pipeline-totals");
}

export async function importInvestors(
  rows: CreateInvestorInput[],
): Promise<ApiSuccessResponse<{ created: number; skipped: number }>> {
  return api.post("/investors/import", { rows });
}

export async function reorderInvestors(
  orderedIds: string[],
): Promise<ApiSuccessResponse<{ success: boolean }>> {
  return api.post("/investors/reorder", { orderedIds });
}

// Bulk selection: either explicit `ids` (rows ticked) or `allMatching`
// + the current `filter` ("select all N matching"). Exactly one mode.
export interface InvestorBulkSelection {
  ids?: string[];
  allMatching?: boolean;
  filter?: { search?: string; type?: string; status?: string };
}

export async function bulkUpdateInvestors(
  input: InvestorBulkSelection & {
    set: { status?: string; type?: string; addedBy?: string };
  },
): Promise<ApiSuccessResponse<{ updated: number }>> {
  return api.post("/investors/bulk-update", input);
}

export async function bulkDeleteInvestors(
  input: InvestorBulkSelection,
): Promise<ApiSuccessResponse<{ deleted: number }>> {
  return api.post("/investors/bulk-delete", input);
}
