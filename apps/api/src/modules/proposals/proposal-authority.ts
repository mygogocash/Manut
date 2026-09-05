import { PERMISSIONS } from "@/common/constants/permissions";
import {
  isInFlight,
  type ProposalStatus,
  TERMINAL_STATUSES,
} from "@/modules/proposals/proposal.types";

// Single source of truth for who may do what to a proposal, and when.
//
// Two gates must BOTH pass:
//   1. PERMISSION: does the caller's role grant this capability at all?
//   2. RULE: is it allowed for this proposal, in this status, by this person?
//
// Keeping both in one table is what makes the "cannot" rules enforceable rather
// than merely documented. Nothing else in the module decides access.

export const CAPABILITY = {
  // Anyone
  CREATE: "create",
  VIEW: "view",
  // Requester
  EDIT: "edit",
  /**
   * Decide the stage the proposal is currently waiting at.
   *
   * One capability rather than one per tier. There used to be two, keyed to the
   * two fixed stages; once the number of stages became configurable, a
   * capability per stage stopped being expressible.
   */
  DECIDE: "decide",
  /** Ask someone for information. Held by whoever can decide at this stage. */
  ASK_INFORMATION: "ask_information",
  /**
   * Answer a question. Held by the person it was assigned to, and by nobody
   * else, so it maps to no permission code. See the null entry below.
   */
  PROVIDE_INFORMATION: "provide_information",
} as const;
export type Capability = (typeof CAPABILITY)[keyof typeof CAPABILITY];

/**
 * The permission code each capability requires.
 *
 * `null` means no code gates it. Used for two different reasons, worth keeping
 * distinct in your head:
 *   - `PROVIDE_INFORMATION`: authority is identity, not permission. Gate 2 checks
 *     `isInformationAssignee`.
 *   - `ASK_INFORMATION`: the code depends on which stage the proposal is at, so
 *     it cannot be a constant. Gate 2 defers to the stage decision.
 */
const CAPABILITY_PERMISSION: Record<Capability, string | null> = {
  [CAPABILITY.CREATE]: PERMISSIONS.PROPOSALS_CREATE,
  [CAPABILITY.VIEW]: PERMISSIONS.PROPOSALS_READ,
  [CAPABILITY.EDIT]: PERMISSIONS.PROPOSALS_CREATE,
  // Deciding is identity, not permission: it belongs to whoever the current
  // stage of the chain names. A code cannot express that, and a code that could
  // decide ANY stage would defeat the point of configuring stages at all.
  [CAPABILITY.DECIDE]: null,
  [CAPABILITY.ASK_INFORMATION]: null,
  [CAPABILITY.PROVIDE_INFORMATION]: null,
};

/**
 * What an administrator should grant each role. Documentation and a test
 * fixture, not a runtime check.
 *
 * There is no longer a role that grants the power to decide. Being named on a
 * stage of the chain is what grants it, so an administrator configures the chain
 * instead of granting a code — which is the whole point of the chain being
 * configurable. `proposals:review` and `proposals:approve` remain registered
 * codes for continuity with roles that already hold them, but they no longer
 * confer stage authority on their own.
 */
export const ROLE_PERMISSION_MATRIX: Record<string, string[]> = {
  Employee: [PERMISSIONS.PROPOSALS_READ, PERMISSIONS.PROPOSALS_CREATE],
};

export interface AuthorityContext {
  /** The caller's resolved permission codes. */
  permissions: string[];
  /** Current status of the proposal. */
  status: ProposalStatus;
  /** Did the caller raise this proposal? */
  isRequester?: boolean;
  /**
   * Is the caller the person a still-open question was assigned to? The only
   * way to hold PROVIDE_INFORMATION.
   */
  isInformationAssignee?: boolean;
  /**
   * May the caller decide the stage this proposal is waiting at?
   *
   * Supplied by the chain engine rather than derived here, so this module stays
   * a pure function of its inputs and the engine remains the single place that
   * knows what a chain says.
   */
  canDecideStage?: boolean;
  /**
   * Is the proposal still at the FIRST stage of its chain? The requester's edit
   * window: once any stage has decided, the version that was reviewed has to
   * stay fixed.
   */
  isFirstStage?: boolean;
}

