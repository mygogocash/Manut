import { api } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api.type";

// Product proposals, API client.
//
// The four statuses, three choices and six views mirror the API exactly. They
// are duplicated rather than imported because @nexora/types does not carry them
// and the web bundle should not pull in the API module; the tests in
// proposal.service.test.ts on the API side are what keep the two honest.

export type ProposalStatus =
  /** In flight: awaiting a stage of the configured approval chain. */
  | "pending_approval"
  | "approved"
  | "declined"
  /** The two fixed tiers this flow had before chains. Read-only. */
  | "pending_pm_review"
  | "pending_ceo_approval";

/** What a reviewer records. `question` deliberately moves nothing. */
export type ProposalChoice = "pass" | "decline" | "question";

/** Only these two move the proposal. */
export type ProposalAction = "pass" | "decline";

export type ProposalType = "idea" | "change_request" | "other";

export type ProposalView =
  | "list"
  | "mine"
  | "pending"
  | "answering"
  | "approved"
  | "declined";

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  pending_approval: "Pending Approval",
  approved: "Approved",
  declined: "Declined",
  pending_pm_review: "Pending Review",
  pending_ceo_approval: "Pending Final Approval",
};

/** Badge styling. Full literal class strings, so Tailwind's scan can see them. */
export const PROPOSAL_STATUS_TONE: Record<ProposalStatus, string> = {
  pending_approval: "bg-amber-500/10 text-amber-600",
  approved: "bg-emerald-500/10 text-emerald-600",
  declined: "bg-red-500/10 text-red-600",
  pending_pm_review: "bg-amber-500/10 text-amber-600",
  pending_ceo_approval: "bg-blue-500/10 text-blue-600",
};

export const PROPOSAL_TYPE_LABELS: Record<ProposalType, string> = {
  idea: "Idea",
  change_request: "Change Request",
  other: "Other",
};

export const PROPOSAL_TYPE_OPTIONS: Array<{
  value: ProposalType;
  label: string;
}> = [
  { value: "idea", label: "Idea" },
  { value: "change_request", label: "Change Request" },
  { value: "other", label: "Other" },
];

export const PROPOSAL_PRIORITIES = ["low", "normal", "high", "urgent"] as const;
export type ProposalPriority = (typeof PROPOSAL_PRIORITIES)[number];

export const PROPOSAL_PRIORITY_LABELS: Record<ProposalPriority, string> = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

/**
 * A stage of the configured chain as snapshotted onto one proposal.
 *
 * The progress strip is built from these rather than from a fixed list of
 * statuses: how many stages there are is an administrator's choice now.
 */
export interface ProposalStage {
  id: string;
  order: number;
  name: string;
  status: "pending" | "approved" | "rejected" | "skipped";
  approver: { id: string; name: string; email: string } | null;
  decidedBy: { id: string; name: string; email: string } | null;
  decidedAt: string | null;
  notes: string | null;
}

export interface ProposalRow {
  id: string;
  title: string;
  type: string;
  priority: string | null;
  status: ProposalStatus;
  label: string;
  raisedBy: string;
  projectId: string | null;
  statusChangedAt: string | null;
  createdAt: string;
  /** Unanswered questions, so a row can show what it is waiting on. */
  openQuestionCount: number;
}

export interface ProposalQueue {
  counts: Record<ProposalView, number>;
  rows: ProposalRow[];
}

export interface ProposalQuestion {
  id: string;
  question: string;
  response: string | null;
  askedBy: string;
  assignedTo: string;
  /** Whether the signed-in caller is the one who must answer. */
  isMine: boolean;
  raisedAtStatus: string;
  createdAt: string;
  respondedAt: string | null;
}

export interface ProposalHistoryEntry {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  choice: string | null;
  comment: string | null;
  actor: string;
  at: string;
}

export interface ProposalDetail {
  proposal: {
    id: string;
    title: string;
    description: string;
    type: string;
    priority: string | null;
    status: ProposalStatus;
    label: string;
    raisedBy: string;
    projectId: string | null;
    project: { id: string; name: string } | null;
    statusChangedAt: string | null;
    createdAt: string;
    updatedAt: string;
  };
  /** What THIS caller may do, decided server-side. Never re-derived here. */
  permissions: {
    availableActions: ProposalAction[];
    canAskForInformation: boolean;
    canAnswer: boolean;
    canEdit: boolean;
  };
  openQuestionCount: number;
  questions: ProposalQuestion[];
  history: ProposalHistoryEntry[];
  /**
   * Where this proposal sits in its chain. Empty when it follows none.
   *
   * Optional because a deployed API can lag the web by a release; the page reads
   * it defensively rather than assuming it is present.
   */
  chain?: {
    currentStage: number | null;
    totalStages: number;
    stages: ProposalStage[];
  };
}

export interface CreateProposalInput {
  title: string;
  description: string;
  type: ProposalType;
  projectId?: string | null;
  priority?: string | null;
}

export type UpdateProposalInput = Partial<CreateProposalInput>;

/**
 * What a write returns: the saved row, not a queue row. It carries no `label`,
 * `raisedBy` or question count, because those are read-model concerns the write
 * path does not compute. Callers reload rather than patching state from this.
 */
export interface ProposalWriteResult {
  id: string;
  title: string;
  description: string;
  type: string;
  priority: string | null;
  status: ProposalStatus;
}

function buildQuery(params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") qs.set(key, value);
  }
  const str = qs.toString();
  return str ? `?${str}` : "";
}

export async function getProposalQueue(
  view: ProposalView,
  filters: { search?: string; type?: string } = {},
): Promise<ApiSuccessResponse<ProposalQueue>> {
  return api.get(
    `/proposals${buildQuery({
      view,
      search: filters.search,
      type: filters.type,
    })}`,
  );
}

export async function getProposal(
  id: string,
): Promise<ApiSuccessResponse<ProposalDetail>> {
  return api.get(`/proposals/${id}`);
}

export async function createProposal(
  input: CreateProposalInput,
): Promise<ApiSuccessResponse<ProposalWriteResult>> {
  return api.post(`/proposals`, input);
}

export async function updateProposal(
  id: string,
  input: UpdateProposalInput,
): Promise<ApiSuccessResponse<ProposalWriteResult>> {
  return api.put(`/proposals/${id}`, input);
}

/** Pass to the next tier, or approve if this is the final one. */
export async function passProposal(
  id: string,
  comment?: string,
): Promise<ApiSuccessResponse<unknown>> {
  return api.post(`/proposals/${id}/pass`, { comment });
}

/** Terminal, and the reason is required. */
export async function declineProposal(
  id: string,
  reason: string,
): Promise<ApiSuccessResponse<unknown>> {
  return api.post(`/proposals/${id}/decline`, { reason });
}

/** Ask one or more people for information. Does not move the proposal. */
export async function askProposalQuestion(
  id: string,
  assigneeIds: string[],
  question: string,
): Promise<ApiSuccessResponse<unknown>> {
  return api.post(`/proposals/${id}/ask`, { assigneeIds, question });
}

export async function respondToProposalQuestion(
  requestId: string,
  response: string,
): Promise<ApiSuccessResponse<unknown>> {
  return api.post(`/proposals/questions/${requestId}/respond`, { response });
}

