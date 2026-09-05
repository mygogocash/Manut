import { PERMISSIONS } from "../../../common/constants/permissions";

/**
 * Teams whose boards run through the project approval workflow.
 *
 * `POST /api/projects` is shared: the Project CRM (`general`) and every other
 * shared-board CRM (HR, Legal, Accounting, QA …) all create through it. Only
 * the teams listed here auto-submit into the workflow, have their tasks gated
 * on an approval, and are reachable through the workflow routes — adding a
 * team here is what opts it in.
 *
 * Lives here rather than in `projects.service` so the workflow module can use
 * it without importing back into the service that already imports it.
 */
export const WORKFLOW_TEAMS = new Set(["general"]);

export function isWorkflowTeam(team?: string | null): boolean {
  return typeof team === "string" && WORKFLOW_TEAMS.has(team);
}

// Project approval workflow engine — the complete state machine.
//
//   created -> Project Manager -> Development -> Completed
//                     |
//                     +-> Escalated (a person the PM names) -> Development
//
// The Project Manager is the single gate. Most requests they approve outright
// and the work starts. When something needs another owner's sign-off — budget,
// or another team's commitment — the PM escalates to a NAMED person rather than
// a fixed role, and that person's approval releases it to development.
//
// This deliberately replaced a fixed four-stage chain: routing every request
// through Business Head and Product Admin regardless of size made small
// requests as expensive as large ones. There is one escalation stage rather
// than a stage per role, because who needs to sign off varies per request.
//
// Still a plain, declarative table — a transition is legal only if it appears
// in TRANSITIONS below. The escalation TARGET is data on the row; the shape of
// the state machine never changes.

export const WORKFLOW_STATUS = {
  /**
   * Only reachable by a PM `return` or `reopen` — creating a project submits
   * it straight away, so nothing sits here waiting to be noticed.
   */
  DRAFT: "draft",
  PENDING_PM_APPROVAL: "pending_pm_approval",
  /** Awaiting the person named in `escalatedToId`. */
  PENDING_ESCALATION: "pending_escalation",
  /**
   * Approved. Work may start, and the board is unblocked.
   *
   * This is the end of the flow for most requests. `complete` remains available
   * but nothing requires it: a request can legitimately sit here for good.
   *
   * It used to be called `pending_development`, which asserted something that
   * was not always true — that every approved request has a development phase —
   * and made the close-out feel mandatory. The status was only ever the signal
   * that work may begin; naming it after that is what it always meant.
   */
  APPROVED: "approved",
  /** Delivered. Set by somebody choosing to close the request out. */
  COMPLETED: "completed",
  REJECTED: "rejected",
  /**
   * The name `APPROVED` carried before. Kept ONLY so rows written under it still
   * read and still move; nothing new is written with it.
   */
  PENDING_DEVELOPMENT: "pending_development",
} as const;

export type WorkflowStatus =
  (typeof WORKFLOW_STATUS)[keyof typeof WORKFLOW_STATUS];

export const WORKFLOW_STATUS_LABELS: Record<WorkflowStatus, string> = {
  [WORKFLOW_STATUS.DRAFT]: "Draft",
  [WORKFLOW_STATUS.PENDING_PM_APPROVAL]: "Pending Approval",
  [WORKFLOW_STATUS.PENDING_ESCALATION]: "Escalated for Approval",
  [WORKFLOW_STATUS.APPROVED]: "Approved",
  // Legacy rows read as what they are.
  [WORKFLOW_STATUS.PENDING_DEVELOPMENT]: "Approved",
  [WORKFLOW_STATUS.COMPLETED]: "Completed",
  [WORKFLOW_STATUS.REJECTED]: "Rejected",
};

/** The actions a caller can request. */
export const WORKFLOW_ACTION = {
  SUBMIT: "submit",
  APPROVE: "approve",
  COMPLETE: "complete",
  REJECT: "reject",
  /** Project Manager sends a request back to the requester for changes. */
  RETURN: "return",
  /** Project Manager refers the request to a named approver. */
  ESCALATE: "escalate",
  /** Project Manager reopens a rejected request. */
  REOPEN: "reopen",
} as const;
export type WorkflowAction =
  (typeof WORKFLOW_ACTION)[keyof typeof WORKFLOW_ACTION];

/**
 * The state machine. `TRANSITIONS[from][action] = to`.
 * Anything absent is an illegal transition — there is no implicit fallthrough,
 * so states cannot be skipped and terminal states cannot be left.
 */
export const TRANSITIONS: Partial<
  Record<WorkflowStatus, Partial<Record<WorkflowAction, WorkflowStatus>>>