export interface AuthorityDecision {
  allowed: boolean;
  reason?: string;
}

function holds(ctx: AuthorityContext, code: string | null): boolean {
  if (code === null) return true;
  // `projects:manage` is the administrative super-grant already used across the
  // Project CRM; Admin receives every code from the permission resolver.
  return (
    ctx.permissions.includes(code) ||
    ctx.permissions.includes(PERMISSIONS.PROJECTS_MANAGE)
  );
}

/**
 * Can this caller decide at the proposal's current stage?
 *
 * Two things must hold: the proposal is still in flight, and the chain says this
 * person owns the pending stage. The module super-grant also satisfies it, so a
 * chain whose approver has left can still be unstuck.
 */
export function canDecideAtStage(ctx: AuthorityContext): boolean {
  if (!isInFlight(ctx.status)) return false;
  if (ctx.permissions.includes(PERMISSIONS.PROJECTS_MANAGE)) return true;
  return ctx.canDecideStage === true;
}

/**
 * The authority check. Returns the reason a request was refused so callers can
 * surface something accurate instead of a bare 403.
 */
export function can(
  capability: Capability,
  ctx: AuthorityContext,
): AuthorityDecision {
  // Gate 1: permission.
  if (!holds(ctx, CAPABILITY_PERMISSION[capability])) {
    return { allowed: false, reason: "Your role does not permit this action" };
  }

  const terminal = TERMINAL_STATUSES.includes(ctx.status);

  // Gate 2: status and identity rules.
  switch (capability) {
    case CAPABILITY.CREATE:
    case CAPABILITY.VIEW:
      return { allowed: true };

    // The requester may correct their proposal while it is still with the first
    // reviewer. Once it has passed to the final approver, the version that was
    // reviewed has to stay fixed.
    case CAPABILITY.EDIT:
      // A decided proposal is fixed. Without this, a completed chain leaves no
      // pending decision, `currentOrder` is null, and `isFirstStage` collapses
      // to true — so the requester could rewrite an approved or declined
      // proposal, and `update()` writes neither a transition nor an audit row.
      if (terminal) {
        return {
          allowed: false,
          reason: "This proposal has already been decided",
        };
      }
      if (!ctx.isFirstStage) {
        return {
          allowed: false,
          reason:
            "A proposal can only be edited before the first stage has decided",
        };
      }
      if (!ctx.isRequester) {
        return {
          allowed: false,
          reason: "Only the person who raised this proposal can edit it",
        };
      }
      return { allowed: true };

    case CAPABILITY.DECIDE:
      if (terminal) {
        return {
          allowed: false,
          reason: "This proposal has already been decided",
        };
      }
      return canDecideAtStage(ctx)
        ? { allowed: true }
        : {
            allowed: false,
            reason: "This stage of the approval chain is not yours to decide",
          };

    // Asking for information is part of deciding, so it carries the same
    // authority as the decision at this stage rather than a code of its own.
    // Terminal proposals admit no questions: there is nothing left to inform.
    case CAPABILITY.ASK_INFORMATION:
      if (terminal) {
        return {
          allowed: false,
          reason: "This proposal has already been decided",
        };
      }
      return canDecideAtStage(ctx)
        ? { allowed: true }
        : {
            allowed: false,
            reason: "Only the reviewer at this stage can ask for information",
          };

    // Identity, not permission. Being asked is what grants this, so holding
    // every proposal code does not let someone answer on another person's
    // behalf: an answer recorded against the wrong name is worse than an
    // unanswered question.
    case CAPABILITY.PROVIDE_INFORMATION:
      return ctx.isInformationAssignee
        ? { allowed: true }
        : {
            allowed: false,
            reason: "This question was asked of someone else",
          };

    default:
      return { allowed: false, reason: "Unknown capability" };
  }
}
