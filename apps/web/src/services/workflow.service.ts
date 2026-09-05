import { api } from "@/lib/api-client";
import type { ApiSuccessResponse } from "@/types/api.type";

// Project approval workflow, API client.

export type WorkflowStatus =
  | "draft"
  | "pending_pm_approval"
  /** Awaiting the person the PM named. */
  | "pending_escalation"
  /** Approved. Work may start; completing is optional. */
  | "approved"
  | "completed"
  | "rejected"
  /** What `approved` was called before. Read-only. */
  | "pending_development";

export type WorkflowAction =
  | "submit"
  | "approve"
  | "complete"
  | "reject"
  // Project Manager authority: send back for changes, or revive a rejection.
  | "return"
  | "reopen"
  /** PM refers the request to a named approver. */
  | "escalate";

export type WorkflowView =
  | "list"
  | "mine"
  | "pending"
  | "completed"
  | "rejected";

export const WORKFLOW_STATUS_LABELS: Record<WorkflowStatus, string> = {
  draft: "Draft",
  pending_pm_approval: "Pending PM Approval",
  pending_escalation: "Escalated for Approval",
  approved: "Approved",
  // Legacy rows read as what they are.
  pending_development: "Approved",
  completed: "Completed",
  rejected: "Rejected",
};

/** Shared badge styling, full literal class strings so Tailwind can see them. */
export const WORKFLOW_STATUS_TONE: Record<WorkflowStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  pending_pm_approval: "bg-amber-500/10 text-amber-600",
  pending_escalation: "bg-amber-500/10 text-amber-600",
  approved: "bg-emerald-500/10 text-emerald-600",
  pending_development: "bg-emerald-500/10 text-emerald-600",
  completed: "bg-emerald-500/10 text-emerald-600",
  rejected: "bg-red-500/10 text-red-600",
};

/** The ordered chain, used to render the progress timeline. */
/**
 * The ordered chain for the progress strip.
 *
 * Ends at `approved`, because that is where most requests finish. `completed` is
 * optional and set by choice, so showing it as an unreached step would imply
 * every request still owes one.
 */
export const WORKFLOW_CHAIN: WorkflowStatus[] = [
  "draft",
  "pending_pm_approval",
  "pending_escalation",
  "approved",
];

export interface WorkflowQueueRow {
  id: string;
  name: string;
  department: string | null;
  status: WorkflowStatus;
  label: string;
  owner: string;
  goLiveDate: string | null;
  updatedAt: string;
  availableActions: WorkflowAction[];
}

export interface WorkflowQueue {
  counts: Record<WorkflowView, number>;
  rows: WorkflowQueueRow[];
}

export interface WorkflowHistoryEntry {
  id: string;
  fromStatus: string | null;
  toStatus: string;
  actor: string;
  comment: string | null;
  at: string;
}

export interface WorkflowState {
  projectId: string;
  status: WorkflowStatus;
  label: string;
  isTerminal: boolean;
  allowedActions: WorkflowAction[];
  availableActions: WorkflowAction[];
  history: WorkflowHistoryEntry[];
}

export interface RequestDetail {
  project: {
    id: string;
    name: string;
    description: string | null;
    details: string | null;
    status: string;
    /** Primary department, the head of `departments`. */
    department: string | null;
    departments: string[];
    /** Set while the status is `pending_escalation`. */
    escalatedTo: { id: string; name: string } | null;
    comment: string | null;
    goLiveDate: string | null;
    revisedGoLiveDate: string | null;
    createdAt: string;
    owner: { id: string; name: string; email: string } | null;
  };
  workflow: WorkflowState;
  comments: Array<{
    id: string;
    body: string;
    author: string;
    taskTitle: string | null;
    at: string;
  }>;
  attachments: Array<{
    id: string;
    kind: string;
    label: string;
    url: string;
    taskTitle: string | null;
    at: string;
  }>;
}

export function getWorkflowQueue(view: WorkflowView) {
  return api.get<ApiSuccessResponse<WorkflowQueue>>(
    `/projects/workflow/queue?view=${view}`,
  );
}

export function getRequestDetail(id: string) {
  return api.get<ApiSuccessResponse<RequestDetail>>(
    `/projects/${id}/workflow/detail`,
  );
}

export function submitRequest(id: string, comment?: string) {
  return api.post<ApiSuccessResponse<unknown>>(
    `/projects/${id}/workflow/submit`,
    { comment },
  );
}
export function approveRequest(id: string, comment?: string) {
  return api.post<ApiSuccessResponse<unknown>>(
    `/projects/${id}/workflow/approve`,
    { comment },
  );
}
export function completeRequest(id: string, comment?: string) {
  return api.post<ApiSuccessResponse<unknown>>(
    `/projects/${id}/workflow/complete`,
    { comment },
  );
}
export function rejectRequest(id: string, reason: string) {
  return api.post<ApiSuccessResponse<unknown>>(
    `/projects/${id}/workflow/reject`,
    { reason },
  );
}
export function returnRequest(id: string, comment?: string) {
  return api.post<ApiSuccessResponse<unknown>>(
    `/projects/${id}/workflow/return`,
    { comment },
  );
}
export function reopenRequest(id: string, comment?: string) {
  return api.post<ApiSuccessResponse<unknown>>(
    `/projects/${id}/workflow/reopen`,
    { comment },
  );
}
export function escalateRequest(
  id: string,
  escalateToId: string,
  comment?: string,
) {
  return api.post<ApiSuccessResponse<unknown>>(
    `/projects/${id}/workflow/escalate`,
    { escalateToId, comment },
  );
}

/** Maps an action to its client call, so callers stay declarative. */
export function runWorkflowAction(
  action: WorkflowAction,
  id: string,
  note: string,
) {
  switch (action) {
    case "submit":
      return submitRequest(id, note || undefined);
    case "approve":
      return approveRequest(id, note || undefined);
    case "complete":
      return completeRequest(id, note || undefined);
    case "reject":
      return rejectRequest(id, note);
    case "return":
      return returnRequest(id, note || undefined);
    case "reopen":
      return reopenRequest(id, note || undefined);
  }
}
