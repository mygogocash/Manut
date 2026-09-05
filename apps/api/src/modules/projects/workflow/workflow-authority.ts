import { PERMISSIONS } from "@/common/constants/permissions";
import {
  isApproved,
  TERMINAL_STATUSES,
  WORKFLOW_STATUS,
  type WorkflowStatus,
} from "@/modules/projects/workflow/workflow.types";

// Single source of truth for "who may do what, and when" in the project
// request workflow.
//
// Two independent gates must BOTH pass:
//   1. PERMISSION — does the caller's role grant the capability at all?
//      (the "Permissions" list for each role)
//   2. RULE — is it allowed for this project, in this state, by this person?
//      (the "Cannot" list, plus stage and ownership constraints)
//
// Keeping both in one table is what makes the "Cannot" rules enforceable
// rather than merely documented. Nothing else in the workflow decides access.

export const CAPABILITY = {
  // Requester
  CREATE_REQUEST: "create_request",
  EDIT_DRAFT: "edit_draft",
  UPLOAD_ATTACHMENT: "upload_attachment",
  COMMENT: "comment",
  VIEW_HISTORY: "view_history",
  // Approval gates
  PM_DECIDE: "pm_decide",
  /**
   * Approve or reject a request the PM escalated. Held by the named target,
   * not by a role — see the null mapping below.
   */
  ESCALATED_DECIDE: "escalated_decide",
  // Project Manager operational authority
  EDIT_DETAILS: "edit_details",
  RETURN_TO_REQUESTER: "return_to_requester",
  REOPEN: "reopen",
  REASSIGN: "reassign",
  MODIFY_TIMELINE: "modify_timeline",
  MARK_COMPLETED: "mark_completed",
  ARCHIVE: "archive",
  ESCALATE: "escalate",
  VIEW_REPORTS: "view_reports",
  // Development team
  ASSIGN_TIMELINE: "assign_timeline",
  UPDATE_PROGRESS: "update_progress",
  UPLOAD_DELIVERABLE: "upload_deliverable",
} as const;
export type Capability = (typeof CAPABILITY)[keyof typeof CAPABILITY];

/**
 * The permission code each capability requires. `null` means the capability is
 * available to anyone who can see the project (commenting, viewing history) —
 * no role in the matrix is forbidden from those.
 */
const CAPABILITY_PERMISSION: Record<Capability, string | null> = {
  [CAPABILITY.CREATE_REQUEST]: PERMISSIONS.WORKFLOW_SUBMIT,
  [CAPABILITY.EDIT_DRAFT]: PERMISSIONS.WORKFLOW_SUBMIT,
  [CAPABILITY.UPLOAD_ATTACHMENT]: null,
  [CAPABILITY.COMMENT]: null,
  [CAPABILITY.VIEW_HISTORY]: null,

  [CAPABILITY.PM_DECIDE]: PERMISSIONS.WORKFLOW_PM_APPROVE,
  // Deliberately null: authority here is "the PM named you", which no
  // permission code can express. Gate 2 checks `isEscalationTarget`. Callers
  // must therefore always supply it — see can().
  [CAPABILITY.ESCALATED_DECIDE]: null,

  [CAPABILITY.EDIT_DETAILS]: PERMISSIONS.WORKFLOW_PM_APPROVE,
  [CAPABILITY.RETURN_TO_REQUESTER]: PERMISSIONS.WORKFLOW_RETURN,
  [CAPABILITY.REOPEN]: PERMISSIONS.WORKFLOW_REOPEN,
  [CAPABILITY.REASSIGN]: PERMISSIONS.WORKFLOW_REASSIGN,
  [CAPABILITY.MODIFY_TIMELINE]: PERMISSIONS.WORKFLOW_TIMELINE_MANAGE,
  [CAPABILITY.MARK_COMPLETED]: PERMISSIONS.WORKFLOW_COMPLETE,
  [CAPABILITY.ARCHIVE]: PERMISSIONS.WORKFLOW_ARCHIVE,
  [CAPABILITY.ESCALATE]: PERMISSIONS.WORKFLOW_ESCALATE,
  [CAPABILITY.VIEW_REPORTS]: PERMISSIONS.PROJECTS_READ_ALL,

  [CAPABILITY.ASSIGN_TIMELINE]: PERMISSIONS.WORKFLOW_TIMELINE_MANAGE,
  [CAPABILITY.UPDATE_PROGRESS]: PERMISSIONS.WORKFLOW_PROGRESS_UPDATE,
  [CAPABILITY.UPLOAD_DELIVERABLE]: PERMISSIONS.WORKFLOW_PROGRESS_UPDATE,
};

