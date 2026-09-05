// Product proposal flow: the complete state machine.
//
//   raised -> First reviewer -> Final approver -> Approved
//                  |                  |
//                  +-- declined       +-- declined
//
// Two tiers, both configurable people rather than roles.
//
// ── Why there is no `awaiting_information` status ──
//
// The original sketch had one, with the proposal moving there while a question
// was outstanding and moving back once answered. Building it that way turned out
// to be wrong for two reasons:
//
//   1. The return target could not be expressed declaratively. Both tiers can
//      ask, so `pass` from `awaiting_information` would have to resolve to
//      either the final-approval stage or `approved` depending on who asked.
//      That is computed routing, which is exactly what this design avoids.
//
//   2. It hid where the proposal actually was. "Awaiting Information" does not
//      say whether it is with the first reviewer or the final approver, which is
//      the thing a queue most needs to convey.
//
// So asking a question does NOT move the proposal. It stays with whoever asked,
// and open questions are tracked in `proposal_information_requests`. "Waiting on
// 2 answers" is derived from that table, and is strictly more informative than a
// status would be. It also means the reviewer is never blocked: they can decide
// while questions are still open if they already have enough to go on.

export const PROPOSAL_STATUS = {
  /**
   * In flight: awaiting a stage of the configured approval chain.
   *
   * WHICH stage is `currentStepOrder` plus the snapshotted decision rows, not a
   * status. Before chains there was a status per tier, which stopped working the
   * moment the number of tiers became an administrator's choice: a fixed enum
   * cannot name stage 4 of 6.
   */
  PENDING_APPROVAL: "pending_approval",
  APPROVED: "approved",
  DECLINED: "declined",

  /**
   * The two fixed tiers this flow had before chains. Retained ONLY so rows
   * written then still read correctly; nothing new is ever written with these.
   * Both mean the same thing as `PENDING_APPROVAL`.
   */
  PENDING_PM_REVIEW: "pending_pm_review",
  PENDING_CEO_APPROVAL: "pending_ceo_approval",
} as const;

export type ProposalStatus =
  (typeof PROPOSAL_STATUS)[keyof typeof PROPOSAL_STATUS];

export const PROPOSAL_STATUS_LABELS: Record<ProposalStatus, string> = {
  [PROPOSAL_STATUS.PENDING_APPROVAL]: "Pending Approval",
  [PROPOSAL_STATUS.APPROVED]: "Approved",
  [PROPOSAL_STATUS.DECLINED]: "Declined",
  // Legacy rows keep the wording they were shown with.
  [PROPOSAL_STATUS.PENDING_PM_REVIEW]: "Pending Review",
  [PROPOSAL_STATUS.PENDING_CEO_APPROVAL]: "Pending Final Approval",
};

/**
 * Statuses that mean "somebody still owes a decision".
 *
 * The two legacy values are in here, which is what lets a proposal raised before
 * chains carry on being decided instead of stalling.
 */
export const IN_FLIGHT_STATUSES: ProposalStatus[] = [
  PROPOSAL_STATUS.PENDING_APPROVAL,
  PROPOSAL_STATUS.PENDING_PM_REVIEW,
  PROPOSAL_STATUS.PENDING_CEO_APPROVAL,
];

export function isInFlight(status: ProposalStatus): boolean {
  return IN_FLIGHT_STATUSES.includes(status);
}

/**
 * The decision a reviewer records. Presented as one control with three mutually
 * exclusive options.
 *
 * `QUESTION` is the odd one out: it is a decision the reviewer makes, but it
 * changes no status. It is listed here because it belongs to the same control,
 * and separated from the state machine below because it moves nothing.
 */
export const PROPOSAL_CHOICE = {
  PASS: "pass",
  DECLINE: "decline",
  QUESTION: "question",
} as const;
export type ProposalChoice =
  (typeof PROPOSAL_CHOICE)[keyof typeof PROPOSAL_CHOICE];

/**
 * Outcomes that move a proposal between STATUSES.
 *
 * Note these are outcomes, not the reviewer's choice. A reviewer picks `pass`;
 * whether that becomes `ADVANCE` (another stage owes a decision) or `FINALISE`
 * (the chain is exhausted) is reported by the chain engine, not computed from
 * the status. That keeps this table positional: no entry here depends on
 * anything but the current status and the outcome.
 */