> = {
  [WORKFLOW_STATUS.DRAFT]: {
    [WORKFLOW_ACTION.SUBMIT]: WORKFLOW_STATUS.PENDING_PM_APPROVAL,
  },
  [WORKFLOW_STATUS.PENDING_PM_APPROVAL]: {
    // The PM gate: approving releases the work immediately. No further
    // sign-off unless the PM asks for one.
    [WORKFLOW_ACTION.APPROVE]: WORKFLOW_STATUS.APPROVED,
    [WORKFLOW_ACTION.ESCALATE]: WORKFLOW_STATUS.PENDING_ESCALATION,
    [WORKFLOW_ACTION.REJECT]: WORKFLOW_STATUS.REJECTED,
    // Workflow owner bounces it back to the requester for changes.
    [WORKFLOW_ACTION.RETURN]: WORKFLOW_STATUS.DRAFT,
  },
  [WORKFLOW_STATUS.PENDING_ESCALATION]: {
    [WORKFLOW_ACTION.APPROVE]: WORKFLOW_STATUS.APPROVED,
    [WORKFLOW_ACTION.REJECT]: WORKFLOW_STATUS.REJECTED,
    // Hand it back to the PM without deciding — the escalation was misdirected
    // or the PM needs to revise it first.
    [WORKFLOW_ACTION.RETURN]: WORKFLOW_STATUS.PENDING_PM_APPROVAL,
  },
  // Completing is OPTIONAL. It is offered, never required, and a request that
  // is never completed is not stuck — it is simply approved.
  [WORKFLOW_STATUS.APPROVED]: {
    [WORKFLOW_ACTION.COMPLETE]: WORKFLOW_STATUS.COMPLETED,
    [WORKFLOW_ACTION.REJECT]: WORKFLOW_STATUS.REJECTED,
  },
  // Same exits for a row still on the old value.
  [WORKFLOW_STATUS.PENDING_DEVELOPMENT]: {
    [WORKFLOW_ACTION.COMPLETE]: WORKFLOW_STATUS.COMPLETED,
    [WORKFLOW_ACTION.REJECT]: WORKFLOW_STATUS.REJECTED,
  },
  // `completed` is terminal. `rejected` is terminal for everyone EXCEPT the
  // Project Manager, who owns the workflow and may reopen it for revision.
  [WORKFLOW_STATUS.REJECTED]: {
    [WORKFLOW_ACTION.REOPEN]: WORKFLOW_STATUS.DRAFT,
  },
};

/**
 * Which permission lets a caller act FROM a given state. The required
 * permission depends on the project's current state, so it is enforced in the
 * service rather than in route middleware (same pattern as travel /
 * cash-advance approval chains). Admin holds every code via the resolver.
 */
/**
 * Where an approval lands when the configured chain still has a later stage.
 *
 * Deliberately a separate map rather than another entry in `TRANSITIONS`: this is
 * not an action anybody can take, it is where the SAME action lands when the
 * chain reports more work. Keeping it out of `TRANSITIONS` also keeps
 * `allowedActions()` describing what a person may click.
 *
 * Both in-flight approval stages return to `pending_pm_approval`, which now means
 * "awaiting a stage of the chain" rather than "awaiting the PM specifically".
 * Escalation is a detour ON a stage, so approving an escalation resumes the
 * chain rather than skipping the rest of it.
 */
export const CHAIN_ADVANCE_TARGET: Partial<
  Record<WorkflowStatus, WorkflowStatus>
> = {
  [WORKFLOW_STATUS.PENDING_PM_APPROVAL]: WORKFLOW_STATUS.PENDING_PM_APPROVAL,
  [WORKFLOW_STATUS.PENDING_ESCALATION]: WORKFLOW_STATUS.PENDING_PM_APPROVAL,
};

export const STAGE_PERMISSION: Record<WorkflowStatus, string | null> = {
  [WORKFLOW_STATUS.DRAFT]: PERMISSIONS.WORKFLOW_SUBMIT,
  [WORKFLOW_STATUS.PENDING_PM_APPROVAL]: PERMISSIONS.WORKFLOW_PM_APPROVE,
  // Escalation authority is NOT a permission code — it is "are you the person
  // the PM named". A code cannot express that, so the service checks
  // `escalatedToId` and this stays null. See workflow.service assertEscalatee.
  [WORKFLOW_STATUS.PENDING_ESCALATION]: null,
  // Completing an approved request is optional, but whoever does it needs the
  // code. Both names carry the same requirement.
  [WORKFLOW_STATUS.APPROVED]: PERMISSIONS.WORKFLOW_COMPLETE,
  [WORKFLOW_STATUS.PENDING_DEVELOPMENT]: PERMISSIONS.WORKFLOW_COMPLETE,
  // Terminal states admit no action, so no permission applies.
  [WORKFLOW_STATUS.COMPLETED]: null,
  [WORKFLOW_STATUS.REJECTED]: null,
};

export const TERMINAL_STATUSES: WorkflowStatus[] = [
  WORKFLOW_STATUS.COMPLETED,
  WORKFLOW_STATUS.REJECTED,
];

export function isWorkflowStatus(v: unknown): v is WorkflowStatus {
  return (
    typeof v === "string" &&
    (Object.values(WORKFLOW_STATUS) as string[]).includes(v)
  );
}

/** Actions legally available from a state (ignoring permissions). */
export function allowedActions(status: WorkflowStatus): WorkflowAction[] {
  return Object.keys(TRANSITIONS[status] ?? {}) as WorkflowAction[];
}

/** The request-queue views surfaced in the UI. */
export const WORKFLOW_VIEWS = [
  "list",
  "mine",
  "pending",
  "completed",
  "rejected",
] as const;
export type WorkflowView = (typeof WORKFLOW_VIEWS)[number];

export interface WorkflowTransitionRecord {
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
  /** Actions this caller may actually perform (legal AND permitted). */
  availableActions: WorkflowAction[];
  history: WorkflowTransitionRecord[];
}

/**
 * Approved, under either name.
 *
 * Every gate that means "work may start" must accept both, or a request written
 * before the rename would have its board locked.
 */
export function isApproved(status: WorkflowStatus | string | null): boolean {
  return (
    status === WORKFLOW_STATUS.APPROVED ||
    status === WORKFLOW_STATUS.PENDING_DEVELOPMENT
  );
}