/**
 * The reference role → permission-code matrix. This is what an administrator
 * should grant each role; it is also what the seed/assignment guidance uses.
 * It is documentation + a fixture, not a runtime check — runtime access is
 * always decided by the caller's actual permission codes.
 */
export const ROLE_PERMISSION_MATRIX: Record<string, string[]> = {
  "Sales & Marketing": [
    PERMISSIONS.PROJECTS_READ,
    PERMISSIONS.PROJECTS_CREATE,
    PERMISSIONS.WORKFLOW_SUBMIT,
  ],
  "Project Manager": [
    PERMISSIONS.PROJECTS_READ,
    PERMISSIONS.PROJECTS_READ_ALL,
    PERMISSIONS.PROJECTS_CREATE,
    PERMISSIONS.PROJECTS_UPDATE,
    PERMISSIONS.WORKFLOW_SUBMIT,
    PERMISSIONS.WORKFLOW_PM_APPROVE,
    PERMISSIONS.WORKFLOW_COMPLETE,
    PERMISSIONS.WORKFLOW_RETURN,
    PERMISSIONS.WORKFLOW_REOPEN,
    PERMISSIONS.WORKFLOW_ARCHIVE,
    PERMISSIONS.WORKFLOW_ESCALATE,
    PERMISSIONS.WORKFLOW_REASSIGN,
    PERMISSIONS.WORKFLOW_TIMELINE_MANAGE,
    PERMISSIONS.WORKFLOW_PROGRESS_UPDATE,
  ],
  // Escalation targets need no workflow permission at all — being named by the
  // PM IS the authority. What they need is to SEE the request, hence read-all.
  // These two are kept as roles because they are real org roles and the likely
  // targets, but nothing in the state machine is bound to either name.
  "Business Head": [PERMISSIONS.PROJECTS_READ, PERMISSIONS.PROJECTS_READ_ALL],
  "Product Admin": [PERMISSIONS.PROJECTS_READ, PERMISSIONS.PROJECTS_READ_ALL],
  "Development Team": [
    PERMISSIONS.PROJECTS_READ,
    PERMISSIONS.WORKFLOW_TIMELINE_MANAGE,
    PERMISSIONS.WORKFLOW_PROGRESS_UPDATE,
  ],
};

export interface AuthorityContext {
  /** The caller's resolved permission codes. */
  permissions: string[];
  /** Current workflow state of the project. */
  status: WorkflowStatus;
  /** Is the caller the project owner (the PM who owns the request)? */
  isOwner?: boolean;
  /** Did the caller raise this request? */
  isRequester?: boolean;
  /** Is the project archived? */
  isArchived?: boolean;
  /**
   * Is the caller the person the PM escalated to? The only way to hold
   * ESCALATED_DECIDE — there is no permission code for it.
   */
  isEscalationTarget?: boolean;
}

export interface AuthorityDecision {
  allowed: boolean;
  reason?: string;
}

function holds(ctx: AuthorityContext, code: string | null): boolean {
  if (code === null) return true;
  // `projects:manage` is the administrative super-grant already used across
  // the Project CRM; Admin receives every code from the permission resolver.
  return (
    ctx.permissions.includes(code) ||
    ctx.permissions.includes(PERMISSIONS.PROJECTS_MANAGE)
  );
}

/** Does the caller hold the Project Manager authority for this workflow? */
export function isProjectManager(permissions: string[]): boolean {
  return (
    permissions.includes(PERMISSIONS.WORKFLOW_PM_APPROVE) ||
    permissions.includes(PERMISSIONS.PROJECTS_MANAGE)
  );
}

/**
 * The authority check. Returns a decision plus the reason it was refused, so
 * callers surface an accurate message instead of a generic 403.
 */
