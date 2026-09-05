import { logger } from "@/common/utils/logger";
import type { WorkflowStatus } from "@/modules/projects/workflow/workflow.types";
import { WORKFLOW_STATUS_LABELS } from "@/modules/projects/workflow/workflow.types";
import { workflowEmailService } from "@/modules/projects/workflow/workflow-email.service";
// Direct service import, NOT the `@/modules/push` barrel: that barrel also
// exports the controller, so importing it from a service pulls Express and the
// auth guard into every consumer. Matches how `chainService` is imported here.
import { pushService } from "@/modules/push/push.service";

// Web Push for project approval transitions.
//
// The first — and for now only — business producer wired to push. Three things
// make it safe to sit beside a business transaction:
//
//   1. It is called AFTER the transaction commits, from the same place the
//      email fan-out is called. A rolled-back transition notifies nobody.
//   2. It never throws. `pushService.sendToUsers` already swallows delivery
//      errors, and this adds a second guard around recipient resolution, so an
//      approval can never fail because a push service is unreachable.
//   3. Recipients come from `workflowEmailService.transitionRecipientIds()` —
//      the SAME rule email uses. Push does not decide who is entitled to know
//      anything; if the rule changes, both channels change together.

/**
 * What the device shows.
 *
 * Deliberately generic. A lock-screen banner is visible to anyone holding the
 * phone, so it says that something needs attention and never what: not the
 * project name, not the requester, not the comment, not the decision. Those are
 * one authenticated tap away.
 *
 * The project name is genuinely tempting here and is deliberately left out —
 * "Q3 redundancy programme" on a lock screen is exactly the leak this avoids.
 */
function bodyFor(status: WorkflowStatus): string {
  switch (status) {
    case "rejected":
      return "A request you raised has been decided.";
    case "completed":
      return "A request you raised has been completed.";
    default:
      return "A request is waiting for your decision.";
  }
}

function titleFor(status: WorkflowStatus): string {
  return status === "rejected" || status === "completed"
    ? "Request update"
    : "Approval required";
}

export class WorkflowPushService {
  /**
   * Fires after a workflow transition has committed.
   *
   * `transitionId` becomes the notification tag, so a device that receives two
   * pushes for the same transition — a retry, or two tabs — collapses them into
   * one banner rather than stacking. It reuses the existing transition id
   * rather than minting a second event-id scheme.
   */
  async onTransition(input: {
    projectId: string;
    transitionId: string;
    toStatus: WorkflowStatus;
    escalatedToId?: string | null;
    /** Excluded from delivery: nobody needs telling about their own click. */
    actorId: string;
  }): Promise<void> {
    try {
      const recipientIds = await workflowEmailService.transitionRecipientIds({
        projectId: input.projectId,
        toStatus: input.toStatus,
        escalatedToId: input.escalatedToId,
      });

      const targets = recipientIds.filter((id) => id !== input.actorId);
      if (targets.length === 0) return;

      await pushService.sendToUsers(targets, {
        title: titleFor(input.toStatus),
        body: bodyFor(input.toStatus),
        // The existing request detail page — where the approve/reject controls
        // are. `/projects/:id` is the delivery BOARD, a different page: an
        // approver who taps "a request is waiting for your decision" would land
        // on a kanban with no decision on it. This is the same route the
        // approval emails and the one-click email action already use, so every
        // surface arrives at the same place. Not a new route, and root-relative
        // so it passes validation on the server and again in the worker.
        url: `/projects/requests/${input.projectId}`,
        notificationId: input.transitionId,
        tag: `workflow-${input.transitionId}`,
      });
    } catch (error) {
      // Never rethrow. The approval already happened; failing here would be
      // reporting an error for something that succeeded.
      logger.warn("Workflow push notification failed (transition unaffected)", {
        projectId: input.projectId,
        toStatus: WORKFLOW_STATUS_LABELS[input.toStatus] ?? input.toStatus,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }
}

export const workflowPushService = new WorkflowPushService();
