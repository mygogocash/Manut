// Configurable approval chains for the Project CRM.
//
// ── What a chain is, and what it is not ──
//
// A chain is an ordered list of stages, each naming one person, covering the
// APPROVAL SEGMENT of a record's life: submitted → stage 1 → … → stage N →
// approved. That part is genuinely linear, so it is data.
//
// It is not the whole lifecycle. The project request flow also has `escalate`
// (routes to somebody the PM names per request, so the target is data on the
// row, not configuration), `return` (backwards), `reopen` (revives a rejected
// record) and `complete` (after approval). None of those are "the next step in
// an order", so they stay coded transitions in `workflow.types.ts`. A chain that
// tried to express them would be a graph pretending to be a list.

/**
 * The registered scopes. This union is the boundary of the feature.
 *
 * Only the Project CRM uses chains. Travel, leave, expenses, cash advance and
 * payroll keep their own `*_approval_steps` tables and their own HR/Finance
 * permissions, deliberately untouched. Adding a scope here is not enough to
 * adopt this elsewhere: that module's submit path, authority checks and UI would
 * all have to move too, which is its own decision.
 */
export const CHAIN_SCOPE = {
  PROJECT_REQUEST: "project_request",
  PROPOSAL: "proposal",
} as const;

export type ChainScope = (typeof CHAIN_SCOPE)[keyof typeof CHAIN_SCOPE];

/** Tuple, not an array: `z.enum` needs a non-empty literal tuple to infer from. */
export const CHAIN_SCOPES = [
  CHAIN_SCOPE.PROJECT_REQUEST,
  CHAIN_SCOPE.PROPOSAL,
] as const satisfies readonly [ChainScope, ...ChainScope[]];

export function isChainScope(value: unknown): value is ChainScope {
  return (
    typeof value === "string" &&
    (CHAIN_SCOPES as readonly string[]).includes(value)
  );
}

export const CHAIN_SCOPE_LABELS: Record<ChainScope, string> = {
  [CHAIN_SCOPE.PROJECT_REQUEST]: "Project requests",
  [CHAIN_SCOPE.PROPOSAL]: "Proposals",
};

/** State of one stage on one record. */
export const DECISION_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
  /**
   * The stage did not apply. Recorded rather than omitted, so the history shows
   * the whole chain including what was bypassed.
   */
  SKIPPED: "skipped",
} as const;

export type DecisionStatus =
  (typeof DECISION_STATUS)[keyof typeof DECISION_STATUS];

/** A stage as configured. `approver` is null when nobody resolves. */
export interface ChainStepView {
  id: string;
  order: number;
  name: string;
  description: string | null;
  approver: { id: string; name: string; email: string } | null;
  /**
   * True when a person IS configured but no longer resolves — deactivated, or
   * deleted. Distinct from "never configured", because the two need different
   * things from an administrator.
   */
  approverMissing: boolean;
  isActive: boolean;
  /**
   * Part of the flow as originally decided, so it cannot be removed or parked —
   * only renamed and reassigned. See the note on the model.
   */
  isSystem: boolean;
}

export interface ChainView {
  id: string;
  scope: ChainScope;
  name: string;
  description: string | null;
  isActive: boolean;
  steps: ChainStepView[];
}

/** One stage on one record, as snapshotted. */
export interface DecisionView {
  id: string;
  order: number;
  name: string;
  status: DecisionStatus;
  approver: { id: string; name: string; email: string } | null;
  decidedBy: { id: string; name: string; email: string } | null;
  decidedAt: string | null;
  notes: string | null;
}

/**
 * Where a record is in its chain.
 *
 * `currentOrder` null with `isComplete` true means every stage approved.
 * `currentOrder` null with `isComplete` false means the record has no snapshot
 * at all, which is how every record that predates chains reads — those follow
 * the module's coded default rather than being treated as approved.
 */
export interface ChainProgress {
  currentOrder: number | null;
  isComplete: boolean;
  isRejected: boolean;
  totalStages: number;
  decisions: DecisionView[];
}

/** Upper bound on stages, so a runaway config cannot make a record unapprovable. */
export const MAX_CHAIN_STEPS = 20;