export function can(
  capability: Capability,
  ctx: AuthorityContext,
): AuthorityDecision {
  // Gate 1 — permission.
  if (!holds(ctx, CAPABILITY_PERMISSION[capability])) {
    return { allowed: false, reason: "Your role does not permit this action" };
  }

  const terminal = TERMINAL_STATUSES.includes(ctx.status);
  const pm = isProjectManager(ctx.permissions);

  // Gate 2 — state / ownership rules (the "Cannot" lists).
  switch (capability) {
    // An archived project is read-only for everyone.
    case CAPABILITY.EDIT_DRAFT:
    case CAPABILITY.EDIT_DETAILS:
    case CAPABILITY.PM_DECIDE:
    case CAPABILITY.ESCALATED_DECIDE:
    case CAPABILITY.RETURN_TO_REQUESTER:
    case CAPABILITY.MODIFY_TIMELINE:
    case CAPABILITY.ASSIGN_TIMELINE:
    case CAPABILITY.UPDATE_PROGRESS:
    case CAPABILITY.MARK_COMPLETED:
      if (ctx.isArchived) {
        return { allowed: false, reason: "This project is archived" };
      }
      break;
    default:
      break;
  }

  switch (capability) {
    // Sales & Marketing may only edit their request BEFORE submission. The PM,
    // as workflow owner, may edit details at any point up to completion.
    case CAPABILITY.EDIT_DRAFT:
      // Creating a project submits it immediately, so a requester would
      // otherwise never get a chance to edit. They keep the ability while it is
      // still sitting with the PM — once the PM has acted on it, the version
      // they reviewed has to stay fixed.
      if (
        ctx.status === WORKFLOW_STATUS.DRAFT ||
        (ctx.status === WORKFLOW_STATUS.PENDING_PM_APPROVAL &&
          (ctx.isRequester || ctx.isOwner))
      ) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason:
          "A request can only be edited before the Project Manager has acted on it",
      };

    case CAPABILITY.EDIT_DETAILS:
      if (terminal) {
        return {
          allowed: false,
          reason: "A completed or rejected request can no longer be edited",
        };
      }
      return { allowed: true };

    // Approval gates are stage-bound.
    case CAPABILITY.PM_DECIDE:
      return ctx.status === WORKFLOW_STATUS.PENDING_PM_APPROVAL
        ? { allowed: true }
        : { allowed: false, reason: "This request is not at the PM stage" };

    // An escalated request may be decided ONLY by the person the PM named.
    // Holding workflow:pm-approve is not enough: if the PM could also sign off
    // their own escalation, escalating would mean nothing.
    case CAPABILITY.ESCALATED_DECIDE:
      if (ctx.status !== WORKFLOW_STATUS.PENDING_ESCALATION) {
        return {
          allowed: false,
          reason: "This request has not been escalated",
        };
      }
      return ctx.isEscalationTarget
        ? { allowed: true }
        : {
            allowed: false,
            reason: "This request was escalated to someone else",
          };

    // The PM bounces a request back to the requester while it sits with them;
    // an escalation target hands it back to the PM without deciding.
    case CAPABILITY.RETURN_TO_REQUESTER:
      if (ctx.status === WORKFLOW_STATUS.PENDING_PM_APPROVAL) {
        return { allowed: true };
      }
      if (
        ctx.status === WORKFLOW_STATUS.PENDING_ESCALATION &&
        ctx.isEscalationTarget
      ) {
        return { allowed: true };
      }
      return {
        allowed: false,
        reason: "This request cannot be returned from its current stage",
      };

    case CAPABILITY.REOPEN:
      return ctx.status === WORKFLOW_STATUS.REJECTED
        ? { allowed: true }
        : { allowed: false, reason: "Only a rejected request can be reopened" };

    // Development assigns the expected completion date once the work reaches
    // them; the PM may adjust it at any live stage.
    case CAPABILITY.ASSIGN_TIMELINE:
      if (pm) return { allowed: true };
      return isApproved(ctx.status)
        ? { allowed: true }
        : {
            allowed: false,
            reason:
              "A timeline can only be set once the project is in development",
          };

    case CAPABILITY.MODIFY_TIMELINE:
      if (terminal) {
        return {
          allowed: false,
          reason: "The timeline of a closed request cannot be changed",
        };
      }
      return { allowed: true };

    case CAPABILITY.UPDATE_PROGRESS:
    case CAPABILITY.UPLOAD_DELIVERABLE:
      if (pm) return { allowed: true };
      return isApproved(ctx.status)
        ? { allowed: true }
        : {
            allowed: false,
            reason:
              "Progress can only be updated while the project is in development",
          };

    // Closing the project is the PM's, and only from development.
    case CAPABILITY.MARK_COMPLETED:
      return isApproved(ctx.status)
        ? { allowed: true }
        : {
            allowed: false,
            reason: "Only a project in development can be marked completed",
          };

    case CAPABILITY.ARCHIVE:
      if (ctx.isArchived) {
        return { allowed: false, reason: "This project is already archived" };
      }
      return { allowed: true };

    case CAPABILITY.CREATE_REQUEST:
    case CAPABILITY.UPLOAD_ATTACHMENT:
    case CAPABILITY.COMMENT:
    case CAPABILITY.VIEW_HISTORY:
    case CAPABILITY.VIEW_REPORTS:
    case CAPABILITY.ESCALATE:
    case CAPABILITY.REASSIGN:
      return { allowed: true };

    default:
      return { allowed: false, reason: "Unknown capability" };
  }
}