export const PROPOSAL_ACTION = {
  /** The chain moved to a later stage. The status does not change. */
  ADVANCE: "advance",
  /** Every stage approved. */
  FINALISE: "finalise",
  DECLINE: "decline",
} as const;
export type ProposalAction =
  (typeof PROPOSAL_ACTION)[keyof typeof PROPOSAL_ACTION];

/** What a reviewer records. Maps onto the outcomes above via the chain. */
export const PROPOSAL_DECISION = {
  PASS: "pass",
  DECLINE: "decline",
} as const;
export type ProposalDecisionInput =
  (typeof PROPOSAL_DECISION)[keyof typeof PROPOSAL_DECISION];

/**
 * The state machine. `TRANSITIONS[from][action] = to`.
 *
 * Anything absent is illegal. There is no implicit fallthrough, so a stage
 * cannot be skipped and a terminal status cannot be left. Routing is positional
 * and never computed: no entry here depends on anything but the current status
 * and the action.
 */
const IN_FLIGHT_TRANSITIONS: Partial<Record<ProposalAction, ProposalStatus>> = {
  // Moving between stages is the chain's business, so the status stays put.
  [PROPOSAL_ACTION.ADVANCE]: PROPOSAL_STATUS.PENDING_APPROVAL,
  [PROPOSAL_ACTION.FINALISE]: PROPOSAL_STATUS.APPROVED,
  [PROPOSAL_ACTION.DECLINE]: PROPOSAL_STATUS.DECLINED,
};

export const TRANSITIONS: Partial<
  Record<ProposalStatus, Partial<Record<ProposalAction, ProposalStatus>>>
> = {
  [PROPOSAL_STATUS.PENDING_APPROVAL]: IN_FLIGHT_TRANSITIONS,
  // A legacy row is in flight, so it admits exactly the same outcomes. Landing
  // on `pending_approval` is also what quietly migrates it forward.
  [PROPOSAL_STATUS.PENDING_PM_REVIEW]: IN_FLIGHT_TRANSITIONS,
  [PROPOSAL_STATUS.PENDING_CEO_APPROVAL]: IN_FLIGHT_TRANSITIONS,
  // `approved` and `declined` are terminal. A declined proposal is not
  // reopenable: the requester raises a fresh one, which keeps each decision
  // attached to what was actually decided on.
};

export const TERMINAL_STATUSES: ProposalStatus[] = [
  PROPOSAL_STATUS.APPROVED,
  PROPOSAL_STATUS.DECLINED,
];

/** What the proposal is about. A label for filtering, never for routing. */
export const PROPOSAL_TYPES = ["idea", "change_request", "other"] as const;
export type ProposalType = (typeof PROPOSAL_TYPES)[number];

export const PROPOSAL_TYPE_LABELS: Record<ProposalType, string> = {
  idea: "Idea",
  change_request: "Change Request",
  other: "Other",
};

export function isProposalStatus(v: unknown): v is ProposalStatus {
  return (
    typeof v === "string" &&
    (Object.values(PROPOSAL_STATUS) as string[]).includes(v)
  );
}

/** Outcomes legally reachable from a status, ignoring who is asking. */
export function allowedActions(status: ProposalStatus): ProposalAction[] {
  return Object.keys(TRANSITIONS[status] ?? {}) as ProposalAction[];
}

/**
 * What a reviewer may choose from a status. `pass` covers both ADVANCE and
 * FINALISE, because from the reviewer's side they are one button.
 */
export function allowedDecisions(
  status: ProposalStatus,
): ProposalDecisionInput[] {
  if (!isInFlight(status)) return [];
  return [PROPOSAL_DECISION.PASS, PROPOSAL_DECISION.DECLINE];
}

/** The queue views surfaced in the UI. */
export const PROPOSAL_VIEWS = [
  "list",
  "mine",
  "pending",
  "answering",
  "approved",
  "declined",
] as const;
export type ProposalView = (typeof PROPOSAL_VIEWS)[number];
